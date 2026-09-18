import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FolderInput } from "lucide-react";
import EscolherDiretorioDialog from "@/components/EscolherDiretorioDialog";

export default function BotaoExportarFinanceiro({ docId, docCriadoEm }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
        <FolderInput className="w-3.5 h-3.5" /> Enviar p/ Financeiro
      </Button>
      <EscolherDiretorioDialog open={open} onOpenChange={setOpen} docId={docId} docCriadoEm={docCriadoEm} />
    </>
  );
}