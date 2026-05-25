import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/ClientForm";

export const Route = createFileRoute("/_app/clientes/novo")({
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6 animate-in-up">
      <header>
        <button onClick={() => navigate({ to: "/clientes" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Cadastro</p>
        <h1 className="font-display text-4xl mt-1">Novo cadastro</h1>
        <p className="text-sm text-muted-foreground mt-1">Cliente, fornecedor — ou ambos.</p>
      </header>
      <ClientForm onSaved={(id) => navigate({ to: "/clientes/$id", params: { id: String(id) } })} />
    </div>
  );
}
