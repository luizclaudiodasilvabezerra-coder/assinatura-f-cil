import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FolderInput } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function BotaoExportarFinanceiro({ docId }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const exportar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("enviarParaFinanceiro", { documento_id: docId });
      toast({
        title: "Envelope direcionado para o Financeiro",
        description: `${res.data.arquivos} arquivo(s) enviados para ${res.data.caminho}. O agente local processará em instantes.`
      });
    } catch (e) {
      toast({ title: "Erro ao exportar", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" size="sm" onClick={exportar} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderInput className="w-3.5 h-3.5" />} Enviar p/ Financeiro
    </Button>
  );
}