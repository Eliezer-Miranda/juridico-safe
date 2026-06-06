import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, getSettings, type FinTx, type ProjectStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileSpreadsheet, Plus, Trash2, FileCheck2, ShoppingCart, ExternalLink, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { generateFinTxFromQuote, buildQuoteSchedule } from "@/lib/quotes";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projetos/$id")({
  component: ProjectDetail,
});

const STATUS_LABEL: Record<ProjectStatus, string> = {
  orcamento: "Em orçamento", aprovado: "Aprovado", execucao: "Em execução",
  concluido: "Concluído", cancelado: "Cancelado",
};
const TYPE_LABEL: Record<string, string> = { material: "Material", maoDeObra: "Mão de obra", misto: "Material + Mão de obra" };

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

function ProjectDetail() {
  const { id } = useParams({ from: "/_app/projetos/$id" });
  const pid = Number(id);
  const navigate = useNavigate();

  const project = useLiveQuery(() => db.projects.get(pid), [pid]);
  const client = useLiveQuery(async () => project ? await db.clients.get(project.clientId) : null, [project?.clientId]);
  const quotes = useLiveQuery(() => db.quotes.where({ projectId: pid }).toArray(), [pid]) ?? [];
  const txs = useLiveQuery(() => db.finTx.where({ projectId: pid }).toArray(), [pid]) ?? [];
  const suppliers = useLiveQuery(() => db.clients.toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const fornecedores = suppliers.filter((c) => c.role === "fornecedor" || c.role === "ambos");

  const receber = txs.filter((t) => t.kind === "receber");
  const pagar = txs.filter((t) => t.kind === "pagar");
  const totalReceber = receber.reduce((s, t) => s + t.amount, 0);
  const totalPagar = pagar.reduce((s, t) => s + t.amount, 0);
  const recebido = receber.filter((t) => t.status === "pago").reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);
  const pago = pagar.filter((t) => t.status === "pago").reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);

  const supplierName = (id?: number) => fornecedores.find((c) => c.id === id)?.name ?? "—";

  const [orderOpen, setOrderOpen] = useState(false);
  const [order, setOrder] = useState({
    supplierId: "" as number | "",
    description: "",
    total: 0,
    installments: 1,
    firstDueDate: addDays(new Date().toISOString().slice(0, 10), 30),
    accountId: "" as number | "",
    category: "Compras de projeto",
    notes: "",
  });

  const orderTitle = useMemo(() => `${project?.code ?? ""} — Pedido`, [project]);

  if (!project) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const updateStatus = async (s: ProjectStatus) => {
    await db.projects.update(pid, { status: s, updatedAt: new Date().toISOString() });
    toast.success("Status atualizado");
  };

  const remove = async () => {
    if (txs.length > 0 || quotes.length > 0) return toast.error("Remova orçamentos e lançamentos vinculados antes de excluir.");
    if (!confirm(`Excluir projeto ${project.code}?`)) return;
    await db.projects.delete(pid);
    toast.success("Projeto excluído");
    navigate({ to: "/projetos" });
  };

  const createOrder = async () => {
    if (!order.supplierId) return toast.error("Selecione o fornecedor");
    if (!order.description.trim()) return toast.error("Descreva o pedido");
    if (!order.total || order.total <= 0) return toast.error("Informe o valor");
    const n = Math.max(1, order.installments);
    const base = Math.floor((order.total / n) * 100) / 100;
    const last = +(order.total - base * (n - 1)).toFixed(2);
    const now = new Date().toISOString();
    const newTxs: FinTx[] = [];
    for (let i = 0; i < n; i++) {
      newTxs.push({
        kind: "pagar",
        description: `${project.code} — ${order.description} (${i + 1}/${n})`,
        category: order.category || "Compras",
        accountId: order.accountId ? Number(order.accountId) : undefined,
        amount: i === n - 1 ? last : base,
        dueDate: addMonths(order.firstDueDate, i),
        status: "pendente",
        partyId: Number(order.supplierId),
        projectId: pid,
        installmentInfo: `${i + 1}/${n}`,
        notes: order.notes,
        createdAt: now,
      });
    }
    await db.finTx.bulkAdd(newTxs);
    toast.success(`${n} parcela(s) lançada(s) em A Pagar`);
    setOrderOpen(false);
    setOrder({ ...order, description: "", total: 0, notes: "" });
  };

  const acceptQuote = async (quoteId: number) => {
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    if (q.partyKind !== "cliente") return toast.error("Apenas orçamentos de cliente geram A Receber.");
    if (q.linkedTxIds?.length) return toast.error("Orçamento já faturado.");
    const schedule = await buildQuoteSchedule(q);
    const preview = schedule
      .map((s) => `• ${s.label} — ${formatDate(s.dueDate)} — ${formatBRL(s.amount)}`)
      .join("\n");
    if (!confirm(`Aceitar orçamento ${q.number} e gerar ${schedule.length} parcela(s) em A Receber?\n\n${preview}`)) return;
    const s = await getSettings();
    const acceptedBy = s.lawyerName || s.officeName || "Operador";
    await generateFinTxFromQuote(q, { category: "Vendas", acceptedBy });
    if (project.status === "orcamento") {
      await db.projects.update(pid, { status: "execucao", updatedAt: new Date().toISOString() });
    }
    toast.success(`${schedule.length} parcela(s) geradas em A Receber`);
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6 animate-in-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate({ to: "/projetos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">{project.code}</p>
          <h1 className="font-display text-4xl mt-1">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente:{" "}
            <Link to="/clientes/$id" params={{ id: String(project.clientId) }} className="text-foreground hover:text-gold">
              {client?.name ?? "—"}
            </Link>{" "}
            · Tipo: {TYPE_LABEL[project.type]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[180px]">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={project.status} onValueChange={(v) => updateStatus(v as ProjectStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={remove} className="self-end text-destructive border-destructive/30">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="A receber (total)" value={formatBRL(totalReceber)} accent="emerald" />
        <KPI label="Recebido" value={formatBRL(recebido)} />
        <KPI label="A pagar (total)" value={formatBRL(totalPagar)} accent="orange" />
        <KPI label="Margem prevista" value={formatBRL(totalReceber - totalPagar)} accent="gold" />
      </div>

      {project.description && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="font-display text-lg">Escopo</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{project.description}</p></CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-gold" /> Orçamentos do projeto ({quotes.length})
          </CardTitle>
          <Button size="sm" onClick={() => navigate({ to: "/orcamentos/novo", search: { projectId: pid } as any })}
            className="bg-gradient-gold text-primary-foreground">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo orçamento
          </Button>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento. Crie um e gere "A Receber" após aprovação.</p>
          ) : (
            <ul className="divide-y divide-border">
              {quotes.map((q) => (
                <li key={q.id} className="py-2 flex items-center justify-between text-sm">
                  <Link to="/orcamentos/$id" params={{ id: String(q.id) }} className="hover:text-gold">
                    <span className="font-mono text-xs text-gold mr-2">{q.number}</span>
                    {q.partyKind === "cliente" ? "Cliente" : "Fornecedor"} ·{" "}
                    <span className="text-muted-foreground">{formatDate(q.issueDate)}</span>
                    {q.status === "faturado" && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5"><FileCheck2 className="h-3 w-3 inline" /> Faturado</span>}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatBRL(q.total)}</span>
                    {q.partyKind === "cliente" && !q.linkedTxIds?.length && (
                      <Button size="sm" onClick={() => acceptQuote(q.id!)} className="bg-gradient-gold text-primary-foreground h-7 px-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceitar e gerar A Receber
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gold" /> Pedidos / Contas a pagar a fornecedor ({pagar.length})
          </CardTitle>
          <Button size="sm" onClick={() => setOrderOpen(true)} className="bg-gradient-gold text-primary-foreground">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo pedido
          </Button>
        </CardHeader>
        <CardContent>
          {pagar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido lançado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pagar.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium flex items-center gap-2"><ArrowUpFromLine className="h-3 w-3 text-orange-400" /> {t.description}</p>
                    <p className="text-xs text-muted-foreground">{supplierName(t.partyId)} · Venc. {formatDate(t.dueDate)} · {t.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatBRL(t.amount)}</span>
                    <Link to="/financeiro/pagar" className="text-gold hover:underline text-xs inline-flex items-center gap-1">
                      ver <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {receber.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-emerald-400" /> Recebíveis do projeto ({receber.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {receber.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">Venc. {formatDate(t.dueDate)} · {t.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatBRL(t.amount)}</span>
                    <Link to="/financeiro/receber" className="text-gold hover:underline text-xs inline-flex items-center gap-1">
                      ver <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="bg-card max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{orderTitle}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Fornecedor">
              <Select value={order.supplierId ? String(order.supplierId) : ""} onValueChange={(v) => setOrder({ ...order, supplierId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cadastre fornecedores em Clientes &amp; Fornecedores.</div>}
                  {fornecedores.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria"><Input value={order.category} onChange={(e) => setOrder({ ...order, category: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="Descrição do pedido"><Input value={order.description} onChange={(e) => setOrder({ ...order, description: e.target.value })} placeholder="Ex.: Cabos, conectores e DVR" /></Field>
            </div>
            <Field label="Valor total (R$)"><Input type="number" step="0.01" value={order.total} onChange={(e) => setOrder({ ...order, total: Number(e.target.value) })} /></Field>
            <Field label="Nº de parcelas"><Input type="number" min={1} value={order.installments} onChange={(e) => setOrder({ ...order, installments: Math.max(1, Number(e.target.value)) })} /></Field>
            <Field label="1º vencimento"><Input type="date" value={order.firstDueDate} onChange={(e) => setOrder({ ...order, firstDueDate: e.target.value })} /></Field>
            <Field label="Conta (opcional)">
              <Select value={order.accountId ? String(order.accountId) : ""} onValueChange={(v) => setOrder({ ...order, accountId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Observações"><Textarea rows={2} value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrderOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder} className="bg-gradient-gold text-primary-foreground">Lançar pedido</Button>
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

function KPI({ label, value, accent }: { label: string; value: string; accent?: "gold" | "emerald" | "orange" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "orange" ? "text-orange-400" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <Card className="bg-card border-border p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${color}`}>{value}</p>
    </Card>
  );
}
