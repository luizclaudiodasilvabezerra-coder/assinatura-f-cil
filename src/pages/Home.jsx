import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, PenLine, Clock, CheckCircle2, Plus, ScrollText, Folder, FolderOpen, Users, Paperclip, Download, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/signatureUtils";
import { baixarEnvelopePdf } from "@/lib/pdfDownload";
import ShareIcons from "@/components/ShareIcons";

const statusStyles = {
  rascunho: "bg-slate-100 text-slate-600",
  pendente: "bg-amber-100 text-amber-700",
  assinado: "bg-emerald-100 text-emerald-700",
  arquivado: "bg-slate-200 text-slate-500",
};

export default function Home() {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pasta, setPasta] = useState("pendente");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const docs = await base44.entities.Documento.list("-created_date", 200);
        setDocumentos(docs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalArquivos = documentos.reduce((acc, d) => acc + (d.arquivos?.length || 0), 0);
  const pendentes = documentos.filter((d) => d.status === "pendente");
  const assinados = documentos.filter((d) => d.status === "assinado");
  const arquivosPendentes = pendentes.reduce((acc, d) => acc + (d.arquivos?.length || 0), 0);
  const arquivosAssinados = assinados.reduce((acc, d) => acc + (d.arquivos?.length || 0), 0);

  const stats = [
    { label: "Envelopes", value: documentos.length, sub: `${totalArquivos} arquivos`, icon: FileText, tone: "text-slate-900" },
    { label: "Pendentes", value: pendentes.length, sub: `${arquivosPendentes} arquivos`, icon: Clock, tone: "text-amber-600" },
    { label: "Assinados", value: assinados.length, sub: `${arquivosAssinados} arquivos`, icon: CheckCircle2, tone: "text-emerald-600" },
  ];

  const unidades = useMemo(() => {
    const set = new Set();
    documentos.forEach((d) => d.unidade_negocio && set.add(d.unidade_negocio));
    return Array.from(set);
  }, [documentos]);

  const docsFiltrados = documentos.filter((d) => {
    const p = d.pasta || (d.status === "assinado" ? "assinados" : "pendente");
    const inPasta = pasta === "pendente" ? p === "pendente" || d.status === "pendente" : p === "assinados" || d.status === "assinado";
    if (!inPasta) return false;
    if (filtroUnidade && d.unidade_negocio !== filtroUnidade) return false;
    if (filtroData && d.data_limite !== filtroData) return false;
    return true;
  });

  const baixar = async (d) => {
    setDownloadingId(d.id);
    try {
      await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`);
    } catch (e) {
      setDownloadingId(null);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <PenLine className="w-4 h-4" />
              <span>Assinatura Fácil Log</span>
            </div>
            <h1 className="text-4xl font-heading tracking-tight text-foreground">Painel</h1>
            <p className="text-muted-foreground mt-2">Gerencie envelopes de assinatura e acompanhe o histórico completo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/cadastros" className="gap-2"><Users className="w-4 h-4" /> Cadastros</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/log" className="gap-2"><ScrollText className="w-4 h-4" /> Log</Link>
            </Button>
            <Button asChild>
              <Link to="/novo" className="gap-2"><Plus className="w-4 h-4" /> Novo envelope</Link>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-5 h-5 ${s.tone}`} />
                  </div>
                  <p className="text-3xl font-heading mt-3">{loading ? "—" : s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {s.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex gap-2">
            <button onClick={() => setPasta("pendente")} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${pasta === "pendente" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              <Folder className="w-4 h-4" /> Pendentes ({pendentes.length})
            </button>
            <button onClick={() => setPasta("assinados")} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${pasta === "assinados" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              <FolderOpen className="w-4 h-4" /> Assinados ({assinados.length})
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Unidade de negócio</label>
            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data limite</label>
            <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : docsFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envelope nesta pasta.</p>
          ) : (
            docsFiltrados.map((d) => (
              <Card key={d.id} className="rounded-xl border-border/60 hover:border-foreground/20 hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <Link to={`/assinar/${d.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {d.numero && <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.numero}</span>}
                      <p className="font-medium truncate">{d.titulo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {d.arquivos?.length || 0} arquivo(s)</span>
                      {d.signatario_nome && <span>Signatário: {d.signatario_nome}</span>}
                      {d.unidade_negocio && <span>UN: {d.unidade_negocio}</span>}
                      {d.data_limite && <span>{formatDate(d.data_limite)}</span>}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.status === "assinado" && (
                      <button type="button" onClick={() => baixar(d)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Baixar envelope (PDF)">
                        {downloadingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                    )}
                    <ShareIcons title={d.titulo} signUrl={`${window.location.origin}/assinar/${d.id}`} />
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusStyles[d.status] || statusStyles.pendente}`}>{d.status}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}