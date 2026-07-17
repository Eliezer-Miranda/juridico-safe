import { db, type StockMovKind } from "./db";

export async function moveStock(
  productId: number,
  kind: StockMovKind,
  quantity: number,
  refType?: "entrada" | "emissao" | "manual",
  refId?: number,
  notes?: string,
) {
  const p = await db.products.get(productId);
  if (!p) return;
  const delta = kind === "entrada" ? quantity : kind === "saida" ? -quantity : quantity;
  const newStock = (p.stock ?? 0) + delta;
  await db.products.update(productId, { stock: newStock, updatedAt: new Date().toISOString() });
  await db.stockMovements.add({
    productId, kind, quantity: Math.abs(quantity),
    date: new Date().toISOString(), refType, refId, notes,
  });
}
