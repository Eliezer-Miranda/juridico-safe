import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FinTx, type FinTxKind } from "@/lib/db";
import { CATEGORIES_PAY, CATEGORIES_RECEIVE } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function TxDialog({ open, onOpenChange, kind, tx }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: FinTxKind; tx?: FinTx | null;
}) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const editing = !!tx?.id;
  const [form, setForm] = useState<Partial<FinTx>>(
    tx ?? { kind, status: "pendente", dueDate: new Date().toISOString().slice(0, 10), amount: 0, category: "Outros", description: "" },
  );

  const cats = kind === "receber" ? CATEGORIES_RECEIVE : CATEGORIES_PAY;

  const save = async () => {
    if (!form.description?.trim()) return toast.error("Descrição é obrigatória");
    if (!form.amount || form.amount <= 0) return toast.error("Valor deve ser maior que zero");
    const now = new Date().toISOString();
    const data: FinTx = {
      id: tx?.id,
      kind,
      description: form.description!,
      category: form.category ?? "Outros",
      accountId: form.accountId,
      amount: Number(form.amount),
      dueDate: form.dueDate ?? now.slice(0, 10),
      status: (form.status as any) ?? "pendente",
      recurrence: form.recurrence ?? "nenhuma",
      notes: form.notes,
      createdAt: tx?.createdAt ?? now,
    };
    if (editing) await db.finTx.update(tx!.id!, data);
    else await db.finTx.add(data);
    toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Editar" : "Novo"} {kind === "receber" ? "recebimento" : "pagamento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category ?? "Outros"} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={form.accountId ? String(form.accountId) : ""} onValueChange={(v) => setForm({ ...form, accountId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recorrência</Label>
              <Select value={form.recurrence ?? "nenhuma"} onValueChange={(v) => setForm({ ...form, recurrence: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "pendente"} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayDialog({ open, onOpenChange, tx }: { open: boolean; onOpenChange: (o: boolean) => void; tx: FinTx }) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState(tx.amount);
  const [paidAccountId, setPaidAccountId] = useState<number | undefined>(tx.accountId);

  const confirm = async () => {
    if (!paidAccountId) return toast.error("Selecione a conta");
    await db.finTx.update(tx.id!, { status: "pago", paidAt, paidAmount, paidAccountId });
    toast.success(tx.kind === "receber" ? "Recebimento registrado" : "Pagamento registrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">
            Registrar {tx.kind === "receber" ? "recebimento" : "pagamento"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{tx.description}</p>
        <div className="space-y-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div>
            <Label>Valor pago (R$)</Label>
            <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Conta</Label>
            <Select value={paidAccountId ? String(paidAccountId) : ""} onValueChange={(v) => setPaidAccountId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} className="bg-gradient-gold text-primary-foreground">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
