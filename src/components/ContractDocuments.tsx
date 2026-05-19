import { useRef } from "react";
import { db, type Contract, type ContractDoc } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const DOC_TYPES = [
  { value: "contrato", label: "Contrato oficial" },
  { value: "procuracao", label: "Procuração" },
  { value: "aditivo", label: "Aditivo" },
  { value: "comprovante", label: "Comprovante" },
  { value: "outro", label: "Outro" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function ContractDocuments({ contract }: { contract: Contract }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const docType = typeRef.current?.value ?? "contrato";
    const newDocs: ContractDoc[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" excede 8 MB e foi ignorado.`);
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      newDocs.push({
        id: crypto.randomUUID(),
        name: f.name,
        type: docType,
        mime: f.type || "application/octet-stream",
        size: f.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    }
    if (!newDocs.length) return;
    const updated = [...(contract.documents ?? []), ...newDocs];
    await db.contracts.update(contract.id!, {
      documents: updated,
      history: [
        ...contract.history,
        { at: new Date().toISOString(), description: `${newDocs.length} documento(s) anexado(s)` },
      ],
      updatedAt: new Date().toISOString(),
    });
    if (fileRef.current) fileRef.current.value = "";
    toast.success(`${newDocs.length} documento(s) anexado(s)`);
  };

  const download = (doc: ContractDoc) => {
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const remove = async (doc: ContractDoc) => {
    if (!confirm(`Remover "${doc.name}"?`)) return;
    const updated = (contract.documents ?? []).filter((d) => d.id !== doc.id);
    await db.contracts.update(contract.id!, {
      documents: updated,
      history: [
        ...contract.history,
        { at: new Date().toISOString(), description: `Documento "${doc.name}" removido` },
      ],
      updatedAt: new Date().toISOString(),
    });
    toast.success("Documento removido");
  };

  const docs = contract.documents ?? [];
  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-md border border-dashed border-border bg-background/40">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</label>
          <select ref={typeRef} className="flex h-9 rounded-md border border-input bg-background px-3 text-sm">
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Button type="button" onClick={() => fileRef.current?.click()} className="bg-gradient-gold text-primary-foreground shadow-gold">
          <Upload className="h-4 w-4 mr-2" /> Anexar arquivo(s)
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
        <p className="text-xs text-muted-foreground">PDF, DOC, DOCX ou imagem · até 8 MB cada</p>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento anexado ainda.</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-muted/40 grid place-items-center shrink-0">
                <FileText className="h-5 w-5 text-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOC_TYPES.find((t) => t.value === d.type)?.label ?? d.type} · {fmtSize(d.size)} · {formatDateTime(d.uploadedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(d)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(d)} className="text-destructive border-destructive/30">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
