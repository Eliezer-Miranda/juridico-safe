import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Banknote, Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { ready, authed, needsSetup, signIn, createPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && authed) navigate({ to: "/" });
  }, [ready, authed, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      if (needsSetup) {
        if (password.length < 4) return toast.error("Use ao menos 4 caracteres.");
        if (password !== confirm) return toast.error("As senhas não coincidem.");
        await createPassword(password);
        toast.success("Senha definida com sucesso.");
        navigate({ to: "/" });
      } else {
        const ok = await signIn(password);
        if (!ok) toast.error("Senha incorreta.");
        else navigate({ to: "/" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative bg-gradient-surface border-r border-border overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, oklch(0.74 0.13 80 / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.4 0.08 245 / 0.4), transparent 50%)",
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-gold grid place-items-center shadow-gold">
              <Banknote className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl">Meu Negócio</span>
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="font-display text-5xl leading-tight">
              Gestão dos seus contratos<br />
              <span className="text-gold">com escritórios e advogados.</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Acompanhe vencimentos, parcelas, entradas e o que foi acordado em cada contrato — tudo offline, no seu dispositivo.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Os dados ficam armazenados localmente no navegador. Faça backups regulares.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm animate-in-up">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <Banknote className="h-6 w-6 text-gold" />
            <span className="font-display text-xl">Meu Negócio</span>
          </div>
          <h2 className="font-display text-3xl mb-1">
            {needsSetup ? "Defina sua senha" : "Bem-vindo de volta"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {needsSetup
              ? "Esta senha protege o acesso ao sistema neste dispositivo."
              : "Informe sua senha para acessar o painel."}
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {needsSetup && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
              {needsSetup ? "Criar senha e entrar" : "Entrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
