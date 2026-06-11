import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db, getSettings, type Settings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setPassword } from "@/lib/auth";
import { maskCPFCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { Download, Upload, Save, Building2, KeyRound, ShieldAlert, Image as ImageIcon, Trash2, CalendarClock } from "lucide-react";
import { PaymentConditionsManager } from "@/components/PaymentConditionsManager";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<Settings>>({});
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings?.id]);

  const update = (patch: Partial<Settings>) => setForm((s) => ({ ...s, ...patch }));
  const updateAddr = (patch: Partial<NonNullable<Settings["companyAddress"]>>) =>
    setForm((s) => ({ ...s, companyAddress: { ...(s.companyAddress ?? {}), ...patch } }));

  const saveCompany = async () => {
    await db.settings.update(1, form);
    toast.success("Dados da empresa atualizados");
  };

  const uploadLogo = async (f: File) => {
    if (f.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB.");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      update({ logoDataUrl: dataUrl });
      await db.settings.update(1, { logoDataUrl: dataUrl });
      toast.success("Logo atualizada");
    };
    reader.readAsDataURL(f);
  };

  const removeLogo = async () => {
    update({ logoDataUrl: undefined });
    await db.settings.update(1, { logoDataUrl: undefined });
    toast.success("Logo removida");
  };

  const changePwd = async () => {
    if (newPwd.length < 4) return toast.error("Mínimo 4 caracteres");
    await setPassword(newPwd);
    setNewPwd("");
    toast.success("Senha atualizada");
  };

  const exportBackup = async () => {
    const data = {
      version: 3,
      exportedAt: new Date().toISOString(),
      contracts: await db.contracts.toArray(),
      installments: await db.installments.toArray(),
      clients: await db.clients.toArray(),
      settings: await db.settings.toArray(),
      accounts: await db.accounts.toArray(),
      finTx: await db.finTx.toArray(),
      investments: await db.investments.toArray(),
      invMovements: await db.invMovements.toArray(),
      quotes: await db.quotes.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado");
  };

  const importBackup = async (file: File) => {
    if (!confirm("Importar substituirá os dados atuais. Continuar?")) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await db.transaction("rw", db.tables, async () => {
      for (const t of db.tables) await t.clear();
      const tables: [string, any[]][] = [
        ["contracts", data.contracts], ["installments", data.installments],
        ["clients", data.clients], ["settings", data.settings],
        ["accounts", data.accounts], ["finTx", data.finTx],
        ["investments", data.investments], ["invMovements", data.invMovements],
        ["quotes", data.quotes],
      ];
      for (const [name, rows] of tables) if (rows?.length) await (db as any)[name].bulkAdd(rows);
    });
    toast.success("Backup restaurado");
  };

  const clearAll = async () => {
    if (!confirm("APAGAR TODOS os dados do sistema? Esta ação é irreversível.")) return;
    await db.transaction("rw", db.tables, async () => {
      for (const t of db.tables) if (t.name !== "settings") await t.clear();
    });
    await db.settings.update(1, { contractSequence: 0, quoteSequence: 0 });
    toast.success("Dados apagados");
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto animate-in-up">
      <header>
        <p className="text-xs uppercase tracking-widest text-gold font-medium">Sistema</p>
        <h1 className="font-display text-4xl mt-1">Configurações</h1>
      </header>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" /> Identidade da empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 rounded-xl border border-border bg-muted/40 grid place-items-center overflow-hidden">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) uploadLogo(f);
              }} />
              <Button variant="outline" onClick={() => logoRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Enviar logo
              </Button>
              {form.logoDataUrl && (
                <Button variant="ghost" onClick={removeLogo} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG ou JPG, até 2MB. Aparece no menu lateral e nos orçamentos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Razão social"><Input value={form.officeName ?? ""} onChange={(e) => update({ officeName: e.target.value })} /></Field>
            <Field label="Slogan / Atividade"><Input value={form.companyTagline ?? ""} onChange={(e) => update({ companyTagline: e.target.value })} placeholder="Ex: Segurança eletrônica com inteligência" /></Field>
            <Field label="CNPJ"><Input value={form.companyDocument ?? ""} onChange={(e) => update({ companyDocument: maskCPFCNPJ(e.target.value) })} /></Field>
            <Field label="Inscrição Estadual"><Input value={form.companyIE ?? ""} onChange={(e) => update({ companyIE: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={form.companyEmail ?? ""} onChange={(e) => update({ companyEmail: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={form.companyPhone ?? ""} onChange={(e) => update({ companyPhone: maskPhone(e.target.value) })} /></Field>
            <Field label="Site"><Input value={form.companyWebsite ?? ""} onChange={(e) => update({ companyWebsite: e.target.value })} placeholder="https://" /></Field>
            <Field label="Vendedor padrão"><Input value={form.defaultSeller ?? ""} onChange={(e) => update({ defaultSeller: e.target.value })} placeholder="Nome que aparece nos orçamentos" /></Field>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Endereço</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="CEP"><Input value={form.companyAddress?.zip ?? ""} onChange={(e) => updateAddr({ zip: maskCEP(e.target.value) })} /></Field>
              <Field label="Logradouro"><Input value={form.companyAddress?.street ?? ""} onChange={(e) => updateAddr({ street: e.target.value })} /></Field>
              <Field label="Número"><Input value={form.companyAddress?.number ?? ""} onChange={(e) => updateAddr({ number: e.target.value })} /></Field>
              <Field label="Complemento"><Input value={form.companyAddress?.complement ?? ""} onChange={(e) => updateAddr({ complement: e.target.value })} /></Field>
              <Field label="Bairro"><Input value={form.companyAddress?.neighborhood ?? ""} onChange={(e) => updateAddr({ neighborhood: e.target.value })} /></Field>
              <Field label="Cidade"><Input value={form.companyAddress?.city ?? ""} onChange={(e) => updateAddr({ city: e.target.value })} /></Field>
              <Field label="UF"><Input maxLength={2} value={form.companyAddress?.state ?? ""} onChange={(e) => updateAddr({ state: e.target.value.toUpperCase() })} /></Field>
            </div>
          </div>

          <div>
            <Field label="Termos padrão para orçamentos">
              <Textarea rows={3} value={form.quoteTerms ?? ""} onChange={(e) => update({ quoteTerms: e.target.value })}
                placeholder="Ex: Validade da proposta: 30 dias. Pagamento via PIX, boleto ou transferência." />
            </Field>
          </div>

          <div>
            <Field label="Alertar dias antes do vencimento">
              <Input className="max-w-[180px]" type="number" value={form.alertDaysBefore ?? 7}
                onChange={(e) => update({ alertDaysBefore: Number(e.target.value) })} />
            </Field>
          </div>

          <Button onClick={saveCompany} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Save className="h-4 w-4 mr-2" /> Salvar configurações
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-gold" /> Condições de pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentConditionsManager />
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
