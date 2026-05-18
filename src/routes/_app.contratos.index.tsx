import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";
import { Plus, Search, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/contratos/")({
  component: ContractsList,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
  negociacao: { label: "Negociação", cls: "bg-warning/15 text-warning border-warning/30" },
  suspenso: { label: "Suspenso", cls: "bg-muted text-muted-foreground border-border" },
  encerrado: { label: "Encerrado", cls: "bg-secondary text-secondary-foreground border-border" },
  arquivado: { label: "Arquivado", cls: "bg-muted text-muted-foreground border-border" },
};

const AREA: Record<string, string> = {
  civel: "Cível", trabalhista: "Trabalhista", criminal: "Criminal", previdenciario: "Previdenciário",
  tributario: "Tributário", empresarial: "Empresarial", familia: "Família", imobiliario: "Imobiliário",
  consumidor: "Consumidor", outro: "Outro",
};

function ContractsList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const contracts = useLiveQuery(() => db.contracts.orderBy("signedAt").reverse().toArray()) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id!, c])), [clients]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (status && c.status !== status) return false;
      if (!q) return true;
      const cli = clientMap.get(c.clientId);
      const hay = `${c.number} ${cli?.name ?? ""} ${cli?.document ?? ""} ${c.objectDescription} ${c.processNumber ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [contracts, q, status, clientMap]);

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Acervo</p>
          <h1 className="font-display text-4xl mt-1">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} {filtered.length === 1 ? "registro" : "registros"}</p>
        </div>
        <Button onClick={() => navigate({ to: "/contratos/novo" })} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4 mr-2" /> Novo contrato
        </Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nº, cliente, processo…" className="pl-10" />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const cli = clientMap.get(c.clientId);
            const st = STATUS[c.status];
            return (
              <Link key={c.id} to="/contratos/$id" params={{ id: String(c.id) }}>
                <Card className="bg-card border-border hover:border-gold transition group p-5 cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gold">{c.number}</span>
                        <Badge variant="outline" className={st?.cls}>{st?.label}</Badge>
                        <span className="text-xs text-muted-foreground">· {AREA[c.area]}</span>
                      </div>
                      <p className="mt-2 font-display text-lg truncate group-hover:text-gold transition">{cli?.name ?? "—"}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{c.objectDescription}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display text-xl text-gold">{formatBRL(c.totalValue)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Assinado {formatDate(c.signedAt)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
