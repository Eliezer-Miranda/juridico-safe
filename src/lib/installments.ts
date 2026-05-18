import { addMonths, differenceInDays, parseISO, setDate, isValid } from "date-fns";
import { db, type Contract, type Installment, type InstallmentStatus } from "./db";

export const generateInstallments = (
  contract: Pick<Contract, "totalValue" | "downPayment" | "paymentMode" | "installmentsCount" | "dueDay" | "firstDueDate">,
): Omit<Installment, "id" | "contractId">[] => {
  if (contract.paymentMode === "avista" || contract.paymentMode === "exito") return [];

  const balance = Math.max(0, (contract.totalValue ?? 0) - (contract.downPayment ?? 0));
  const count = Math.max(1, contract.installmentsCount || 1);

  const baseDate = contract.firstDueDate ? parseISO(contract.firstDueDate) : new Date();
  if (!isValid(baseDate)) return [];

  const valuePer = Math.round((balance / count) * 100) / 100;
  const list: Omit<Installment, "id" | "contractId">[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const due = setDate(addMonths(baseDate, i), contract.dueDay || baseDate.getDate());
    const isLast = i === count - 1;
    const value = isLast ? Math.round((balance - acc) * 100) / 100 : valuePer;
    acc += value;
    list.push({
      number: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      originalValue: value,
      correction: 0,
      penalty: 0,
      finalValue: value,
      status: "pendente",
    });
  }
  return list;
};

export const computePenalty = (
  inst: Installment,
  contract: Pick<Contract, "monthlyPenalty" | "monthlyInterest">,
  refDate: Date = new Date(),
) => {
  const due = parseISO(inst.dueDate);
  const days = differenceInDays(refDate, due);
  if (days <= 0) return { penalty: 0, days: 0 };
  const monthlyJ = (contract.monthlyInterest ?? 0) / 100;
  const monthlyM = (contract.monthlyPenalty ?? 0) / 100;
  const juros = inst.originalValue * monthlyJ * (days / 30);
  const multa = inst.originalValue * monthlyM;
  return { penalty: Math.round((juros + multa) * 100) / 100, days };
};

export const refreshInstallmentStatus = async (contractId: number) => {
  const contract = await db.contracts.get(contractId);
  if (!contract) return;
  const items = await db.installments.where({ contractId }).toArray();
  const today = new Date();
  for (const i of items) {
    if (i.status === "pago" || i.status === "cancelado") continue;
    const due = parseISO(i.dueDate);
    let next: InstallmentStatus = "pendente";
    if (isValid(due) && due < today) next = "atraso";
    const { penalty } = computePenalty(i, contract, today);
    const finalValue = Math.round((i.originalValue + i.correction + penalty) * 100) / 100;
    if (i.status !== next || i.penalty !== penalty || i.finalValue !== finalValue) {
      await db.installments.update(i.id!, { status: next, penalty, finalValue });
    }
  }
};
