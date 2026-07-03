import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { QuoteForm } from "@/components/QuoteForm";

export const Route = createFileRoute("/_app/orcamentos/novo")({
  validateSearch: (s: Record<string, unknown>) => ({
    projectId: s.projectId ? Number(s.projectId) : undefined,
  }),
  component: NewQuotePage,
});

function NewQuotePage() {
  const search = useSearch({ from: "/_app/orcamentos/novo" });
  const settings = useLiveQuery(() => db.settings.get(1));

  return (
    <QuoteForm
      mode="new"
      projectId={search.projectId}
      defaultSeller={settings?.defaultSeller ?? ""}
      defaultNotes={settings?.quoteTerms ?? ""}
    />
  );
}
