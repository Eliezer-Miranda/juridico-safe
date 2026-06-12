import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ClientOnly } from "@/components/ClientOnly";
import { AuthProvider } from "@/components/AuthProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">O endereço solicitado não existe.</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Ir ao painel
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl">Erro ao carregar a página</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meu Negócio — Gestão financeira e contratos" },
      { name: "description", content: "Sistema offline de gestão de contratos jurídicos para advogados e escritórios." },
      { property: "og:title", content: "Meu Negócio — Gestão financeira e contratos" },
      { name: "twitter:title", content: "Meu Negócio — Gestão financeira e contratos" },
      { property: "og:description", content: "Sistema offline de gestão de contratos jurídicos para advogados e escritórios." },
      { name: "twitter:description", content: "Sistema offline de gestão de contratos jurídicos para advogados e escritórios." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4b7119af-4edd-452e-a3c3-6a9f113f7c50/id-preview-b4e70b42--10d5cd61-6f6c-4703-b182-0b5a10d819a6.lovable.app-1779154390975.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4b7119af-4edd-452e-a3c3-6a9f113f7c50/id-preview-b4e70b42--10d5cd61-6f6c-4703-b182-0b5a10d819a6.lovable.app-1779154390975.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ClientOnly
        fallback={
          <div className="min-h-screen grid place-items-center bg-background">
            <p className="text-sm text-muted-foreground">Carregando…</p>
          </div>
        }
      >
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </ClientOnly>
    </QueryClientProvider>
  );
}
