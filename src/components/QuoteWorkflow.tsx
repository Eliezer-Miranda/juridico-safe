import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { db, getSettings, type Quote, type QuoteStatus } from "@/lib/db";
import { QUOTE_PIPELINE, QUOTE_STATUS_LABEL, linkQuoteToContract, setQuoteStatus } from "@/lib/quotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ExternalLink, FileSignature, Link2, Unlink, Workflow } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const NONE = "none";

export function QuoteWorkflow({ quote }: { quote: Quote }) {
  const contracts = useLiveQuery(() => db.contracts.toArray()) ?? [];
  const linkedContract = useMemo(
    () => contracts.find((c) => c.id === quote.contractId),
    [contracts, quote.contractId],
  );
  const [pick, setPick] = useState<string>(NONE);

  const actor = async () => {
    const s = await getSettings();
    return s.lawyerName || s.officeName || "Operador";
  };

  const currentIdx = QUOTE_PIPELINE.findIndex((p) => p.status === quote.status);

  const advance = async (status: QuoteStatus) => {
    if (status === "faturado") {
      toast.info('Use "Gerar parcelas" para converter a proposta em contas a receber/pagar.');
      return;
    }
    await setQuoteStatus(quote, status, await actor());
    toast.success(`Status: ${QUOTE_STATUS_LABEL[status]}`);
  };

  const link = async () => {
    if (pick === NONE) { toast.error("Selecione um contrato."); return; }
    await linkQuoteToContract(quote, Number(pick), await actor());
    setPick(NONE);
    toast.success("Proposta vinculada ao contrato");
  };

  const unlink = async () => {
    await linkQuoteToContract(quote, null, await actor());
    toast.success("Vínculo removido");
  };

  const suggested = useMemo(
    () => contracts.filter((c) => c.clientId === quote.partyId),
    [contracts, quote.partyId],
  );
  const options = suggested.length ? suggested : contracts;

  return (
    <Card className="bg-card border-border print:hidden">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Workflow className="h-4 w-4 text-gold" /> Acompanhamento da proposta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-4">
          {QUOTE_PIPELINE.map((step, i) => {
            const done = currentIdx >= 0 && i <= currentIdx;
            const isCurrent = quote.status === step.status;
            return (
              <button
                key={step.status}
                onClick={() => !isCurrent && advance(step.status)}
                className={`text-left rounded-lg border p-3 transition ${
                  isCurrent
                    ? "border-gold/60 bg-gold/10"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/5 hover:border-gold/40"
                      : "border-border hover:border-gold/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  {done ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="h-3 w-3 rounded-full border border-border" />}
                  {i + 1}
                </span>
                <p className={`mt-1 text-sm font-medium ${isCurrent ? "text-gold" : ""}`}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              </button>
            );
          })}
        </div>

        {!QUOTE_PIPELINE.some((p) => p.status === quote.status) && (
          <p className="text-xs text-muted-foreground">
            Status atual fora do fluxo padrão: <span className="text-foreground">{QUOTE_STATUS_LABEL[quote.status]}</span>
          </p>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <Label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <FileSignature className="h-3.5 w-3.5 text-gold" /> Contrato vinculado
          </Label>

          {linkedContract ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {linkedContract.number} · {linkedContract.objectDescription || "Sem objeto informado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assinado em {formatDate(linkedContract.signedAt)} · {linkedContract.status}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/contratos/$id"
                  params={{ id: String(linkedContract.id) }}
                  className="text-xs text-gold hover:underline inline-flex items-center gap-1"
                >
                  abrir contrato <ExternalLink className="h-3 w-3" />
                </Link>
                <Button variant="outline" size="sm" onClick={unlink}>
                  <Unlink className="h-3.5 w-3.5 mr-1" /> Desvincular
                </Button>
              </div>
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato cadastrado ainda.{" "}
              <Link to="/contratos/novo" className="text-gold hover:underline">Cadastrar contrato</Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger className="max-w-md min-w-[260px]">
                  <SelectValue placeholder="Selecione o contrato existente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Selecione…</SelectItem>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.number} — {c.objectDescription?.slice(0, 48) || "sem objeto"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={link} className="bg-gradient-gold text-primary-foreground shadow-gold">
                <Link2 className="h-4 w-4 mr-2" /> Vincular
              </Button>
              {suggested.length > 0 && (
                <span className="text-xs text-muted-foreground">Contratos do mesmo cliente</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
