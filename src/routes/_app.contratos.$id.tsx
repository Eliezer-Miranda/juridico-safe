import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, type Installment, type PaymentMethod } from "@/lib/db";
import { computePenalty, refreshInstallmentStatus } from "@/lib/installments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, AlertTriangle, Trash2, FileText, Users, Wallet, Calendar, Paperclip } from "lucide-react";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { ContractDocuments } from "@/components/ContractDocuments";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contratos/$id")({
  component: ContractDetail,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground border-border" },
  pago: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  atraso: { label: "Em atraso", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  negociado: { label: "Negociado", cls: "bg-warning/15 text-warning border-warning/30" },
};

function ContractDetail() {
  const { id } = useParams({ from: "/_app/contratos/$id" });
  const cid = Number(id);
  const navigate = useNavigate();

  const contract = useLiveQuery(() => db.contracts.get(cid), [cid]);
  const installments = useLiveQuery(
    () => db.installments.where({ contractId: cid }).sortBy("number"),
    [cid],
  ) ?? [];
  const client = useLiveQuery(() => contract ? db.clients.get(contract.clientId) : undefined, [contract?.clientId]);

  const [paying, setPaying] = useState<Installment | null>(null);

  useEffect(() => { refreshInstallmentStatus(cid); }, [cid]);

  if (!contract) {
    return <div className="p-10 text-muted-foreground">Carregando contrato…</div>;
  }

  const totalContratado = contract.totalValue;
  const totalRecebido = installments.filter(i => i.status === "pago").reduce((s, i) => s + (i.paidValue ?? i.finalValue), 0) + (contract.downPayment ?? 0);
  const totalPendente = installments.filter(i => i.status === "pendente").reduce((s, i) => s + i.finalValue, 0);
  const totalAtraso = installments.filter(i => i.status === "atraso").reduce((s, i) => s + i.finalValue, 0);

  const removeContract = async () => {
    if (!confirm(`Excluir o contrato ${contract.number}? Esta ação não pode ser desfeita.`)) return;
    await db.installments.where({ contractId: cid }).delete();
    await db.contracts.delete(cid);
    toast.success("Contrato excluído");
    navigate({ to: "/contratos" });
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto animate-in-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => navigate({ to: "/contratos" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="font-mono text-xs text-gold">{contract.number}</span>
            <Badge variant="outline">{contract.status}</Badge>
            <Badge variant="outline">{contract.area}</Badge>
            <Badge variant="outline">{contract.type}</Badge>
          </div>
          <h1 className="font-display text-3xl lg:text-4xl mt-2">{client?.name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{contract.objectDescription}</p>
        </div>
        <Button variant="outline" onClick={removeContract} className="text-destructive border-destructive/30">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </Button>
      </header>

      {/* Finance summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Wallet} label="Contratado" value={formatBRL(totalContratado)} accent />
        <SummaryCard icon={CheckCircle2} label="Recebido" value={formatBRL(totalRecebido)} positive />
        <SummaryCard icon={Calendar} label="A receber" value={formatBRL(totalPendente)} />
        <SummaryCard icon={AlertTriangle} label="Em atraso" value={formatBRL(totalAtraso)} danger />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Installments */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Calendar className="h-4 w-4 text-gold" /> Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            {installments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este contrato não possui parcelas (à vista ou êxito).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Vencimento</th>
                      <th className="text-right py-2 px-2">Original</th>
                      <th className="text-right py-2 px-2">Multa/Juros</th>
                      <th className="text-right py-2 px-2">Total</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Pago em</th>
                      <th className="text-right py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((i) => {
                      const st = STATUS[i.status];
                      return (
                        <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                          <td className="py-2.5 px-2 font-mono text-xs">{i.number}</td>
                          <td className="py-2.5 px-2">{formatDate(i.dueDate)}</td>
                          <td className="py-2.5 px-2 text-right">{formatBRL(i.originalValue)}</td>
                          <td className="py-2.5 px-2 text-right text-destructive">{i.penalty > 0 ? formatBRL(i.penalty) : "—"}</td>
                          <td className="py-2.5 px-2 text-right font-medium">{formatBRL(i.finalValue)}</td>
                          <td className="py-2.5 px-2"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
                          <td className="py-2.5 px-2 text-muted-foreground">{i.paidAt ? formatDate(i.paidAt) : "—"}</td>
                          <td className="py-2.5 px-2 text-right">
                            {i.status !== "pago" && i.status !== "cancelado" && (
                              <Button size="sm" variant="outline" onClick={() => setPaying(i)} className="border-gold/40 text-gold hover:bg-gold/10">
                                Registrar pagamento
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panels */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Users className="h-4 w-4 text-gold" /> Prestador contratado</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Info label="Nome" value={client?.name} />
              <Info label="Documento" value={client?.document} />
              <Info label="E-mail" value={client?.email} />
              <Info label="Telefone" value={client?.phone} />
              {client?.id && (
                <Link to="/clientes/$id" params={{ id: String(client.id) }} className="inline-block text-xs text-gold hover:underline mt-2">
                  Ver / editar cadastro →
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /> Processo</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Info label="Nº processo" value={contract.processNumber} />
              <Info label="Tribunal" value={contract.court} />
              <Info label="Fase" value={contract.procedureStage} />
              <Info label="Assinado em" value={formatDate(contract.signedAt)} />
              <Info label="Vigência" value={`${formatDate(contract.startsAt)} → ${formatDate(contract.endsAt) ?? "—"}`} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display">Advogados</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contract.lawyers.map((l, i) => (
                <div key={i} className="flex justify-between border-b border-border/40 pb-1.5 last:border-0">
                  <div>
                    <p className="font-medium">{l.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">OAB {l.oab}/{l.uf}</p>
                  </div>
                  <span className="text-gold font-medium">{l.percentage}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display">Histórico</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contract.history.slice().reverse().map((h, i) => (
                <div key={i} className="border-l-2 border-gold/40 pl-3">
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.at)}</p>
                  <p>{h.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Documentos */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-gold" /> Documentos do contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContractDocuments contract={contract} />
        </CardContent>
      </Card>

      <PaymentDialog
        installment={paying}
        contract={contract}
        onClose={() => setPaying(null)}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent, positive, danger }: any) {
  const c = danger ? "text-destructive border-l-destructive" : positive ? "text-success border-l-success" : accent ? "text-gold border-l-gold" : "text-foreground border-l-border";
  return (
    <Card className={`bg-card border-border border-l-2 ${c.split(" ").pop()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${c.split(" ")[0]}`} />
        </div>
        <p className={`font-display text-2xl mt-2 ${c.split(" ")[0]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PaymentDialog({ installment, contract, onClose }: any) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paidValue, setPaidValue] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (installment) {
      const { penalty } = computePenalty(installment, contract, new Date(paidAt));
      setPaidValue(Math.round((installment.originalValue + penalty) * 100) / 100);
      setRef(""); setNotes("");
    }
  }, [installment?.id, paidAt]);

  if (!installment) return null;

  const save = async () => {
    await db.installments.update(installment.id!, {
      status: "pago",
      paidAt,
      paidValue,
      paymentMethod: method,
      transactionRef: ref,
      notes,
    });
    const c = await db.contracts.get(installment.contractId);
    if (c) {
      await db.contracts.update(c.id!, {
        history: [...c.history, { at: new Date().toISOString(), description: `Parcela ${installment.number} paga (${formatBRL(paidValue)})` }],
        updatedAt: new Date().toISOString(),
      });
    }
    toast.success(`Pagamento da parcela ${installment.number} registrado`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registrar pagamento — Parcela {installment.number}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data do pagamento</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Valor pago (R$)</Label>
            <Input type="number" step="0.01" value={paidValue} onChange={(e) => setPaidValue(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Forma</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="pix">PIX</option><option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option>
              <option value="cheque">Cheque</option><option value="cartao">Cartão</option><option value="outro">Outro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nº comprovante</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="opcional" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} className="bg-gradient-gold text-primary-foreground shadow-gold">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
