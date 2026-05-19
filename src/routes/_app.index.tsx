import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { refreshInstallmentStatus } from "@/lib/installments";
import { formatBRL, formatDate, daysFromToday } from "@/lib/format";
import { FileText, TrendingUp, AlertTriangle, CheckCircle2, Wallet, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { Link } from "@tanstack/react-router";
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

const AREA_LABEL: Record<string, string> = {
  civel: "Cível", trabalhista: "Trabalhista", criminal: "Criminal",
  previdenciario: "Previdenciário", tributario: "Tributário", empresarial: "Empresarial",
  familia: "Família", imobiliario: "Imobiliário", consumidor: "Consumidor", outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo", suspenso: "Suspenso", encerrado: "Encerrado",
  arquivado: "Arquivado", negociacao: "Em Negociação",
};

function Dashboard() {
  const contracts = useLiveQuery(() => db.contracts.toArray()) ?? [];
  const installments = useLiveQuery(() => db.installments.toArray()) ?? [];

  useEffect(() => {
    contracts.forEach((c) => refreshInstallmentStatus(c.id!));
  }, [contracts.length]);

  const totals = useMemo(() => {
    const ativos = contracts.filter((c) => c.status === "ativo");
    const totalAtivos = ativos.reduce((s, c) => s + (c.totalValue ?? 0), 0);
    const recebido = installments.filter((i) => i.status === "pago").reduce((s, i) => s + (i.paidValue ?? i.finalValue), 0);
    const aberto = installments.filter((i) => i.status === "pendente").reduce((s, i) => s + i.finalValue, 0);
    const atraso = installments.filter((i) => i.status === "atraso").reduce((s, i) => s + i.finalValue, 0);
    return { totalAtivos, recebido, aberto, atraso };
  }, [contracts, installments]);

  const statusCounts = useMemo(() => {
    return contracts.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [contracts]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }).map((_, i) => startOfMonth(subMonths(new Date(), 11 - i)));
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      const prev = installments
        .filter((i) => format(parseISO(i.dueDate), "yyyy-MM") === key)
        .reduce((s, i) => s + i.originalValue, 0);
      const real = installments
        .filter((i) => i.paidAt && format(parseISO(i.paidAt), "yyyy-MM") === key)
        .reduce((s, i) => s + (i.paidValue ?? 0), 0);
      return { mes: format(m, "MMM/yy", { locale: ptBR }), Previsto: Math.round(prev), Recebido: Math.round(real) };
    });
  }, [installments]);

  const areaData = useMemo(() => {
    const map = contracts.reduce<Record<string, number>>((acc, c) => {
      acc[c.area] = (acc[c.area] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(map).map(([area, value]) => ({ name: AREA_LABEL[area] ?? area, value }));
  }, [contracts]);

  const proximas = useMemo(
    () =>
      installments
        .filter((i) => i.status === "pendente" && daysFromToday(i.dueDate) >= 0 && daysFromToday(i.dueDate) <= 7)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [installments],
  );
  const atrasadas = useMemo(
    () => installments.filter((i) => i.status === "atraso").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [installments],
  );

  const contractName = (id: number) => contracts.find((c) => c.id === id)?.number ?? "—";

  const COLORS = ["oklch(0.74 0.13 80)", "oklch(0.65 0.16 195)", "oklch(0.65 0.16 155)", "oklch(0.58 0.22 25)", "oklch(0.6 0.15 290)", "oklch(0.7 0.1 30)", "oklch(0.55 0.12 250)"];

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Painel</p>
          <h1 className="font-display text-4xl mt-1">Gestão dos contratos jurídicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </header>

      {/* Financial Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI title="Contratos ativos" value={formatBRL(totals.totalAtivos)} icon={Wallet} accent />
        <KPI title="Total recebido" value={formatBRL(totals.recebido)} icon={CheckCircle2} positive />
        <KPI title="Em aberto" value={formatBRL(totals.aberto)} icon={TrendingUp} />
        <KPI title="Em atraso" value={formatBRL(totals.atraso)} icon={AlertTriangle} danger />
      </section>

      {/* Status counts */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(["ativo", "negociacao", "suspenso", "encerrado", "arquivado"] as const).map((s) => (
          <Card key={s} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
              <p className="font-display text-3xl mt-1">{statusCounts[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display">Entradas previstas vs realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.34 0.03 245)" />
                  <XAxis dataKey="mes" stroke="oklch(0.72 0.02 80)" fontSize={12} />
                  <YAxis stroke="oklch(0.72 0.02 80)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.21 0.04 245)", border: "1px solid oklch(0.34 0.03 245)", borderRadius: 8 }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend />
                  <Bar dataKey="Previsto" fill="oklch(0.65 0.16 195)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recebido" fill="oklch(0.74 0.13 80)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display">Por área do direito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {areaData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados ainda</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={areaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                      {areaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.04 245)", border: "1px solid oklch(0.34 0.03 245)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Vencimentos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2"><Calendar className="h-4 w-4 text-gold" /> Próximos 7 dias</CardTitle>
            <Badge variant="outline" className="border-gold text-gold">{proximas.length}</Badge>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma parcela vencendo nos próximos 7 dias.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proximas.slice(0, 6).map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between text-sm">
                    <Link to="/contratos/$id" params={{ id: String(i.contractId) }} className="hover:text-gold transition">
                      <span className="font-medium">{contractName(i.contractId)}</span>
                      <span className="text-muted-foreground"> · Parcela {i.number}</span>
                    </Link>
                    <div className="text-right">
                      <p className="font-medium">{formatBRL(i.finalValue)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(i.dueDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-2 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Em atraso</CardTitle>
            <Badge variant="destructive">{atrasadas.length}</Badge>
          </CardHeader>
          <CardContent>
            {atrasadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma parcela em atraso. Excelente!</p>
            ) : (
              <ul className="divide-y divide-border">
                {atrasadas.slice(0, 6).map((i) => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between text-sm">
                    <Link to="/contratos/$id" params={{ id: String(i.contractId) }} className="hover:text-destructive transition">
                      <span className="font-medium">{contractName(i.contractId)}</span>
                      <span className="text-muted-foreground"> · Parcela {i.number}</span>
                    </Link>
                    <div className="text-right">
                      <p className="font-medium text-destructive">{formatBRL(i.finalValue)}</p>
                      <p className="text-xs text-muted-foreground">Venceu {formatDate(i.dueDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {contracts.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum contrato cadastrado ainda.</p>
          <Link to="/contratos/novo" className="inline-block mt-4 px-4 py-2 rounded-md bg-gradient-gold text-primary-foreground text-sm font-medium">
            Cadastrar primeiro contrato
          </Link>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value, icon: Icon, accent, positive, danger }: {
  title: string; value: string; icon: any; accent?: boolean; positive?: boolean; danger?: boolean;
}) {
  const accentClass = danger ? "text-destructive" : positive ? "text-success" : accent ? "text-gold" : "text-foreground";
  const ringClass = danger ? "border-l-destructive" : positive ? "border-l-success" : accent ? "border-l-gold" : "border-l-border";
  return (
    <Card className={`bg-card border-border border-l-2 ${ringClass}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
          <Icon className={`h-4 w-4 ${accentClass}`} />
        </div>
        <p className={`font-display text-2xl xl:text-3xl mt-2 ${accentClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
