import { useForm, Controller, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import { db, type Client } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskCPFCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { Save, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type FormData = Omit<Client, "id" | "createdAt" | "updatedAt">;

interface Props {
  initial?: Client;
  onSaved: (id: number) => void;
  defaultRole?: "cliente" | "fornecedor" | "ambos";
  lockRole?: boolean;
}

export function ClientForm({ initial, onSaved, defaultRole = "cliente", lockRole = false }: Props) {
  const { register, handleSubmit, control, reset, setValue, getValues, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      type: "PJ",
      role: defaultRole,
      name: "",
      document: "",
      address: {},
      ...initial,
    } as FormData,
  });

  const type = useWatch({ control, name: "type" });
  const document = useWatch({ control, name: "document" });
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (initial) reset(initial as FormData);
  }, [initial?.id, reset]);

  const lookupCNPJ = async () => {
    const digits = (document ?? "").replace(/\D/g, "");
    if (digits.length !== 14) return toast.error("Informe um CNPJ válido (14 dígitos).");
    setLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const d = await res.json();
      const current = getValues();
      setValue("name", d.razao_social ?? d.nome_fantasia ?? current.name, { shouldDirty: true });
      if (d.data_inicio_atividade) setValue("birthDate", d.data_inicio_atividade, { shouldDirty: true });
      if (d.email) setValue("email", d.email, { shouldDirty: true });
      const ddd = d.ddd_telefone_1 ?? "";
      if (ddd) setValue("phone", maskPhone(ddd), { shouldDirty: true });
      setValue("address.zip", d.cep ? maskCEP(String(d.cep)) : current.address?.zip ?? "", { shouldDirty: true });
      setValue("address.street", [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim(), { shouldDirty: true });
      setValue("address.number", d.numero ?? "", { shouldDirty: true });
      setValue("address.complement", d.complemento ?? "", { shouldDirty: true });
      setValue("address.neighborhood", d.bairro ?? "", { shouldDirty: true });
      setValue("address.city", d.municipio ?? "", { shouldDirty: true });
      setValue("address.state", d.uf ?? "", { shouldDirty: true });
      toast.success("Dados do CNPJ preenchidos");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível consultar o CNPJ.");
    } finally {
      setLookingUp(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!data.name?.trim()) return toast.error("Informe o nome / razão social.");
    const now = new Date().toISOString();
    const payload = { ...data, role: lockRole ? defaultRole : (data.role ?? defaultRole) };
    try {
      if (initial?.id) {
        await db.clients.update(initial.id, { ...payload, updatedAt: now });
        toast.success("Cadastro atualizado");
        onSaved(initial.id);
      } else {
        const id = await db.clients.add({ ...payload, createdAt: now, updatedAt: now } as Client);
        toast.success("Cadastro criado");
        onSaved(id as number);
      }
    } catch (err) {
      console.error("Erro ao salvar cadastro", err);
      toast.error("Não foi possível salvar. Verifique os dados e tente novamente.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Grid cols={3}>
            {!lockRole && (
              <Field label="Relação">
                <select {...register("role")} className={inputCls}>
                  <option value="cliente">Cliente</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="ambos">Cliente e Fornecedor</option>
                </select>
              </Field>
            )}
            <Field label="Tipo">
              <select {...register("type")} className={inputCls}>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="PF">Pessoa Física</option>
              </select>
            </Field>
            <Field label="Nome / Razão social">
              <Input {...register("name", { required: true })} />
            </Field>
            <Field label="CPF / CNPJ">
              <Controller control={control} name="document" render={({ field }) => (
                <Input {...field} onChange={(e) => field.onChange(maskCPFCNPJ(e.target.value))} />
              )} />
            </Field>
            <Field label="RG / IE"><Input {...register("rgIe")} /></Field>
            <Field label="Representante legal"><Input {...register("legalRep")} placeholder="Sócio ou responsável" /></Field>
            <Field label="Data de nascimento / fundação"><Input type="date" {...register("birthDate")} /></Field>
          </Grid>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Contato</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Grid cols={2}>
            <Field label="E-mail"><Input type="email" {...register("email")} /></Field>
            <Field label="Telefone">
              <Controller control={control} name="phone" render={({ field }) => (
                <Input {...field} onChange={(e) => field.onChange(maskPhone(e.target.value ?? ""))} />
              )} />
            </Field>
          </Grid>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Endereço</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Grid cols={3}>
            <Field label="CEP">
              <Controller control={control} name="address.zip" render={({ field }) => (
                <Input {...field} onChange={(e) => field.onChange(maskCEP(e.target.value ?? ""))} />
              )} />
            </Field>
            <Field label="Rua / Logradouro"><Input {...register("address.street")} /></Field>
            <Field label="Número"><Input {...register("address.number")} /></Field>
            <Field label="Complemento"><Input {...register("address.complement")} /></Field>
            <Field label="Bairro"><Input {...register("address.neighborhood")} /></Field>
            <Field label="Cidade"><Input {...register("address.city")} /></Field>
            <Field label="UF"><Input {...register("address.state")} maxLength={2} /></Field>
          </Grid>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Observações</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} {...register("notes")} placeholder="Notas internas…" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> {initial ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  const cls = cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3";
  return <div className={`grid ${cls} gap-4`}>{children}</div>;
}
