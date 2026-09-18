import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FolderInput, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const ANOS = [2024, 2025, 2026, 2027, 2028];

export default function EscolherDiretorioDialog({ open, onOpenChange, docId, docCriadoEm }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState("mes"); // "mes" | "custom"

  const defaultMesAno = useMemo(() => {
    const data = docCriadoEm ? new Date(docCriadoEm) : new Date();
    return { mes: MESES[data.getMonth()], ano: data.getFullYear() };
  }, [docCriadoEm]);

  const [mes, setMes] = useState(defaultMesAno.mes);
  const [ano, setAno] = useState(defaultMesAno.ano);
  const [custom, setCustom] = useState(`NOTAS_${defaultMesAno.mes}_${defaultMesAno.ano}`);

  const subpasta = modo === "mes" ? `NOTAS_${mes}_${ano}` : custom.trim();
  const caminhoCompleto = `Z:\\Financeiro\\${subpasta}`;
  const mes_ano = modo === "mes" ? `${mes}_${ano}` : subpasta.replace(/^NOTAS_/, "");

  const exportar = async () => {
    if (!subpasta) {
      toast({ title: "Informe o diretório de destino", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("enviarParaFinanceiro", {
        documento_id: docId,
        caminho_destino: caminhoCompleto,
        mes_ano,
      });
      toast({
        title: "Envelope direcionado para o Financeiro",
        description: `${res.data.arquivos} arquivo(s) enviados para ${res.data.caminho}. O agente local processará em instantes.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Erro ao exportar", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderInput className="w-4 h-4" /> Enviar p/ Financeiro</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Escolha o diretório de destino na unidade de rede. A varredura dos arquivos assinados do envelope será executada automaticamente.
        </p>

        <div className="flex gap-2 mb-3">
          <Button type="button" size="sm" variant={modo === "mes" ? "default" : "outline"} onClick={() => setModo("mes")} className="gap-2">
            <Calendar className="w-3.5 h-3.5" /> Por mês/ano
          </Button>
          <Button type="button" size="sm" variant={modo === "custom" ? "default" : "outline"} onClick={() => setModo("custom")} className="gap-2">
            <FolderInput className="w-3.5 h-3.5" /> Personalizado
          </Button>
        </div>

        {modo === "mes" ? (
          <div className="flex gap-2">
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-28 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        ) : (
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ex: NOTAS_SETEMBRO_2026" />
        )}

        <div className="rounded-md bg-muted px-3 py-2 text-sm font-mono text-muted-foreground break-all">
          {caminhoCompleto}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={exportar} disabled={loading || !subpasta} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />} Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}