import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PackagePlus, FileOutput } from "lucide-react";

export const Route = createFileRoute("/_app/estoque")({
  component: EstoqueLayout,
});

const tabs = [
  { to: "/estoque/notas", label: "Notas de Entrada", icon: PackagePlus },
  { to: "/estoque/emissao", label: "Fila NF-e Saída", icon: FileOutput },
];

function EstoqueLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-border bg-card/30">
        <div className="px-6 lg:px-10 pt-6">
          <p className="text-xs uppercase tracking-widest text-gold font-medium">Estoque</p>
          <h1 className="font-display text-3xl mt-1">Movimentação fiscal</h1>
        </div>
        <nav className="px-6 lg:px-10 mt-5 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-md border-b-2 transition ${
                  active ? "border-gold text-gold bg-background" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
