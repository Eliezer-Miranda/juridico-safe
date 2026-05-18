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
