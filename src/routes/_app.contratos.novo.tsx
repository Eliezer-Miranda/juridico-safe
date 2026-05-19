import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { db, nextContractNumber, type Contract, type Client } from "@/lib/db";
import { generateInstallments } from "@/lib/installments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { maskCPFCNPJ, maskPhone, formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contratos/novo")({
  component: NewContract,
});

interface FormShape extends Omit<Contract, "id" | "number" | "createdAt" | "updatedAt" | "documents" | "history" | "clientId"> {
  client: { existing?: string; type: "PF" | "PJ"; name: string; document: string; email?: string; phone?: string };
}

function NewContract() {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.toArray()) ?? [];

  const { register, handleSubmit, control, watch, setValue, formState: { isSubmitting } } = useForm<FormShape>({
    defaultValues: {
      signedAt: new Date().toISOString().slice(0, 10),
      startsAt: new Date().toISOString().slice(0, 10),
      status: "ativo",
      type: "honorarios",
      area: "civel",
      objectDescription: "",
      tags: [],
      lawyers: [{ name: "", oab: "", uf: "SP", percentage: 100 }],
      totalValue: 0,
      downPayment: 0,
      paymentMode: "parcelado",
      installmentsCount: 12,
      dueDay: 10,
      firstDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      correctionIndex: "nenhum",
      monthlyPenalty: 2,
      monthlyInterest: 1,
      earlyDiscount: 0,
      client: { type: "PF", name: "", document: "" },
    } as any,
  });

  const lawyers = useFieldArray({ control, name: "lawyers" });
  const values = watch();

  const previewInstallments = generateInstallments(values);

  const onSubmit = async (data: FormShape) => {
    let clientId: number;
    if (data.client.existing) {
      clientId = Number(data.client.existing);
    } else {
      if (!data.client.name) {
        toast.error("Informe o nome do cliente.");
        return;
      }
      const now = new Date().toISOString();
      const c: Omit<Client, "id"> = {
        type: data.client.type, name: data.client.name, document: data.client.document,
        email: data.client.email, phone: data.client.phone,
        createdAt: now, updatedAt: now,
      };
      clientId = await db.clients.add(c as Client);
    }

    const number = await nextContractNumber();
    const now = new Date().toISOString();
    const contract: Omit<Contract, "id"> = {
      ...data,
      clientId,
      number,
      tags: data.tags ?? [],
      documents: [],
      history: [{ at: now, description: `Contrato ${number} cadastrado` }],
      createdAt: now, updatedAt: now,
    } as Contract;
    const id = await db.contracts.add(contract as Contract);

    const insts = generateInstallments(contract).map((i) => ({ ...i, contractId: id }));
    if (insts.length) await db.installments.bulkAdd(insts);

    toast.success(`Contrato ${number} criado`);
    navigate({ to: "/contratos/$id", params: { id: String(id) } });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto animate-in-up">
      <header className="flex items-center justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate({ to: "/contratos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <h1 className="font-display text-4xl mt-1">Novo contrato</h1>
        </div>
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> Salvar contrato
        </Button>
      </header>

      <Section title="Identificação">
        <Grid cols={3}>
          <Field label="Status">
            <select {...register("status")} className={inputCls}>
              <option value="ativo">Ativo</option>
              <option value="negociacao">Em negociação</option>
              <option value="suspenso">Suspenso</option>
              <option value="encerrado">Encerrado</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </Field>
          <Field label="Tipo de contrato">
            <select {...register("type")} className={inputCls}>
              <option value="honorarios">Honorários</option>
              <option value="exito">Êxito</option>
              <option value="consultoria">Consultoria</option>
              <option value="representacao">Representação</option>
              <option value="acordo">Acordo extrajudicial</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Área do direito">
            <select {...register("area")} className={inputCls}>
              <option value="civel">Cível</option>
              <option value="trabalhista">Trabalhista</option>
              <option value="criminal">Criminal</option>
              <option value="previdenciario">Previdenciário</option>
              <option value="tributario">Tributário</option>
              <option value="empresarial">Empresarial</option>
              <option value="familia">Família</option>
              <option value="imobiliario">Imobiliário</option>
              <option value="consumidor">Consumidor</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Data de assinatura"><Input type="date" {...register("signedAt")} /></Field>
          <Field label="Início de vigência"><Input type="date" {...register("startsAt")} /></Field>
          <Field label="Término de vigência"><Input type="date" {...register("endsAt")} /></Field>
        </Grid>
      </Section>

      <Section title="Objeto">
        <Grid cols={1}>
          <Field label="Descrição do objeto">
            <Textarea rows={3} {...register("objectDescription", { required: true })} placeholder="Descreva o objeto do contrato…" />
          </Field>
        </Grid>
        <Grid cols={3}>
          <Field label="Nº do processo"><Input {...register("processNumber")} placeholder="0000000-00.0000.0.00.0000" /></Field>
          <Field label="Tribunal / Vara / Comarca"><Input {...register("court")} /></Field>
          <Field label="Fase processual">
            <select {...register("procedureStage")} className={inputCls}>
              <option value="">—</option>
              <option>Inicial</option><option>Instrução</option><option>Sentença</option>
              <option>Recurso</option><option>Execução</option><option>Transitado em julgado</option>
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Prestador contratado (escritório/advogado)">
        <Grid cols={2}>
          <Field label="Prestador existente">
            <select {...register("client.existing")} className={inputCls}>
              <option value="">— Cadastrar novo prestador —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.document}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select {...register("client.type")} className={inputCls}>
              <option value="PJ">Pessoa Jurídica (escritório)</option>
              <option value="PF">Pessoa Física (advogado)</option>
            </select>
          </Field>
          <Field label="Nome / Razão social"><Input {...register("client.name")} /></Field>
          <Field label="CPF / CNPJ">
            <Controller control={control} name="client.document" render={({ field }) => (
              <Input {...field} onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))} />
            )} />
          </Field>
          <Field label="E-mail"><Input type="email" {...register("client.email")} /></Field>
          <Field label="Telefone">
            <Controller control={control} name="client.phone" render={({ field }) => (
              <Input {...field} onChange={(e) => field.onChange(maskPhone(e.target.value))} />
            )} />
          </Field>
        </Grid>
      </Section>

      <Section title="Advogados responsáveis pelo caso" action={
        <Button type="button" variant="outline" size="sm" onClick={() => lawyers.append({ name: "", oab: "", uf: "SP", percentage: 0 })}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      }>
        <div className="space-y-3">
          {lawyers.fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5"><Field label="Nome"><Input {...register(`lawyers.${idx}.name`)} /></Field></div>
              <div className="col-span-3"><Field label="OAB"><Input {...register(`lawyers.${idx}.oab`)} /></Field></div>
              <div className="col-span-2"><Field label="UF"><Input {...register(`lawyers.${idx}.uf`)} /></Field></div>
              <div className="col-span-1"><Field label="%"><Input type="number" {...register(`lawyers.${idx}.percentage`, { valueAsNumber: true })} /></Field></div>
              <div className="col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => lawyers.remove(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Condições financeiras">
        <Grid cols={4}>
          <Field label="Valor total (R$)"><Input type="number" step="0.01" {...register("totalValue", { valueAsNumber: true })} /></Field>
          <Field label="Entrada / sinal (R$)"><Input type="number" step="0.01" {...register("downPayment", { valueAsNumber: true })} /></Field>
          <Field label="Data do sinal"><Input type="date" {...register("downPaymentDate")} /></Field>
          <Field label="Forma de pagamento">
            <select {...register("paymentMode")} className={inputCls}>
              <option value="avista">À vista</option>
              <option value="parcelado">Parcelado</option>
              <option value="exito">Êxito</option>
              <option value="misto">Misto</option>
            </select>
          </Field>
          <Field label="Nº de parcelas"><Input type="number" {...register("installmentsCount", { valueAsNumber: true })} /></Field>
          <Field label="Dia do vencimento"><Input type="number" min={1} max={31} {...register("dueDay", { valueAsNumber: true })} /></Field>
          <Field label="Primeira parcela"><Input type="date" {...register("firstDueDate")} /></Field>
          <Field label="Correção">
            <select {...register("correctionIndex")} className={inputCls}>
              <option value="nenhum">Nenhum</option><option value="igpm">IGPM</option>
              <option value="ipca">IPCA</option><option value="inpc">INPC</option>
              <option value="selic">Selic</option><option value="personalizado">Personalizado</option>
            </select>
          </Field>
          <Field label="Multa por atraso (%)"><Input type="number" step="0.01" {...register("monthlyPenalty", { valueAsNumber: true })} /></Field>
          <Field label="Juros de mora (% a.m.)"><Input type="number" step="0.01" {...register("monthlyInterest", { valueAsNumber: true })} /></Field>
          <Field label="Desconto pontualidade (%)"><Input type="number" step="0.01" {...register("earlyDiscount", { valueAsNumber: true })} /></Field>
          <Field label="Êxito (%)"><Input type="number" step="0.01" {...register("successPercentage", { valueAsNumber: true })} /></Field>
        </Grid>

        {previewInstallments.length > 0 && (
          <div className="mt-4 p-4 rounded-md border border-border bg-background/40">
            <p className="text-xs uppercase tracking-widest text-gold mb-2">Pré-visualização de parcelas</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {previewInstallments.slice(0, 12).map((i) => (
                <div key={i.number} className="px-2 py-1.5 rounded bg-muted/40">
                  <div className="text-muted-foreground">#{i.number} · {i.dueDate.split("-").reverse().join("/")}</div>
                  <div className="font-medium">{formatBRL(i.originalValue)}</div>
                </div>
              ))}
              {previewInstallments.length > 12 && (
                <div className="px-2 py-1.5 text-muted-foreground">+{previewInstallments.length - 12} parcelas…</div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="Observações">
        <Textarea rows={3} {...register("notes")} placeholder="Anotações livres sobre o contrato…" />
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> Salvar contrato
        </Button>
      </div>
    </form>
  );
}

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-xl">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Grid({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  const cls = cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 md:grid-cols-2" : cols === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4";
  return <div className={`grid ${cls} gap-4`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
