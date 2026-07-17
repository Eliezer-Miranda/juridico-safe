import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type StockEntry, type StockEntryItem } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Upload, Save } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { moveStock } from "@/lib/stock";
import { parseNFeXml } from "@/lib/nfe-xml";

export const Route = createFileRoute("/_app/estoque/notas/nova")({
  component: NovaNotaEntrada,
});

const emptyItem: StockEntryItem = { description: "", ncm: "", unit: "UN", quantity: 1, unitPrice: 0, total: 0 };

function NovaNotaEntrada() {
  const navigate = useNavigate();
  const suppliers = useLiveQuery(() =>
    db.clients.filter((c) => c.role === "fornecedor" || c.role === "ambos").toArray(),
  ) ?? [];

  const [form, setForm] = useState<Omit<StockEntry, "id" | "createdAt">>({
    number: "", series: "",
    supplierId: undefined, supplierName: "", supplierDocument: "",
    issueDate: new Date().toISOString().substring(0, 10),
    total: 0, items: [{ ...emptyItem }], notes: "",
  });

  const setItem = (i: number, patch: Partial<StockEntryItem>) => {
    const items = form.items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      next.total = Number((next.quantity * next.unitPrice).toFixed(2));
      return next;
    });
    const total = items.reduce((s, x) => s + x.total, 0);
    setForm({ ...form, items, total });
  };

  const addRow = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const rmRow = (i: number) => {
    const items = form.items.filter((_, idx) => idx !== i);
    const total = items.reduce((s, x) => s + x.total, 0);
    setForm({ ...form, items, total });
  };

  const onXml = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseNFeXml(text, file.name);
      const matchSupplier = parsed.supplierDocument
        ? suppliers.find((s) => (s.document ?? "").replace(/\D/g, "") === parsed.supplierDocument!.replace(/\D/g, ""))
        : undefined;
      setForm({
        ...parsed,
        supplierId: matchSupplier?.id,
        notes: "",
      });
      toast.success(`XML importado — ${parsed.items.length} item(ns)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler XML");
    }
  };

  const save = async () => {
    if (!form.number.trim()) return toast.error("Informe o número da nota");
    if (form.items.length === 0) return toast.error("Adicione pelo menos um item");

    // Auto-cadastro / vínculo de produtos
    const processed: StockEntryItem[] = [];
    for (const it of form.items) {
      let productId = it.productId;
      if (!productId) {
        // Try to match by name (case-insensitive)
        const existing = await db.products.filter((p) =>
          p.name.trim().toLowerCase() === it.description.trim().toLowerCase(),
        ).first();
        if (existing?.id) {
          productId = existing.id;
          // Update NCM/price if missing
          const patch: any = { updatedAt: new Date().toISOString() };
          if (!existing.ncm && it.ncm) patch.ncm = it.ncm;
          if (!existing.cost && it.unitPrice) patch.cost = it.unitPrice;
          await db.products.update(existing.id, patch);
        } else {
          const now = new Date().toISOString();
          productId = await db.products.add({
            name: it.description || "Item sem nome",
            unit: it.unit || "UN",
            price: it.unitPrice,
            cost: it.unitPrice,
            ncm: it.ncm || undefined,
            stock: 0,
            active: true,
            createdAt: now, updatedAt: now,
          } as any);
        }
      }
      processed.push({ ...it, productId });
    }

    const entryId = await db.stockEntries.add({
      ...form,
      items: processed,
      createdAt: new Date().toISOString(),
    } as StockEntry);

    // Move stock
    for (const it of processed) {
      if (it.productId) {
        await moveStock(it.productId, "entrada", it.quantity, "entrada", entryId as number, `NF ${form.number}`);
      }
    }

    toast.success("Nota lançada — estoque atualizado");
    navigate({ to: "/estoque/notas" });
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/estoque/notas"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Estoque</p>
          <h1 className="font-display text-3xl mt-1">Nova nota de entrada</h1>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Importar XML da NF-e</CardTitle></CardHeader>
        <CardContent>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="file" accept=".xml,application/xml,text/xml" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onXml(f); e.target.value = ""; }} />
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted/40 text-sm">
              <Upload className="h-4 w-4" /> Escolher arquivo XML
            </span>
          </label>
          <p className="text-xs text-muted-foreground mt-2">Preenche número, fornecedor, itens, NCM e valores automaticamente.</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Dados da nota</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Número"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Série"><Input value={form.series ?? ""} onChange={(e) => setForm({ ...form, series: e.target.value })} /></Field>
          <Field label="Emissão"><Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></Field>
          <Field label="Fornecedor cadastrado">
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.supplierId ?? ""} onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : undefined;
                const s = suppliers.find((x) => x.id === id);
                setForm({ ...form, supplierId: id, supplierName: s?.name ?? form.supplierName, supplierDocument: s?.document ?? form.supplierDocument });
              }}>
              <option value="">— Selecionar / avulso —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2"><Field label="Nome do fornecedor (livre)"><Input value={form.supplierName ?? ""} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></Field></div>
          <Field label="CNPJ/CPF"><Input value={form.supplierDocument ?? ""} onChange={(e) => setForm({ ...form, supplierDocument: e.target.value })} /></Field>
          <div className="md:col-span-4"><Field label="Observações"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Itens</CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Descrição</th>
                  <th className="text-left px-2 py-2 w-28">NCM/SH</th>
                  <th className="text-left px-2 py-2 w-20">Un</th>
                  <th className="text-right px-2 py-2 w-24">Qtd</th>
                  <th className="text-right px-2 py-2 w-32">V. Unit</th>
                  <th className="text-right px-2 py-2 w-32">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1"><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                    <td className="px-2 py-1"><Input value={it.ncm ?? ""} onChange={(e) => setItem(i, { ncm: e.target.value })} placeholder="00000000" /></td>
                    <td className="px-2 py-1"><Input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                    <td className="px-2 py-1"><Input type="number" step="0.001" className="text-right" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input type="number" step="0.01" className="text-right" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} /></td>
                    <td className="px-2 py-1 text-right font-medium">{formatBRL(it.total)}</td>
                    <td className="px-2 py-1"><Button size="sm" variant="ghost" onClick={() => rmRow(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3 border-t border-border">
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Total da nota</p>
              <p className="font-display text-2xl text-gold">{formatBRL(form.total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/estoque/notas"><Button variant="ghost">Cancelar</Button></Link>
        <Button onClick={save} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> Lançar e atualizar estoque
        </Button>
      </div>
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
