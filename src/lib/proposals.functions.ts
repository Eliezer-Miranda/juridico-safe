import { createServerFn } from "@tanstack/react-start";

export interface ProposalFileInput {
  name: string;
  mime: string;
  dataBase64: string;
}

export interface AnalyzeProposalInput {
  prompt?: string;
  text?: string;
  file?: ProposalFileInput;
}

const SYSTEM = `Você é um assistente de back-office de uma empresa brasileira.
Sua tarefa: ler uma proposta comercial (PDF, Word convertido em texto, ou descrição em texto livre)
e devolver os dados estruturados para cadastro no ERP.

Responda SOMENTE com JSON válido, sem markdown, no formato:
{
  "party": {
    "kind": "cliente" | "fornecedor",
    "type": "PF" | "PJ",
    "name": "razão social ou nome",
    "contactName": "pessoa de contato (opcional)",
    "document": "CNPJ ou CPF apenas dígitos (opcional)",
    "email": "", "phone": "",
    "address": { "street": "", "number": "", "complement": "", "neighborhood": "", "city": "", "state": "", "zip": "" }
  },
  "quote": {
    "issueDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD",
    "seller": "", "notes": "condições/observações da proposta",
    "discount": 0,
    "items": [ { "description": "", "quantity": 1, "unit": "un", "unitPrice": 0 } ]
  },
  "payment": {
    "conditionName": "ex: 3x a cada 30 dias",
    "installments": 1,
    "intervalDays": 30,
    "downPaymentPct": 0,
    "firstDueDate": "YYYY-MM-DD",
    "methodName": "PIX | Boleto | Transferência | ..."
  },
  "summary": "resumo curto do que foi entendido",
  "warnings": ["campos que não foram encontrados"]
}

Regras: valores numéricos em número (ponto decimal), nunca string. Não invente CNPJ.
Se a proposta é uma venda nossa para um cliente, kind = "cliente"; se é uma compra de um fornecedor, kind = "fornecedor".
Se não houver datas, use datas coerentes a partir de hoje.`;

export const analyzeProposal = createServerFn({ method: "POST" })
  .inputValidator((d: AnalyzeProposalInput) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA não configurada neste projeto.");

    const content: Array<Record<string, unknown>> = [];
    const today = new Date().toISOString().slice(0, 10);
    content.push({
      type: "text",
      text: `Hoje é ${today}. ${data.prompt?.trim() || "Extraia os dados da proposta anexa."}`,
    });
    if (data.text?.trim()) {
      content.push({ type: "text", text: `Conteúdo da proposta:\n\n${data.text.slice(0, 120000)}` });
    }
    if (data.file) {
      const dataUrl = `data:${data.file.mime};base64,${data.file.dataBase64}`;
      if (data.file.mime.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url: dataUrl } });
      } else {
        content.push({ type: "file", file: { filename: data.file.name, file_data: dataUrl } });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("AI gateway error", res.status, detail);
      if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error("Falha ao analisar a proposta.");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(cleaned) as Record<string, any>;
    } catch {
      console.error("AI returned non-JSON", raw.slice(0, 500));
      throw new Error("A IA não retornou dados estruturados. Tente descrever a proposta com mais detalhes.");
    }
  });
