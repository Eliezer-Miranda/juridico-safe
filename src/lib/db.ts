import Dexie, { type Table } from "dexie";

export type ContractStatus = "ativo" | "suspenso" | "encerrado" | "arquivado" | "negociacao";
export type ContractType = "honorarios" | "exito" | "consultoria" | "representacao" | "acordo" | "outro";
export type LawArea = "civel" | "trabalhista" | "criminal" | "previdenciario" | "tributario" | "empresarial" | "familia" | "imobiliario" | "consumidor" | "outro";
export type InstallmentStatus = "pendente" | "pago" | "atraso" | "cancelado" | "negociado";
export type PaymentMethod = "pix" | "transferencia" | "boleto" | "dinheiro" | "cheque" | "cartao" | "outro";

export type PartyRole = "cliente" | "fornecedor" | "ambos";

export interface Client {
  id?: number;
  type: "PF" | "PJ";
  role?: PartyRole;
  name: string;
  document: string;
  rgIe?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string; number?: string; complement?: string;
    neighborhood?: string; city?: string; state?: string; zip?: string;
  };
  legalRep?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lawyer { name: string; oab: string; uf: string; percentage: number; }
export interface OpposingParty { name?: string; document?: string; lawyer?: string; oab?: string; }
export interface ContractDoc {
  id: string; name: string; type: string; mime: string; size: number; dataUrl: string; uploadedAt: string;
}
export interface HistoryEntry { at: string; description: string; }

export interface Installment {
  id?: number; contractId: number; number: number; dueDate: string;
  originalValue: number; correction: number; penalty: number; finalValue: number;
  status: InstallmentStatus; paidAt?: string; paidValue?: number;
  paymentMethod?: PaymentMethod; transactionRef?: string; receiptDataUrl?: string; notes?: string;
}

export interface Contract {
  id?: number; number: string; signedAt: string; startsAt: string; endsAt?: string;
  status: ContractStatus; type: ContractType; area: LawArea;
  objectDescription: string; processNumber?: string; court?: string; procedureStage?: string;
  tags: string[]; clientId: number; opposing?: OpposingParty; lawyers: Lawyer[];
  totalValue: number; downPayment: number; downPaymentDate?: string;
  paymentMode: "avista" | "parcelado" | "exito" | "misto";
  installmentsCount: number; dueDay: number; firstDueDate?: string;
  correctionIndex: "nenhum" | "igpm" | "ipca" | "inpc" | "selic" | "personalizado";
  monthlyPenalty: number; monthlyInterest: number; earlyDiscount: number;
  successPercentage?: number; successBase?: string;
  documents: ContractDoc[]; notes?: string; history: HistoryEntry[];
  createdAt: string; updatedAt: string;
}

export interface CompanyAddress {
  street?: string; number?: string; complement?: string;
  neighborhood?: string; city?: string; state?: string; zip?: string;
}

export interface Settings {
  id: number;
  officeName: string; lawyerName: string; oab: string; uf: string;
  logoDataUrl?: string; alertDaysBefore: number; theme: "dark" | "light";
  passwordHash?: string; contractSequence: number;
  companyDocument?: string; companyIE?: string;
  companyEmail?: string; companyPhone?: string; companyWebsite?: string;
  companyAddress?: CompanyAddress; companyTagline?: string;
  defaultSeller?: string; quoteSequence?: number; quoteTerms?: string;
  projectSequence?: number;
}

export type AccountKind = "corrente" | "poupanca" | "carteira" | "cartao" | "investimento" | "outro";
export interface Account {
  id?: number; name: string; kind: AccountKind; institution?: string;
  openingBalance: number; color?: string; notes?: string; archived?: boolean; createdAt: string;
}

export type FinTxKind = "receber" | "pagar";
export type FinTxStatus = "pendente" | "pago" | "atraso" | "cancelado";
export interface FinTx {
  id?: number; kind: FinTxKind; description: string; category: string;
  accountId?: number; amount: number; dueDate: string;
  paidAt?: string; paidAmount?: number; paidAccountId?: number;
  status: FinTxStatus; recurrence?: "nenhuma" | "mensal" | "semanal" | "anual";
  partyId?: number; quoteId?: number; projectId?: number;
  installmentInfo?: string; notes?: string; createdAt: string;
}

export type InvestmentKind = "rendaFixa" | "acao" | "fii" | "cripto" | "fundo" | "tesouro" | "outro";
export interface Investment {
  id?: number; name: string; ticker?: string; kind: InvestmentKind; broker?: string;
  quantity: number; avgPrice: number; currentPrice: number; notes?: string;
  updatedAt: string; createdAt: string;
}
export type InvMovKind = "aporte" | "resgate" | "rendimento" | "dividendo" | "ajuste";
export interface InvMovement {
  id?: number; investmentId: number; kind: InvMovKind; date: string;
  quantity?: number; price?: number; amount: number; notes?: string;
}

export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado" | "faturado";
export interface QuoteItem {
  description: string; quantity: number; unit?: string; unitPrice: number; productId?: number;
}
export interface Quote {
  id?: number; number: string; partyId: number; partyKind: "cliente" | "fornecedor";
  issueDate: string; expiryDate: string; seller?: string;
  items: QuoteItem[]; discount: number; total: number; notes?: string;
  status: QuoteStatus; paymentMode: "avista" | "parcelado";
  installmentsCount: number; firstDueDate?: string;
  paymentConditionId?: number; projectId?: number;
  linkedTxIds?: number[]; createdAt: string; updatedAt: string;
}

