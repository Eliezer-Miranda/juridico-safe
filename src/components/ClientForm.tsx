import { useForm, Controller } from "react-hook-form";
import { useEffect } from "react";
import { db, type Client } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskCPFCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { Save } from "lucide-react";
import { toast } from "sonner";

type FormData = Omit<Client, "id" | "createdAt" | "updatedAt">;

interface Props {
  initial?: Client;
  onSaved: (id: number) => void;
}

export function ClientForm({ initial, onSaved }: Props) {
  const { register, handleSubmit, control, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      type: "PJ",
      role: "cliente",
      name: "",
      document: "",
      address: {},
      ...initial,
    } as FormData,
  });

  useEffect(() => {
    if (initial) reset(initial as FormData);
  }, [initial?.id, reset]);

  const onSubmit = async (data: FormData) => {
    if (!data.name?.trim()) return toast.error("Informe o nome / razão social.");
    const now = new Date().toISOString();
    if (initial?.id) {
      await db.clients.update(initial.id, { ...data, updatedAt: now });
      toast.success("Cadastro atualizado");
      onSaved(initial.id);
    } else {
      const id = await db.clients.add({ ...data, createdAt: now, updatedAt: now } as Client);
      toast.success("Cadastro criado");
      onSaved(id as number);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Grid cols={3}>
            <Field label="Relação">
              <select {...register("role")} className={inputCls}>
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="ambos">Cliente e Fornecedor</option>
              </select>
            </Field>
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
          <Textarea rows={3} {...register("notes")} placeholder="Notas internas sobre o prestador…" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> {initial ? "Salvar alterações" : "Cadastrar prestador"}
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
