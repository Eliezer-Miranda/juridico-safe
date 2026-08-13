import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings, nextQuoteNumber, type Client, type ContractDoc, type Quote, type QuoteItem } from "@/lib/db";
import { analyzeProposal } from "@/lib/proposals.functions";
import { generateFinTxFromQuote, buildQuoteSchedule } from "@/lib/quotes";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Upload, FileText, Wand2, Check, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);
const digits = (s?: string) => (s ?? "").replace(/\D/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Extracted {
  party?: any;
  quote?: any;
  payment?: any;
  summary?: string;
  warnings?: string[];
}

const readAsBase64 = (file: File) =>
  new Promise<{ dataUrl: string; base64: string }>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] ?? "" });
    };
    r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });

export function ProposalImport() {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<Extracted | null>(null);
  const [genFin, setGenFin] = useState(true);

  const matchClient = (party: any): Client | undefined => {
    if (!party) return undefined;
    const doc = digits(party.document);
    if (doc.length >= 11) {
      const byDoc = clients.find((c) => digits(c.document) === doc);
      if (byDoc) return byDoc;
    }
    const name = (party.name ?? "").trim().toLowerCase();
    if (!name) return undefined;
    return clients.find((c) => c.name.trim().toLowerCase() === name);
  };

  const analyze = async () => {
    if (!file && !prompt.trim()) {
      toast.error("Envie a proposta (PDF/Word) ou descreva no chat.");
      return;
    }
    setLoading(true);
    try {
      let text: string | undefined;
      let filePayload: { name: string; mime: string; dataBase64: string } | undefined;

      if (file) {
        const isDocx = /\.docx$/i.test(file.name);
        const isTxt = /\.(txt|csv|md)$/i.test(file.name);
        if (isDocx) {
          // @ts-ignore - browser build has no bundled types
          const mammoth = await import("mammoth/mammoth.browser.js");
          const buf = await file.arrayBuffer();
          const out = await (mammoth as any).extractRawText({ arrayBuffer: buf });
          text = out?.value ?? "";
        } else if (isTxt) {
          text = await file.text();
        } else {
          const { base64 } = await readAsBase64(file);
          filePayload = { name: file.name, mime: file.type || "application/pdf", dataBase64: base64 };
        }
      }

      const res = (await analyzeProposal({
        data: { prompt: prompt.trim() || undefined, text, file: filePayload },
      })) as Extracted;
      setData(res);
      toast.success("Proposta analisada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao analisar");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!data?.quote) return;
    setApplying(true);
    try {
      const now = new Date().toISOString();
      const party = data.party ?? {};
      const partyKind: "cliente" | "fornecedor" = party.kind === "fornecedor" ? "fornecedor" : "cliente";

      let existing = matchClient(party);
      let partyId: number;
      let createdClient = false;
      if (existing?.id) {
        partyId = existing.id;
      } else {
        partyId = (await db.clients.add({
          type: party.type === "PF" ? "PF" : "PJ",
          role: partyKind,
          name: party.name || "Cliente da proposta",
          contactName: party.contactName || undefined,
          document: digits(party.document),
          email: party.email || undefined,
          phone: party.phone || undefined,
          address: party.address || undefined,
          notes: "Cadastrado automaticamente a partir de proposta importada.",
          createdAt: now,
          updatedAt: now,
        } as Client)) as number;
        createdClient = true;
      }

      // Payment condition
      const pay = data.payment ?? {};
      const installments = Math.max(1, Number(pay.installments) || 1);
      const intervalDays = Math.max(1, Number(pay.intervalDays) || 30);
      const downPaymentPct = Math.min(100, Math.max(0, Number(pay.downPaymentPct) || 0));
      const conds = await db.paymentConditions.toArray();
      let condition = conds.find(
        (c) =>
          c.installments === installments &&
          c.intervalDays === intervalDays &&
          (c.downPaymentPct ?? 0) === downPaymentPct,
      );
      if (!condition) {
        const name =
          (pay.conditionName as string) ||
          `${installments}x a cada ${intervalDays} dias${downPaymentPct ? ` (entrada ${downPaymentPct}%)` : ""}`;
        const cid = (await db.paymentConditions.add({
          name,
          description: "Criada a partir de proposta importada",
          installments,
          intervalDays,
          downPaymentPct,
          active: true,
          createdAt: now,
        })) as number;
        condition = await db.paymentConditions.get(cid);
      }

      // Payment method (optional)
      let methodId: number | undefined;
      if (pay.methodName) {
        const methods = await db.paymentMethods.toArray();
        const found = methods.find(
          (m) => m.name.trim().toLowerCase() === String(pay.methodName).trim().toLowerCase(),
        );
        methodId =
          found?.id ??
          ((await db.paymentMethods.add({
            name: String(pay.methodName),
            active: true,
            createdAt: now,
          })) as number);
      }

      // Items
      const items: QuoteItem[] = (data.quote.items ?? []).map((i: any) => ({
        description: String(i.description ?? "Item"),
        quantity: Number(i.quantity) || 1,
        unit: i.unit || "un",
        unitPrice: Number(i.unitPrice) || 0,
      }));
      const discount = Number(data.quote.discount) || 0;
      const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const total = round2(Math.max(0, subtotal - discount));

      // Attachment
      const documents: ContractDoc[] = [];
      if (file) {
        const { dataUrl } = await readAsBase64(file);
        documents.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: "proposta",
          mime: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          uploadedAt: now,
        });
      }

      const number = await nextQuoteNumber();
      const quote: Quote = {
        number,
        partyId,
        partyKind,
        issueDate: data.quote.issueDate || todayISO(),
        expiryDate: data.quote.expiryDate || todayISO(),
        seller: data.quote.seller || undefined,
        items,
        discount,
        total,
        notes: data.quote.notes || undefined,
        status: "enviado",
        paymentMode: installments > 1 ? "parcelado" : "avista",
        installmentsCount: installments,
        firstDueDate: pay.firstDueDate || data.quote.issueDate || todayISO(),
        paymentConditionId: condition?.id,
        paymentMethodId: methodId,
        documents,
        history: [
          {
            at: now,
            description: `Proposta importada por IA${file ? ` (arquivo: ${file.name})` : " (chat)"}. ${
              createdClient ? "Novo cadastro criado" : "Vinculado a cadastro existente"
            }: ${party.name ?? ""}.`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      const qid = (await db.quotes.add(quote)) as number;
      const saved = (await db.quotes.get(qid))!;

      if (genFin) {
        const s = await getSettings();
        const sched = await buildQuoteSchedule(saved);
        await generateFinTxFromQuote(saved, {
          category: partyKind === "cliente" ? "Vendas" : "Compras",
          acceptedBy: s.lawyerName || s.officeName || "IA",
        });
        toast.success(`${sched.length} parcela(s) lançada(s) em ${partyKind === "cliente" ? "A Receber" : "A Pagar"}`);
      }

      toast.success(`Proposta ${number} criada${createdClient ? " + novo cadastro" : ""}`);
      navigate({ to: "/orcamentos/$id", params: { id: String(qid) } });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar no sistema");
    } finally {
      setApplying(false);
    }
  };

  const preview = data?.quote;
  const previewTotal = preview
    ? round2(
        Math.max(
          0,
          (preview.items ?? []).reduce(
            (s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
            0,
          ) - (Number(preview.discount) || 0),
        ),
      )
    : 0;
  const matched = data?.party ? matchClient(data.party) : undefined;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6 animate-in-up">
      <header>
        <p className="text-xs uppercase tracking-widest text-gold font-medium">Propostas</p>
        <h1 className="font-display text-3xl mt-1">Importar proposta com IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie a proposta em PDF/Word ou descreva no chat. A IA identifica o cliente, itens, condições de pagamento e
          parcelas — e anexa o arquivo à proposta.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-gold" /> Chat / Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Arquivo da proposta (PDF, DOCX, TXT ou imagem)</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                type="file"
                accept=".pdf,.docx,.txt,.csv,.md,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                  <Paperclip className="h-3 w-3" /> {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>
          <div>
            <Label>Instruções / proposta em texto</Label>
            <Textarea
              rows={5}
              className="mt-1"
              placeholder="Ex.: Proposta para a ACME Ltda, CNPJ 12.345.678/0001-90, 3 unidades de instalação elétrica a R$ 1.200 cada, pagamento em 3x a cada 30 dias com entrada de 20%."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={analyze} disabled={loading} className="bg-gradient-gold text-primary-foreground shadow-gold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Analisar proposta
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={genFin} onChange={(e) => setGenFin(e.target.checked)} />
              Lançar parcelas no financeiro ao criar
            </label>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-gold" /> Resultado da análise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            {data.summary && <p className="text-muted-foreground">{data.summary}</p>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {data.party?.kind === "fornecedor" ? "Fornecedor" : "Cliente"}
                </p>
                <p className="font-medium mt-1">{data.party?.name ?? "—"}</p>
                <p className="text-muted-foreground">{data.party?.document || "sem documento"}</p>
                {data.party?.contactName && <p className="text-muted-foreground">Contato: {data.party.contactName}</p>}
                <p className="mt-2 text-xs">
                  {matched ? (
                    <span className="text-emerald-400">Cadastro existente encontrado (#{matched.id})</span>
                  ) : (
                    <span className="text-gold">Será criado um novo cadastro</span>
                  )}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Condições de pagamento</p>
                <p className="font-medium mt-1">
                  {data.payment?.conditionName ||
                    `${data.payment?.installments ?? 1}x a cada ${data.payment?.intervalDays ?? 30} dias`}
                </p>
                <p className="text-muted-foreground">
                  Entrada: {Number(data.payment?.downPaymentPct) || 0}% · 1º venc.: {data.payment?.firstDueDate || "—"}
                </p>
                {data.payment?.methodName && (
                  <p className="text-muted-foreground">Forma: {data.payment.methodName}</p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-right px-3 py-2">Qtd</th>
                    <th className="text-right px-3 py-2">Unit.</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.items ?? []).map((i: any, idx: number) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2">{i.description}</td>
                      <td className="px-3 py-2 text-right">
                        {i.quantity} {i.unit ?? ""}
                      </td>
                      <td className="px-3 py-2 text-right">{formatBRL(Number(i.unitPrice) || 0)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatBRL((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-right font-display text-xl">Total: {formatBRL(previewTotal)}</p>

            {!!data.warnings?.length && (
              <ul className="text-xs text-amber-400 list-disc pl-5">
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={apply} disabled={applying} className="bg-gradient-gold text-primary-foreground shadow-gold">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Criar no sistema
              </Button>
              <Button variant="outline" onClick={() => setData(null)}>
                <Upload className="h-4 w-4" /> Nova análise
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
