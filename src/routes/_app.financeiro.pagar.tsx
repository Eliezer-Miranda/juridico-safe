import { createFileRoute } from "@tanstack/react-router";
import { FinTxList } from "@/components/FinTxList";

export const Route = createFileRoute("/_app/financeiro/pagar")({
  component: () => <FinTxList kind="pagar" />,
});
