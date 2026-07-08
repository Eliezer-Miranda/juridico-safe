import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db, nextQuoteNumber, type Product, type Quote, type QuoteItem, type PaymentCondition } from "@/lib/db";
import { quoteSubtotal, quoteTotal } from "@/lib/quotes";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Save, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentConditionsManager } from "@/components/PaymentConditionsManager";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface QuoteFormProps {
  mode: "new" | "edit";
  initial?: Quote;
  projectId?: number;
  defaultSeller?: string;
  defaultNotes?: string;
}

export function QuoteForm({ mode, initial, projectId, defaultSeller, defaultNotes }: QuoteFormProps) {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const products = useLiveQuery(() => db.products.orderBy("name").toArray()) ?? [];
  const conditions = useLiveQuery(
    () => db.paymentConditions.orderBy("name").filter((c) => c.active !== false).toArray()
  ) ?? [];
  const project = useLiveQuery(async () => projectId ? await db.projects.get(projectId) : null, [projectId]);

  const [partyKind, setPartyKind] = useState<"cliente" | "fornecedor">(initial?.partyKind ?? "cliente");
  const [partyId, setPartyId] = useState<number | "">(initial?.partyId ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? addDays(todayISO(), 30));
  const [seller, setSeller] = useState(initial?.seller ?? "");
  const [items, setItems] = useState<QuoteItem[]>(initial?.items?.length ? initial.items : [
    { description: "", quantity: 1, unit: "Un", unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [conditionId, setConditionId] = useState<number | "">(initial?.paymentConditionId ?? "");
  const [paymentMode, setPaymentMode] = useState<"avista" | "parcelado">(initial?.paymentMode ?? "avista");
  const [installmentsCount, setInstallmentsCount] = useState(initial?.installmentsCount ?? 1);
  const [firstDueDate, setFirstDueDate] = useState(initial?.firstDueDate ?? addDays(todayISO(), 30));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Quick-add product dialog
  const [prodOpen, setProdOpen] = useState(false);
  const [condMgrOpen, setCondMgrOpen] = useState(false);
  const [prodItemIdx, setProdItemIdx] = useState<number | null>(null);
  const emptyProd: Omit<Product, "id"> = {
    sku: "", name: "", description: "", unit: "Un",
    price: 0, cost: 0, category: "", active: true,
    createdAt: "", updatedAt: "",
  };
  const [newProd, setNewProd] = useState<Omit<Product, "id">>(emptyProd);

  useEffect(() => {
    if (mode !== "new") return;
    if (defaultSeller) setSeller((s) => s || defaultSeller);
    if (defaultNotes) setNotes((s) => s || defaultNotes);
  }, [defaultSeller, defaultNotes, mode]);

  useEffect(() => {
    if (mode === "new" && project) setPartyId(project.clientId);
  }, [project?.id, mode]);

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

  const openNewProduct = (idx: number) => {
    setProdItemIdx(idx);
    setNewProd(emptyProd);
    setProdOpen(true);
  };

  const saveNewProduct = async () => {
    if (!newProd.name.trim()) return toast.error("Informe o nome do produto");
    const now = new Date().toISOString();
    const id = await db.products.add({ ...newProd, createdAt: now, updatedAt: now } as Product);
    toast.success("Produto cadastrado");
    if (prodItemIdx !== null) {
      setItem(prodItemIdx, {
        productId: Number(id),
        description: newProd.name,
        unit: newProd.unit,
        unitPrice: newProd.price,
      });
    }
    setProdOpen(false);
  };

  const save = async (status: "rascunho" | "enviado" = "rascunho") => {
    if (!partyId) return toast.error(partyKind === "cliente" ? "Selecione o cliente" : "Selecione o fornecedor");
    if (items.length === 0 || items.every((i) => !i.description.trim())) return toast.error("Adicione ao menos um item");
    const cleanItems = items.filter((i) => i.description.trim());
    const now = new Date().toISOString();

    if (mode === "edit" && initial?.id) {
      const patch: Partial<Quote> = {
        partyId: Number(partyId), partyKind, issueDate, expiryDate, seller,
        items: cleanItems, discount: Number(discount) || 0,
        total: quoteTotal({ items: cleanItems, discount: Number(discount) || 0 }),
        notes, status: status ?? initial.status,
        paymentMode,
        installmentsCount: paymentMode === "avista" ? 1 : Math.max(1, installmentsCount),
        firstDueDate,
        paymentConditionId: conditionId ? Number(conditionId) : undefined,
        updatedAt: now,
      };
      await db.quotes.update(initial.id, patch);
      toast.success(`Orçamento ${initial.number} atualizado`);
      navigate({ to: "/orcamentos/$id", params: { id: String(initial.id) } });
      return;
    }

    const number = await nextQuoteNumber();
    const quote: Quote = {
      number, partyId: Number(partyId), partyKind, issueDate, expiryDate, seller,
      items: cleanItems, discount: Number(discount) || 0,
      total: quoteTotal({ items: cleanItems, discount: Number(discount) || 0 }),
      notes, status, paymentMode,
      installmentsCount: paymentMode === "avista" ? 1 : Math.max(1, installmentsCount),
      firstDueDate,
      paymentConditionId: conditionId ? Number(conditionId) : undefined,
      projectId,
      createdAt: now, updatedAt: now,
    };
    const id = await db.quotes.add(quote);
    toast.success(`Orçamento ${number} criado`);
    navigate({ to: "/orcamentos/$id", params: { id: String(id) } });
  };

  const isFaturado = initial?.status === "faturado" && !!initial?.linkedTxIds?.length;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6 animate-in-up">
      <header>
        <button
          onClick={() => navigate(mode === "edit" && initial?.id
            ? { to: "/orcamentos/$id", params: { id: String(initial.id) } }
            : { to: "/orcamentos" })}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">
          {mode === "edit" ? "Editar" : "Novo"}
        </p>
        <h1 className="font-display text-4xl mt-1">
          {mode === "edit" ? `Editar orçamento ${initial?.number ?? ""}` : "Gerar orçamento"}
        </h1>
        {project && mode === "new" && (
          <p className="text-sm text-muted-foreground mt-1">
            Vinculado ao projeto <span className="text-gold font-mono">{project.code}</span> — {project.name}
          </p>
        )}
        {isFaturado && (
          <p className="text-xs text-destructive mt-2">
            Este orçamento já foi faturado. Alterações não recriam as parcelas — desfaça o faturamento antes de mudar valores.
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
                <Link to={partyKind === "cliente" ? "/clientes/novo" : "/fornecedores/novo"} className="text-[10px] text-gold hover:underline normal-case tracking-normal">+ Novo cadastro</Link>
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Produto (opcional / avulso)</Label>
                  <button type="button" onClick={() => openNewProduct(idx)} className="text-[10px] text-gold hover:underline">
                    + Novo produto
                  </button>
                </div>
                <ProductSearch
                  products={products}
                  selectedId={it.productId}
                  onPick={(p) => pickProduct(idx, p.id!)}
                  onClear={() => setItem(idx, { productId: undefined })}
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                <Input value={it.description} onChange={(e) => setItem(idx, { description: e.target.value, productId: undefined })} placeholder="Item avulso ou descrição livre" />
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
                  {conditions.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhuma condição ativa. Cadastre em Configurações → Condições de pagamento.</div>}
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
        {mode === "edit" ? (
          <Button onClick={() => save(initial?.status === "rascunho" ? "rascunho" : "enviado")} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Save className="h-4 w-4 mr-2" /> Salvar alterações
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => save("rascunho")}>Salvar rascunho</Button>
            <Button onClick={() => save("enviado")} className="bg-gradient-gold text-primary-foreground shadow-gold">
              <Save className="h-4 w-4 mr-2" /> Salvar e enviar
            </Button>
          </>
        )}
      </div>

      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="bg-card max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo produto</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="SKU / Código"><Input value={newProd.sku ?? ""} onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })} /></Field>
            <Field label="Categoria"><Input value={newProd.category ?? ""} onChange={(e) => setNewProd({ ...newProd, category: e.target.value })} placeholder="Ex: Material, Serviço" /></Field>
            <div className="md:col-span-2"><Field label="Nome"><Input value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} /></Field></div>
            <div className="md:col-span-2"><Field label="Descrição"><Textarea rows={2} value={newProd.description ?? ""} onChange={(e) => setNewProd({ ...newProd, description: e.target.value })} /></Field></div>
            <Field label="Unidade"><Input value={newProd.unit} onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })} placeholder="Un, kg, m, h…" /></Field>
            <Field label="Custo (R$)"><Input type="number" step="0.01" value={newProd.cost ?? 0} onChange={(e) => setNewProd({ ...newProd, cost: Number(e.target.value) })} /></Field>
            <Field label="Preço de venda (R$)"><Input type="number" step="0.01" value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: Number(e.target.value) })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewProduct} className="bg-gradient-gold text-primary-foreground">Cadastrar e usar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ProductSearch({
  products, selectedId, onPick, onClear,
}: {
  products: Product[];
  selectedId?: number;
  onPick: (p: Product) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = selectedId ? products.find((p) => p.id === selectedId) : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        const hay = `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase();
        return hay.includes(q) || p.name.toLowerCase().startsWith(q);
      })
      .slice(0, 8);
  }, [products, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm">
        <span className="flex-1 truncate">{selected.name}{selected.sku ? ` (${selected.sku})` : ""}</span>
        <button type="button" onClick={() => { onClear(); setQuery(""); }} className="text-[10px] text-muted-foreground hover:text-destructive">
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Digite palavra-chave ou iniciais…"
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-auto">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado. Preencha a descrição para item avulso.</div>
          ) : matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(p); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border/40 last:border-b-0"
            >
              <div className="truncate">{p.name}{p.sku ? <span className="text-muted-foreground"> ({p.sku})</span> : null}</div>
              {p.category && <div className="text-[10px] text-muted-foreground">{p.category}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
