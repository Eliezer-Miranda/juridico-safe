import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, type ProjectStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, FolderKanban } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/projetos/")({
  component: ProjectsIndex,
});

const STATUS_LABEL: Record<ProjectStatus, string> = {
  orcamento: "Em orçamento", aprovado: "Aprovado", execucao: "Em execução",
  concluido: "Concluído", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  orcamento: "bg-muted text-muted-foreground",
  aprovado: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  execucao: "bg-gold/15 text-gold border border-gold/40",
  concluido: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  cancelado: "bg-red-500/15 text-red-400 border border-red-500/30",
};
const TYPE_LABEL: Record<string, string> = { material: "Material", maoDeObra: "Mão de obra", misto: "Material + Mão de obra" };

function ProjectsIndex() {
  const navigate = useNavigate();
  const projects = useLiveQuery(async () => {
    const list = await db.projects.toArray();
    return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];
  const [q, setQ] = useState("");
  const clientName = (id: number) => clients.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() =>
    projects.filter((p) => !q || `${p.code} ${p.name} ${clientName(p.clientId)}`.toLowerCase().includes(q.toLowerCase())),
    [projects, q, clients]);

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Projetos</p>
          <h1 className="font-display text-4xl mt-1">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fornecimento de material e mão de obra — orçamentos viram recebíveis; pedidos a fornecedores viram contas a pagar.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/projetos/novo" })} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4 mr-2" /> Novo projeto
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nome, cliente…" className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum projeto cadastrado.</p>
          <Button onClick={() => navigate({ to: "/projetos/novo" })} className="mt-4 bg-gradient-gold text-primary-foreground shadow-gold">
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro projeto
          </Button>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Início</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => navigate({ to: "/projetos/$id", params: { id: String(p.id) } })}>
                  <td className="px-4 py-3 font-mono text-gold text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <Link onClick={(e) => e.stopPropagation()} to="/clientes/$id" params={{ id: String(p.clientId) }} className="hover:text-gold">
                      {clientName(p.clientId)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[p.type]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.startsAt ? formatDate(p.startsAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLOR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
