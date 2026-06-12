import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, X, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { refreshFinTxStatus } from "@/lib/finance";
import { formatBRL, formatDate, daysFromToday } from "@/lib/format";

export const DueAlerts = () => {
  const txs = useLiveQuery(() => db.finTx.toArray()) ?? [];
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { refreshFinTxStatus(); }, [txs.length]);

  const { atrasados, proximos } = useMemo(() => {
    const a = txs
      .filter((t) => t.status === "atraso")
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
    const p = txs
      .filter((t) => t.status === "pendente" && daysFromToday(t.dueDate) >= 0 && daysFromToday(t.dueDate) <= 7)
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
    return { atrasados: a, proximos: p };
  }, [txs]);

  if (dismissed) return null;
  if (atrasados.length === 0 && proximos.length === 0) return null;

  const totalAtrReceber = atrasados.filter((t) => t.kind === "receber").reduce((s, t) => s + t.amount, 0);
  const totalAtrPagar = atrasados.filter((t) => t.kind === "pagar").reduce((s, t) => s + t.amount, 0);
  const totalProx = proximos.reduce((s, t) => s + t.amount, 0);

  const items = [...atrasados, ...proximos].slice(0, 4);

  return (
    <div className="border-b border-border bg-card/70 backdrop-blur px-6 lg:px-10 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {atrasados.length > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CalendarClock className="h-4 w-4 text-gold" />
          )}
          Alertas financeiros
        </div>

        {atrasados.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-destructive font-medium">{atrasados.length} em atraso</span>
            {totalAtrReceber > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <ArrowDownToLine className="h-3 w-3 text-success" /> {formatBRL(totalAtrReceber)}
              </span>
            )}
            {totalAtrPagar > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <ArrowUpFromLine className="h-3 w-3 text-destructive" /> {formatBRL(totalAtrPagar)}
              </span>
            )}
          </div>
        )}

        {proximos.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gold font-medium">{proximos.length} vencendo em 7 dias</span>
            <span className="text-muted-foreground">{formatBRL(totalProx)}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <Link to="/financeiro/receber" className="text-xs text-gold hover:underline">A receber</Link>
          <Link to="/financeiro/pagar" className="text-xs text-gold hover:underline">A pagar</Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dispensar alertas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-1">
          {items.map((t) => {
            const overdue = t.status === "atraso";
            return (
              <li key={t.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  {t.kind === "receber" ? (
                    <ArrowDownToLine className="h-3 w-3 text-success shrink-0" />
                  ) : (
                    <ArrowUpFromLine className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className="truncate">{t.description}</span>
                </span>
                <span className={`ml-2 shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatBRL(t.amount)} · {formatDate(t.dueDate)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
