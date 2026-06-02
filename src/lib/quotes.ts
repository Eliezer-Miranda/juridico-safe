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

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScheduleEntry {
  label: string;
  amount: number;
  dueDate: string;
  installmentInfo: string;
}

/**
 * Builds the parcel schedule from a quote, honoring its payment condition when present.
 * - Down payment (entrada) becomes parcel 1 due on issueDate (or today).
 * - Remaining N installments spaced by intervalDays starting at firstDueDate.
 * - Without a condition, falls back to monthly intervals × installmentsCount.
 */
export const buildQuoteSchedule = async (quote: Quote): Promise<ScheduleEntry[]> => {
  const total = quote.total;
  const today = new Date().toISOString().slice(0, 10);
  const firstDue = quote.firstDueDate || today;

  const cond = quote.paymentConditionId
    ? await db.paymentConditions.get(quote.paymentConditionId)
    : null;

  const entries: ScheduleEntry[] = [];

  if (cond) {
    const n = Math.max(1, cond.installments);
    const downPct = Math.min(100, Math.max(0, cond.downPaymentPct ?? 0));
    const downAmount = round2((total * downPct) / 100);
    const remaining = round2(total - downAmount);
    const totalParcels = n + (downAmount > 0 ? 1 : 0);

    if (downAmount > 0) {
      entries.push({
        label: `Entrada`,
        amount: downAmount,
        dueDate: quote.issueDate || today,
        installmentInfo: `1/${totalParcels}`,
      });
    }

    const base = Math.floor((remaining / n) * 100) / 100;
    const last = round2(remaining - base * (n - 1));
    for (let i = 0; i < n; i++) {
      const idx = entries.length + 1;
      entries.push({
        label: `Parcela ${idx}/${totalParcels}`,
        amount: i === n - 1 ? last : base,
        dueDate: addDays(firstDue, i * cond.intervalDays),
        installmentInfo: `${idx}/${totalParcels}`,
      });
    }
    return entries;
  }

  // Fallback: monthly schedule based on installmentsCount
  const n = Math.max(1, quote.installmentsCount || 1);
  const base = Math.floor((total / n) * 100) / 100;
  const last = round2(total - base * (n - 1));
  for (let i = 0; i < n; i++) {
    entries.push({
      label: `Parcela ${i + 1}/${n}`,
      amount: i === n - 1 ? last : base,
      dueDate: addMonths(firstDue, i),
      installmentInfo: `${i + 1}/${n}`,
    });
  }
  return entries;
};

/**
 * Generates parcels (FinTx) for the quote and marks it as "faturado".
 * - Cliente => contas a receber
 * - Fornecedor => contas a pagar
 * Uses the linked payment condition to compute dates/values when present.
 */
export const generateFinTxFromQuote = async (
  quote: Quote,
  opts: { accountId?: number; category?: string },
): Promise<number[]> => {
  if (!quote.id) throw new Error("Quote sem id");
  const kind: "receber" | "pagar" = quote.partyKind === "cliente" ? "receber" : "pagar";
  const now = new Date().toISOString();
  const category = opts.category ?? (kind === "receber" ? "Vendas" : "Compras");
  const schedule = await buildQuoteSchedule(quote);
  const ids: number[] = [];

  for (const entry of schedule) {
    const tx: FinTx = {
      kind,
      description: `${quote.number} — ${entry.label}`,
      category,
      accountId: opts.accountId,
      amount: entry.amount,
      dueDate: entry.dueDate,
      status: "pendente",
      recurrence: "nenhuma",
      partyId: quote.partyId,
      quoteId: quote.id,
      projectId: quote.projectId,
      installmentInfo: entry.installmentInfo,
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
