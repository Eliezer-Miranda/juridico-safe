import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type PaymentCondition } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty: Omit<PaymentCondition, "id"> = {
  name: "", description: "", installments: 1, intervalDays: 30,
  downPaymentPct: 0, active: true, createdAt: "",
};

export function PaymentConditionsManager() {
  const items = useLiveQuery(() => db.paymentConditions.orderBy("name").toArray()) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentCondition | null>(null);
  const [form, setForm] = useState<Omit<PaymentCondition, "id">>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: PaymentCondition) => { setEditing(c); setForm({ ...empty, ...c }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome");
    if (editing?.id) {
      await db.paymentConditions.update(editing.id, form);
      toast.success("Atualizado");
    } else {
      await db.paymentConditions.add({ ...form, createdAt: new Date().toISOString() } as PaymentCondition);
      toast.success("Cadastrado");
    }
    setOpen(false);
  };

  const remove = async (c: PaymentCondition) => {
    if (!confirm(`Excluir "${c.name}"?`)) return;
    await db.paymentConditions.delete(c.id!);
    toast.success("Excluído");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Ex.: À vista, Entrada + 3x, 30/60/90 dias — usadas no orçamento para gerar parcelas.
        </p>
        <Button size="sm" onClick={openNew} className="bg-gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded">
          Nenhuma condição cadastrada.
        </p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-right px-3 py-2">Parcelas</th>
                <th className="text-right px-3 py-2">Intervalo</th>
                <th className="text-right px-3 py-2">Entrada</th>
                <th className="text-left px-3 py-2">Ativo</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{c.name}{c.description && <span className="text-xs text-muted-foreground block">{c.description}</span>}</td>
                  <td className="px-3 py-2 text-right">{c.installments}</td>
                  <td className="px-3 py-2 text-right">{c.intervalDays}d</td>
                  <td className="px-3 py-2 text-right">{((c.downPaymentPct ?? 0) * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2">{c.active ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Editar condição" : "Nova condição"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: 30/60/90" /></Field></div>
            <div className="md:col-span-2"><Field label="Descrição"><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
            <Field label="Nº de parcelas"><Input type="number" min={1} value={form.installments} onChange={(e) => setForm({ ...form, installments: Math.max(1, Number(e.target.value)) })} /></Field>
            <Field label="Intervalo (dias)"><Input type="number" min={0} value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: Math.max(0, Number(e.target.value)) })} /></Field>
            <Field label="Entrada (% do total)"><Input type="number" step="0.01" min={0} max={100} value={(form.downPaymentPct ?? 0) * 100} onChange={(e) => setForm({ ...form, downPaymentPct: Math.max(0, Number(e.target.value)) / 100 })} /></Field>
            <Field label="Ativo">
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
                <option value="1">Sim</option><option value="0">Não</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button>
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
