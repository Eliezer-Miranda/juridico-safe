import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db, getSettings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setPassword } from "@/lib/auth";
import { Download, Upload, Save, Building2, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useLiveQuery(() => getSettings());
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ officeName: "", lawyerName: "", oab: "", uf: "", alertDaysBefore: 7 });
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (settings) {
      setForm({
        officeName: settings.officeName, lawyerName: settings.lawyerName,
        oab: settings.oab, uf: settings.uf, alertDaysBefore: settings.alertDaysBefore,
      });
    }
  }, [settings?.id]);

  const saveOffice = async () => {
    await db.settings.update(1, form);
    toast.success("Dados da empresa atualizados");
  };

  const changePwd = async () => {
    if (newPwd.length < 4) return toast.error("Mínimo 4 caracteres");
    await setPassword(newPwd);
    setNewPwd("");
    toast.success("Senha atualizada");
  };

  const exportBackup = async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      contracts: await db.contracts.toArray(),
      installments: await db.installments.toArray(),
      clients: await db.clients.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-juridico-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado");
  };

  const importBackup = async (file: File) => {
    if (!confirm("Importar substituirá os dados atuais. Continuar?")) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await db.transaction("rw", db.contracts, db.installments, db.clients, db.settings, async () => {
      await db.contracts.clear(); await db.installments.clear(); await db.clients.clear(); await db.settings.clear();
      if (data.contracts) await db.contracts.bulkAdd(data.contracts);
      if (data.installments) await db.installments.bulkAdd(data.installments);
      if (data.clients) await db.clients.bulkAdd(data.clients);
      if (data.settings) await db.settings.bulkAdd(data.settings);
    });
    toast.success("Backup restaurado");
  };

  const clearAll = async () => {
    if (!confirm("APAGAR TODOS os dados do sistema? Esta ação é irreversível.")) return;
    await db.transaction("rw", db.contracts, db.installments, db.clients, async () => {
      await db.contracts.clear(); await db.installments.clear(); await db.clients.clear();
    });
    await db.settings.update(1, { contractSequence: 0 });
    toast.success("Dados apagados");
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-4xl mx-auto animate-in-up">
      <header>
        <p className="text-xs uppercase tracking-widest text-gold font-medium">Sistema</p>
        <h1 className="font-display text-4xl mt-1">Configurações</h1>
      </header>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><Building2 className="h-4 w-4 text-gold" /> Empresa contratante</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome da empresa"><Input value={form.officeName} onChange={(e) => setForm({ ...form, officeName: e.target.value })} /></Field>
            <Field label="Responsável pelo jurídico"><Input value={form.lawyerName} onChange={(e) => setForm({ ...form, lawyerName: e.target.value })} /></Field>
            <Field label="CNPJ / Registro"><Input value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} /></Field>
            <Field label="UF"><Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} /></Field>
            <Field label="Alertar dias antes do vencimento">
              <Input type="number" value={form.alertDaysBefore} onChange={(e) => setForm({ ...form, alertDaysBefore: Number(e.target.value) })} />
            </Field>
          </div>
          <Button onClick={saveOffice} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><KeyRound className="h-4 w-4 text-gold" /> Senha de acesso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Nova senha"><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></Field>
          <Button onClick={changePwd} variant="outline">Atualizar senha</Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display">Backup e restauração</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Todos os dados ficam apenas no seu navegador. Faça backups regulares.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup} variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar backup (JSON)</Button>
            <Button onClick={() => fileRef.current?.click()} variant="outline"><Upload className="h-4 w-4 mr-2" /> Restaurar backup</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importBackup(f);
            }} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-destructive/30 border-l-2 border-l-destructive">
        <CardHeader><CardTitle className="font-display flex items-center gap-2 text-destructive"><ShieldAlert className="h-4 w-4" /> Zona de risco</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={clearAll} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
            Apagar todos os dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
