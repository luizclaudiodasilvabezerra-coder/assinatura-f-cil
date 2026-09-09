import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, CheckCircle2, Calendar, Upload, PenLine, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SignaturePad from "@/components/SignaturePad";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";
import { baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function AssinarDiretoria() {
  const { id } = useParams();
  const { toast } = useToast();
  const padRef = useRef(null);
  const obsRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [cadastros, setCadastros] = useState([]);
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [critica, setCritica] = useState(false);
  const [done, setDone] = useState(false);

  const [cadastroId, setCadastroId] = useState("");
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState("desenhada");
  const [observacao, setObservacao] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [imagemUpload, setImagemUpload] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [d, cad, s] = await Promise.all([
          base44.entities.Documento.get(id),
          base44.entities.Cadastro.list("-created_date", 200),
          base44.entities.Assinatura.filter({ documento_id: id }, "-created_date", 100),
        ]);
        setDoc(d);
        setCadastros(cad);
        setSigs(s);
        if (s.some((x) => x.etapa === "master")) setDone(true);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const gestaoSigs = useMemo(() => sigs.filter((s) => s.etapa !== "master" && s.arquivo_url), [sigs]);

  const onCadastroChange = (e) => {
    const c = cadastros.find((x) => x.id === e.target.value);
    setCadastroId(e.target.value);
    if (c) setNome(c.nome);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setImagemUpload(file_url); }
    catch { toast({ title: "Erro ao enviar imagem", variant: "destructive" }); }
  };

  const baixarEnvelope = async () => {
    setDownloading(true);
    try { await baixarEnvelopePdf(id, `${doc.numero || "envelope"}.pdf`); }
    catch (e) { toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  const assinar = async () => {
    if (!nome.trim()) { toast({ title: "Selecione ou informe o diretor", variant: "destructive" }); return; }
    if (!observacao.trim()) { setCritica(true); toast({ title: "Observação obrigatória", variant: "destructive" }); return; }
    let imagem_url = "";
    if (modo === "desenhada") {
      if (padRef.current?.isEmpty()) { toast({ title: "Desenhe a assinatura", variant: "destructive" }); return; }
      setSaving(true);
      try { const file = dataURLToFile(padRef.current.getDataURL(), `assinatura_diretoria_${nome}.png`); const up = await base44.integrations.Core.UploadFile({ file }); imagem_url = up.file_url; }
      catch { setSaving(false); toast({ title: "Erro ao salvar assinatura", variant: "destructive" }); return; }
    } else {
      if (!imagemUpload) { toast({ title: "Envie uma imagem de assinatura", variant: "destructive" }); return; }
      imagem_url = imagemUpload; setSaving(true);
    }
    try {
      await base44.entities.Assinatura.create({
        documento_id: id, documento_titulo: doc.titulo, arquivo_url: gestaoSigs[0]?.arquivo_url || undefined,
        assinante_nome: nome, assinante_cadastro_id: cadastroId || undefined, imagem_url, tipo: modo,
        etapa: "master", observacao, indent: 0, pos_x: 10, pos_y: 70,
        unidade_negocio: doc.unidade_negocio || "", operacao: doc.operacao || "",
        status: "assinado", data_assinatura: new Date().toISOString(),
      });
      await base44.entities.Documento.update(id, { status: "assinado_diretoria" });
      setDone(true);
      toast({ title: "Envelope concluído", description: "Assinatura da diretoria registrada." });
    } catch { toast({ title: "Erro ao registrar assinatura", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>);
  if (!doc) return (<div className="min-h-screen flex flex-col items-center justify-center gap-4"><p className="text-muted-foreground">Documento não encontrado.</p><Button asChild variant="outline"><Link to="/">Voltar</Link></Button></div>);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
          <h1 className="text-2xl font-heading mb-2">Envelope concluído</h1>
          <p className="text-muted-foreground mb-6">A assinatura da diretoria foi registrada e o envelope finalizado.</p>
          <div className="flex flex-col gap-3 mb-6">
            <Button type="button" onClick={baixarEnvelope} disabled={downloading} className="gap-2">{downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar envelope completo (PDF)</Button>
            <div className="text-left space-y-2">
              <p className="text-xs text-muted-foreground">Arquivos (clique para baixar individual):</p>
              {gestaoSigs.map((s, i) => (
                <button key={i} type="button" onClick={() => baixarArquivoPdf(s.arquivo_url, fileName(s.arquivo_url))} className="flex items-center gap-2 text-sm text-blue-600 hover:underline w-full text-left"><Download className="w-3.5 h-3.5" /> {fileName(s.arquivo_url)}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline"><Link to="/log">Ver log</Link></Button>
            <Button asChild><Link to="/">Painel</Link></Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><ShieldCheck className="w-4 h-4" /> Assinatura da diretoria</div>
        <h1 className="text-3xl font-heading tracking-tight mb-1">{doc.titulo}</h1>
        <div className="flex flex-wrap gap-4 mt-2 mb-6 text-sm text-muted-foreground">
          {doc.numero && <span className="font-mono">{doc.numero}</span>}
          {doc.unidade_negocio && <span>UN: {doc.unidade_negocio}</span>}
          {doc.operacao && <span>Operação: {doc.operacao}</span>}
          {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
        </div>

        <Card className="rounded-2xl border-border/60 mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="font-heading">Arquivos assinados pela gestão</h2>
              <Button type="button" variant="outline" size="sm" onClick={baixarEnvelope} disabled={downloading} className="gap-2 shrink-0">{downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar envelope</Button>
            </div>
            {gestaoSigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo assinado pela gestão.</p>
            ) : (
              <div className="space-y-2">
                {gestaoSigs.map((s, i) => (
                  <div key={s.id || i} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{fileName(s.arquivo_url)}</p>
                      <p className="text-xs text-muted-foreground">Gestão: {s.assinante_nome} · {formatDate(s.data_assinatura)}</p>
                    </div>
                    <button type="button" onClick={() => baixarArquivoPdf(s.arquivo_url, fileName(s.arquivo_url))} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline shrink-0"><Download className="w-3.5 h-3.5" /> Baixar</button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {critica && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="w-4 h-4" /> Observação obrigatória.</div>
            <button type="button" onClick={() => { setCritica(false); obsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => obsRef.current?.focus(), 300); }} className="text-sm font-medium text-amber-900 underline">Inserir a observação</button>
          </div>
        )}

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dir">Quem assina como diretoria *</Label>
              <select id="dir" value={cadastroId} onChange={onCadastroChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— Selecionar do cadastro —</option>
                {cadastros.map((c) => (<option key={c.id} value={c.id}>{c.nome}{c.diretoria ? ` · ${c.diretoria}` : ""}</option>))}
              </select>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ou digite o nome do diretor" className="mt-2" />
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button type="button" onClick={() => setModo("desenhada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "desenhada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><PenLine className="w-4 h-4" /> Desenhar no touch</button>
              <button type="button" onClick={() => setModo("uploadada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "uploadada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><Upload className="w-4 h-4" /> Buscar imagem</button>
            </div>
            <div className="space-y-2">
              <Label>Assinatura da diretoria *</Label>
              {modo === "desenhada" ? (<SignaturePad ref={padRef} />) : (
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-border py-8 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                  <Upload className="w-4 h-4" />{imagemUpload ? "Imagem carregada ✓ (clique para trocar)" : "Buscar imagem de assinatura"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Caixa de observações *</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox checked={autorizado} onCheckedChange={(v) => { setAutorizado(!!v); if (v) { setObservacao("Autorizado"); setCritica(false); } else { setObservacao(""); } }} />
                Autorizado
              </label>
              <Textarea id="obs" ref={obsRef} value={observacao} disabled={autorizado} onChange={(e) => { setObservacao(e.target.value); if (e.target.value.trim()) setCritica(false); }} rows={2} placeholder="Observação da assinatura da diretoria" />
            </div>
            <Button type="button" disabled={saving} onClick={assinar} className="w-full gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Confirmar assinatura da diretoria</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}