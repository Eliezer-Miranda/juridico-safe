import { createFileRoute } from "@tanstack/react-router";
import { ProposalImport } from "@/components/ProposalImport";

export const Route = createFileRoute("/_app/propostas")({
  head: () => ({
    meta: [
      { title: "Importar proposta com IA | Meu Negócio" },
      {
        name: "description",
        content:
          "Envie propostas em PDF ou Word e a IA cadastra cliente, itens, condições de pagamento e parcelas automaticamente.",
      },
      { property: "og:title", content: "Importar proposta com IA | Meu Negócio" },
      {
        property: "og:description",
        content: "Extraia dados de propostas em PDF/Word e gere orçamento, cliente e parcelas em um clique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalImport,
});
