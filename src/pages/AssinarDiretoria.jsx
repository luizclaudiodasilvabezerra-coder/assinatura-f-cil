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
import { ArrowLeft, Loader2, FileText, CheckCircle2, Calendar, Upload, PenLine, Plus, Minus, ChevronRight, AlertTriangle, Download, ShieldCheck, Lock, Layers } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SignaturePad from "@/components/SignaturePad";
import DocumentPositioner from "@/components/DocumentPositioner";
import EnvelopeRecusado from "@/components/EnvelopeRecusado";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";
import { base64ToBlob, baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { identificarDiretoria, diretoriaDoMembro, SENHA_MASTER_RECUSA } from "@/lib/acessos";
import { useAuth } from "@/lib/AuthContext";
import { getPermissoes, nomeDoUsuario, nomeExibicao, diretoriaDoUsuario } from "@/lib/permissoes";
import { loteDoArquivo, carimbarEUploadar } from "@/lib/carimbarLote";
import LoteFolders from "@/components/LoteFolders";

const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function AssinarDiretoria() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const padRef = useRef(null);
  const obsRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [cadastros, setCadastros] = useState([]);
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [critica, setCritica] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [diretorIdentificado, setDiretorIdentificado] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedMap, setSignedMap] = useState({});

  const [modo, setModo] = useState("desenhada");
  const [cadastroId, setCadastroId] = useState("");
  const [nome, setNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [indent, setIndent] = useState(0);
  const [imagemUpload, setImagemUpload] = useState("");
  const [pos, setPos] = useState({ x: 3, y: 90 });

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
        const gestao = s.filter((x) => x.etapa === "signatario" && x.arquivo_url);
        const masters = s.filter((x) => x.etapa === "master");
        const map = {};
        gestao.forEach((g, i) => {
          const m = masters.find((mm) => mm.arquivo_original_url === g.arquivo_original_url);
          if (m) map[i] = m;
        });
        setSignedMap(map);
        const firstUnsigned = gestao.findIndex((_, i) => !map[i]);
        setCurrentIndex(firstUnsigned >= 0 ? firstUnsigned : 0);
        // Auto-unlock para membros da diretoria (identificados pelo e-mail)
        const p = getPermissoes(user);
        if (p?.tipo === "diretoria" && d && !d.recusado) {
          const dir = diretoriaDoUsuario(user, cad);
          if (dir && d.diretoria === dir) {
            const nomeDir = nomeExibicao(user) || nomeDoUsuario(user);
            setDiretorIdentificado(nomeDir);
            setNome(nomeDir || "");
            // Auto-seleciona o cadastro correspondente para carregar a assinatura
            const norm = (s) => (s || "").trim().toUpperCase();
            const cadDir = cad.find((x) => norm(x.nome) === norm(nomeDir) && x.tipo === "diretoria");
            if (cadDir) setCadastroId(cadDir.id);
            // Busca imagem de assinatura em qualquer cadastro com o mesmo nome
            const comImagem = cad.find((x) => norm(x.nome) === norm(nomeDir) && x.imagem_assinatura);
            if (comImagem) { setImagemUpload(comImagem.imagem_assinatura); setModo("uploadada"); }
            setPos({ x: 75, y: 92 });
          }
        }
        // Acesso livre para envelopes normais (sem senha); recusados ainda exigem senha master
        if (d && !d.recusado) setUnlocked(true);
      } finally { setLoading(false); }
    })();
  }, [id, user]);

  // Auto-busca imagem de assinatura quando o nome coincide com cadastro
  useEffect(() => {
    if (!nome.trim() || imagemUpload) return;
    const norm = (s) => (s || "").trim().toUpperCase();
    const c = cadastros.find((x) => norm(x.nome) === norm(nome) && x.imagem_assinatura);
    if (c) {
      setImagemUpload(c.imagem_assinatura);
      setModo("uploadada");
    }
  }, [nome, cadastros]);

  const gestaoSigs = useMemo(() => sigs.filter((s) => s.etapa === "signatario" && s.arquivo_url), [sigs]);
  const diretoriaCadastros = useMemo(() => {
    const todos = cadastros.filter((c) => c.tipo === "diretoria");
    if (diretorIdentificado) {
      const norm = (s) => (s || "").trim().toUpperCase();
      const filtrado = todos.filter((c) => norm(c.nome) === norm(diretorIdentificado));
      return filtrado.length ? filtrado : todos;
    }
    return todos;
  }, [cadastros, diretorIdentificado]);
  const arquivos = gestaoSigs;
  const currentSig = arquivos[currentIndex];
  const currentFile = currentSig?.arquivo_url;
  const currentSigned = signedMap[currentIndex];
  const allSigned = arquivos.length > 0 && arquivos.every((_, i) => signedMap[i]);
  const loteAtual = useMemo(() => loteDoArquivo(doc?.lotes, currentSig?.arquivo_original_url || currentFile), [doc, currentSig, currentFile]);

  const onCadastroChange = (e) => {
    const c = diretoriaCadastros.find((x) => x.id === e.target.value);
    setCadastroId(e.target.value);
    if (c) {
      setNome(c.nome);
      const norm = (s) => (s || "").trim().toUpperCase();
      const comImagem = c.imagem_assinatura
        ? c
        : cadastros.find((x) => norm(x.nome) === norm(c.nome) && x.imagem_assinatura);
      if (comImagem?.imagem_assinatura) {
        setImagemUpload(comImagem.imagem_assinatura);
        setModo("uploadada");
      } else {
        setImagemUpload("");
      }
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); setImagemUpload(file_url); }
    catch { toast({ title: "Erro ao enviar imagem", variant: "destructive" }); }
  };

  const buscarImagemCadastrada = () => {
    if (!nome.trim()) { toast({ title: "Informe primeiro quem assina como diretoria", variant: "destructive" }); return; }
    const norm = (s) => (s || "").trim().toUpperCase();
    const c = cadastros.find((x) => norm(x.nome) === norm(nome) && x.imagem_assinatura);
    if (c) {
      setImagemUpload(c.imagem_assinatura);
      toast({ title: "Assinatura encontrada no cadastro", description: `Imagem de ${c.nome} carregada.` });
    } else {
      toast({ title: "Assinatura não cadastrada", description: "Nenhuma imagem de assinatura encontrada para este nome. Envie um arquivo manualmente.", variant: "destructive" });
    }
  };

  const findNextUnsigned = (from) => {
    for (let step = 1; step <= arquivos.length; step++) {
      const idx = (from + step) % arquivos.length;
      if (!signedMap[idx]) return idx;
    }
    return -1;
  };

  const focarObservacao = () => {
    setCritica(false);
    obsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => obsRef.current?.focus(), 300);
  };

  const baixarEnvelope = async () => {
    setDownloading(true);
    try { await baixarEnvelopePdf(id, `${doc.numero || "envelope"}.pdf`); }
    catch (e) { toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  const assinarLote = async () => {
    if (!nome.trim()) { toast({ title: "Selecione ou informe o diretor", variant: "destructive" }); return; }
    if (!observacao.trim()) { setCritica(true); toast({ title: "Observação obrigatória", description: "A observação é obrigatória para assinar.", variant: "destructive" }); return; }
    const lote = loteDoArquivo(doc.lotes, currentSig?.arquivo_original_url || currentFile);
    if (!lote) { toast({ title: "Este arquivo não pertence a um lote", variant: "destructive" }); return; }

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

    const urlsLote = new Set(lote.arquivos);
    const indicesDoLote = gestaoSigs.map((s, i) => ({ s, i })).filter(({ s }) => urlsLote.has(s.arquivo_original_url) || urlsLote.has(s.arquivo_url)).map(({ i }) => i);
    const pendentes = indicesDoLote.filter((i) => !signedMap[i]);
    if (pendentes.length === 0) { setSaving(false); toast({ title: "Todas as páginas deste lote já estão assinadas" }); return; }

    const newMap = { ...signedMap };
    let ok = 0, falhou = 0;
    for (const idx of pendentes) {
      const sig = gestaoSigs[idx];
      const fileUrl = sig.arquivo_url;
      let stampedUrl = fileUrl;
      try {
        stampedUrl = await carimbarEUploadar({
          fileUrl, imagemUrl: imagem_url, pos, autoPosition: true, lado: "direita", prefixo: "diretoria",
          nome, observacao, operacao: doc.operacao || "", unidade: doc.unidade_negocio || "", indent,
        });
      } catch { falhou++; continue; }
      try {
        await base44.entities.Assinatura.update(sig.id, { arquivo_url: stampedUrl });
        const rec = await base44.entities.Assinatura.create({
          documento_id: id, documento_titulo: doc.titulo, arquivo_url: stampedUrl,
          arquivo_original_url: sig.arquivo_original_url || fileUrl,
          assinante_nome: nome, assinante_cadastro_id: cadastroId || undefined, imagem_url, tipo: modo,
          etapa: "master", observacao, indent, pos_x: pos.x, pos_y: pos.y,
          unidade_negocio: doc.unidade_negocio || "", operacao: doc.operacao || "",
          status: "assinado", data_assinatura: new Date().toISOString(),
        });
        newMap[idx] = rec;
        ok++;
      } catch { falhou++; }
    }
    setSignedMap(newMap);
    setObservacao(""); setIndent(0); setAutorizado(false); setCritica(false);
    if (diretorIdentificado) {
      setNome(diretorIdentificado);
      const norm = (s) => (s || "").trim().toUpperCase();
      const cadDir = cadastros.find((x) => norm(x.nome) === norm(diretorIdentificado) && x.tipo === "diretoria");
      if (cadDir) setCadastroId(cadDir.id);
      const comImagem = cadastros.find((x) => norm(x.nome) === norm(diretorIdentificado) && x.imagem_assinatura);
      if (comImagem) { setImagemUpload(comImagem.imagem_assinatura); setModo("uploadada"); } else { setImagemUpload(""); }
      setPos({ x: 75, y: 92 });
    } else { setImagemUpload(""); setCadastroId(""); setNome(""); setPos({ x: 3, y: 90 }); }

    const allDone = arquivos.every((_, i) => newMap[i]);
    if (allDone) {
      await base44.entities.Documento.update(id, { status: "assinado_diretoria", pasta: "assinados" });
      setDoc((d) => ({ ...d, status: "assinado_diretoria", pasta: "assinados" }));
      toast({ title: `Lote carimbado: ${ok} arquivo(s)`, description: "Envelope concluído." });
      base44.functions.invoke("extrairDadosNF", { documento_id: id }).catch(() => {});
    } else {
      let next = -1;
      for (let step = 1; step <= arquivos.length; step++) {
        const idx = (currentIndex + step) % arquivos.length;
        if (!newMap[idx]) { next = idx; break; }
      }
      if (next !== -1) setCurrentIndex(next);
      toast({ title: `Lote carimbado: ${ok} arquivo(s) assinado(s)${falhou ? `, ${falhou} falha(s)` : ""}` });
    }
    setSaving(false);
  };

  const avancar = () => { const next = findNextUnsigned(currentIndex); if (next !== -1) setCurrentIndex(next); };

  const assinarArquivo = async () => {
    if (!nome.trim()) { toast({ title: "Selecione ou informe o diretor", variant: "destructive" }); return; }
    if (!observacao.trim()) { setCritica(true); toast({ title: "Observação obrigatória", description: "A observação é obrigatória para assinar.", variant: "destructive" }); return; }
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

    let stampedUrl = currentFile;
    if (currentFile && /\.pdf$/i.test(currentFile)) {
      let stampRes;
      try {
        stampRes = await base44.functions.invoke("carimbarPdf", {
          fileUrl: currentFile, imagemUrl: imagem_url, autoPosition: true,
          posX: pos.x, posY: pos.y, lado: "direita",
          nome, data: new Date().toLocaleString("pt-BR"),
          observacao, operacao: doc.operacao || "", unidade: doc.unidade_negocio || "", indent,
        });
      } catch {
        toast({ title: "Falha ao gravar assinatura no PDF", description: "A assinatura da diretoria não foi registrada no arquivo. Tente novamente.", variant: "destructive" });
        setSaving(false); return;
      }
      if (!stampRes.data?.pdf_base64) {
        toast({ title: "Falha ao gravar assinatura no PDF", description: stampRes.data?.error || "A assinatura da diretoria não foi registrada no arquivo. Tente novamente.", variant: "destructive" });
        setSaving(false); return;
      }
      try {
        const stampedFile = new File([base64ToBlob(stampRes.data.pdf_base64)], `diretoria_${fileName(currentFile)}`, { type: "application/pdf" });
        const up2 = await base44.integrations.Core.UploadFile({ file: stampedFile });
        stampedUrl = up2.file_url;
      } catch {
        toast({ title: "Falha ao salvar PDF assinado", variant: "destructive" });
        setSaving(false); return;
      }
    }

    try {
      await base44.entities.Assinatura.update(currentSig.id, { arquivo_url: stampedUrl });
      const rec = await base44.entities.Assinatura.create({
        documento_id: id, documento_titulo: doc.titulo, arquivo_url: stampedUrl,
        arquivo_original_url: currentSig.arquivo_original_url || currentFile,
        assinante_nome: nome, assinante_cadastro_id: cadastroId || undefined, imagem_url, tipo: modo,
        etapa: "master", observacao, indent, pos_x: pos.x, pos_y: pos.y,
        unidade_negocio: doc.unidade_negocio || "", operacao: doc.operacao || "",
        status: "assinado", data_assinatura: new Date().toISOString(),
      });
      const newMap = { ...signedMap, [currentIndex]: rec };
      setSignedMap(newMap);
      setObservacao(""); setIndent(0); setAutorizado(false); setCritica(false);
      if (diretorIdentificado) {
        setNome(diretorIdentificado);
        const norm = (s) => (s || "").trim().toUpperCase();
        const cadDir = cadastros.find((x) => norm(x.nome) === norm(diretorIdentificado) && x.tipo === "diretoria");
        if (cadDir) setCadastroId(cadDir.id);
        const comImagem = cadastros.find((x) => norm(x.nome) === norm(diretorIdentificado) && x.imagem_assinatura);
        if (comImagem) { setImagemUpload(comImagem.imagem_assinatura); setModo("uploadada"); } else { setImagemUpload(""); }
        setPos({ x: 75, y: 92 });
      } else { setImagemUpload(""); setCadastroId(""); setNome(""); setPos({ x: 3, y: 90 }); }
      const allDone = arquivos.every((_, i) => newMap[i]);
      if (allDone) {
        await base44.entities.Documento.update(id, { status: "assinado_diretoria", pasta: "assinados" });
        setDoc((d) => ({ ...d, status: "assinado_diretoria", pasta: "assinados" }));
        toast({ title: "Todos os arquivos assinados pela diretoria", description: "Envelope concluído." });
        // Extrai dados das NFs para o módulo de relatórios (nao bloqueia o fluxo)
        base44.functions.invoke("extrairDadosNF", { documento_id: id }).catch(() => {});
      } else {
        let next = -1;
        for (let step = 1; step <= arquivos.length; step++) {
          const idx = (currentIndex + step) % arquivos.length;
          if (!newMap[idx]) { next = idx; break; }
        }
        if (next !== -1) setCurrentIndex(next);
        toast({ title: "Arquivo assinado", description: "Avançando para o próximo arquivo." });
      }
    } catch { toast({ title: "Erro ao registrar assinatura", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const validarSenha = (e) => {
    e.preventDefault();
    if (doc && doc.recusado) {
      if (senha === SENHA_MASTER_RECUSA) { setUnlocked(true); setDiretorIdentificado("Master"); setSenhaErro(false); }
      else setSenhaErro(true);
      return;
    }
    const nome = identificarDiretoria(senha);
    if (!nome) { setSenhaErro(true); return; }
    // Verifica se o envelope pertence à diretoria deste membro
    const dirMembro = diretoriaDoMembro(nome, cadastros);
    if (doc && doc.diretoria && dirMembro && doc.diretoria !== dirMembro) {
      setSenhaErro(true);
      toast({ title: "Acesso negado", description: `Este envelope pertence à diretoria ${doc.diretoria}.`, variant: "destructive" });
      return;
    }
    setDiretorIdentificado(nome);
    setNome(nome);
    setUnlocked(true);
    setSenhaErro(false);
  };

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>);
  if (!doc) return (<div className="min-h-screen flex flex-col items-center justify-center gap-4"><p className="text-muted-foreground">Documento não encontrado.</p><Button asChild variant="outline"><Link to="/">Voltar</Link></Button></div>);

  // Envelopes recusados ainda exigem senha master
  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading text-center mb-1">Envelope recusado</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Esta NF foi recusada. Acesso e alterações restritos à senha master.</p>
          {doc?.observacao_recusa && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Observação: </span>{doc.observacao_recusa}
            </div>
          )}
          <form onSubmit={validarSenha} className="space-y-3">
            <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setSenhaErro(false); }} placeholder="Senha master" autoFocus />
            {senhaErro && <p className="text-sm text-destructive">Senha incorreta.</p>}
            <Button type="submit" className="w-full gap-2"><ShieldCheck className="w-4 h-4" /> Entrar</Button>
          </form>
          <div className="mt-6 text-center">
            <Button asChild variant="outline" size="sm"><Link to="/">Voltar</Link></Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (doc.recusado) {
    return <EnvelopeRecusado doc={doc} assinaturas={sigs} />;
  }

  if (allSigned) {
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
              {arquivos.map((s, i) => {
                const signedUrl = signedMap[i]?.arquivo_url || s.arquivo_url;
                return (<button key={i} type="button" onClick={() => baixarArquivoPdf(signedUrl, fileName(signedUrl))} className="flex items-center gap-2 text-sm text-blue-600 hover:underline w-full text-left"><Download className="w-3.5 h-3.5" /> {fileName(signedUrl)}</button>);
              })}
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

  if (arquivos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground">Nenhum arquivo assinado pela gestão encontrado.</p>
        <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  const positionerBlocks = currentSigned ? [{ id: currentSigned.id, nome: currentSigned.assinante_nome, imagem_url: currentSigned.imagem_url, observacao: currentSigned.observacao, indent: currentSigned.indent || 0, pos_x: currentSigned.pos_x ?? 3, pos_y: currentSigned.pos_y ?? 90, draggable: false }] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><ShieldCheck className="w-4 h-4" /> {doc.numero ? `Envelope ${doc.numero}` : "Assinatura da diretoria"}</div>
            <h1 className="text-3xl font-heading tracking-tight">{doc.titulo}</h1>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {doc.unidade_negocio && <span>UN: {doc.unidade_negocio}</span>}
              {doc.operacao && <span>Operação: {doc.operacao}</span>}
              {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
            </div>
          </div>
          {Object.keys(signedMap).length > 0 && (
            <Button type="button" variant="outline" onClick={baixarEnvelope} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar envelope
            </Button>
          )}
        </div>

        <LoteFolders
          lotes={doc.lotes}
          arquivos={arquivos}
          signedMap={signedMap}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          getUrl={(s) => s?.arquivo_original_url || s?.arquivo_url || ""}
        />

        <div className="grid lg:grid-cols-12 gap-4">
          <div className="space-y-3 lg:col-span-8">
            <p className="text-sm font-medium">{currentSigned ? "Arquivo já assinado pela diretoria" : `Assinando: ${fileName(currentFile)}`}</p>
            {currentSigned ? (
              <DocumentPositioner fileUrl={currentFile} blocks={positionerBlocks} onMove={() => {}} />
            ) : (
              <>
                {currentFile && isImage(currentFile) ? (
                  <img src={currentFile} alt="documento" className="w-full rounded-lg border border-border" />
                ) : (
                  <iframe src={currentFile} title="documento" className="w-full h-[600px] rounded-lg border border-border" />
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  A assinatura será posicionada automaticamente em uma área em branco do documento.
                </div>
              </>
            )}
            {currentFile && !isImage(currentFile) && (<a href={currentFile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"><FileText className="w-4 h-4" /> Abrir arquivo em nova aba</a>)}
          </div>

          <div className="space-y-4 lg:col-span-4">
            {currentSigned ? (
              <Card className="rounded-2xl border-emerald-200 bg-emerald-50/40">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">Arquivo assinado pela diretoria</span></div>
                  <div className="flex items-center gap-4">
                    {currentSigned.imagem_url && (<img src={currentSigned.imagem_url} alt="assinatura" className="h-14 w-28 object-contain bg-white rounded border border-border" />)}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{currentSigned.assinante_nome}</p>
                      {currentSigned.observacao && <p className="text-sm text-muted-foreground" style={{ paddingLeft: (currentSigned.indent || 0) * 14 }}>{currentSigned.observacao}</p>}
                    </div>
                  </div>
                  <button type="button" onClick={() => baixarArquivoPdf(currentSigned.arquivo_url || currentFile, fileName(currentSigned.arquivo_url || currentFile))} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"><Download className="w-3.5 h-3.5" /> Baixar este arquivo</button>
                  {!allSigned && (<Button type="button" className="w-full gap-2" onClick={avancar}>Avançar para próximo <ChevronRight className="w-4 h-4" /></Button>)}
                </CardContent>
              </Card>
            ) : (
              <>
                {critica && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="w-4 h-4" /> Observação obrigatória.</div>
                    <button type="button" onClick={focarObservacao} className="text-sm font-medium text-amber-900 underline">Inserir a observação</button>
                  </div>
                )}
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button type="button" onClick={() => setModo("desenhada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "desenhada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><PenLine className="w-4 h-4" /> Desenhar no touch</button>
                  <button type="button" onClick={() => setModo("uploadada")} className={`flex-1 py-2 inline-flex items-center justify-center gap-2 ${modo === "uploadada" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><Upload className="w-4 h-4" /> Buscar imagem</button>
                </div>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cadastro">Quem assina como diretoria *</Label>
                      <select id="cadastro" value={cadastroId} onChange={onCadastroChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">— Selecionar do cadastro —</option>
                        {diretoriaCadastros.map((c) => (<option key={c.id} value={c.id}>{c.nome}{c.diretoria ? ` · ${c.diretoria}` : ""}</option>))}
                      </select>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ou digite o nome do diretor" className="mt-2" />
                    </div>
                    <div className="space-y-2">
                      <Label>Assinatura da diretoria *</Label>
                      {modo === "desenhada" ? (<SignaturePad ref={padRef} />) : (
                        <div className="space-y-2">
                          {imagemUpload ? (
                            <div className="flex items-center gap-3">
                              <img src={imagemUpload} alt="assinatura" className="h-16 w-32 object-contain bg-white rounded border border-border" />
                              <button type="button" onClick={() => setImagemUpload("")} className="text-xs text-destructive hover:underline">Remover</button>
                            </div>
                          ) : (
                            <button type="button" onClick={buscarImagemCadastrada} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                              <Upload className="w-4 h-4" /> Buscar imagem de assinatura
                            </button>
                          )}
                          <label className="flex items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            ou enviar arquivo manualmente
                            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="obs">Caixa de observações *</Label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox checked={autorizado} onCheckedChange={(v) => { setAutorizado(!!v); if (v) { setObservacao("Autorizado"); setIndent(0); setCritica(false); } else { setObservacao(""); } }} />
                        Autorizado
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Recuo</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.max(0, v - 1))} disabled={autorizado}><Minus className="w-3.5 h-3.5" /></Button>
                          <span className="text-xs w-5 text-center tabular-nums">{indent}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.min(6, v + 1))} disabled={autorizado}><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <Textarea id="obs" ref={obsRef} value={observacao} disabled={autorizado} onChange={(e) => { setObservacao(e.target.value); if (e.target.value.trim()) setCritica(false); }} rows={2} style={{ paddingLeft: 8 + indent * 14 }} placeholder="Observação da assinatura da diretoria" />
                    </div>
                    <Button type="button" disabled={saving} onClick={assinarArquivo} className="w-full gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Assinar este arquivo e avançar</Button>
                    {loteAtual && loteAtual.arquivos.length > 1 && (
                      <Button type="button" variant="secondary" disabled={saving} onClick={assinarLote} className="w-full gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Carimbar todo o lote ({loteAtual.arquivos.length} arquivos)
                      </Button>
                    )}
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