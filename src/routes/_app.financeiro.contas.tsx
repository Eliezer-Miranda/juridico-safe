import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account, type AccountKind } from "@/lib/db";
import { ACCOUNT_KIND_LABEL, accountBalance } from "@/lib/finance";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Landmark, Wallet, CreditCard, PiggyBank } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financeiro/contas")({
  component: AccountsPage,
});

const ICONS: Record<AccountKind, any> = {
  corrente: Landmark, poupanca: PiggyBank, carteira: Wallet, cartao: CreditCard, investimento: PiggyBank, outro: Landmark,
};
const COLORS = ["#C9A84C", "#4ECDC4", "#FF6B6B", "#A78BFA", "#10B981", "#F59E0B", "#3B82F6", "#EC4899"];

function AccountsPage() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const txs = useLiveQuery(() => db.finTx.toArray()) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const remove = async (a: Account) => {
    const used = txs.some((t) => t.accountId === a.id || t.paidAccountId === a.id);
    if (used) return toast.error("Conta possui lançamentos vinculados.");
    if (!confirm(`Excluir a conta "${a.name}"?`)) return;
    await db.accounts.delete(a.id!);
    toast.success("Conta removida");
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Contas & Carteiras</h2>
          <p className="text-sm text-muted-foreground">Bancos, carteiras, cartões e contas de investimento.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Nova conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-12 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Cadastre suas contas para acompanhar saldo e movimentações.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const Icon = ICONS[a.kind];
            const bal = accountBalance(a, txs);
            return (
              <Card key={a.id} className="bg-card border-border overflow-hidden">
                <div className="h-1.5" style={{ background: a.color ?? "var(--color-gold)" }} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent grid place-items-center">
                        <Icon className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="font-display text-lg leading-tight">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABEL[a.kind]} · {a.institution ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Saldo atual</p>
                    <p className={`font-display text-3xl mt-1 ${bal < 0 ? "text-destructive" : "text-gold"}`}>{formatBRL(bal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Saldo inicial: {formatBRL(a.openingBalance)} · {formatDate(a.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {open && <AccountDialog open={open} onOpenChange={setOpen} account={editing} />}
    </div>
  );
}

function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: Account | null }) {
  const editing = !!account?.id;
  const [form, setForm] = useState<Partial<Account>>(
    account ?? { name: "", kind: "corrente", openingBalance: 0, color: COLORS[0] },
  );

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Nome é obrigatório");
    const now = new Date().toISOString();
    const data: Account = {
      id: account?.id,
      name: form.name!,
      kind: (form.kind as AccountKind) ?? "corrente",
      institution: form.institution,
      openingBalance: Number(form.openingBalance ?? 0),
      color: form.color,
      notes: form.notes,
      archived: false,
      createdAt: account?.createdAt ?? now,
    };
    if (editing) await db.accounts.update(account!.id!, data);
    else await db.accounts.add(data);
    toast.success(editing ? "Conta atualizada" : "Conta criada");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank, Carteira, Itaú…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind ?? "corrente"} onValueChange={(v) => setForm({ ...form, kind: v as AccountKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instituição</Label>
              <Input value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Saldo inicial (R$)</Label>
            <Input type="number" step="0.01" value={form.openingBalance ?? 0} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
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
