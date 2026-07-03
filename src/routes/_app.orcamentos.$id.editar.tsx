import { createFileRoute, useParams } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { QuoteForm } from "@/components/QuoteForm";

export const Route = createFileRoute("/_app/orcamentos/$id/editar")({
  component: EditQuotePage,
});

function EditQuotePage() {
  const { id } = useParams({ from: "/_app/orcamentos/$id/editar" });
  const qid = Number(id);
  const quote = useLiveQuery(() => db.quotes.get(qid), [qid]);

  if (!quote) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  return <QuoteForm mode="edit" initial={quote} projectId={quote.projectId} />;
}
