import type { StockEntry, StockEntryItem } from "./db";

// Parse NFe XML (procNFe / nfeProc / NFe root).
export function parseNFeXml(xmlText: string, fileName?: string): Omit<StockEntry, "id" | "createdAt"> {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error("XML inválido");

  const g = (parent: Element | Document, tag: string): string => {
    const el = parent.getElementsByTagName(tag)[0];
    return el?.textContent?.trim() ?? "";
  };

  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Não é um XML de NF-e (infNFe ausente)");

  const ide = infNFe.getElementsByTagName("ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0];
  const total = infNFe.getElementsByTagName("total")[0];

  const nNF = ide ? g(ide, "nNF") : "";
  const serie = ide ? g(ide, "serie") : "";
  const dhEmi = ide ? (g(ide, "dhEmi") || g(ide, "dEmi")) : "";
  const issueDate = dhEmi ? dhEmi.substring(0, 10) : new Date().toISOString().substring(0, 10);

  const supplierName = emit ? (g(emit, "xNome") || g(emit, "xFant")) : "";
  const supplierDocument = emit ? (g(emit, "CNPJ") || g(emit, "CPF")) : "";

  const vNF = total ? Number(g(total, "vNF") || 0) : 0;

  const items: StockEntryItem[] = [];
  const detList = infNFe.getElementsByTagName("det");
  for (let i = 0; i < detList.length; i++) {
    const det = detList[i];
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;
    const qty = Number(g(prod, "qCom") || 0);
    const price = Number(g(prod, "vUnCom") || 0);
    const totalItem = Number(g(prod, "vProd") || (qty * price));
    items.push({
      description: g(prod, "xProd"),
      ncm: g(prod, "NCM") || undefined,
      unit: g(prod, "uCom") || "UN",
      quantity: qty,
      unitPrice: price,
      total: totalItem,
    });
  }

  const chNFe = infNFe.getAttribute("Id")?.replace(/^NFe/, "") ?? undefined;

  return {
    number: nNF || "s/n",
    series: serie || undefined,
    supplierName: supplierName || undefined,
    supplierDocument: supplierDocument || undefined,
    issueDate,
    total: vNF,
    items,
    xmlName: fileName,
    xmlKey: chNFe,
  };
}
