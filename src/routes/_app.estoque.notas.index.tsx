import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, PackagePlus, Trash2, FileText } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { moveStock } from "@/lib/stock";

export const Route = createFileRoute("/_app/estoque/notas/")({
  component: NotasEntradaList,
});

function NotasEntradaList() {
  const entries = useLiveQuery(async () => {
    const arr = await db.stockEntries.toArray();
    return arr.sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""));
  }) ?? [];

  const remove = async (id: number) => {
    if (!confirm("Excluir esta nota? Os itens serão estornados do estoque.")) return;
    const entry = await db.stockEntries.get(id);
    if (entry) {
      for (const it of entry.items) {
        if (it.productId) await moveStock(it.productId, "saida", it.quantity, "entrada", id, "Estorno de nota");
      }
    }
    await db.stockEntries.delete(id);
    toast.success("Nota removida");
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {entries.length} nota(s) de entrada — atualizam o estoque dos produtos.
          </p>
        </div>
        <Link to="/estoque/notas/nova">
          <Button className="bg-gradient-gold text-primary-foreground shadow-gold">
            <Plus className="h-4 w-4 mr-2" /> Nova nota de entrada
          </Button>
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <PackagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma nota lançada ainda.</p>
          <Link to="/estoque/notas/nova">
            <Button className="mt-4 bg-gradient-gold text-primary-foreground shadow-gold">
              <Plus className="h-4 w-4 mr-2" /> Lançar primeira nota
            </Button>
          </Link>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Nº</th>
                <th className="text-left px-4 py-3">Emissão</th>
                <th className="text-left px-4 py-3">Fornecedor</th>
                <th className="text-right px-4 py-3">Itens</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-gold">{e.number}{e.series ? `/${e.series}` : ""}</td>
                  <td className="px-4 py-3">{formatDate(e.issueDate)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.supplierName || "—"}</p>
                    {e.supplierDocument && <p className="text-xs text-muted-foreground">{e.supplierDocument}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">{e.items.length}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(e.total)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {e.xmlName ? (<span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> XML</span>) : "Manual"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(e.id!)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
