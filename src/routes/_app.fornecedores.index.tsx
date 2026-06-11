import { createFileRoute } from "@tanstack/react-router";
import { PartyList } from "@/components/PartyList";

export const Route = createFileRoute("/_app/fornecedores/")({
  component: () => <PartyList mode="fornecedor" />,
});