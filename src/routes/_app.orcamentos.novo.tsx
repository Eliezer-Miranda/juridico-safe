import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db, nextQuoteNumber, getSettings, type Quote, type QuoteItem, type PaymentCondition } from "@/lib/db";
import { quoteSubtotal, quoteTotal } from "@/lib/quotes";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orcamentos/novo")({
  validateSearch: (s: Record<string, unknown>) => ({
    projectId: s.projectId ? Number(s.projectId) : undefined,
  }),
  component: NewQuotePage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function NewQuotePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_app/orcamentos/novo" });
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const products = useLiveQuery(() => db.products.orderBy("name").toArray()) ?? [];
  const conditions = useLiveQuery(() => db.paymentConditions.toArray()) ?? [];
  const settings = useLiveQuery(() => getSettings());
  const project = useLiveQuery(async () => search.projectId ? await db.projects.get(search.projectId) : null, [search.projectId]);

  const [partyKind, setPartyKind] = useState<"cliente" | "fornecedor">("cliente");
  const [partyId, setPartyId] = useState<number | "">("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState(addDays(todayISO(), 30));
  const [seller, setSeller] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([
    { description: "", quantity: 1, unit: "Un", unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [conditionId, setConditionId] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState<"avista" | "parcelado">("avista");
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(addDays(todayISO(), 30));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!settings) return;
    if (settings.defaultSeller) setSeller((s) => s || settings.defaultSeller!);
    if (settings.quoteTerms) setNotes((s) => s || settings.quoteTerms!);
  }, [settings?.id]);

  useEffect(() => {
    if (project) setPartyId(project.clientId);
  }, [project?.id]);

  const applyCondition = (id: number) => {
    setConditionId(id);
    const c = conditions.find((x) => x.id === id);
    if (!c) return;
    if (c.installments <= 1) setPaymentMode("avista");
    else { setPaymentMode("parcelado"); setInstallmentsCount(c.installments); }
    setFirstDueDate(addDays(issueDate, c.intervalDays || 30));
    if (c.description) setNotes((n) => n || `Condição: ${c.name}${c.description ? " — " + c.description : ""}`);
  };

  const filteredParties = useMemo(() => clients.filter((c) => {
    const r = c.role ?? "cliente";
    if (partyKind === "cliente") return r === "cliente" || r === "ambos";
    return r === "fornecedor" || r === "ambos";
  }), [clients, partyKind]);

  const subtotal = quoteSubtotal({ items });
  const total = quoteTotal({ items, discount });

  const setItem = (idx: number, patch: Partial<QuoteItem>) =>
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const addItem = () =>
    setItems([...items, { description: "", quantity: 1, unit: "Un", unitPrice: 0 }]);
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, productId: number) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItem(idx, {
      productId: p.id, description: p.name, unit: p.unit, unitPrice: p.price,
    });
  };

  const save = async (status: "rascunho" | "enviado" = "rascunho") => {
    if (!partyId) return toast.error(partyKind === "cliente" ? "Selecione o cliente" : "Selecione o fornecedor");
    if (items.length === 0 || items.every((i) => !i.description.trim())) return toast.error("Adicione ao menos um item");
    const cleanItems = items.filter((i) => i.description.trim());
    const now = new Date().toISOString();
    const number = await nextQuoteNumber();
    const quote: Quote = {
      number, partyId: Number(partyId), partyKind, issueDate, expiryDate, seller,
      items: cleanItems, discount: Number(discount) || 0,
      total: quoteTotal({ items: cleanItems, discount: Number(discount) || 0 }),
      notes, status, paymentMode,
      installmentsCount: paymentMode === "avista" ? 1 : Math.max(1, installmentsCount),
      firstDueDate,
      paymentConditionId: conditionId ? Number(conditionId) : undefined,
      projectId: search.projectId,
      createdAt: now, updatedAt: now,
    };
    const id = await db.quotes.add(quote);
    toast.success(`Orçamento ${number} criado`);
    navigate({ to: "/orcamentos/$id", params: { id: String(id) } });
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6 animate-in-up">
      <header>
        <button onClick={() => navigate({ to: "/orcamentos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Novo</p>
        <h1 className="font-display text-4xl mt-1">Gerar orçamento</h1>
        {project && (
          <p className="text-sm text-muted-foreground mt-1">
            Vinculado ao projeto <span className="text-gold font-mono">{project.code}</span> — {project.name}
          </p>
        )}
      </header>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Dados gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Tipo">
              <Select value={partyKind} onValueChange={(v) => { setPartyKind(v as any); setPartyId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Para cliente (gera A Receber)</SelectItem>
                  <SelectItem value="fornecedor">De fornecedor (gera A Pagar)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={
              <span className="flex items-center justify-between">
                <span>{partyKind === "cliente" ? "Cliente" : "Fornecedor"}</span>
                <Link to="/clientes/novo" className="text-[10px] text-gold hover:underline normal-case tracking-normal">+ Novo cadastro</Link>
              </span>
            }>
              <Select value={partyId ? String(partyId) : ""} onValueChange={(v) => setPartyId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {filteredParties.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cadastro encontrado.</div>
                  )}
                  {filteredParties.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.document}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vendedor / Responsável"><Input value={seller} onChange={(e) => setSeller(e.target.value)} /></Field>
            <Field label="Data de emissão"><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
            <Field label="Validade até"><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Itens</CardTitle>
          <div className="flex items-center gap-2">
            <Link to="/cadastros/produtos" className="text-xs text-gold hover:underline">Gerenciar produtos</Link>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-border/50 pb-3">
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Produto (opcional)</Label>
                <Select value={it.productId ? String(it.productId) : ""} onValueChange={(v) => pickProduct(idx, Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Buscar cadastro…" /></SelectTrigger>
                  <SelectContent>
                    {products.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum produto. Cadastre em Produtos &amp; Serviços.</div>}
                    {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                <Input value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Descrição do item" />
              </div>
              <div className="col-span-3 md:col-span-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Qtd</Label>
                <Input type="number" step="0.01" value={it.quantity} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })} />
              </div>
              <div className="col-span-3 md:col-span-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Un</Label>
                <Input value={it.unit ?? ""} onChange={(e) => setItem(idx, { unit: e.target.value })} placeholder="Un" />
              </div>
              <div className="col-span-3 md:col-span-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Valor unit. (R$)</Label>
                <Input type="number" step="0.01" value={it.unitPrice} onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 md:col-span-1 text-right text-sm font-medium pt-5">
                {formatBRL((it.quantity || 0) * (it.unitPrice || 0))}
              </div>
              <div className="col-span-1 md:col-span-1 flex justify-end pt-5">
                <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-col items-end gap-1 pt-2 text-sm">
            <div className="flex gap-8"><span className="text-muted-foreground">Subtotal</span><span className="font-medium w-32 text-right">{formatBRL(subtotal)}</span></div>
            <div className="flex gap-8 items-center">
              <span className="text-muted-foreground">Desconto (R$)</span>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-32 text-right" />
            </div>
            <div className="flex gap-8 text-lg pt-2 border-t border-border w-full md:w-auto">
              <span className="text-gold font-display">Total</span>
              <span className="font-display text-gold w-32 text-right">{formatBRL(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl">Faturamento</CardTitle>
          <Link to="/cadastros/condicoes" className="text-xs text-gold hover:underline">Gerenciar condições</Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Condição cadastrada">
              <Select value={conditionId ? String(conditionId) : ""} onValueChange={(v) => applyCondition(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {conditions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma condição cadastrada.</div>}
                  {conditions.map((c: PaymentCondition) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Forma de pagamento">
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº de parcelas">
              <Input type="number" min={1} value={installmentsCount}
                onChange={(e) => setInstallmentsCount(Math.max(1, Number(e.target.value)))}
                disabled={paymentMode === "avista"} />
            </Field>
            <Field label="1º vencimento">
              <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Observações / Termos">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => save("rascunho")}>Salvar rascunho</Button>
        <Button onClick={() => save("enviado")} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> Salvar e enviar
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
