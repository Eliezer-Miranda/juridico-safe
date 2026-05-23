import { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FinTx, type FinTxKind } from "@/lib/db";
import { refreshFinTxStatus } from "@/lib/finance";
import { formatBRL, formatDate, daysFromToday } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckCircle2, Pencil, Trash2, Search, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";
import { TxDialog, PayDialog } from "@/components/FinTxDialog";
import { toast } from "sonner";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  pago: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  atraso: { label: "Em atraso", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

export function FinTxList({ kind }: { kind: FinTxKind }) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const all = useLiveQuery(() => db.finTx.where("kind").equals(kind).toArray(), [kind]) ?? [];
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dialog, setDialog] = useState<{ open: boolean; tx?: FinTx | null }>({ open: false });
  const [pay, setPay] = useState<FinTx | null>(null);

  useEffect(() => { refreshFinTxStatus(); }, [all.length]);

  const list = useMemo(() => {
    return all
      .filter((t) => statusFilter === "todos" || t.status === statusFilter)
      .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()) || t.category.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [all, q, statusFilter]);

  const totalPendente = list.filter((t) => t.status === "pendente" || t.status === "atraso").reduce((s, t) => s + t.amount, 0);
  const totalPago = list.filter((t) => t.status === "pago").reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);
  const totalAtraso = list.filter((t) => t.status === "atraso").reduce((s, t) => s + t.amount, 0);

  const accName = (id?: number) => accounts.find((a) => a.id === id)?.name ?? "—";

  const remove = async (id: number) => {
    if (!confirm("Excluir este lançamento?")) return;
    await db.finTx.delete(id);
    toast.success("Removido");
  };

  const tone = kind === "receber" ? "text-success" : "text-destructive";
  const TitleIcon = kind === "receber" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2"><TitleIcon className={`h-5 w-5 ${tone}`} /> Contas a {kind === "receber" ? "receber" : "pagar"}</h2>
          <p className="text-sm text-muted-foreground">Cadastre, organize e dê baixa nos seus lançamentos.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, tx: null })} className="bg-gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Novo lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-card border-border border-l-2 border-l-warning">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Em aberto</p>
            <p className="font-display text-2xl mt-1 text-warning">{formatBRL(totalPendente)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-2 border-l-success">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Liquidado</p>
            <p className="font-display text-2xl mt-1 text-success">{formatBRL(totalPago)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-2 border-l-destructive">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Em atraso</p>
            <p className="font-display text-2xl mt-1 text-destructive">{formatBRL(totalAtraso)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por descrição ou categoria…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {(["todos", "pendente", "atraso", "pago", "cancelado"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  statusFilter === s ? "border-gold text-gold" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "todos" ? "Todos" : STATUS_BADGE[s]?.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum lançamento encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t) => {
                  const dias = daysFromToday(t.dueDate);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell className="text-muted-foreground">{t.category}</TableCell>
                      <TableCell className="text-muted-foreground">{accName(t.accountId)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(t.dueDate)}</div>
                        {t.status !== "pago" && t.status !== "cancelado" && (
                          <div className={`text-xs ${dias < 0 ? "text-destructive" : dias <= 3 ? "text-warning" : "text-muted-foreground"}`}>
                            {dias < 0 ? `${-dias}d em atraso` : dias === 0 ? "hoje" : `em ${dias}d`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${tone}`}>{formatBRL(t.paidAmount ?? t.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[t.status].cls}>
                          {t.status === "atraso" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {STATUS_BADGE[t.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {t.status !== "pago" && t.status !== "cancelado" && (
                            <Button size="sm" variant="ghost" onClick={() => setPay(t)} title="Dar baixa">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, tx: t })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(t.id!)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {dialog.open && (
        <TxDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} kind={kind} tx={dialog.tx} />
      )}
      {pay && <PayDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} tx={pay} />}
    </div>
  );
}
