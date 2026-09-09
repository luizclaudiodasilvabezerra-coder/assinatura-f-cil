import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, PenLine, Clock, CheckCircle2, Plus, ArrowRight, ScrollText, Folder, FolderOpen, Users } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/signatureUtils";
import ShareIcons from "@/components/ShareIcons";

const statusStyles = {
  rascunho: "bg-slate-100 text-slate-600",
  pendente: "bg-amber-100 text-amber-700",
  assinado: "bg-emerald-100 text-emerald-700",
  arquivado: "bg-slate-200 text-slate-500",
};

export default function Home() {
  const [documentos, setDocumentos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pasta, setPasta] = useState("recentes");

  useEffect(() => {
    (async () => {
      try {
        const [docs, sigs] = await Promise.all([
          base44.entities.Documento.list("-created_date", 100),
          base44.entities.Assinatura.list("-created_date", 6),
        ]);
        setDocumentos(docs);
        setAssinaturas(sigs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const docsFiltrados = documentos.filter((d) => (d.pasta || "recentes") === pasta);

  const stats = [
    { label: "Documentos", value: documentos.length, icon: FileText, tone: "text-slate-900" },
    { label: "Pendentes", value: documentos.filter((d) => d.status === "pendente").length, icon: Clock, tone: "text-amber-600" },
    { label: "Assinados", value: documentos.filter((d) => d.status === "assinado").length, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Assinaturas", value: assinaturas.length, icon: PenLine, tone: "text-slate-900" },
  ];

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
            <p className="text-muted-foreground mt-2">Gerencie solicitações de assinatura e acompanhe o histórico completo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/cadastros" className="gap-2"><Users className="w-4 h-4" /> Cadastros</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/log" className="gap-2"><ScrollText className="w-4 h-4" /> Log</Link>
            </Button>
            <Button asChild>
              <Link to="/novo" className="gap-2"><Plus className="w-4 h-4" /> Novo documento</Link>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-5 h-5 ${s.tone}`} />
                  </div>
                  <p className="text-3xl font-heading mt-3">{loading ? "—" : s.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading">Documentos</h2>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setPasta("recentes")} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${pasta === "recentes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                <Folder className="w-4 h-4" /> Recentes ({documentos.filter((d) => (d.pasta || "recentes") === "recentes").length})
              </button>
              <button onClick={() => setPasta("assinados")} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${pasta === "assinados" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                <FolderOpen className="w-4 h-4" /> Assinados ({documentos.filter((d) => d.pasta === "assinados").length})
              </button>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : docsFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pasta vazia.</p>
              ) : (
                docsFiltrados.map((d) => (
                  <Card key={d.id} className="rounded-xl border-border/60 hover:border-foreground/20 hover:shadow-md transition-all">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <Link to={`/assinar/${d.id}`} className="min-w-0 flex-1">
                        <p className="font-medium truncate">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.destinatario_nome || "Sem destinatário"} · {formatDate(d.data_limite)}</p>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <ShareIcons title={d.titulo} signUrl={`${window.location.origin}/assinar/${d.id}`} />
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusStyles[d.status] || statusStyles.pendente}`}>{d.status}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading">Assinaturas recentes</h2>
              <Link to="/log" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Ver log <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : assinaturas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada ainda.</p>
              ) : (
                assinaturas.map((a) => (
                  <Card key={a.id} className="rounded-xl border-border/60">
                    <CardContent className="p-4 flex items-center gap-4">
                      {a.imagem_url ? (
                        <img src={a.imagem_url} alt="assinatura" className="h-10 w-20 object-contain bg-white rounded border border-border/60" />
                      ) : (
                        <div className="h-10 w-20 rounded bg-muted flex items-center justify-center">
                          <PenLine className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.assinante_nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.documento_titulo}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.data_assinatura || a.created_date)}</span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}