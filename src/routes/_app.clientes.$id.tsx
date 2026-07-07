import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ClientForm } from "@/components/ClientForm";
import { ArrowLeft, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: EditClient,
});

function EditClient() {
  const { id } = useParams({ from: "/_app/clientes/$id" });
  const cid = Number(id);
  const navigate = useNavigate();
  const client = useLiveQuery(() => db.clients.get(cid), [cid]);
  const contracts = useLiveQuery(() => db.contracts.where({ clientId: cid }).toArray(), [cid]) ?? [];

  if (!client) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const remove = async () => {
    if (contracts.length > 0) return toast.error(`Não é possível excluir: existem ${contracts.length} contrato(s) vinculados.`);
    if (!confirm(`Excluir o cadastro "${client.name}"?`)) return;
    await db.clients.delete(cid);
    toast.success("Cadastro excluído");
    navigate({ to: "/clientes" });
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6 animate-in-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate({ to: "/clientes" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Editar cadastro</p>
          <h1 className="font-display text-4xl mt-1">{client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{client.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"} · {client.document}</p>
          {client.type === "PJ" && client.contactName && (
            <p className="text-sm text-gold mt-1">Contato: {client.contactName}</p>
          )}
        </div>
        <Button variant="outline" onClick={remove} className="text-destructive border-destructive/30">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </Button>
      </header>

      <ClientForm initial={client} onSaved={() => toast.success("Atualizado")} />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /> Contratos vinculados</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado com este prestador.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contracts.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                  <Link to="/contratos/$id" params={{ id: String(c.id) }} className="hover:text-gold transition">
                    <span className="font-mono text-xs text-gold">{c.number}</span>
                    <span className="ml-2">{c.objectDescription}</span>
                  </Link>
                  <div className="text-right">
                    <p className="font-medium">{formatBRL(c.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">Assinado {formatDate(c.signedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
