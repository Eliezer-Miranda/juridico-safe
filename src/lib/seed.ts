import { db, nextContractNumber, type Contract } from "./db";
import { generateInstallments } from "./installments";

export const hasData = async () => (await db.contracts.count()) > 0;

export const seedDemo = async () => {
  if (await hasData()) return;

  const now = new Date().toISOString();

  const c1 = await db.clients.add({
    type: "PF",
    name: "Maria Helena Rodrigues",
    document: "123.456.789-00",
    rgIe: "MG-12.345.678",
    email: "maria.helena@exemplo.com",
    phone: "(31) 99876-5432",
    address: { city: "Belo Horizonte", state: "MG", street: "Rua das Acácias", number: "120" },
    createdAt: now, updatedAt: now,
  });

  const c2 = await db.clients.add({
    type: "PJ",
    name: "Construtora Aurum Ltda",
    document: "12.345.678/0001-90",
    email: "juridico@aurum.com.br",
    phone: "(11) 4002-8922",
    address: { city: "São Paulo", state: "SP" },
    legalRep: "Carlos Mendes",
    createdAt: now, updatedAt: now,
  });

  const c3 = await db.clients.add({
    type: "PF",
    name: "João Batista Souza",
    document: "987.654.321-00",
    phone: "(21) 98123-4567",
    address: { city: "Rio de Janeiro", state: "RJ" },
    createdAt: now, updatedAt: now,
  });

  const baseContract = (overrides: Partial<Contract>): Omit<Contract, "id"> => ({
    number: "",
    signedAt: "2025-01-15",
    startsAt: "2025-01-15",
    status: "ativo",
    type: "honorarios",
    area: "civel",
    objectDescription: "",
    tags: [],
    clientId: 0,
    lawyers: [{ name: "Dra. Helena Vasconcelos", oab: "123456", uf: "SP", percentage: 100 }],
    totalValue: 0,
    downPayment: 0,
    paymentMode: "parcelado",
    installmentsCount: 12,
    dueDay: 10,
    firstDueDate: "2025-02-10",
    correctionIndex: "nenhum",
    monthlyPenalty: 2,
    monthlyInterest: 1,
    earlyDiscount: 0,
    documents: [],
    history: [{ at: now, description: "Contrato cadastrado" }],
    createdAt: now, updatedAt: now,
    ...overrides,
  });

  const contracts: Omit<Contract, "id">[] = [
    baseContract({
      clientId: c1,
      area: "familia",
      type: "honorarios",
      objectDescription: "Divórcio consensual com partilha de bens e regulamentação de guarda.",
      totalValue: 18000,
      downPayment: 3000,
      installmentsCount: 10,
      firstDueDate: "2025-02-10",
      processNumber: "0001234-56.2025.8.13.0024",
      court: "2ª Vara de Família – BH/MG",
      procedureStage: "Inicial",
      tags: ["prioritário"],
    }),
    baseContract({
      clientId: c2,
      area: "empresarial",
      type: "consultoria",
      objectDescription: "Consultoria jurídica mensal: revisão contratual e compliance.",
      totalValue: 60000,
      downPayment: 0,
      installmentsCount: 12,
      firstDueDate: "2024-12-10",
      tags: ["VIP", "recorrente"],
      monthlyPenalty: 5,
      monthlyInterest: 2,
    }),
    baseContract({
      clientId: c3,
      area: "trabalhista",
      type: "exito",
      objectDescription: "Reclamatória trabalhista – verbas rescisórias e horas extras.",
      totalValue: 0,
      paymentMode: "exito",
      installmentsCount: 0,
      successPercentage: 30,
      successBase: "Sobre o valor líquido obtido",
      status: "negociacao",
      processNumber: "0000777-22.2025.5.01.0001",
      court: "15ª Vara do Trabalho – RJ",
      procedureStage: "Instrução",
    }),
  ];

  for (const c of contracts) {
    const number = await nextContractNumber();
    const id = await db.contracts.add({ ...c, number });
    const insts = generateInstallments(c).map((i) => ({ ...i, contractId: id }));
    if (insts.length) await db.installments.bulkAdd(insts);
  }

  // Mark some installments as paid
  const list = await db.installments.orderBy("dueDate").toArray();
  for (const i of list.slice(0, 4)) {
    await db.installments.update(i.id!, {
      status: "pago",
      paidAt: i.dueDate,
      paidValue: i.originalValue,
      paymentMethod: "pix",
    });
  }
};

