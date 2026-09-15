import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileBarChart, Loader2, Download, FileDown } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { podeVerRelatorios } from "@/lib/permissoes";
import { Image as UIImage } from "@/components/ui/image";
import RelatorioFilters from "@/components/RelatorioFilters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";

const fmtData = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
};

const fmtDataHora = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
};

const statusLabel = (s) =>
  s === "assinado_gestao" ? "Pendente diretoria" :
  s === "assinado_diretoria" ? "Assinado diretoria" : s;

const statusTone = (s) =>
  s === "assinado_gestao" ? "bg-amber-100 text-amber-800" :
  s === "assinado_diretoria" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground";

export default function Relatorios() {
  const { user } = useAuth();
  const tableRef = React.useRef(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [filtros, setFiltros] = useState({
    dataDe: "", dataAte: "", status: "", unidade: "", gestor: "", diretoria: "",
  });

  const buscar = async () => {
    setLoading(true);
    try {
      const [pendentes, concluidos] = await Promise.all([
        base44.entities.Documento.filter({ status: "assinado_gestao" }, "-created_date", 500),
        base44.entities.Documento.filter({ status: "assinado_diretoria" }, "-created_date", 500),
      ]);
      setRegistros([...pendentes, ...concluidos]);
      setBuscou(true);
    } catch { setRegistros([]); } finally { setLoading(false); }
  };

  const opcoes = useMemo(() => {
    const unidades = [...new Set(registros.map((r) => r.unidade_negocio).filter(Boolean))].sort();
    const gestores = [...new Set(registros.map((r) => r.signatario_nome).filter(Boolean))].sort();
    const diretorias = [...new Set(registros.map((r) => r.diretoria).filter(Boolean))].sort();
    return { unidades, gestores, diretorias };
  }, [registros]);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtros.dataDe) {
        const d = new Date(r.created_date);
        if (d < new Date(filtros.dataDe + "T00:00:00")) return false;
      }
      if (filtros.dataAte) {
        const d = new Date(r.created_date);
        if (d > new Date(filtros.dataAte + "T23:59:59")) return false;
      }
      if (filtros.status && r.status !== filtros.status) return false;
      if (filtros.unidade && r.unidade_negocio !== filtros.unidade) return false;
      if (filtros.gestor && r.signatario_nome !== filtros.gestor) return false;
      if (filtros.diretoria && r.diretoria !== filtros.diretoria) return false;
      return true;
    });
  }, [registros, filtros]);

  const limpar = () => setFiltros({
    dataDe: "", dataAte: "", status: "", unidade: "", gestor: "", diretoria: "",
  });

  const exportarCsv = () => {
    const headers = ["Envelope", "Status", "Gestor", "Unidade", "Operação", "Diretoria", "Destinatário", "Data Limite", "Criado em"];
    const rows = filtrados.map((r) => [
      `"${(r.titulo || "").replace(/"/g, '""')}"`,
      statusLabel(r.status),
      `"${(r.signatario_nome || "").replace(/"/g, '""')}"`,
      r.unidade_negocio || "",
      `"${(r.operacao || "").replace(/"/g, '""')}"`,
      r.diretoria || "",
      `"${(r.destinatario_nome || "").replace(/"/g, '""')}"`,
      r.data_limite || "",
      r.created_date || "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_envelopes_${format(new Date(), "dd-MM-yyyy")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportarPdf = async () => {
    const el = tableRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`relatorio_envelopes_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    } catch {}
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
            <p className="text-muted-foreground mt-2">Envelopes assinados pelo gestor e pendentes/assinados pela diretoria.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/" className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Link></Button>
            <Button onClick={exportarPdf} disabled={filtrados.length === 0} variant="outline" className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button onClick={exportarCsv} disabled={filtrados.length === 0} className="gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </header>

        <div className="mb-6">
          <RelatorioFilters
            filtros={filtros}
            setFiltros={setFiltros}
            opcoes={opcoes}
            onLimpar={limpar}
            onBuscar={buscar}
            loading={loading}
          />
        </div>

        {buscou && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total de envelopes</p>
                  <p className="text-2xl font-heading mt-1">{filtrados.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pendentes diretoria</p>
                  <p className="text-2xl font-heading mt-1">{filtrados.filter((r) => r.status === "assinado_gestao").length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Assinados diretoria</p>
                  <p className="text-2xl font-heading mt-1">{filtrados.filter((r) => r.status === "assinado_diretoria").length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Unidades</p>
                  <p className="text-2xl font-heading mt-1">{new Set(filtrados.map((r) => r.unidade_negocio).filter(Boolean)).size}</p>
                </CardContent>
              </Card>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">Nenhum envelope encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <div ref={tableRef} className="rounded-xl border border-border/60 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Envelope</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Gestor</th>
                        <th className="px-4 py-3 font-medium">Unidade</th>
                        <th className="px-4 py-3 font-medium">Operação</th>
                        <th className="px-4 py-3 font-medium">Diretoria</th>
                        <th className="px-4 py-3 font-medium">Destinatário</th>
                        <th className="px-4 py-3 font-medium">Data limite</th>
                        <th className="px-4 py-3 font-medium">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filtrados.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 max-w-[200px] truncate" title={r.titulo}>{r.titulo || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(r.status)}`}>
                              {statusLabel(r.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{r.signatario_nome || "—"}</td>
                          <td className="px-4 py-3">{r.unidade_negocio || "—"}</td>
                          <td className="px-4 py-3">{r.operacao || "—"}</td>
                          <td className="px-4 py-3">{r.diretoria || "—"}</td>
                          <td className="px-4 py-3">{r.destinatario_nome || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{fmtData(r.data_limite)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDataHora(r.created_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!buscou && !loading && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Defina os filtros e clique em <strong>Buscar</strong> para consultar os envelopes.</p>
          </div>
        )}
      </div>
    </div>
  );
}