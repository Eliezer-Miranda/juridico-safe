import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, nextProjectCode, type Project, type ProjectType } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projetos/novo")({
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray()) ?? [];
  const onlyClients = clients.filter((c) => (c.role ?? "cliente") !== "fornecedor");

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [type, setType] = useState<ProjectType>("misto");
  const [startsAt, setStartsAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState<string>("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!name.trim()) return toast.error("Informe o nome do projeto");
    if (!clientId) return toast.error("Selecione o cliente");
    const now = new Date().toISOString();
    const code = await nextProjectCode();
    const project: Project = {
      code, name, clientId: Number(clientId), type, status: "orcamento",
      startsAt, endsAt: endsAt || undefined, description, notes,
      createdAt: now, updatedAt: now,
    };
    const id = await db.projects.add(project);
    toast.success(`Projeto ${code} criado`);
    navigate({ to: "/projetos/$id", params: { id: String(id) } });
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6 animate-in-up">
      <header>
        <button onClick={() => navigate({ to: "/projetos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-xs uppercase tracking-widest text-gold font-medium mt-2">Novo projeto</p>
        <h1 className="font-display text-4xl mt-1">Cadastrar projeto</h1>
      </header>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="font-display text-xl">Dados do projeto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome / Identificação"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: CFTV Sede Cliente X" /></Field>
            <Field label="Cliente">
              <Select value={clientId ? String(clientId) : ""} onValueChange={(v) => setClientId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {onlyClients.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cliente cadastrado.</div>}
                  {onlyClients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.document}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de contrato">
              <Select value={type} onValueChange={(v) => setType(v as ProjectType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">Fornecimento de material</SelectItem>
                  <SelectItem value="maoDeObra">Mão de obra</SelectItem>
                  <SelectItem value="misto">Material + Mão de obra</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div />
            <Field label="Início"><Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
            <Field label="Previsão de término"><Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
            <div className="md:col-span-2">
              <Field label="Descrição / Escopo"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observações"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Save className="h-4 w-4 mr-2" /> Criar projeto
        </Button>
      </div>
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
