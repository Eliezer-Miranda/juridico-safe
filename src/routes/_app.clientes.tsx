import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Users, Mail, Phone, Plus } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

function ClientsPage() {
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const contracts = useLiveQuery(() => db.contracts.toArray()) ?? [];
  const [q, setQ] = useState("");

  const enriched = useMemo(() => {
    return clients.map((c) => {
      const cs = contracts.filter((x) => x.clientId === c.id);
      return {
        ...c,
        contractCount: cs.length,
        totalValue: cs.reduce((s, x) => s + (x.totalValue ?? 0), 0),
      };
    }).filter((c) => {
      if (!q) return true;
      const hay = `${c.name} ${c.document} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [clients, contracts, q]);

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header>
        <p className="text-xs uppercase tracking-widest text-gold font-medium">CRM</p>
        <h1 className="font-display text-4xl mt-1">Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">{enriched.length} {enriched.length === 1 ? "cliente" : "clientes"}</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, documento, telefone…" className="pl-10" />
      </div>

      {enriched.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {enriched.map((c) => (
            <Card key={c.id} className="bg-card border-border hover:border-gold transition p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-gold grid place-items-center text-primary-foreground font-display text-sm shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"} · {c.document}</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.contractCount} contrato{c.contractCount !== 1 ? "s" : ""}</span>
                    <span className="text-gold font-medium">{formatBRL(c.totalValue)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
