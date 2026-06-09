import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Briefcase } from "lucide-react";
import { ClientForm } from "@/components/ClientForm";

export const Route = createFileRoute("/_app/fornecedores/novo")({
  component: NewSupplier,
});

function NewSupplier() {
  const navigate = useNavigate();
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6 animate-in-up">
      <header>
        <button onClick={() => navigate({ to: "/fornecedores" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar para fornecedores
        </button>
        <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Cadastro</p>
        <h1 className="font-display text-4xl mt-1 flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-gold" /> Novo fornecedor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Cadastre um fornecedor para vincular a compras e contas a pagar.</p>
      </header>
      <ClientForm
        defaultRole="fornecedor"
        lockRole
        onSaved={(id) => navigate({ to: "/clientes/$id", params: { id: String(id) } })}
      />
    </div>
  );
}
