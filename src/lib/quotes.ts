import { db, type Quote, type FinTx } from "./db";

export const quoteSubtotal = (q: Pick<Quote, "items">) =>
  q.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

export const quoteTotal = (q: Pick<Quote, "items" | "discount">) =>
  Math.max(0, quoteSubtotal(q) - (Number(q.discount) || 0));

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  faturado: "Faturado",
};

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Generates parcels (FinTx) for the quote and marks it as "faturado".
 * - Cliente => contas a receber
 * - Fornecedor => contas a pagar
 */
export const generateFinTxFromQuote = async (
  quote: Quote,
  opts: { accountId?: number; category?: string },
): Promise<number[]> => {
  if (!quote.id) throw new Error("Quote sem id");
  const kind: "receber" | "pagar" = quote.partyKind === "cliente" ? "receber" : "pagar";
  const total = quote.total;
  const n = Math.max(1, quote.installmentsCount || 1);
  const base = Math.floor((total / n) * 100) / 100;
  const last = +(total - base * (n - 1)).toFixed(2);
  const firstDue = quote.firstDueDate || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const ids: number[] = [];
  const category = opts.category ?? (kind === "receber" ? "Vendas" : "Compras");

  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? last : base;
    const tx: FinTx = {
      kind,
      description: `${quote.number} — Parcela ${i + 1}/${n}`,
      category,
      accountId: opts.accountId,
      amount,
      dueDate: addMonths(firstDue, i),
      status: "pendente",
      recurrence: "nenhuma",
      partyId: quote.partyId,
      quoteId: quote.id,
      installmentInfo: `${i + 1}/${n}`,
      notes: `Gerado do orçamento ${quote.number}`,
      createdAt: now,
    };
    const id = (await db.finTx.add(tx)) as number;
    ids.push(id);
  }

  await db.quotes.update(quote.id, {
    status: "faturado",
    linkedTxIds: ids,
    updatedAt: now,
  });

  return ids;
};

export const removeFinTxFromQuote = async (quote: Quote) => {
  if (!quote.linkedTxIds?.length) return;
  // Only delete those still pending (never delete already-paid items)
  const txs = await db.finTx.bulkGet(quote.linkedTxIds);
  for (const t of txs) {
    if (t && t.id && t.status === "pendente") {
      await db.finTx.delete(t.id);
    }
  }
  await db.quotes.update(quote.id!, {
    status: "aprovado",
    linkedTxIds: [],
    updatedAt: new Date().toISOString(),
  });
};
