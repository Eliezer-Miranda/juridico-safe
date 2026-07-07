import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, type Client } from "@/lib/db";
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

type Mode = "cliente" | "fornecedor";

interface PartyListProps {
  mode: Mode;
}

const COPY: Record<Mode, { eyebrow: string; title: string; subtitle: (n: number) => string; empty: string; cta: string; icon: typeof Building2 }> = {
  cliente: {
    eyebrow: "Cadastros",
    title: "Clientes",
    subtitle: (n) => `${n} clientes cadastrados`,
    empty: "Nenhum cliente encontrado.",
    cta: "Novo cliente",
    icon: Building2,
  },
  fornecedor: {
    eyebrow: "Cadastros",
    title: "Fornecedores",
    subtitle: (n) => `${n} fornecedores cadastrados`,
    empty: "Nenhum fornecedor encontrado.",
    cta: "Novo fornecedor",
    icon: Briefcase,
  },
};

export function PartyList({ mode }: PartyListProps) {
  const navigate = useNavigate();
  const all = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    return all
      .filter((c) => {
        const r = c.role ?? "cliente";
        if (mode === "cliente") return r === "cliente" || r === "ambos";
        return r === "fornecedor" || r === "ambos";
      })
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.name} ${c.contactName ?? ""} ${c.document} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [all, q, mode]);

  const copy = COPY[mode];
  const RoleIcon = copy.icon;

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-medium">{copy.eyebrow}</p>
          <h1 className="font-display text-4xl mt-1">{copy.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{copy.subtitle(filtered.length)}</p>
        </div>
        <Button
          onClick={() => navigate({ to: mode === "cliente" ? "/clientes/novo" : "/fornecedores/novo" })}
          className="bg-gradient-gold text-primary-foreground shadow-gold"
        >
          <Plus className="h-4 w-4 mr-2" /> {copy.cta}
        </Button>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, documento, contato…" className="pl-10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{copy.empty}</p>
          <Button
            onClick={() => navigate({ to: mode === "cliente" ? "/clientes/novo" : "/fornecedores/novo" })}
            className="mt-4 bg-gradient-gold text-primary-foreground shadow-gold"
          >
            <Plus className="h-4 w-4 mr-2" /> Cadastrar agora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
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
                      <RoleIcon className="h-3 w-3" /> {c.role === "ambos" ? "Cliente + Fornecedor" : mode === "cliente" ? "Cliente" : "Fornecedor"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"} · {c.document}</p>
                  {c.type === "PJ" && c.contactName && (
                    <p className="text-xs text-gold mt-1">Contato: {c.contactName}</p>
                  )}
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
                    setEditing(c);
                  }}
                >
                  <Pencil className="h-4 w-4 text-gold" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar cadastro</DialogTitle>
            <DialogDescription>Altere os dados e salve.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ClientForm
              initial={editing}
              onSaved={() => {
                toast.success("Cadastro atualizado");
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
