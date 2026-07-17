import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, FileText, Users, Settings as SettingsIcon, LogOut, Banknote, Plus, Wallet, ArrowDownToLine, ArrowUpFromLine, Landmark, LineChart, FileSpreadsheet, FolderKanban, Package, CalendarClock, Briefcase, PackagePlus, FileOutput } from "lucide-react";
import { DueAlerts } from "./DueAlerts";
import { useAuth } from "./AuthProvider";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { group: "Comercial" },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/fornecedores", label: "Fornecedores", icon: Briefcase },
  { to: "/orcamentos", label: "Orçamentos", icon: FileSpreadsheet },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { group: "Cadastros" },
  { to: "/cadastros/produtos", label: "Produtos & Serviços", icon: Package },
  { group: "Financeiro" },
  { to: "/financeiro", label: "Visão geral", icon: Wallet, exact: true },
  { to: "/financeiro/receber", label: "A receber", icon: ArrowDownToLine },
  { to: "/financeiro/pagar", label: "A pagar", icon: ArrowUpFromLine },
  { to: "/financeiro/contas", label: "Contas & Carteiras", icon: Landmark },
  { to: "/financeiro/investimentos", label: "Investimentos", icon: LineChart },
  { group: "Jurídico" },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { group: " " },
  { to: "/configuracoes", label: "Configurações", icon: SettingsIcon },
] as Array<any>;

export const AppShell = () => {
  const { authed, ready, needsSetup, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const settings = useLiveQuery(() => db.settings.get(1));

  useEffect(() => {
    if (!ready) return;
    if (!authed || needsSetup) navigate({ to: "/login" });
  }, [ready, authed, needsSetup, navigate]);

  if (!ready || !authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center">
          <Banknote className="mx-auto h-10 w-10 text-gold animate-pulse" />
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {settings?.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover shadow-gold" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-gold grid place-items-center shadow-gold">
                <Banknote className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight truncate">{settings?.officeName ?? "Meu Negócio"}</p>
              <p className="text-xs text-muted-foreground truncate">{settings?.companyTagline ?? "Gestão financeira & contratos"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item, idx) => {
            if (item.group !== undefined) {
              return (
                <p key={`g-${idx}`} className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {item.group}
                </p>
              );
            }
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-gold border-l-2 border-gold"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Link
            to="/orcamentos/novo"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-md text-sm bg-gradient-gold text-primary-foreground font-medium shadow-gold hover:opacity-95 transition"
          >
            <Plus className="h-4 w-4" /> Novo orçamento
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <DueAlerts />
        <Outlet />
      </main>
    </div>
  );
};
