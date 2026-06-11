import { createFileRoute } from "@tanstack/react-router";
import { PartyList } from "@/components/PartyList";

export const Route = createFileRoute("/_app/clientes/")({
  component: () => <PartyList mode="cliente" />,
});