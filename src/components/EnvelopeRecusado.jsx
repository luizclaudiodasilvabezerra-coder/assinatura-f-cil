import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Ban, Trash2, FilePlus2, Download, FileText, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { baixarArquivoPdf } from "@/lib/pdfDownload";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function EnvelopeRecusado({ doc, assinaturas = [] }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [excluindo, setExcluindo] = useState(false);
  const [gerando, setGerando] = useState(false);

  const arquivos = (doc.arquivos || []).filter(Boolean);

  const excluirEnvelope = async () => {
    setExcluindo(true);
    try {
      if (assinaturas.length) {
        await base44.entities.Assinatura.deleteMany({ documento_id: doc.id });
      }
      await base44.entities.Documento.delete(doc.id);
      toast({ title: "Envelope excluído", description: "O envelope recusado foi removido." });
      navigate("/");
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setExcluindo(false);
    }
  };

  const gerarNovoEnvelope = async () => {
    setGerando(true);
    try {
      const novo = await base44.entities.Documento.create({
        titulo: doc.titulo,
        descricao: doc.descricao || "",
        numero: doc.numero || "",
        arquivos: arquivos,
        status: "pendente_gestao",
        pasta: "pendente",
        destinatario_nome: doc.destinatario_nome || "",
        destinatario_email: doc.destinatario_email || "",
        signatario_nome: doc.signatario_nome || "",
        signatario_email: doc.signatario_email || "",
        signatario_cadastro_id: doc.signatario_cadastro_id || "",
        diretoria: doc.diretoria || "",
        unidade_negocio: doc.unidade_negocio || "",
        operacao: doc.operacao || "",
        data_limite: doc.data_limite || "",
        processado: false,
        recusado: false,
        observacao_recusa: "",
      });
      toast({ title: "Novo envelope criado", description: "Um novo envelope foi gerado com os mesmos arquivos." });
      navigate(`/assinar/${novo.id}`);
    } catch (e) {
      toast({ title: "Erro ao gerar novo envelope", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border-amber-400 bg-amber-50/60">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Ban className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-xl font-heading text-amber-900">Envelope recusado</h1>
                  <p className="text-sm text-amber-800">Acesso restrito à senha master. Você pode excluir este envelope ou gerar um novo com os mesmos arquivos.</p>
                </div>
              </div>

              {doc.observacao_recusa && (
                <div className="rounded-lg border border-amber-200 bg-white/70 px-4 py-3">
                  <p className="text-xs font-medium text-amber-900 mb-0.5">Observação da recusa</p>
                  <p className="text-sm text-amber-800">{doc.observacao_recusa}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Arquivos do envelope
                </p>
                <div className="rounded-lg border border-amber-200 bg-white/60 divide-y divide-amber-100">
                  {arquivos.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum arquivo neste envelope.</p>
                  )}
                  {arquivos.map((url, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-sm truncate flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-700" /> {fileName(url)}
                      </span>
                      <button type="button" onClick={() => baixarArquivoPdf(url, fileName(url))} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline shrink-0">
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button type="button" onClick={gerarNovoEnvelope} disabled={gerando || excluindo} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                  Gerar novo envelope
                </Button>
                <Button type="button" variant="outline" onClick={excluirEnvelope} disabled={gerando || excluindo} className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10">
                  {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir envelope
                </Button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-amber-100/60 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Ao gerar um novo envelope, este recusado permanece no painel até ser excluído. O novo envelope será aberto já no fluxo de assinatura.</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}