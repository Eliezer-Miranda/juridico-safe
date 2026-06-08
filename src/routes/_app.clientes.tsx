import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, type PartyRole, type Client } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClientForm } from "@/components/ClientForm";
import { toast } from "sonner";
import { Search, Users, Mail, Phone, Plus, Building2, Briefcase, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

const ROLE_LABEL: Record<PartyRole, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  ambos: "Cliente + Fornecedor",
};

function ClientsPage() {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | PartyRole>("todos");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const r = c.role ?? "cliente";
      if (roleFilter !== "todos") {
        if (roleFilter === "cliente" && !(r === "cliente" || r === "ambos")) return false;
        if (roleFilter === "fornecedor" && !(r === "fornecedor" || r === "ambos")) return false;
      }
      if (!q) return true;
      const hay = `${c.name} ${c.document} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [clients, q, roleFilter]);

  const counts = useMemo(() => ({
    total: clients.length,
    clientes: clients.filter((c) => (c.role ?? "cliente") !== "fornecedor").length,
    fornecedores: clients.filter((c) => c.role === "fornecedor" || c.role === "ambos").length,
  }), [clients]);

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Cadastros</p>
          <h1 className="font-display text-4xl mt-1">Clientes &amp; Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} cadastros · {counts.clientes} clientes · {counts.fornecedores} fornecedores
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/clientes/novo" })} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4 mr-2" /> Novo cadastro
        </Button>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, documento, contato…" className="pl-10" />
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-1">
          {(["todos", "cliente", "fornecedor"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs rounded transition ${
                roleFilter === r ? "bg-background text-gold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "todos" ? "Todos" : r === "cliente" ? "Clientes" : "Fornecedores"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>
          <Button onClick={() => navigate({ to: "/clientes/novo" })} className="mt-4 bg-gradient-gold text-primary-foreground shadow-gold">
            <Plus className="h-4 w-4 mr-2" /> Cadastrar agora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const role = (c.role ?? "cliente") as PartyRole;
            const RoleIcon = role === "fornecedor" ? Briefcase : Building2;
            return (
              <Card key={c.id} className="bg-card border-border hover:border-gold transition p-5 cursor-pointer h-full relative group">
                <Link to="/clientes/$id" params={{ id: String(c.id) }} className="absolute inset-0 z-0" />
                <div className="relative z-10 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-gold grid place-items-center text-primary-foreground font-display text-sm shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg truncate">{c.name}</p>
                      <span className="text-[10px] uppercase tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5 shrink-0 inline-flex items-center gap-1">
                        <RoleIcon className="h-3 w-3" /> {ROLE_LABEL[role]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"} · {c.document}</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</p>}
                      {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingClient(c);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-gold" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar cadastro</DialogTitle>
            <DialogDescription>Altere os dados do cliente ou fornecedor e salve.</DialogDescription>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              initial={editingClient}
              onSaved={(id) => {
                toast.success("Cadastro atualizado");
                setEditingClient(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
