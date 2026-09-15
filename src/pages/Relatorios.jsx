import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileBarChart, Loader2, Download } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { podeVerRelatorios } from "@/lib/permissoes";
import { Image as UIImage } from "@/components/ui/image";
import RelatorioFilters from "@/components/RelatorioFilters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";

const fmtMoeda = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
};

const fmtDataHora = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
};

const fileName = (url) => {
  try { return decodeURIComponent(url.split("/").pop() || url); } catch { return url; }
};

export default function Relatorios() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    dataDe: "", dataAte: "", emitente: "", valorMin: "", valorMax: "",
    unidade: "", dataEmissao: "", gestor: "", diretoria: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await base44.entities.RelatorioNF.list("-created_date", 500);
        setRegistros(r);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const opcoes = useMemo(() => {
    const unidades = [...new Set(registros.map((r) => r.unidade_negocio).filter(Boolean))].sort();
    const gestores = [...new Set(registros.map((r) => r.gestor).filter(Boolean))].sort();
    const diretorias = [...new Set(registros.map((r) => r.diretoria).filter(Boolean))].sort();
    return { unidades, gestores, diretorias };
  }, [registros]);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtros.dataDe) {
        const d = new Date(r.data_assinatura);
        if (d < new Date(filtros.dataDe + "T00:00:00")) return false;
      }
      if (filtros.dataAte) {
        const d = new Date(r.data_assinatura);
        if (d > new Date(filtros.dataAte + "T23:59:59")) return false;
      }
      if (filtros.emitente && !(r.emitente || "").toLowerCase().includes(filtros.emitente.toLowerCase())) return false;
      if (filtros.valorMin && (Number(r.valor_total) || 0) < Number(filtros.valorMin)) return false;
      if (filtros.valorMax && (Number(r.valor_total) || 0) > Number(filtros.valorMax)) return false;
      if (filtros.unidade && r.unidade_negocio !== filtros.unidade) return false;
      if (filtros.dataEmissao && r.data_emissao !== filtros.dataEmissao) return false;
      if (filtros.gestor && r.gestor !== filtros.gestor) return false;
      if (filtros.diretoria && r.diretoria !== filtros.diretoria) return false;
      return true;
    });
  }, [registros, filtros]);

  const totalValor = useMemo(() => filtrados.reduce((s, r) => s + (Number(r.valor_total) || 0), 0), [filtrados]);

  const limpar = () => setFiltros({
    dataDe: "", dataAte: "", emitente: "", valorMin: "", valorMax: "",
    unidade: "", dataEmissao: "", gestor: "", diretoria: "",
  });

  const exportarCsv = () => {
    const headers = ["Envelope", "Emitente", "Valor Total", "Data Emissão", "Unidade", "Gestor", "Diretoria", "Data Assinatura", "Arquivo"];
    const rows = filtrados.map((r) => [
      `"${(r.documento_titulo || "").replace(/"/g, '""')}"`,
      `"${(r.emitente || "").replace(/"/g, '""')}"`,
      (Number(r.valor_total) || 0).toFixed(2),
      r.data_emissao || "",
      r.unidade_negocio || "",
      r.gestor || "",
      r.diretoria || "",
      r.data_assinatura || "",
      r.arquivo_url || "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_nf_${format(new Date(), "dd-MM-yyyy")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!podeVerRelatorios(user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-xl font-heading">Acesso não autorizado</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">Você não tem permissão para acessar relatórios.</p>
        <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <UIImage src={LOGO_URL} alt="LOGMAM transportes" className="h-20 w-auto object-contain" />
        </div>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-sm font-medium text-brand mb-2 inline-block">Assinatura Fácil Log</span>
            <h1 className="text-4xl font-heading tracking-tight text-foreground flex items-center gap-3">
              <FileBarChart className="w-8 h-8" /> Relatórios
            </h1>
            <p className="text-muted-foreground mt-2">Dados extraídos das NFs ao concluir assinaturas.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/" className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Link></Button>
            <Button onClick={exportarCsv} disabled={filtrados.length === 0} className="gap-2">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total de NFs</p>
              <p className="text-2xl font-heading mt-1">{filtrados.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-2xl font-heading mt-1">{fmtMoeda(totalValor)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Emitentes únicos</p>
              <p className="text-2xl font-heading mt-1">{new Set(filtrados.map((r) => r.emitente).filter(Boolean)).size}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Unidades</p>
              <p className="text-2xl font-heading mt-1">{new Set(filtrados.map((r) => r.unidade_negocio).filter(Boolean)).size}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <RelatorioFilters
            filtros={filtros}
            setFiltros={setFiltros}
            opcoes={opcoes}
            onLimpar={limpar}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Nenhuma NF encontrada com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Envelope</th>
                    <th className="px-4 py-3 font-medium">Emitente</th>
                    <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                    <th className="px-4 py-3 font-medium">Data Emissão</th>
                    <th className="px-4 py-3 font-medium">Unidade</th>
                    <th className="px-4 py-3 font-medium">Gestor</th>
                    <th className="px-4 py-3 font-medium">Diretoria</th>
                    <th className="px-4 py-3 font-medium">Data Assinatura</th>
                    <th className="px-4 py-3 font-medium">Arquivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtrados.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 max-w-[180px] truncate" title={r.documento_titulo}>{r.documento_titulo || "—"}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate" title={r.emitente}>{r.emitente || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoeda(r.valor_total)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtData(r.data_emissao)}</td>
                      <td className="px-4 py-3">{r.unidade_negocio || "—"}</td>
                      <td className="px-4 py-3">{r.gestor || "—"}</td>
                      <td className="px-4 py-3">{r.diretoria || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDataHora(r.data_assinatura)}</td>
                      <td className="px-4 py-3 max-w-[140px] truncate">
                        {r.arquivo_url ? (
                          <a href={r.arquivo_url} target="_blank" rel="noreferrer" className="text-brand hover:underline" title={fileName(r.arquivo_url)}>
                            {fileName(r.arquivo_url)}
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}