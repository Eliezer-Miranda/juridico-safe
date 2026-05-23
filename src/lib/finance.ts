import { db, type Account, type FinTx, type Investment, type InvMovement } from "./db";

export const accountBalance = (acc: Account, txs: FinTx[], movs?: InvMovement[]) => {
  let bal = acc.openingBalance ?? 0;
  for (const t of txs) {
    if (t.status !== "pago" || t.paidAccountId !== acc.id) continue;
    const v = t.paidAmount ?? t.amount;
    bal += t.kind === "receber" ? v : -v;
  }
  if (movs && acc.kind === "investimento") {
    // Investment account aggregates contributions vs withdrawals/returns
    for (const m of movs) {
      if (m.kind === "aporte") bal += m.amount;
      else if (m.kind === "resgate") bal -= m.amount;
      else if (m.kind === "rendimento" || m.kind === "dividendo") bal += m.amount;
    }
  }
  return bal;
};

export const refreshFinTxStatus = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const list = await db.finTx.toArray();
  for (const t of list) {
    if (t.status === "pendente" && t.dueDate < today) {
      await db.finTx.update(t.id!, { status: "atraso" });
    }
  }
};

export const investmentValue = (inv: Investment) => inv.quantity * inv.currentPrice;
export const investmentCost = (inv: Investment) => inv.quantity * inv.avgPrice;
export const investmentPnL = (inv: Investment) => investmentValue(inv) - investmentCost(inv);
export const investmentPnLPct = (inv: Investment) => {
  const c = investmentCost(inv);
  return c > 0 ? (investmentPnL(inv) / c) * 100 : 0;
};

export const CATEGORIES_RECEIVE = [
  "Salário", "Freelance", "Vendas", "Aluguel recebido", "Rendimentos", "Reembolso", "Presente", "Outros",
];
export const CATEGORIES_PAY = [
  "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas",
  "Cartão de crédito", "Empréstimos", "Impostos", "Compras", "Pets", "Outros",
];

export const ACCOUNT_KIND_LABEL: Record<string, string> = {
  corrente: "Conta Corrente", poupanca: "Poupança", carteira: "Carteira",
  cartao: "Cartão de Crédito", investimento: "Investimento", outro: "Outro",
};

export const INV_KIND_LABEL: Record<string, string> = {
  rendaFixa: "Renda Fixa", acao: "Ações", fii: "FIIs", cripto: "Cripto",
  fundo: "Fundos", tesouro: "Tesouro Direto", outro: "Outro",
};
