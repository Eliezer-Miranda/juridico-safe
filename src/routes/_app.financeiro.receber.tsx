import { createFileRoute } from "@tanstack/react-router";
import { FinTxList } from "@/components/FinTxList";

export const Route = createFileRoute("/_app/financeiro/receber")({
  component: () => <FinTxList kind="receber" />,
});
