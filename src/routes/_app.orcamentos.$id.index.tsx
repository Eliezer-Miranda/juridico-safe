import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getSettings, type QuoteStatus } from "@/lib/db";
import { generateFinTxFromQuote, QUOTE_STATUS_LABEL, removeFinTxFromQuote } from "@/lib/quotes";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Trash2, FileCheck2, RotateCcw, ExternalLink, Pencil, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { QuoteWorkflow } from "@/components/QuoteWorkflow";

export const Route = createFileRoute("/_app/orcamentos/$id/")({
  component: QuoteView,
});

const STATUS_OPTS: QuoteStatus[] = ["rascunho", "enviado", "aprovado", "recusado", "expirado", "faturado"];

function QuoteView() {
  const { id } = useParams({ from: "/_app/orcamentos/$id/" });
  const qid = Number(id);
  const navigate = useNavigate();
  const quote = useLiveQuery(() => db.quotes.get(qid), [qid]);
  const settings = useLiveQuery(() => db.settings.get(1));
  const party = useLiveQuery(async () => quote ? await db.clients.get(quote.partyId) : null, [quote?.partyId]);
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const linkedTx = useLiveQuery(async () => {
    if (!quote?.linkedTxIds?.length) return [];
    return (await db.finTx.bulkGet(quote.linkedTxIds)).filter(Boolean) as any[];
  }, [quote?.linkedTxIds]);

  const [billOpen, setBillOpen] = useState(false);
  const [accountId, setAccountId] = useState<number | undefined>(undefined);

  if (!quote) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const changeStatus = async (s: QuoteStatus) => {
    await db.quotes.update(qid, { status: s, updatedAt: new Date().toISOString() });
    toast.success("Status atualizado");
  };

  const removeQuote = async () => {
    if (quote.linkedTxIds?.length) {
      if (!confirm("Existem parcelas vinculadas. Excluir orçamento e remover parcelas pendentes?")) return;
      await removeFinTxFromQuote(quote);
    } else if (!confirm("Excluir este orçamento?")) return;
    await db.quotes.delete(qid);
    toast.success("Orçamento excluído");
    navigate({ to: "/orcamentos" });
  };

  const confirmBilling = async () => {
    const s = await getSettings();
    await generateFinTxFromQuote(quote, {
      accountId,
      category: quote.partyKind === "cliente" ? "Vendas" : "Compras",
      acceptedBy: s.lawyerName || s.officeName || "Operador",
    });
    toast.success(`${quote.installmentsCount} parcela(s) gerada(s) em ${quote.partyKind === "cliente" ? "A Receber" : "A Pagar"}`);
    setBillOpen(false);
  };

  const rollback = async () => {
    if (!confirm("Remover parcelas pendentes vinculadas ao orçamento?")) return;
    await removeFinTxFromQuote(quote);
    toast.success("Parcelas removidas");
  };

  const addDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Arquivo maior que 8MB"); return; }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("erro"));
      r.readAsDataURL(f);
    });
    const now = new Date().toISOString();
    const docs = [...(quote.documents ?? []), {
      id: crypto.randomUUID(), name: f.name, type: "proposta",
      mime: f.type || "application/octet-stream", size: f.size, dataUrl, uploadedAt: now,
    }];
    await db.quotes.update(qid, { documents: docs, updatedAt: now });
    toast.success("Documento anexado");
  };

  const removeDoc = async (docId: string) => {
    if (!confirm("Remover este documento?")) return;
    const docs = (quote.documents ?? []).filter((d) => d.id !== docId);
    await db.quotes.update(qid, { documents: docs, updatedAt: new Date().toISOString() });
    toast.success("Documento removido");
  };

  const subtotal = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6 animate-in-up">
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <button onClick={() => navigate({ to: "/orcamentos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Orçamento</p>
          <h1 className="font-display text-4xl mt-1">{quote.number}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[160px]">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={quote.status} onValueChange={(v) => changeStatus(v as QuoteStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{QUOTE_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="self-end">
            <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/orcamentos/$id/editar", params: { id: String(qid) } })}
            className="self-end"
          >
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
          {!quote.linkedTxIds?.length ? (
            <Button onClick={() => setBillOpen(true)} className="self-end bg-gradient-gold text-primary-foreground shadow-gold">
              <FileCheck2 className="h-4 w-4 mr-2" />
              Gerar {quote.partyKind === "cliente" ? "A Receber" : "A Pagar"}
            </Button>
          ) : (
            <Button onClick={rollback} variant="outline" className="self-end">
              <RotateCcw className="h-4 w-4 mr-2" /> Desfazer faturamento
            </Button>
          )}
          <Button onClick={removeQuote} variant="outline" className="self-end text-destructive border-destructive/30">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </Button>
        </div>
      </header>

      {/* Printable document */}
      <div id="quote-print" className="bg-card border border-border rounded-lg p-8 print:p-0 print:border-0 print:bg-white print:text-black space-y-6">
        <div className="flex items-start justify-between gap-6 border-b border-border pb-5 print:border-gray-300">
          <div className="flex items-start gap-4">
            {settings?.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="Logo" className="h-24 w-24 rounded object-contain print:h-28 print:w-28" />
            ) : null}
            <div>
              <p className="font-display text-2xl">{settings?.officeName ?? "Sua Empresa"}</p>
              {settings?.companyTagline && <p className="text-xs text-muted-foreground print:text-gray-600">{settings.companyTagline}</p>}
              <div className="mt-2 text-xs text-muted-foreground print:text-gray-700 space-y-0.5">
                {settings?.companyAddress?.street && (
                  <p>{settings.companyAddress.street}{settings.companyAddress.number ? `, ${settings.companyAddress.number}` : ""}{settings.companyAddress.complement ? ` — ${settings.companyAddress.complement}` : ""}</p>
                )}
                {(settings?.companyAddress?.city || settings?.companyAddress?.state) && (
                  <p>{settings?.companyAddress?.neighborhood ? settings.companyAddress.neighborhood + " · " : ""}{settings?.companyAddress?.city ?? ""}{settings?.companyAddress?.state ? "/" + settings.companyAddress.state : ""} {settings?.companyAddress?.zip ?? ""}</p>
                )}
                {settings?.companyDocument && <p>CNPJ: {settings.companyDocument}</p>}
                {settings?.companyPhone && <p>Contato: {settings.companyPhone}</p>}
                {settings?.companyEmail && <p>E-mail: {settings.companyEmail}</p>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-gold print:text-gray-600">Cotação</p>
            <p className="font-display text-3xl">n° {quote.number}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground print:text-gray-600 mb-1">{quote.partyKind === "cliente" ? "Cliente" : "Fornecedor"}</p>
            <p className="font-medium">{party?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground print:text-gray-700">CPF/CNPJ: {party?.document ?? "—"}</p>
            {party?.address?.street && (
              <p className="text-xs text-muted-foreground print:text-gray-700">{party.address.street}{party.address.number ? `, ${party.address.number}` : ""}</p>
            )}
            {(party?.address?.city || party?.address?.state) && (
              <p className="text-xs text-muted-foreground print:text-gray-700">{party.address?.city}{party.address?.state ? `/${party.address.state}` : ""} {party.address?.zip ?? ""}</p>
            )}
            {party?.phone && <p className="text-xs text-muted-foreground print:text-gray-700">Tel: {party.phone}</p>}
            {party?.email && <p className="text-xs text-muted-foreground print:text-gray-700">{party.email}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="uppercase tracking-widest text-muted-foreground print:text-gray-600">Emissão</p>
              <p className="text-sm font-medium mt-0.5">{formatDate(quote.issueDate)}</p>
            </div>
            <div>
              <p className="uppercase tracking-widest text-muted-foreground print:text-gray-600">Validade</p>
              <p className="text-sm font-medium mt-0.5">{formatDate(quote.expiryDate)}</p>
            </div>
            <div>
              <p className="uppercase tracking-widest text-muted-foreground print:text-gray-600">Vendedor</p>
              <p className="text-sm font-medium mt-0.5">{quote.seller ?? "—"}</p>
            </div>
          </div>
        </div>

        <table className="w-full text-sm border border-border print:border-gray-400">
          <thead className="bg-muted/40 print:bg-gray-100">
            <tr className="text-xs uppercase tracking-widest">
              <th className="text-left px-3 py-2 border-b border-border print:border-gray-400">Descrição</th>
              <th className="text-right px-3 py-2 border-b border-border print:border-gray-400 w-28">Quantidade</th>
              <th className="text-right px-3 py-2 border-b border-border print:border-gray-400 w-32">Preço unitário</th>
              <th className="text-right px-3 py-2 border-b border-border print:border-gray-400 w-32">Valor</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i} className="border-b border-border print:border-gray-300">
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2 text-right">{it.quantity.toLocaleString("pt-BR")} {it.unit ?? ""}</td>
                <td className="px-3 py-2 text-right">{formatBRL(it.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{formatBRL(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="px-3 py-1.5 text-right text-muted-foreground print:text-gray-700 text-xs">Subtotal</td><td className="px-3 py-1.5 text-right">{formatBRL(subtotal)}</td></tr>
            {quote.discount > 0 && (
              <tr><td colSpan={3} className="px-3 py-1.5 text-right text-muted-foreground print:text-gray-700 text-xs">Desconto</td><td className="px-3 py-1.5 text-right">- {formatBRL(quote.discount)}</td></tr>
            )}
            <tr className="bg-muted/30 print:bg-gray-50">
              <td colSpan={3} className="px-3 py-2 text-right font-display text-gold print:text-black">Total</td>
              <td className="px-3 py-2 text-right font-display text-gold print:text-black">{formatBRL(quote.total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground print:text-gray-600">Forma de pagamento</p>
            <p className="mt-0.5">
              {quote.paymentMode === "avista"
                ? "À vista"
                : `${quote.installmentsCount}x parcelas a partir de ${formatDate(quote.firstDueDate ?? quote.issueDate)}`}
            </p>
          </div>
          {quote.notes && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground print:text-gray-600">Observações</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs">{quote.notes}</p>
            </div>
          )}
        </div>

        <div className="pt-8 mt-4 border-t border-border print:border-gray-300 text-center text-xs text-muted-foreground print:text-gray-600">
          <div className="mx-auto w-72 border-t border-border print:border-gray-400 pt-1">Assinatura</div>
        </div>
      </div>

      <QuoteWorkflow quote={quote} />

      <Card className="bg-card border-border print:hidden">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-gold" /> Documentos vinculados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(quote.documents ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado (proposta, PDF assinado, aditivos).</p>
          )}
          <ul className="divide-y divide-border">
            {(quote.documents ?? []).map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a href={d.dataUrl} download={d.name} className="text-gold hover:underline text-xs inline-flex items-center gap-1">
                    abrir <ExternalLink className="h-3 w-3" />
                  </a>
                  <button onClick={() => removeDoc(d.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Input type="file" accept=".pdf,.docx,.doc,.txt,image/*" onChange={addDoc} />
        </CardContent>
      </Card>

      {linkedTx && linkedTx.length > 0 && (
        <Card className="bg-card border-border print:hidden">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-gold" />
              Parcelas geradas ({quote.partyKind === "cliente" ? "A Receber" : "A Pagar"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {linkedTx.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">Venc. {formatDate(t.dueDate)} · {t.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatBRL(t.amount)}</span>
                    <Link to={quote.partyKind === "cliente" ? "/financeiro/receber" : "/financeiro/pagar"}
                          className="text-gold hover:underline text-xs inline-flex items-center gap-1">
                      ver <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {quote.history && quote.history.length > 0 && (
        <Card className="bg-card border-border print:hidden">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-gold" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quote.acceptedAt && (
              <p className="text-xs text-muted-foreground mb-3">
                Aceito por <span className="text-foreground font-medium">{quote.acceptedBy ?? "—"}</span> em {new Date(quote.acceptedAt).toLocaleString("pt-BR")}
              </p>
            )}
            <ul className="space-y-2">
              {quote.history.map((h, i) => (
                <li key={i} className="text-xs border-l-2 border-gold/40 pl-3">
                  <p className="text-muted-foreground">{new Date(h.at).toLocaleString("pt-BR")}</p>
                  <p className="whitespace-pre-wrap">{h.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">
              Gerar {quote.partyKind === "cliente" ? "contas a receber" : "contas a pagar"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Serão criadas <strong className="text-foreground">{quote.installmentsCount}</strong> parcela(s) de
              {" "}<strong className="text-foreground">{formatBRL(quote.total / Math.max(1, quote.installmentsCount))}</strong>,
              a partir de <strong className="text-foreground">{formatDate(quote.firstDueDate ?? quote.issueDate)}</strong>.
            </p>
            <div>
              <Label>Conta padrão (opcional)</Label>
              <Select value={accountId ? String(accountId) : ""} onValueChange={(v) => setAccountId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBillOpen(false)}>Cancelar</Button>
            <Button onClick={confirmBilling} className="bg-gradient-gold text-primary-foreground">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
