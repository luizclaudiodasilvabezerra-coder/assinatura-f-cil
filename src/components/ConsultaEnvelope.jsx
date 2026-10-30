import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Download, Eye, FileText, Loader2, User } from "lucide-react";
import DocumentPositioner from "@/components/DocumentPositioner";
import LoteFolders from "@/components/LoteFolders";
import carregarAssinaturasEnvelope from "@/lib/assinaturasEnvelope";
import { baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { formatDate } from "@/lib/signatureUtils";

const isImage = (url) => !!url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");
const automatica = (s) => (s.observacao || "").startsWith("Assinatura automática");

export default function ConsultaEnvelope({ doc }) {
  const arquivos = useMemo(() => doc?.arquivos || [], [doc]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const sigs = await carregarAssinaturasEnvelope(doc.id, ["signatario", "gestao_origem", "master"]);
        setAssinaturas(sigs);
      } finally {
        setLoading(false);
      }
    })();
  }, [doc.id]);

  const registros = useMemo(() => assinaturas.filter((s) => !automatica(s)), [assinaturas]);

  const signedMap = useMemo(() => {
    const map = {};
    arquivos.forEach((url, i) => {
      const sig = registros.find((s) => (s.arquivo_original_url || s.arquivo_url) === url);
      if (sig) map[i] = sig;
    });
    return map;
  }, [arquivos, registros]);

  const currentFile = arquivos[currentIndex];
  const doArquivo = registros.filter((s) => (s.arquivo_original_url || s.arquivo_url) === currentFile);
  const blocks = doArquivo.map((s) => ({
    id: s.id,
    nome: s.assinante_nome,
    imagem_url: s.imagem_url,
    observacao: s.observacao,
    indent: s.indent || 0,
    pos_x: s.pos_x ?? 10,
    pos_y: s.pos_y ?? 70,
    draggable: false,
  }));

  const baixarEnvelope = async () => {
    setDownloading(true);
    try { await baixarEnvelopePdf(doc.id, `${doc.numero || "envelope"}.pdf`); }
    catch {}
    finally { setDownloading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
              <FileText className="w-4 h-4" />
              {doc.numero ? `Envelope ${doc.numero}` : "Envelope"}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                <Eye className="w-3 h-3" /> Somente consulta
              </span>
            </div>
            <h1 className="text-3xl font-heading tracking-tight">{doc.titulo}</h1>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {doc.signatario_nome && <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Gestão: {doc.signatario_nome}</span>}
              {doc.diretoria && <span>Diretoria: {doc.diretoria}</span>}
              {doc.unidade_negocio && <span>UN: {doc.unidade_negocio}</span>}
              {doc.operacao && <span>Operação: {doc.operacao}</span>}
              {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={baixarEnvelope} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar envelope
          </Button>
        </div>

        <LoteFolders lotes={doc.lotes} arquivos={arquivos} signedMap={signedMap} currentIndex={currentIndex} onSelect={setCurrentIndex} />

        <div className="grid lg:grid-cols-12 gap-4">
          <div className="space-y-3 lg:col-span-8">
            <p className="text-sm font-medium">{fileName(currentFile)}</p>
            <DocumentPositioner fileUrl={currentFile} blocks={blocks} onMove={() => {}} />
            {currentFile && !isImage(currentFile) && (
              <a href={currentFile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <FileText className="w-4 h-4" /> Abrir arquivo em nova aba
              </a>
            )}
          </div>

          <div className="space-y-3 lg:col-span-4">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-medium">Assinaturas deste arquivo</p>
                {loading ? (
                  <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
                ) : doArquivo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada neste arquivo.</p>
                ) : (
                  <ul className="space-y-3">
                    {doArquivo.map((s) => (
                      <li key={s.id} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                        <p className="text-sm font-medium">{s.assinante_nome}</p>
                        {s.data_assinatura && <p className="text-xs text-muted-foreground">{new Date(s.data_assinatura).toLocaleString("pt-BR")}</p>}
                        {s.observacao && <p className="text-xs text-muted-foreground mt-1" style={{ paddingLeft: (s.indent || 0) * 10 }}>{s.observacao}</p>}
                        <button type="button" onClick={() => baixarArquivoPdf(s.arquivo_url || currentFile, fileName(s.arquivo_url || currentFile))} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                          <Download className="w-3 h-3" /> Baixar arquivo assinado
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}