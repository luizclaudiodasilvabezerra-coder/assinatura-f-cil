import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Calendar, User, Plus, Upload, PenLine, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SignaturePad from "@/components/SignaturePad";
import DocumentPositioner from "@/components/DocumentPositioner";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";

let blockSeq = 0;
const newId = () => `tmp_${++blockSeq}_${Date.now()}`;

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

  const [modo, setModo] = useState("desenhada");
  const [cadastroId, setCadastroId] = useState("");
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinanteEmail, setAssinanteEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [imagemUpload, setImagemUpload] = useState("");
  const [blocos, setBlocos] = useState([]);

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
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  const adicionarBloco = () => {
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
      imagem_url = padRef.current.getDataURL();
    } else {
      if (!imagemUpload) {
        toast({ title: "Envie uma imagem de assinatura", variant: "destructive" });
        return;
      }
      imagem_url = imagemUpload;
    }
    setBlocos((prev) => [
      ...prev,
      {
        id: newId(),
        nome: assinanteNome,
        email: assinanteEmail,
        cadastro_id: cadastroId,
        imagem_url,
        tipo: modo,
        observacao,
        pos_x: 10 + (prev.length * 12) % 60,
        pos_y: 70,
        draggable: true,
        pending: true,
      },
    ]);
    setObservacao("");
    setImagemUpload("");
    setCadastroId("");
    setAssinanteNome("");
    setAssinanteEmail("");
    toast({ title: "Assinatura adicionada ao documento" });
  };

  const removerBloco = (bid) => setBlocos((prev) => prev.filter((b) => b.id !== bid));

  const moverBloco = (bid, x, y) =>
    setBlocos((prev) => prev.map((b) => (b.id === bid ? { ...b, pos_x: x, pos_y: y } : b)));

  const previewImage = doc?.arquivos?.find((u) => /\.(png|jpe?g|webp|gif)$/i.test(u)) || doc?.arquivos?.[0];

  const confirmar = async () => {
    if (blocos.length === 0) {
      toast({ title: "Adicione ao menos uma assinatura", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const registros = await Promise.all(
        blocos.map(async (b) => {
          let imagem_url = b.imagem_url;
          if (b.pending && b.tipo === "desenhada") {
            const file = dataURLToFile(imagem_url, `assinatura_${b.nome}.png`);
            const up = await base44.integrations.Core.UploadFile({ file });
            imagem_url = up.file_url;
          }
          return base44.entities.Assinatura.create({
            documento_id: id,
            documento_titulo: doc.titulo,
            assinante_nome: b.nome,
            assinante_email: b.email,
            assinante_cadastro_id: b.cadastro_id || undefined,
            imagem_url,
            tipo: b.tipo,
            observacao: b.observacao,
            pos_x: b.pos_x,
            pos_y: b.pos_y,
            status: "assinado",
            data_assinatura: new Date().toISOString(),
          });
        })
      );
      await base44.entities.Documento.update(id, { status: "assinado", pasta: "assinados" });
      setExistentes(registros);
      setBlocos([]);
      setDone(true);
      toast({ title: "Documento assinado com sucesso" });
    } catch {
      toast({ title: "Erro ao assinar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-heading mb-2">Assinatura registrada</h1>
          <p className="text-muted-foreground mb-6">O documento foi assinado e movido para a pasta "Assinados".</p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline"><Link to="/log">Ver log</Link></Button>
            <Button asChild><Link to="/">Painel</Link></Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const positionerBlocks = [
    ...existentes.map((a) => ({
      id: a.id,
      nome: a.assinante_nome,
      imagem_url: a.imagem_url,
      observacao: a.observacao,
      pos_x: a.pos_x ?? 10,
      pos_y: a.pos_y ?? 70,
      draggable: false,
    })),
    ...blocos,
  ];

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

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
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
                  <Label htmlFor="observacao">Caixa de observações</Label>
                  <Textarea id="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Observação que aparece sob a assinatura" />
                </div>

                <Button type="button" variant="outline" className="w-full gap-2" onClick={adicionarBloco}>
                  <Plus className="w-4 h-4" /> Adicionar assinatura ao documento
                </Button>
              </CardContent>
            </Card>

            {blocos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Assinaturas pendentes ({blocos.length})</p>
                {blocos.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <img src={b.imagem_url} alt="" className="h-8 w-16 object-contain bg-white rounded" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.nome}</p>
                      {b.observacao && <p className="text-xs text-muted-foreground truncate">{b.observacao}</p>}
                    </div>
                    <button type="button" onClick={() => removerBloco(b.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Posicione arrastando as assinaturas e observações sobre o arquivo</p>
              <DocumentPositioner imageUrl={previewImage} blocks={positionerBlocks} onMove={moverBloco} />
            </div>
            {doc.arquivos && doc.arquivos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Arquivos anexados</p>
                {doc.arquivos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/30">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate flex-1">{decodeURIComponent(url.split("/").pop() || "arquivo")}</span>
                  </a>
                ))}
              </div>
            )}
            <Button type="button" disabled={saving || blocos.length === 0} onClick={confirmar} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar assinatura(s) e finalizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}