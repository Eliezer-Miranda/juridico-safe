import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Investment, type InvestmentKind, type InvMovement, type InvMovKind } from "@/lib/db";
import { INV_KIND_LABEL, investmentValue, investmentCost, investmentPnL, investmentPnLPct } from "@/lib/finance";
import { formatBRL, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/financeiro/investimentos")({
  component: InvestmentsPage,
});

const COLORS = ["oklch(0.74 0.13 80)", "oklch(0.65 0.16 195)", "oklch(0.65 0.16 155)", "oklch(0.58 0.22 25)", "oklch(0.6 0.15 290)", "oklch(0.78 0.16 70)", "oklch(0.55 0.12 250)"];

function InvestmentsPage() {
  const invs = useLiveQuery(() => db.investments.toArray()) ?? [];
  const movs = useLiveQuery(() => db.invMovements.toArray()) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [movFor, setMovFor] = useState<Investment | null>(null);

  const totalValue = useMemo(() => invs.reduce((s, i) => s + investmentValue(i), 0), [invs]);
  const totalCost = useMemo(() => invs.reduce((s, i) => s + investmentCost(i), 0), [invs]);
  const totalPnL = totalValue - totalCost;
  const totalPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const allocation = useMemo(() => {
    const map = invs.reduce<Record<string, number>>((acc, i) => {
      acc[INV_KIND_LABEL[i.kind]] = (acc[INV_KIND_LABEL[i.kind]] ?? 0) + investmentValue(i);
      return acc;
    }, {});
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [invs]);

  const remove = async (i: Investment) => {
    if (!confirm(`Excluir "${i.name}" e todas suas movimentações?`)) return;
    await db.invMovements.where("investmentId").equals(i.id!).delete();
    await db.investments.delete(i.id!);
    toast.success("Removido");
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Investimentos</h2>
          <p className="text-sm text-muted-foreground">Sua carteira: aportes, posições e rentabilidade.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Novo ativo
        </Button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border border-l-2 border-l-gold">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Patrimônio</p>
            <p className="font-display text-2xl text-gold mt-1">{formatBRL(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Custo total</p>
            <p className="font-display text-2xl mt-1">{formatBRL(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className={`bg-card border-border border-l-2 ${totalPnL >= 0 ? "border-l-success" : "border-l-destructive"}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Resultado</p>
            <p className={`font-display text-2xl mt-1 ${totalPnL >= 0 ? "text-success" : "text-destructive"}`}>
              {totalPnL >= 0 ? "+" : ""}{formatBRL(totalPnL)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Rentabilidade</p>
            <p className={`font-display text-2xl mt-1 flex items-center gap-1 ${totalPct >= 0 ? "text-success" : "text-destructive"}`}>
              {totalPct >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {totalPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardContent className="p-4">
            {invs.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhum ativo cadastrado ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">Posição</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invs.map((i) => {
                    const pnl = investmentPnL(i);
                    const pct = investmentPnLPct(i);
                    return (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p className="font-medium">{i.name}</p>
                          {i.ticker && <p className="text-xs text-muted-foreground">{i.ticker} · {i.broker ?? "—"}</p>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{INV_KIND_LABEL[i.kind]}</TableCell>
                        <TableCell className="text-right">{i.quantity}</TableCell>
                        <TableCell className="text-right">{formatBRL(i.avgPrice)}</TableCell>
                        <TableCell className="text-right">{formatBRL(i.currentPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatBRL(investmentValue(i))}</TableCell>
                        <TableCell className={`text-right ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                          <div className="font-medium">{pnl >= 0 ? "+" : ""}{formatBRL(pnl)}</div>
                          <div className="text-xs">{pct.toFixed(2)}%</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setMovFor(i)} title="Movimentações"><History className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="font-display text-lg mb-2">Alocação</p>
            <div className="h-72">
              {allocation.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                      {allocation.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.04 245)", border: "1px solid oklch(0.34 0.03 245)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {open && <InvDialog open={open} onOpenChange={setOpen} inv={editing} />}
      {movFor && <MovementsDialog open={!!movFor} onOpenChange={(o) => !o && setMovFor(null)} inv={movFor} movs={movs.filter((m) => m.investmentId === movFor.id)} />}
    </div>
  );
}

function InvDialog({ open, onOpenChange, inv }: { open: boolean; onOpenChange: (o: boolean) => void; inv?: Investment | null }) {
  const editing = !!inv?.id;
  const [form, setForm] = useState<Partial<Investment>>(
    inv ?? { name: "", kind: "rendaFixa", quantity: 0, avgPrice: 0, currentPrice: 0 },
  );

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Nome é obrigatório");
    const now = new Date().toISOString();
    const data: Investment = {
      id: inv?.id,
      name: form.name!,
      ticker: form.ticker,
      kind: (form.kind as InvestmentKind) ?? "outro",
      broker: form.broker,
      quantity: Number(form.quantity ?? 0),
      avgPrice: Number(form.avgPrice ?? 0),
      currentPrice: Number(form.currentPrice ?? 0),
      notes: form.notes,
      updatedAt: now,
      createdAt: inv?.createdAt ?? now,
    };
    if (editing) await db.investments.update(inv!.id!, data);
    else await db.investments.add(data);
    toast.success(editing ? "Ativo atualizado" : "Ativo criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Editar ativo" : "Novo ativo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: PETR4, Tesouro IPCA 2029…" />
            </div>
            <div>
              <Label>Ticker</Label>
              <Input value={form.ticker ?? ""} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind ?? "rendaFixa"} onValueChange={(v) => setForm({ ...form, kind: v as InvestmentKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INV_KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Corretora</Label>
              <Input value={form.broker ?? ""} onChange={(e) => setForm({ ...form, broker: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" step="0.0001" value={form.quantity ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Preço médio</Label>
              <Input type="number" step="0.01" value={form.avgPrice ?? 0} onChange={(e) => setForm({ ...form, avgPrice: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Preço atual</Label>
              <Input type="number" step="0.01" value={form.currentPrice ?? 0} onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) })} />
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

const MOV_LABEL: Record<InvMovKind, string> = {
  aporte: "Aporte", resgate: "Resgate", rendimento: "Rendimento", dividendo: "Dividendo", ajuste: "Ajuste",
};

function MovementsDialog({ open, onOpenChange, inv, movs }: { open: boolean; onOpenChange: (o: boolean) => void; inv: Investment; movs: InvMovement[] }) {
  const [form, setForm] = useState<Partial<InvMovement>>({
    kind: "aporte", date: new Date().toISOString().slice(0, 10), amount: 0,
  });

  const add = async () => {
    if (!form.amount || form.amount <= 0) return toast.error("Valor inválido");
    await db.invMovements.add({
      investmentId: inv.id!,
      kind: (form.kind as InvMovKind) ?? "aporte",
      date: form.date!,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      price: form.price ? Number(form.price) : undefined,
      amount: Number(form.amount),
      notes: form.notes,
    });
    setForm({ kind: "aporte", date: new Date().toISOString().slice(0, 10), amount: 0 });
    toast.success("Movimentação registrada");
  };

  const remove = async (id: number) => {
    if (!confirm("Excluir movimentação?")) return;
    await db.invMovements.delete(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">Movimentações — {inv.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 border border-border rounded-md bg-accent/30">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={form.kind ?? "aporte"} onValueChange={(v) => setForm({ ...form, kind: v as InvMovKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(MOV_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Qtd</Label>
            <Input type="number" step="0.0001" value={form.quantity ?? ""} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <Button onClick={add} className="bg-gradient-gold text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>

        {movs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell>{MOV_LABEL[m.kind]}</TableCell>
                  <TableCell className="text-right">{m.quantity ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${m.kind === "resgate" ? "text-destructive" : "text-success"}`}>{formatBRL(m.amount)}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => remove(m.id!)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
