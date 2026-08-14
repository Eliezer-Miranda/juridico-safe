import { db, type Quote, type FinTx, type QuoteStatus } from "./db";

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
  opts: { accountId?: number; category?: string; acceptedBy?: string },
): Promise<number[]> => {
  if (!quote.id) throw new Error("Quote sem id");
  const kind: "receber" | "pagar" = quote.partyKind === "cliente" ? "receber" : "pagar";
  const now = new Date().toISOString();
  const category = opts.category ?? (kind === "receber" ? "Vendas" : "Compras");
  const schedule = await buildQuoteSchedule(quote);
  const cond = quote.paymentConditionId
    ? await db.paymentConditions.get(quote.paymentConditionId)
    : null;
  const actor = opts.acceptedBy?.trim() || "Operador";
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

  const originLabel = cond
    ? `Condição: ${cond.name} (${cond.installments}x a cada ${cond.intervalDays}d${cond.downPaymentPct ? `, entrada ${cond.downPaymentPct}%` : ""})`
    : `Condição manual: ${quote.installmentsCount}x mensal`;

  const scheduleLines = schedule
    .map((s) => `${s.label} — venc. ${s.dueDate} — R$ ${s.amount.toFixed(2)}`)
    .join(" | ");

  const baseDesc =
    `Aceito por ${actor}. ${originLabel}. ${kind === "receber" ? "A Receber" : "A Pagar"} geradas (${schedule.length}): ${scheduleLines}`;

  const quoteHist = quote.history ?? [];
  quoteHist.push({ at: now, description: baseDesc });

  await db.quotes.update(quote.id, {
    status: "faturado",
    linkedTxIds: ids,
    acceptedAt: now,
    acceptedBy: actor,
    history: quoteHist,
    updatedAt: now,
  });

  if (quote.projectId) {
    const proj = await db.projects.get(quote.projectId);
    if (proj) {
      const projHist = proj.history ?? [];
      projHist.push({
        at: now,
        description: `Orçamento ${quote.number} aceito por ${actor}. ${originLabel}. ${schedule.length} parcela(s) → ${kind === "receber" ? "A Receber" : "A Pagar"}: ${scheduleLines}`,
      });
      await db.projects.update(quote.projectId, { history: projHist, updatedAt: now });
    }
  }

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

/** Workflow: pipeline order used by the proposal/quote status tracker. */
export const QUOTE_PIPELINE: Array<{ status: QuoteStatus; label: string; hint: string }> = [
  { status: "rascunho", label: "Rascunho", hint: "Em elaboração" },
  { status: "enviado", label: "Enviada", hint: "Enviada ao cliente/fornecedor" },
  { status: "aprovado", label: "Aprovada", hint: "Aceita pela contraparte" },
  { status: "faturado", label: "Convertida", hint: "Parcelas geradas no financeiro" },
];

/** Updates the quote status, registering who/when in the history. */
export const setQuoteStatus = async (
  quote: Quote,
  status: QuoteStatus,
  actor?: string,
) => {
  if (!quote.id) throw new Error("Quote sem id");
  const now = new Date().toISOString();
  const hist = quote.history ?? [];
  hist.push({
    at: now,
    description: `Status alterado de "${QUOTE_STATUS_LABEL[quote.status] ?? quote.status}" para "${QUOTE_STATUS_LABEL[status] ?? status}"${actor ? ` por ${actor}` : ""}.`,
  });
  const patch: Partial<Quote> = { status, history: hist, updatedAt: now };
  if (status === "enviado" && !quote.sentAt) patch.sentAt = now;
  if (status === "aprovado" && !quote.acceptedAt) {
    patch.acceptedAt = now;
    patch.acceptedBy = actor ?? quote.acceptedBy;
  }
  await db.quotes.update(quote.id, patch);
};

/** Links (or unlinks when contractId is null) a quote/proposal to an existing contract. */
export const linkQuoteToContract = async (
  quote: Quote,
  contractId: number | null,
  actor?: string,
) => {
  if (!quote.id) throw new Error("Quote sem id");
  const now = new Date().toISOString();
  const contract = contractId ? await db.contracts.get(contractId) : null;
  if (contractId && !contract) throw new Error("Contrato não encontrado");

  const hist = quote.history ?? [];
  hist.push({
    at: now,
    description: contract
      ? `Proposta vinculada ao contrato ${contract.number}${actor ? ` por ${actor}` : ""}.`
      : `Vínculo com contrato removido${actor ? ` por ${actor}` : ""}.`,
  });
  await db.quotes.update(quote.id, {
    contractId: contractId ?? undefined,
    history: hist,
    updatedAt: now,
  });

  if (contract?.id) {
    const chist = contract.history ?? [];
    chist.push({
      at: now,
      description: `Proposta/orçamento ${quote.number} vinculado (${QUOTE_STATUS_LABEL[quote.status] ?? quote.status}).`,
    });
    await db.contracts.update(contract.id, { history: chist, updatedAt: now });
  }

  // Detach: register the removal in the previously linked contract too.
  if (!contractId && quote.contractId) {
    const prev = await db.contracts.get(quote.contractId);
    if (prev?.id) {
      const phist = prev.history ?? [];
      phist.push({ at: now, description: `Proposta/orçamento ${quote.number} desvinculado.` });
      await db.contracts.update(prev.id, { history: phist, updatedAt: now });
    }
  }
};
