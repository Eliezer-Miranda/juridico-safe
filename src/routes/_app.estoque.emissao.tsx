import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, type FiscalEmission, type FiscalEmissionItem } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileOutput, Plus, CheckCircle2, Printer, Trash2, Undo2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { moveStock } from "@/lib/stock";

export const Route = createFileRoute("/_app/estoque/emissao")({
  component: EmissaoPage,
});

const emptyItem: FiscalEmissionItem = { description: "", ncm: "", unit: "UN", quantity: 1, unitPrice: 0, total: 0 };

function EmissaoPage() {
  const emissions = useLiveQuery(async () => {
    const arr = await db.fiscalEmissions.toArray();
    return arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  const [filter, setFilter] = useState<"pendente" | "emitida" | "todas">("pendente");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<FiscalEmission, "id" | "createdAt">>({
    partyId: undefined, partyName: "",
    items: [{ ...emptyItem }], total: 0, status: "pendente", notes: "",
  });

  const [markOpen, setMarkOpen] = useState<FiscalEmission | null>(null);
  const [nfNumber, setNfNumber] = useState("");
  const [nfKey, setNfKey] = useState("");

  const filtered = useMemo(
    () => emissions.filter((e) => filter === "todas" ? true : e.status === filter),
    [emissions, filter],
  );

  const setItem = (i: number, patch: Partial<FiscalEmissionItem>) => {
    const items = form.items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      next.total = Number((next.quantity * next.unitPrice).toFixed(2));
      return next;
    });
    setForm({ ...form, items, total: items.reduce((s, x) => s + x.total, 0) });
  };
  const pickProduct = (i: number, pid: number) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    setItem(i, {
      productId: pid, description: p.name, ncm: p.ncm ?? "",
      unit: p.unit, unitPrice: p.price,
    });
  };

  const save = async () => {
    if (form.items.length === 0 || form.items.every((x) => !x.description.trim()))
      return toast.error("Adicione ao menos um item");
    const cleanItems = form.items.filter((x) => x.description.trim());
    const total = cleanItems.reduce((s, x) => s + x.total, 0);
    await db.fiscalEmissions.add({
      ...form, items: cleanItems, total,
      createdAt: new Date().toISOString(),
    } as FiscalEmission);
    // Baixa de estoque no momento do lançamento (marcação)
    for (const it of cleanItems) {
      if (it.productId) await moveStock(it.productId, "saida", it.quantity, "emissao", undefined, "Fila NF-e");
    }
    toast.success("Item adicionado à fila de emissão — estoque abatido");
    setOpen(false);
    setForm({ partyId: undefined, partyName: "", items: [{ ...emptyItem }], total: 0, status: "pendente", notes: "" });
  };

  const markEmitted = async () => {
    if (!markOpen?.id) return;
    await db.fiscalEmissions.update(markOpen.id, {
      status: "emitida",
      emittedAt: new Date().toISOString(),
      nfNumber: nfNumber || undefined,
      nfKey: nfKey || undefined,
    });
    toast.success("Marcada como emitida");
    setMarkOpen(null); setNfNumber(""); setNfKey("");
  };

  const revert = async (e: FiscalEmission) => {
    if (!confirm("Voltar para pendente?")) return;
    await db.fiscalEmissions.update(e.id!, { status: "pendente", emittedAt: undefined });
  };

  const remove = async (e: FiscalEmission) => {
    if (!confirm("Excluir? Estoque será reposto.")) return;
    for (const it of e.items) {
      if (it.productId) await moveStock(it.productId, "entrada", it.quantity, "emissao", e.id, "Cancelamento");
    }
    await db.fiscalEmissions.delete(e.id!);
    toast.success("Removido");
  };

  const totals = {
    pendente: emissions.filter((e) => e.status === "pendente").reduce((s, e) => s + e.total, 0),
    emitida: emissions.filter((e) => e.status === "emitida").reduce((s, e) => s + e.total, 0),
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Itens marcados para emissão de NF-e de saída. Use este relatório no portal fiscal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir relatório
          </Button>
          <Button onClick={() => setOpen(true)} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Plus className="h-4 w-4 mr-2" /> Marcar itens
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <StatCard label="Pendente" value={formatBRL(totals.pendente)} count={emissions.filter((e) => e.status === "pendente").length} tone="gold" />
        <StatCard label="Emitidas" value={formatBRL(totals.emitida)} count={emissions.filter((e) => e.status === "emitida").length} />
        <div className="flex items-center gap-2">
          {(["pendente", "emitida", "todas"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FileOutput className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum item na fila.</p>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden print:border-0 print:shadow-none">
          <div className="hidden print:block p-6">
            <h2 className="font-display text-2xl">Relatório — Itens para emissão de NF-e</h2>
            <p className="text-xs text-muted-foreground">Gerado em {new Date().toLocaleString("pt-BR")}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Destinatário</th>
                <th className="text-left px-4 py-3">Itens (descrição · NCM · qtd · v.un)</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3 w-36 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 align-top">
                  <td className="px-4 py-3 text-xs">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.partyName || "—"}</p>
                    {e.nfNumber && <p className="text-xs text-gold">NF {e.nfNumber}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="text-xs space-y-1">
                      {e.items.map((it, i) => (
                        <li key={i}>
                          <span className="font-medium">{it.description}</span>
                          {it.ncm && <span className="text-muted-foreground"> · NCM {it.ncm}</span>}
                          <span className="text-muted-foreground"> · {it.quantity} {it.unit} × {formatBRL(it.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(e.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${e.status === "emitida" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right print:hidden">
                    {e.status === "pendente" ? (
                      <Button size="sm" variant="ghost" onClick={() => setMarkOpen(e)} title="Marcar emitida">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => revert(e)} title="Reverter">
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(e)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Novo lançamento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-4xl">
          <DialogHeader><DialogTitle className="font-display text-xl">Marcar itens para emissão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Destinatário (cliente)">
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.partyId ?? ""} onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  const c = clients.find((x) => x.id === id);
                  setForm({ ...form, partyId: id, partyName: c?.name ?? form.partyName });
                }}>
                <option value="">— Selecionar —</option>
                {clients.filter((c) => c.role !== "fornecedor").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Nome livre (se avulso)"><Input value={form.partyName ?? ""} onChange={(e) => setForm({ ...form, partyName: e.target.value })} /></Field>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Produto</th>
                  <th className="text-left px-2 py-2">Descrição</th>
                  <th className="text-left px-2 py-2 w-28">NCM</th>
                  <th className="text-right px-2 py-2 w-20">Qtd</th>
                  <th className="text-right px-2 py-2 w-28">V.Un</th>
                  <th className="text-right px-2 py-2 w-28">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">
                      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={it.productId ?? ""} onChange={(e) => pickProduct(i, Number(e.target.value))}>
                        <option value="">— Avulso —</option>
                        {products.filter((p) => p.active).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} (est: {p.stock ?? 0})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1"><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                    <td className="px-2 py-1"><Input value={it.ncm ?? ""} onChange={(e) => setItem(i, { ncm: e.target.value })} /></td>
                    <td className="px-2 py-1"><Input type="number" step="0.001" className="text-right" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input type="number" step="0.01" className="text-right" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1 text-right">{formatBRL(it.total)}</td>
                    <td className="px-2 py-1"><Button size="sm" variant="ghost" onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
            </Button>
          </div>

          <Field label="Observações"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-gradient-gold text-primary-foreground">Adicionar à fila (baixa estoque)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marcar emitida */}
      <Dialog open={!!markOpen} onOpenChange={(v) => !v && setMarkOpen(null)}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl">Marcar como emitida</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Número da NF-e"><Input value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} placeholder="Ex: 000123456" /></Field>
            <Field label="Chave de acesso (44 dígitos)"><Input value={nfKey} onChange={(e) => setNfKey(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarkOpen(null)}>Cancelar</Button>
            <Button onClick={markEmitted} className="bg-gradient-gold text-primary-foreground">Confirmar emissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ label, value, count, tone }: { label: string; value: string; count: number; tone?: "gold" }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground tracking-widest">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className={`font-display text-2xl ${tone === "gold" ? "text-gold" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{count} item(ns)</p>
      </CardContent>
    </Card>
  );
}