export interface PaymentCondition {
  id?: number; name: string; description?: string;
  installments: number; intervalDays: number;
  downPaymentPct?: number; active: boolean; createdAt: string;
}

export interface Product {
  id?: number; sku?: string; name: string; description?: string;
  unit: string; price: number; cost?: number; category?: string;
  active: boolean; createdAt: string; updatedAt: string;
}

export type ProjectType = "material" | "maoDeObra" | "misto";
export type ProjectStatus = "orcamento" | "aprovado" | "execucao" | "concluido" | "cancelado";
export interface Project {
  id?: number; code: string; name: string; clientId: number;
  type: ProjectType; status: ProjectStatus;
  startsAt?: string; endsAt?: string; description?: string; notes?: string;
  createdAt: string; updatedAt: string;
}

class LegalDB extends Dexie {
  contracts!: Table<Contract, number>;
  installments!: Table<Installment, number>;
  clients!: Table<Client, number>;
  settings!: Table<Settings, number>;
  accounts!: Table<Account, number>;
  finTx!: Table<FinTx, number>;
  investments!: Table<Investment, number>;
  invMovements!: Table<InvMovement, number>;
  quotes!: Table<Quote, number>;
  paymentConditions!: Table<PaymentCondition, number>;
  products!: Table<Product, number>;
  projects!: Table<Project, number>;

  constructor() {
    super("legal-contracts-db");
    this.version(1).stores({
      contracts: "++id, number, status, clientId, area, type, signedAt",
      installments: "++id, contractId, status, dueDate",
      clients: "++id, document, name, type",
      settings: "id",
    });
    this.version(2).stores({
      contracts: "++id, number, status, clientId, area, type, signedAt",
      installments: "++id, contractId, status, dueDate",
      clients: "++id, document, name, type",
      settings: "id",
      accounts: "++id, name, kind, archived",
      finTx: "++id, kind, status, dueDate, accountId, category",
      investments: "++id, name, kind, ticker",
      invMovements: "++id, investmentId, date, kind",
    });
    this.version(3).stores({
      contracts: "++id, number, status, clientId, area, type, signedAt",
      installments: "++id, contractId, status, dueDate",
      clients: "++id, document, name, type, role",
      settings: "id",
      accounts: "++id, name, kind, archived",
      finTx: "++id, kind, status, dueDate, accountId, category, partyId, quoteId",
      investments: "++id, name, kind, ticker",
      invMovements: "++id, investmentId, date, kind",
      quotes: "++id, number, status, partyId, partyKind, issueDate",
    }).upgrade(async (tx) => {
      await tx.table("clients").toCollection().modify((c: Client) => {
        if (!c.role) c.role = "cliente";
      });
    });
    this.version(4).stores({
      contracts: "++id, number, status, clientId, area, type, signedAt",
      installments: "++id, contractId, status, dueDate",
      clients: "++id, document, name, type, role",
      settings: "id",
      accounts: "++id, name, kind, archived",
      finTx: "++id, kind, status, dueDate, accountId, category, partyId, quoteId, projectId",
      investments: "++id, name, kind, ticker",
      invMovements: "++id, investmentId, date, kind",
      quotes: "++id, number, status, partyId, partyKind, issueDate, projectId",
      paymentConditions: "++id, name, active",
      products: "++id, sku, name, category, active",
      projects: "++id, code, name, clientId, status, type",
    });
  }
}

export const db = new LegalDB();

export const getSettings = async (): Promise<Settings> => {
  let s = await db.settings.get(1);
  if (!s) {
    s = {
      id: 1, officeName: "Minha Empresa", lawyerName: "", oab: "", uf: "SP",
      alertDaysBefore: 7, theme: "dark", contractSequence: 0,
      quoteSequence: 0, projectSequence: 0,
    };
    await db.settings.put(s);
  }
  const patch: Partial<Settings> = {};
  if (s.quoteSequence == null) { patch.quoteSequence = 0; s.quoteSequence = 0; }
  if (s.projectSequence == null) { patch.projectSequence = 0; s.projectSequence = 0; }
  if (Object.keys(patch).length) await db.settings.update(1, patch);
  return s;
};

export const nextContractNumber = async (): Promise<string> => {
  const s = await getSettings();
  const year = new Date().getFullYear();
  const next = (s.contractSequence ?? 0) + 1;
  await db.settings.update(1, { contractSequence: next });
  return `CTR-${year}-${String(next).padStart(4, "0")}`;
};

export const nextQuoteNumber = async (): Promise<string> => {
  const s = await getSettings();
  const next = (s.quoteSequence ?? 0) + 1;
  await db.settings.update(1, { quoteSequence: next });
  return `S${String(next).padStart(5, "0")}`;
};

export const nextProjectCode = async (): Promise<string> => {
  const s = await getSettings();
  const next = (s.projectSequence ?? 0) + 1;
  await db.settings.update(1, { projectSequence: next });
  return `PRJ-${String(next).padStart(4, "0")}`;
};
