import Dexie, { type Table } from "dexie";

export type ContractStatus = "ativo" | "suspenso" | "encerrado" | "arquivado" | "negociacao";
export type ContractType = "honorarios" | "exito" | "consultoria" | "representacao" | "acordo" | "outro";
export type LawArea = "civel" | "trabalhista" | "criminal" | "previdenciario" | "tributario" | "empresarial" | "familia" | "imobiliario" | "consumidor" | "outro";
export type InstallmentStatus = "pendente" | "pago" | "atraso" | "cancelado" | "negociado";
export type PaymentMethod = "pix" | "transferencia" | "boleto" | "dinheiro" | "cheque" | "cartao" | "outro";

export interface Client {
  id?: number;
  type: "PF" | "PJ";
  name: string;
  document: string; // CPF/CNPJ
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

export interface Lawyer {
  name: string;
  oab: string;
  uf: string;
  percentage: number;
}

export interface OpposingParty {
  name?: string;
  document?: string;
  lawyer?: string;
  oab?: string;
}

export interface ContractDoc {
  id: string;
  name: string;
  type: string; // "contrato" | "procuracao" | ...
  mime: string;
  size: number;
  dataUrl: string; // base64
  uploadedAt: string;
}

export interface HistoryEntry {
  at: string;
  description: string;
}

export interface Installment {
  id?: number;
  contractId: number;
  number: number;
  dueDate: string;
  originalValue: number;
  correction: number;
  penalty: number; // multa+juros aplicado
  finalValue: number;
  status: InstallmentStatus;
  paidAt?: string;
  paidValue?: number;
  paymentMethod?: PaymentMethod;
  transactionRef?: string;
  receiptDataUrl?: string;
  notes?: string;
}

export interface Contract {
  id?: number;
  number: string; // CTR-AAAA-NNNN
  signedAt: string;
  startsAt: string;
  endsAt?: string;
  status: ContractStatus;
  type: ContractType;

  area: LawArea;
  objectDescription: string;
  processNumber?: string;
  court?: string;
  procedureStage?: string;
  tags: string[];

  clientId: number;
  opposing?: OpposingParty;
  lawyers: Lawyer[];

  // Finance
  totalValue: number;
  downPayment: number;
  downPaymentDate?: string;
  paymentMode: "avista" | "parcelado" | "exito" | "misto";
  installmentsCount: number;
  dueDay: number;
  firstDueDate?: string;
  correctionIndex: "nenhum" | "igpm" | "ipca" | "inpc" | "selic" | "personalizado";
  monthlyPenalty: number; // %
  monthlyInterest: number; // %
  earlyDiscount: number; // %
  successPercentage?: number;
  successBase?: string;

  documents: ContractDoc[];
  notes?: string;
  history: HistoryEntry[];

  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: number;
  officeName: string;
  lawyerName: string;
  oab: string;
  uf: string;
  logoDataUrl?: string;
  alertDaysBefore: number;
  theme: "dark" | "light";
  passwordHash?: string;
  contractSequence: number; // last CTR number
}

class LegalDB extends Dexie {
  contracts!: Table<Contract, number>;
  installments!: Table<Installment, number>;
  clients!: Table<Client, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super("legal-contracts-db");
    this.version(1).stores({
      contracts: "++id, number, status, clientId, area, type, signedAt",
      installments: "++id, contractId, status, dueDate",
      clients: "++id, document, name, type",
      settings: "id",
    });
  }
}

export const db = new LegalDB();

export const getSettings = async (): Promise<Settings> => {
  let s = await db.settings.get(1);
  if (!s) {
    s = {
      id: 1,
      officeName: "Meu Escritório",
      lawyerName: "",
      oab: "",
      uf: "SP",
      alertDaysBefore: 7,
      theme: "dark",
      contractSequence: 0,
    };
    await db.settings.put(s);
  }
  return s;
};

export const nextContractNumber = async (): Promise<string> => {
  const s = await getSettings();
  const year = new Date().getFullYear();
  const next = (s.contractSequence ?? 0) + 1;
  await db.settings.update(1, { contractSequence: next });
  return `CTR-${year}-${String(next).padStart(4, "0")}`;
};
