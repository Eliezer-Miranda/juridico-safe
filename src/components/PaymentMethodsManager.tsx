import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type PaymentMethodItem, type PaymentMethod } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const KINDS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "cartao", label: "Cartão" },
  { value: "outro", label: "Outro" },
];

const empty: Omit<PaymentMethodItem, "id"> = {
  name: "", description: "", kind: "pix", active: true, createdAt: "",
};

export function PaymentMethodsManager() {
  const items = useLiveQuery(() => db.paymentMethods.orderBy("name").toArray()) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodItem | null>(null);
  const [form, setForm] = useState<Omit<PaymentMethodItem, "id">>(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: PaymentMethodItem) => { setEditing(m); setForm({ ...empty, ...m }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome");
    if (editing?.id) {
      await db.paymentMethods.update(editing.id, form);
      toast.success("Atualizada");
    } else {
      await db.paymentMethods.add({ ...form, createdAt: new Date().toISOString() } as PaymentMethodItem);
      toast.success("Cadastrada");
    }
    setOpen(false);
  };

  const remove = async (m: PaymentMethodItem) => {
    if (!confirm(`Excluir "${m.name}"?`)) return;
    await db.paymentMethods.delete(m.id!);
    toast.success("Excluída");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Ex.: PIX Itaú, Boleto Sicoob, Cartão Stone — usadas ao registrar recebimentos e pagamentos.
        </p>
        <Button size="sm" onClick={openNew} className="bg-gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded">
          Nenhuma forma de pagamento cadastrada.
        </p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Ativo</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">
                    {m.name}
                    {m.description && <span className="text-xs text-muted-foreground block">{m.description}</span>}
                  </td>
                  <td className="px-3 py-2">{KINDS.find(k => k.value === m.kind)?.label ?? "—"}</td>
                  <td className="px-3 py-2">{m.active ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Editar forma" : "Nova forma de pagamento"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: PIX Itaú" /></Field>
            </div>
            <Field label="Tipo">
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.kind ?? "outro"}
                onChange={(e) => setForm({ ...form, kind: e.target.value as PaymentMethod })}>
                {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Ativo">
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
                <option value="1">Sim</option><option value="0">Não</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição / Instruções"><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: chave PIX, agência/conta, etc." /></Field>
            </div>
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
