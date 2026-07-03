import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes";
import { formatBRL, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, Plus, Search, ArrowDownToLine, ArrowUpFromLine, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/orcamentos/")({
  component: QuotesIndex,
});

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  aprovado: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  recusado: "bg-red-500/15 text-red-400 border border-red-500/30",
  expirado: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  faturado: "bg-gold/15 text-gold border border-gold/40",
};

function QuotesIndex() {
  const navigate = useNavigate();
  const quotes = useLiveQuery(() => db.quotes.orderBy("issueDate").reverse().toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"todos" | "cliente" | "fornecedor">("todos");

  const partyName = (id: number) => clients.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => quotes.filter((x) => {
    if (kindFilter !== "todos" && x.partyKind !== kindFilter) return false;
    if (!q) return true;
    const hay = `${x.number} ${partyName(x.partyId)} ${x.seller ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [quotes, q, kindFilter, clients]);

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Comercial</p>
          <h1 className="font-display text-4xl mt-1">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {quotes.length} orçamento{quotes.length !== 1 ? "s" : ""} · gere parcelas em contas a receber/pagar.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/orcamentos/novo" })} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4 mr-2" /> Novo orçamento
        </Button>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente, vendedor…" className="pl-10" />
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-1">
          {(["todos", "cliente", "fornecedor"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setKindFilter(r)}
              className={`px-3 py-1.5 text-xs rounded transition ${
                kindFilter === r ? "bg-background text-gold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "todos" ? "Todos" : r === "cliente" ? "Para clientes" : "De fornecedores"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum orçamento cadastrado.</p>
          <Button onClick={() => navigate({ to: "/orcamentos/novo" })} className="mt-4 bg-gradient-gold text-primary-foreground shadow-gold">
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro orçamento
          </Button>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Número</th>
                  <th className="text-left px-4 py-3">Cliente / Fornecedor</th>
                  <th className="text-left px-4 py-3">Emissão</th>
                  <th className="text-left px-4 py-3">Validade</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((x) => (
                  <tr key={x.id} className="hover:bg-muted/20 transition cursor-pointer"
                      onClick={() => navigate({ to: "/orcamentos/$id", params: { id: String(x.id) } })}>
                    <td className="px-4 py-3 font-mono text-gold">{x.number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {x.partyKind === "cliente"
                          ? <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />
                          : <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-400" />}
                        <Link onClick={(e) => e.stopPropagation()} to="/clientes/$id" params={{ id: String(x.partyId) }} className="hover:text-gold">
                          {partyName(x.partyId)}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(x.issueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(x.expiryDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatBRL(x.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLOR[x.status]}`}>
                        {QUOTE_STATUS_LABEL[x.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to="/orcamentos/$id/editar"
                        params={{ id: String(x.id) }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold"
                        title="Editar orçamento"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
