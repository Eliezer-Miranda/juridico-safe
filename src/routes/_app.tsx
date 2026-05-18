import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_app")({
  component: () => (
    <AppShell />
  ),
});

// Outlet is rendered inside AppShell
export { Outlet };
