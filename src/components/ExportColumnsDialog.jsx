import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown, Download, Loader2 } from "lucide-react";

export default function ExportColumnsDialog({ open, onOpenChange, colunas, selected, onChange, onExportPdf, onExportCsv, exporting }) {
  const toggle = (key) => {
    onChange((s) => ({ ...s, [key]: !s[key] }));
  };

  const selecionarTodos = () => {
    const all = colunas.every((c) => selected[c.key]);
    const next = {};
    colunas.forEach((c) => { next[c.key] = !all; });
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Colunas para exportação</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Selecione as colunas que deseja incluir no arquivo.</p>
          <Button variant="ghost" size="sm" onClick={selecionarTodos} className="text-xs h-7">
            {colunas.every((c) => selected[c.key]) ? "Desmarcar tudo" : "Selecionar tudo"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto py-1">
          {colunas.map((c) => (
            <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm py-1">
              <Checkbox checked={!!selected[c.key]} onCheckedChange={() => toggle(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onExportCsv} disabled={exporting} className="gap-2">
            {exporting === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar CSV
          </Button>
          <Button onClick={onExportPdf} disabled={exporting} className="gap-2">
            {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}