export const seedFinance = async () => {
  if ((await db.accounts.count()) > 0) return;
  const now = new Date().toISOString();
  const today = new Date();
  const isoDay = (offsetDays: number) => {
    const d = new Date(today); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10);
  };

  const accCorrente = await db.accounts.add({
    name: "Conta Corrente Itaú", kind: "corrente", institution: "Itaú",
    openingBalance: 8500, color: "#C9A84C", createdAt: now,
  });
  const accNubank = await db.accounts.add({
    name: "Nubank", kind: "corrente", institution: "Nu Pagamentos",
    openingBalance: 2100, color: "#A78BFA", createdAt: now,
  });
  const accCarteira = await db.accounts.add({
    name: "Carteira", kind: "carteira", openingBalance: 350, color: "#10B981", createdAt: now,
  });
  const accCartao = await db.accounts.add({
    name: "Cartão Visa Infinite", kind: "cartao", institution: "Itaú",
    openingBalance: 0, color: "#FF6B6B", createdAt: now,
  });

  const recurMensal = (description: string, amount: number, category: string, kind: "receber" | "pagar", paidMonths: number) => {
    const items = [];
    for (let i = -5; i <= 1; i++) {
      const due = new Date(today.getFullYear(), today.getMonth() + i, 5).toISOString().slice(0, 10);
      const isPast = i < 0;
      const paid = i < paidMonths;
      items.push({
        kind, description, category, accountId: kind === "receber" ? accCorrente : accNubank,
        amount, dueDate: due,
        status: paid ? ("pago" as const) : (isPast ? ("atraso" as const) : ("pendente" as const)),
        paidAt: paid ? due : undefined,
        paidAmount: paid ? amount : undefined,
        paidAccountId: paid ? (kind === "receber" ? accCorrente : accNubank) : undefined,
        recurrence: "mensal" as const,
        createdAt: now,
      });
    }
    return items;
  };

  const txs = [
    ...recurMensal("Salário Empresa XYZ", 9800, "Salário", "receber", 1),
    ...recurMensal("Aluguel apartamento", 2400, "Moradia", "pagar", 1),
    ...recurMensal("Internet + Streaming", 230, "Assinaturas", "pagar", 1),
    ...recurMensal("Plano de saúde", 680, "Saúde", "pagar", 1),
    { kind: "pagar" as const, description: "Mercado da semana", category: "Alimentação", accountId: accNubank, amount: 420, dueDate: isoDay(-2), status: "pago" as const, paidAt: isoDay(-2), paidAmount: 420, paidAccountId: accNubank, createdAt: now },
    { kind: "pagar" as const, description: "Posto de gasolina", category: "Transporte", accountId: accCartao, amount: 280, dueDate: isoDay(3), status: "pendente" as const, createdAt: now },
    { kind: "receber" as const, description: "Freelance design", category: "Freelance", accountId: accCorrente, amount: 1500, dueDate: isoDay(10), status: "pendente" as const, createdAt: now },
  ];
  await db.finTx.bulkAdd(txs);

  await db.investments.bulkAdd([
    { name: "Tesouro IPCA+ 2029", ticker: "IPCA29", kind: "tesouro", broker: "XP", quantity: 12, avgPrice: 3200, currentPrice: 3460, createdAt: now, updatedAt: now },
    { name: "ITAÚ UNIBANCO PN", ticker: "ITUB4", kind: "acao", broker: "XP", quantity: 200, avgPrice: 28.5, currentPrice: 33.8, createdAt: now, updatedAt: now },
    { name: "MXRF11", ticker: "MXRF11", kind: "fii", broker: "Rico", quantity: 300, avgPrice: 10.2, currentPrice: 9.85, createdAt: now, updatedAt: now },
    { name: "Bitcoin", ticker: "BTC", kind: "cripto", broker: "Mercado Bitcoin", quantity: 0.05, avgPrice: 280000, currentPrice: 350000, createdAt: now, updatedAt: now },
  ]);
};
