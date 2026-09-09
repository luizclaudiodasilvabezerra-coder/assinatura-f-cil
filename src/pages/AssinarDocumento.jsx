import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Calendar, User, Upload, PenLine, Plus, Minus, ChevronRight, Pen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SignaturePad from "@/components/SignaturePad";
import DocumentPositioner from "@/components/DocumentPositioner";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";

const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function AssinarDocumento() {
  const { id } = useParams();
  const { toast } = useToast();
  const padRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [cadastros, setCadastros] = useState([]);
  const [existentes, setExistentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedMap, setSignedMap] = useState({});

  const [modo, setModo] = useState("desenhada");
  const [cadastroId, setCadastroId] = useState("");
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinanteEmail, setAssinanteEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [indent, setIndent] = useState(0);
  const [imagemUpload, setImagemUpload] = useState("");
  const [pos, setPos] = useState({ x: 10, y: 70 });

  useEffect(() => {
    (async () => {
      try {
        const [d, cad, sigs] = await Promise.all([
          base44.entities.Documento.get(id),
          base44.entities.Cadastro.list("-created_date", 200),
          base44.entities.Assinatura.filter({ documento_id: id }, "-created_date", 100),
        ]);
        setDoc(d);
        setCadastros(cad);
        setExistentes(sigs);
        const arqs = d.arquivos && d.arquivos.length ? d.arquivos : [""];
        const map = {};
        sigs.forEach((s) => {
          const url = s.arquivo_url || "";
          const idx = arqs.indexOf(url);
          if (idx >= 0) map[idx] = s;
        });
        setSignedMap(map);
        const firstUnsigned = arqs.findIndex((_, i) => !map[i]);
        setCurrentIndex(firstUnsigned >= 0 ? firstUnsigned : 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const arquivos = useMemo(() => (doc?.arquivos && doc.arquivos.length ? doc.arquivos : [""]), [doc]);
  const currentFile = arquivos[currentIndex];
  const currentSigned = signedMap[currentIndex];
  const allSigned = arquivos.length > 0 && arquivos.every((_, i) => signedMap[i]);

  const onCadastroChange = (e) => {
    const c = cadastros.find((x) => x.id === e.target.value);
    setCadastroId(e.target.value);
    if (c) {
      setAssinanteNome(c.nome);
      setAssinanteEmail(c.email || "");
    }
  };

  const handleUploadAssinatura = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImagemUpload(file_url);
    } catch {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    }
  };

  const findNextUnsigned = (from) => {
    for (let step = 1; step <= arquivos.length; step++) {
      const idx = (from + step) % arquivos.length;
      if (!signedMap[idx]) return idx;
    }
    return -1;
  };

  const assinarArquivo = async () => {
    if (!assinanteNome.trim()) {
      toast({ title: "Selecione ou informe o nome do assinante", variant: "destructive" });
      return;
    }
    let imagem_url = "";
    if (modo === "desenhada") {
      if (padRef.current?.isEmpty()) {
        toast({ title: "Desenhe a assinatura", variant: "destructive" });
        return;
      }
      setSaving(true);
      try {
        const file = dataURLToFile(padRef.current.getDataURL(), `assinatura_${assinanteNome}.png`);
        const up = await base44.integrations.Core.UploadFile({ file });
        imagem_url = up.file_url;
      } catch {
        setSaving(false);
        toast({ title: "Erro ao salvar assinatura", variant: "destructive" });
        return;
      }
    } else {
      if (!imagemUpload) {
        toast({ title: "Envie uma imagem de assinatura", variant: "destructive" });
        return;
      }
      imagem_url = imagemUpload;
      setSaving(true);
    }

    try {
      const rec = await base44.entities.Assinatura.create({
        documento_id: id,
        documento_titulo: doc.titulo,
        arquivo_url: currentFile || undefined,
        assinante_nome: assinanteNome,
        assinante_email: assinanteEmail,
        assinante_cadastro_id: cadastroId || undefined,
        imagem_url,
        tipo: modo,
        observacao,
        indent,
        pos_x: pos.x,
        pos_y: pos.y,
        status: "assinado",
        data_assinatura: new Date().toISOString(),
      });
      const newMap = { ...signedMap, [currentIndex]: rec };
      setSignedMap(newMap);
      setExistentes((e) => [rec, ...e]);
      setObservacao("");
      setIndent(0);
      setImagemUpload("");
      setCadastroId("");
      setAssinanteNome("");
      setAssinanteEmail("");
      setPos({ x: 10, y: 70 });

      const next = findNextUnsigned(currentIndex);
      if (next === -1) {
        await base44.entities.Documento.update(id, { status: "assinado", pasta: "assinados" });
        setDone(true);
      } else {
        setCurrentIndex(next);
      }
      toast({ title: "Arquivo assinado", description: next === -1 ? "Todos os arquivos foram assinados." : "Avançando para o próximo arquivo." });
    } catch {
      toast({ title: "Erro ao registrar assinatura", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const avancar = () => {
    const next = findNextUnsigned(currentIndex);
    if (next !== -1) setCurrentIndex(next);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-heading mb-2">Todos os arquivos assinados</h1>
          <p className="text-muted-foreground mb-6">O documento foi movido para a pasta "Assinados".</p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline"><Link to="/log">Ver log</Link></Button>
            <Button asChild><Link to="/">Painel</Link></Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const pendingBlock =
    !currentSigned && assinanteNome
      ? [{
          id: "pending",
          nome: assinanteNome,
          imagem_url: imagemUpload || "",
          observacao,
          indent,
          pos_x: pos.x,
          pos_y: pos.y,
          draggable: true,
        }]
      : [];

  const positionerBlocks = currentSigned
    ? [{
        id: currentSigned.id,
        nome: currentSigned.assinante_nome,
        imagem_url: currentSigned.imagem_url,
        observacao: currentSigned.observacao,
        indent: currentSigned.indent || 0,
        pos_x: currentSigned.pos_x ?? 10,
        pos_y: currentSigned.pos_y ?? 70,
        draggable: false,
      }]
    : pendingBlock;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileText className="w-4 h-4" /> Documento para assinatura</div>
          <h1 className="text-3xl font-heading tracking-tight">{doc.titulo}</h1>
          {doc.descricao && <p className="text-muted-foreground mt-2">{doc.descricao}</p>}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {doc.destinatario_nome && <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {doc.destinatario_nome}</span>}
            {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
          </div>
        </div>

        {/* Stepper de arquivos */}
        <div className="flex flex-wrap gap-2 mb-6">
          {arquivos.map((url, i) => {
            const signed = !!signedMap[i];
            const isCurrent = i === currentIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  isCurrent ? "border-foreground/30 bg-foreground/5" : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${signed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {signed ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span className="max-w-[160px] truncate">{fileName(url)}</span>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="space-y-3 lg:col-span-3">
            <p className="text-sm font-medium">
              {currentSigned ? "Arquivo já assinado" : `Assinando: ${fileName(currentFile)}`}
            </p>
            <DocumentPositioner
              fileUrl={currentFile}
              blocks={positionerBlocks}
              onMove={(bid, x, y) => setPos({ x, y })}
            />
            {currentFile && !isImage(currentFile) && (
              <a href={currentFile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <FileText className="w-4 h-4" /> Abrir arquivo em nova aba
              </a>
            )}
          </div>

          <div className="space-y-4 lg:col-span-2">
            {currentSigned ? (
              <Card className="rounded-2xl border-emerald-200 bg-emerald-50/40">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Arquivo assinado</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {currentSigned.imagem_url && (
                      <img src={currentSigned.imagem_url} alt="assinatura" className="h-14 w-28 object-contain bg-white rounded border border-border" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{currentSigned.assinante_nome}</p>
                      {currentSigned.observacao && <p className="text-sm text-muted-foreground" style={{ paddingLeft: (currentSigned.indent || 0) * 14 }}>{currentSigned.observacao}</p>}
                    </div>
                  </div>
                  {!allSigned && (
                    <Button type="button" className="w-full gap-2" onClick={avancar}>
                      Avançar para próximo <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button type="button" onClick={() => setModo("desenhada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "desenhada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    <PenLine className="w-4 h-4" /> Desenhar no touch
                  </button>
                  <button type="button" onClick={() => setModo("uploadada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "uploadada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    <Upload className="w-4 h-4" /> Buscar imagem
                  </button>
                </div>

                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cadastro">Quem está assinando *</Label>
                      <select id="cadastro" value={cadastroId} onChange={onCadastroChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">— Selecionar do cadastro —</option>
                        {cadastros.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}{c.email ? ` · ${c.email}` : ""}</option>
                        ))}
                      </select>
                      <Input value={assinanteNome} onChange={(e) => setAssinanteNome(e.target.value)} placeholder="Ou digite o nome" className="mt-2" />
                      <Input type="email" value={assinanteEmail} onChange={(e) => setAssinanteEmail(e.target.value)} placeholder="E-mail (opcional)" className="mt-2" />
                    </div>

                    <div className="space-y-2">
                      <Label>Assinatura *</Label>
                      {modo === "desenhada" ? (
                        <SignaturePad ref={padRef} />
                      ) : (
                        <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-border py-8 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                          <Upload className="w-4 h-4" />
                          {imagemUpload ? "Imagem carregada ✓ (clique para trocar)" : "Buscar imagem de assinatura"}
                          <input type="file" accept="image/*" className="hidden" onChange={handleUploadAssinatura} />
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="observacao">Caixa de observações</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">Recuo</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.max(0, v - 1))}>
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs w-5 text-center tabular-nums">{indent}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.min(6, v + 1))}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        id="observacao"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        rows={2}
                        style={{ paddingLeft: 8 + indent * 14 }}
                        placeholder="Observação que aparece sob a assinatura"
                      />
                    </div>

                    <Button type="button" disabled={saving} onClick={assinarArquivo} className="w-full gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pen className="w-4 h-4" />}
                      Assinar este arquivo e avançar
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}