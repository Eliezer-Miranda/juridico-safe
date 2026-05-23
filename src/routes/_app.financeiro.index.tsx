import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { accountBalance, refreshFinTxStatus, investmentValue, investmentCost, investmentPnL } from "@/lib/finance";
import { formatBRL, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Wallet, AlertTriangle, PiggyBank } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/financeiro/")({
  component: FinanceHome,
});

function FinanceHome() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? [];
  const txs = useLiveQuery(() => db.finTx.toArray()) ?? [];
  const investments = useLiveQuery(() => db.investments.toArray()) ?? [];
  const movs = useLiveQuery(() => db.invMovements.toArray()) ?? [];

  useEffect(() => { refreshFinTxStatus(); }, [txs.length]);

  const saldoTotal = useMemo(
    () => accounts.filter((a) => !a.archived).reduce((s, a) => s + accountBalance(a, txs, movs.filter((m) => false)), 0),
    [accounts, txs, movs],
  );

  const aReceber = useMemo(
    () => txs.filter((t) => t.kind === "receber" && (t.status === "pendente" || t.status === "atraso")).reduce((s, t) => s + t.amount, 0),
    [txs],
  );
  const aPagar = useMemo(
    () => txs.filter((t) => t.kind === "pagar" && (t.status === "pendente" || t.status === "atraso")).reduce((s, t) => s + t.amount, 0),
    [txs],
  );
  const patrimonioInvest = useMemo(
    () => investments.reduce((s, i) => s + investmentValue(i), 0),
    [investments],
  );
  const lucroInvest = useMemo(
    () => investments.reduce((s, i) => s + investmentPnL(i), 0),
    [investments],
  );

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      const rec = txs
        .filter((t) => t.kind === "receber" && t.paidAt && format(parseISO(t.paidAt), "yyyy-MM") === key)
        .reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);
      const pag = txs
        .filter((t) => t.kind === "pagar" && t.paidAt && format(parseISO(t.paidAt), "yyyy-MM") === key)
        .reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);
      return { mes: format(m, "MMM", { locale: ptBR }), Receitas: Math.round(rec), Despesas: Math.round(pag) };
    });
  }, [txs]);

  const despesasPorCategoria = useMemo(() => {
    const map = txs
      .filter((t) => t.kind === "pagar" && t.status === "pago")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + (t.paidAmount ?? t.amount);
        return acc;
      }, {});
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [txs]);

  const proximas = useMemo(
    () => txs
      .filter((t) => t.status === "pendente" || t.status === "atraso")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8),
    [txs],
  );

  const COLORS = ["oklch(0.74 0.13 80)", "oklch(0.65 0.16 195)", "oklch(0.58 0.22 25)", "oklch(0.65 0.16 155)", "oklch(0.6 0.15 290)", "oklch(0.7 0.1 30)", "oklch(0.55 0.12 250)", "oklch(0.78 0.16 70)"];

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in-up">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI title="Saldo total" value={formatBRL(saldoTotal)} icon={Wallet} accent />
        <KPI title="A receber" value={formatBRL(aReceber)} icon={ArrowDownToLine} positive />
        <KPI title="A pagar" value={formatBRL(aPagar)} icon={ArrowUpFromLine} danger />
        <KPI title="Investimentos" value={formatBRL(patrimonioInvest)} sub={`${lucroInvest >= 0 ? "+" : ""}${formatBRL(lucroInvest)} resultado`} icon={PiggyBank} positive={lucroInvest >= 0} danger={lucroInvest < 0} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display">Receitas vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.34 0.03 245)" />
                  <XAxis dataKey="mes" stroke="oklch(0.72 0.02 80)" fontSize={12} />
                  <YAxis stroke="oklch(0.72 0.02 80)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.21 0.04 245)", border: "1px solid oklch(0.34 0.03 245)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="oklch(0.65 0.16 155)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="oklch(0.58 0.22 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {despesasPorCategoria.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem despesas pagas ainda</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                      {despesasPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.04 245)", border: "1px solid oklch(0.34 0.03 245)", borderRadius: 8 }} formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Contas & Carteiras</CardTitle>
            <Link to="/financeiro/contas" className="text-xs text-gold hover:underline">Gerenciar →</Link>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada. <Link to="/financeiro/contas" className="text-gold hover:underline">Criar a primeira</Link>.</p>
            ) : (
              <ul className="divide-y divide-border">
                {accounts.filter((a) => !a.archived).map((a) => (
                  <li key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color ?? "oklch(0.74 0.13 80)" }} />
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.institution ?? "—"}</p>
                      </div>
                    </div>
                    <p className="font-display text-lg">{formatBRL(accountBalance(a, txs))}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Próximos vencimentos</CardTitle>
            <Badge variant="outline" className="border-gold text-gold">{proximas.length}</Badge>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento pendente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proximas.map((t) => (
                  <li key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {t.kind === "receber" ? <ArrowDownToLine className="h-3 w-3 text-success" /> : <ArrowUpFromLine className="h-3 w-3 text-destructive" />}
                        {t.description}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${t.status === "atraso" ? "text-destructive" : ""}`}>{formatBRL(t.amount)}</p>
                      {t.status === "atraso" && <p className="text-[10px] text-destructive flex items-center gap-1 justify-end"><AlertTriangle className="h-3 w-3" /> em atraso</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KPI({ title, value, sub, icon: Icon, accent, positive, danger }: { title: string; value: string; sub?: string; icon: any; accent?: boolean; positive?: boolean; danger?: boolean }) {
  const cls = danger ? "text-destructive" : positive ? "text-success" : accent ? "text-gold" : "text-foreground";
  const ring = danger ? "border-l-destructive" : positive ? "border-l-success" : accent ? "border-l-gold" : "border-l-border";
  return (
    <Card className={`bg-card border-border border-l-2 ${ring}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
          <Icon className={`h-4 w-4 ${cls}`} />
        </div>
        <p className={`font-display text-2xl xl:text-3xl mt-2 ${cls}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
