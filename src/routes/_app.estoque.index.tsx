import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/estoque/")({
  beforeLoad: () => { throw redirect({ to: "/estoque/notas" }); },
});
