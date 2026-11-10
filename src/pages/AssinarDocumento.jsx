import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Calendar, User, Upload, PenLine, Plus, Minus, ChevronRight, Pen, AlertTriangle, Download, Send, Lock, ShieldCheck, Ban, Layers } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import SignaturePad from "@/components/SignaturePad";
import DocumentPositioner from "@/components/DocumentPositioner";
import EnvelopeRecusado from "@/components/EnvelopeRecusado";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";
import { base64ToBlob, baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { validarSenhaGestor, gestorTemSenha, SENHA_MASTER_RECUSA } from "@/lib/acessos";
import { podeAssinarGestao, somenteConsultaEnvelopes, souSignatarioDeOrigem, temVisaoTotalPainel, participaDoEnvelope } from "@/lib/permissoes";
import { useAuth } from "@/lib/AuthContext";
import { loteDoArquivo, carimbarEUploadar } from "@/lib/carimbarLote";
import LoteFolders from "@/components/LoteFolders";
import { mapaAssinaturas, etapaGestao, precisaAutorizacao, precisaHierarquia, encaminharEnvelope } from "@/lib/fluxoAssinatura";
import { signatarioRedirecionado } from "@/lib/redirecionamentoAssinatura";
import AutorizacaoAssinatura from "@/components/AutorizacaoAssinatura";
import RecusaNFDialog from "@/components/RecusaNFDialog";
import { Image } from "@/components/ui/image";
import carregarAssinaturasEnvelope from "@/lib/assinaturasEnvelope";
import ConsultaEnvelope from "@/components/ConsultaEnvelope";
import { detectarPosicaoAssinatura } from "@/lib/posicionamentoAssinatura";
import useSenhaPdf from "@/hooks/useSenhaPdf";
import { erroSenhaPdf } from "@/lib/senhaPdf";

const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");


export default function AssinarDocumento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { comSenha, senhaDialog } = useSenhaPdf();
  const padRef = useRef(null);
  const obsRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [cadastros, setCadastros] = useState([]);
  const [existentes, setExistentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [critica, setCritica] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [showParcial, setShowParcial] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);
  const [showRecusa, setShowRecusa] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedMap, setSignedMap] = useState({});

  const [modo, setModo] = useState("desenhada");
  const [cadastroId, setCadastroId] = useState("");
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinanteEmail, setAssinanteEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [indent, setIndent] = useState(0);
  const [imagemUpload, setImagemUpload] = useState("");
  const [pos, setPos] = useState({ x: 3, y: 90 });
  const detCtxRef = useRef({});
  const autoPosDoneRef = useRef(false);
  const [unidade, setUnidade] = useState("");
  const [operacao, setOperacao] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [d, cad] = await Promise.all([
          base44.entities.Documento.get(id),
          base44.entities.Cadastro.list("-created_date", 200),
        ]);
        // Quem assina nesta visita: o signatário de origem (ex.: Anderson Duque) ou o gestor atual.
        const atorOrigem = souSignatarioDeOrigem(user, d);
        const etapaAtor = atorOrigem ? "gestao_origem" : etapaGestao(d);
        const sigs = await carregarAssinaturasEnvelope(id, d.recusado ? ["gestao_origem", "signatario", "master"] : [etapaAtor]);
        setDoc(d);
        setCadastros(cad);
        if (!d.recusado) setUnlocked(true);
        setUnidade(d.unidade_negocio || "");
        setOperacao(d.operacao || "");
        setExistentes(sigs);
        const arqs = d.arquivos || [];
        const map = mapaAssinaturas(d, sigs, etapaAtor);
        setSignedMap(map);
        const norm = (value) => (value || "").trim().toUpperCase();
        const nomeEfetivo = atorOrigem ? d.signatario_origem_nome : d.signatario_nome;
        const emailEfetivo = atorOrigem ? d.signatario_origem_email : d.signatario_email;
        const cadastroEfetivo = atorOrigem ? d.signatario_origem_cadastro_id : d.signatario_cadastro_id;
        const pessoa = cad.find((c) => c.id === cadastroEfetivo) || cad.find((c) => norm(c.nome) === norm(nomeEfetivo));
        setCadastroId(pessoa?.id || "");
        setAssinanteNome(pessoa?.nome || nomeEfetivo || "");
        setAssinanteEmail(pessoa?.email || emailEfetivo || "");
        if (pessoa?.imagem_assinatura) { setImagemUpload(pessoa.imagem_assinatura); setModo("uploadada"); }
        setPos(precisaAutorizacao(d) ? { x: 3, y: 78 } : { x: 3, y: 90 });
        const firstUnsigned = arqs.findIndex((_, i) => !map[i]);
        setCurrentIndex(firstUnsigned >= 0 ? firstUnsigned : 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.email]);

  const arquivos = useMemo(() => doc?.arquivos || [], [doc]);
  // Assinando como origem (envelope já encaminhado ao gestor) ou como gestor atual.
  const origemAtor = souSignatarioDeOrigem(user, doc);
  const etapa = origemAtor ? "gestao_origem" : etapaGestao(doc);
  const responsavelEtapa = origemAtor ? doc?.signatario_origem_nome : doc?.signatario_nome;
  // Visão total do painel (ex.: Joselio): consulta os envelopes das unidades permitidas
  // em modo somente leitura, sem assinar.
  const consultaPainel = temVisaoTotalPainel(user) && !!doc && !doc.recusado && !podeAssinarGestao(user, doc);
  // Envelopes em que ele participa (signatário, origem ou destinatário) abrem em consulta
  // quando a assinatura é de outra pessoa na etapa atual.
  const consultaParticipante = participaDoEnvelope(user, doc) && !doc?.recusado && !podeAssinarGestao(user, doc);
  const consulta = somenteConsultaEnvelopes(user) || consultaPainel || consultaParticipante;
  const autorizacaoGestor = precisaAutorizacao(doc) && !origemAtor;
  const destinoGestor = !!signatarioRedirecionado(doc?.signatario_nome);
  const hierarquico = precisaHierarquia(doc);
  const cadastrosPessoas = useMemo(() => cadastros.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo) && (!precisaHierarquia(doc) || (c.nome || "").trim().toUpperCase() === (responsavelEtapa || "").trim().toUpperCase())), [cadastros, doc, responsavelEtapa]);
  const currentFile = arquivos[currentIndex];
  const loteAtual = useMemo(() => loteDoArquivo(doc?.lotes, currentFile), [doc, currentFile]);
  const currentSigned = signedMap[currentIndex];
  const allSigned = arquivos.length > 0 && arquivos.every((_, i) => signedMap[i]);
  const gestaoDone = allSigned;

  // Posicionamento automático: espaço em branco no rodapé (espelho das assinaturas existentes).
  // Se não encontrar, mantém o padrão e o usuário arrasta manualmente.
  detCtxRef.current = { currentFile, existentes, lado: "esquerda" };
  const handleCanvasReady = (canvas) => {
    if (autoPosDoneRef.current || !currentFile) return;
    autoPosDoneRef.current = true;
    const mesmos = (existentes || []).filter((a) => (a.arquivo_original_url || a.arquivo_url) === currentFile);
    const res = detectarPosicaoAssinatura(canvas, { assinaturasMesmoArquivo: mesmos, ladoPreferido: "esquerda" });
    if (res) setPos(res);
  };

  const onCadastroChange = (e) => {
    const c = cadastros.find((x) => x.id === e.target.value);
    setCadastroId(e.target.value);
    if (c) { setAssinanteNome(c.nome); setAssinanteEmail(c.email || ""); setImagemUpload(c.imagem_assinatura || ""); if (c.imagem_assinatura) setModo("uploadada"); }
  };

  const handleUploadAssinatura = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImagemUpload(file_url);
    } catch { toast({ title: "Erro ao enviar imagem", variant: "destructive" }); }
  };

  const buscarImagemCadastrada = () => {
    if (!assinanteNome.trim()) { toast({ title: "Informe primeiro quem está assinando", variant: "destructive" }); return; }
    const norm = (s) => (s || "").trim().toUpperCase();
    const c = cadastros.find((x) => norm(x.nome) === norm(assinanteNome) && x.imagem_assinatura);
    if (c) {
      setImagemUpload(c.imagem_assinatura);
      toast({ title: "Assinatura encontrada no cadastro", description: `Imagem de ${c.nome} carregada.` });
    } else {
      toast({ title: "Assinatura não cadastrada", description: "Nenhuma imagem de assinatura encontrada para este nome. Envie um arquivo manualmente.", variant: "destructive" });
    }
  };

  const findNextUnsigned = (from, map = signedMap) => {
    for (let step = 1; step <= arquivos.length; step++) {
      const idx = (from + step) % arquivos.length;
      if (!map[idx]) return idx;
    }
    return -1;
  };

  const focarObservacao = () => {
    setCritica(false);
    obsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => obsRef.current?.focus(), 300);
  };

  const assinarArquivo = async () => {
    if (!assinanteNome.trim()) { toast({ title: "Selecione ou informe o nome do assinante", variant: "destructive" }); return; }
    if (hierarquico && assinanteNome.trim().toUpperCase() !== (responsavelEtapa || "").trim().toUpperCase()) { toast({ title: "Assine com o responsável desta etapa", variant: "destructive" }); return; }
    if (autorizacaoGestor && !autorizado) { setCritica(true); toast({ title: "Marque Autorizado antes de assinar", variant: "destructive" }); return; }
    if (!observacao.trim()) {
      setCritica(true);
      toast({ title: "Existe arquivo sem observação", description: "A observação é obrigatória para assinar.", variant: "destructive" });
      return;
    }
    let imagem_url = "";
    if (modo === "desenhada") {
      if (padRef.current?.isEmpty()) { toast({ title: "Desenhe a assinatura", variant: "destructive" }); return; }
      setSaving(true);
      try {
        const file = dataURLToFile(padRef.current.getDataURL(), `assinatura_${assinanteNome}.png`);
        const up = await base44.integrations.Core.UploadFile({ file });
        imagem_url = up.file_url;
      } catch { setSaving(false); toast({ title: "Erro ao salvar assinatura", variant: "destructive" }); return; }
    } else {
      if (!imagemUpload) { toast({ title: "Envie uma imagem de assinatura", variant: "destructive" }); return; }
      imagem_url = imagemUpload;
      setSaving(true);
    }

    let arquivo_url = currentFile || undefined;
    if (currentFile && /\.pdf$/i.test(currentFile)) {
      try {
        arquivo_url = await comSenha(currentFile, async (senhaPdf) => {
          const stampRes = await base44.functions.invoke("carimbarPdf", {
            fileUrl: currentFile, imagemUrl: imagem_url, posX: pos.x, posY: pos.y,
            nome: assinanteNome, data: new Date().toLocaleString("pt-BR"),
            observacao, operacao: operacao || doc.operacao || "", unidade: unidade || doc.unidade_negocio || "", indent,
            senha: senhaPdf,
          });
          const senhaErr = erroSenhaPdf(stampRes.data);
          if (senhaErr) throw senhaErr;
          if (!stampRes.data?.pdf_base64) throw new Error(stampRes.data?.error || "A assinatura não foi registrada no arquivo. Tente novamente.");
          const stampedFile = new File([base64ToBlob(stampRes.data.pdf_base64)], `assinado_${fileName(currentFile)}`, { type: "application/pdf" });
          const up2 = await base44.integrations.Core.UploadFile({ file: stampedFile });
          return up2.file_url;
        });
      } catch (e) {
        toast({ title: "Falha ao gravar assinatura no PDF", description: e?.message || "A assinatura não foi registrada no arquivo. Tente novamente.", variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    try {
      const rec = await base44.entities.Assinatura.create({
        documento_id: id, documento_titulo: doc.titulo, arquivo_url,
        arquivo_original_url: currentFile || undefined,
        assinante_nome: assinanteNome, assinante_email: assinanteEmail,
        assinante_cadastro_id: cadastroId || undefined, imagem_url, tipo: modo,
        etapa, autorizado: autorizacaoGestor && autorizado, observacao, indent, pos_x: pos.x, pos_y: pos.y,
        unidade_negocio: unidade || doc.unidade_negocio || "", operacao: operacao || doc.operacao || "",
        status: "assinado", data_assinatura: new Date().toISOString(),
      });
      const newMap = { ...signedMap, [currentIndex]: rec };
      setSignedMap(newMap);
      setExistentes((e) => [rec, ...e]);
      setObservacao(""); setIndent(0); setAutorizado(false); setCritica(false);

      const next = findNextUnsigned(currentIndex, newMap);
      if (next === -1) {
        if (origemAtor) {
          toast({ title: "Sua etapa está assinada", description: "O envelope segue com Joselio Serur para autorização e assinatura." });
        } else if (doc.status === "pendente_gestao") {
          await base44.entities.Documento.update(id, { status: "assinado_gestao" });
          setDoc((d) => ({ ...d, status: "assinado_gestao" }));
          toast({ title: "Todas as páginas assinadas", description: destinoGestor ? "Envelope pronto para enviar a Joselio Serur." : "Envelope pronto para enviar à diretoria." });
        } else {
          toast({ title: "Arquivos restantes assinados", description: "O envelope já está com a diretoria." });
        }
      } else {
        setCurrentIndex(next);
        toast({ title: "Arquivo assinado", description: "Avançando para o próximo arquivo." });
      }
    } catch { toast({ title: "Erro ao registrar assinatura", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const assinarLote = async () => {
    if (!assinanteNome.trim()) { toast({ title: "Selecione ou informe o nome do assinante", variant: "destructive" }); return; }
    if (hierarquico && assinanteNome.trim().toUpperCase() !== (responsavelEtapa || "").trim().toUpperCase()) { toast({ title: "Assine com o responsável desta etapa", variant: "destructive" }); return; }
    if (autorizacaoGestor && !autorizado) { setCritica(true); toast({ title: "Marque Autorizado antes de assinar", variant: "destructive" }); return; }
    if (!observacao.trim()) { setCritica(true); toast({ title: "Existe arquivo sem observação", description: "A observação é obrigatória para assinar.", variant: "destructive" }); return; }
    const lote = loteDoArquivo(doc.lotes, currentFile);
    if (!lote) { toast({ title: "Este arquivo não pertence a um lote", variant: "destructive" }); return; }

    let imagem_url = "";
    if (modo === "desenhada") {
      if (padRef.current?.isEmpty()) { toast({ title: "Desenhe a assinatura", variant: "destructive" }); return; }
      setSaving(true);
      try {
        const file = dataURLToFile(padRef.current.getDataURL(), `assinatura_${assinanteNome}.png`);
        const up = await base44.integrations.Core.UploadFile({ file });
        imagem_url = up.file_url;
      } catch { setSaving(false); toast({ title: "Erro ao salvar assinatura", variant: "destructive" }); return; }
    } else {
      if (!imagemUpload) { toast({ title: "Envie uma imagem de assinatura", variant: "destructive" }); return; }
      imagem_url = imagemUpload;
      setSaving(true);
    }

    const indicesDoLote = lote.arquivos.map((url) => arquivos.indexOf(url)).filter((i) => i >= 0);
    const pendentes = indicesDoLote.filter((i) => !signedMap[i]);
    if (pendentes.length === 0) { setSaving(false); toast({ title: "Todas as páginas deste lote já estão assinadas" }); return; }

    const newMap = { ...signedMap };
    const novosRegistros = [];
    let ok = 0, falhou = 0;
    for (const idx of pendentes) {
      const fileUrl = arquivos[idx];
      let arquivo_url = fileUrl || undefined;
      try {
        arquivo_url = await comSenha(fileUrl, (senhaPdf) => carimbarEUploadar({
          fileUrl, imagemUrl: imagem_url, pos,
          nome: assinanteNome, observacao, senha: senhaPdf,
          operacao: operacao || doc.operacao || "", unidade: unidade || doc.unidade_negocio || "", indent,
        }));
      } catch (e) {
        if (e?.precisaSenha) toast({ title: "PDF protegido por senha", description: `${fileName(fileUrl)} não foi assinado.`, variant: "destructive" });
        falhou++; continue;
      }
      try {
        const rec = await base44.entities.Assinatura.create({
          documento_id: id, documento_titulo: doc.titulo, arquivo_url,
          arquivo_original_url: fileUrl || undefined,
          assinante_nome: assinanteNome, assinante_email: assinanteEmail,
          assinante_cadastro_id: cadastroId || undefined, imagem_url, tipo: modo,
          etapa, autorizado: autorizacaoGestor && autorizado, observacao, indent, pos_x: pos.x, pos_y: pos.y,
          unidade_negocio: unidade || doc.unidade_negocio || "", operacao: operacao || doc.operacao || "",
          status: "assinado", data_assinatura: new Date().toISOString(),
        });
        newMap[idx] = rec;
        novosRegistros.push(rec);
        ok++;
      } catch { falhou++; }
    }
    setSignedMap(newMap);
    if (novosRegistros.length) setExistentes((e) => [...novosRegistros, ...e]);
    setObservacao(""); setIndent(0); setAutorizado(false); setCritica(false);

    const allDone = arquivos.every((_, i) => newMap[i]);
    if (allDone && origemAtor) {
      toast({ title: `Lote assinado: ${ok} arquivo(s)`, description: "O envelope segue com Joselio Serur para autorização e assinatura." });
    } else if (allDone && doc.status === "pendente_gestao") {
      await base44.entities.Documento.update(id, { status: "assinado_gestao" });
      setDoc((d) => ({ ...d, status: "assinado_gestao" }));
      toast({ title: `Lote carimbado: ${ok} arquivo(s)`, description: destinoGestor ? "Envie o envelope a Joselio Serur." : "Envie o envelope à diretoria." });
    } else {
      const next = arquivos.findIndex((_, i) => !newMap[i]);
      if (next >= 0) setCurrentIndex(next);
      toast({ title: `Lote carimbado: ${ok} arquivo(s) assinado(s)${falhou ? `, ${falhou} falha(s)` : ""}` });
    }
    setSaving(false);
  };

  const avancar = () => { const next = findNextUnsigned(currentIndex); if (next !== -1) setCurrentIndex(next); };

  const baixarEnvelope = async () => {
    setDownloading(true);
    try { await baixarEnvelopePdf(id, `${doc.numero || "envelope"}.pdf`); }
    catch (e) { toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" }); }
    finally { setDownloading(false); }
  };

  const enviarDiretoria = async () => {
    if (!allSigned) return;
    setEnviando(true);
    try {
      const atualizado = await encaminharEnvelope(id);
      setDoc(atualizado);
      toast({ title: destinoGestor ? "Enviado para Joselio Serur" : "Enviado para diretoria", description: destinoGestor ? "Aguardando assinatura e autorização do gestor." : "Aguardando assinatura da diretoria." });
      if (destinoGestor) navigate("/");
    } catch (e) { toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }); }
    finally { setEnviando(false); }
  };

  const enviarParcial = async () => {
    if (hierarquico) return;
    setEnviando(true);
    try {
      const atualizado = await encaminharEnvelope(id, true);
      setDoc(atualizado);
      toast({ title: "Envio parcial à diretoria", description: "Arquivos assinados enviados à diretoria. Os pendentes seguem no painel." });
      navigate("/");
    } catch { toast({ title: "Erro ao enviar", variant: "destructive" }); }
    finally { setEnviando(false); setShowParcial(false); }
  };

  const aposRecusa = (atualizado) => {
    setDoc(atualizado);
    const map = mapaAssinaturas(atualizado, existentes, etapa);
    setSignedMap(map);
    const next = atualizado.arquivos.findIndex((_, i) => !map[i]);
    setCurrentIndex(next >= 0 ? next : 0);
    if (!atualizado.arquivos.length) navigate("/");
  };

  const someSigned = Object.keys(signedMap).length > 0;
  const someSignedButNotAll = someSigned && !allSigned;

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>);
  if (!doc) return (<div className="min-h-screen flex flex-col items-center justify-center gap-4"><p className="text-muted-foreground">Documento não encontrado.</p><Button asChild variant="outline"><Link to="/">Voltar</Link></Button></div>);
  if (user && !consulta && !podeAssinarGestao(user, doc)) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Lock className="w-10 h-10 text-muted-foreground" />
      <p className="text-muted-foreground text-center max-w-sm">Você não tem acesso a este envelope. Acompanhe o andamento pelo painel.</p>
      <Button asChild variant="outline"><Link to="/">Voltar ao painel</Link></Button>
    </div>
  );

  if (consulta) return <ConsultaEnvelope doc={doc} />;

  if (!unlocked) {
    const validar = (e) => {
      e.preventDefault();
      if (doc.recusado) {
        if (senha === SENHA_MASTER_RECUSA) { setUnlocked(true); setSenhaErro(false); }
        else setSenhaErro(true);
        return;
      }
      if (senha === SENHA_MASTER_RECUSA) { setUnlocked(true); setSenhaErro(false); return; }
      const r = validarSenhaGestor(doc.signatario_nome, senha);
      if (r.naoConfigurado) { setUnlocked(true); return; }
      if (r.ok) { setUnlocked(true); setSenhaErro(false); }
      else setSenhaErro(true);
    };
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-5">
            {doc.recusado ? <AlertTriangle className="w-7 h-7 text-amber-600" /> : <Lock className="w-7 h-7 text-primary" />}
          </div>
          <h1 className="text-2xl font-heading text-center mb-1">{doc.recusado ? "Envelope recusado" : "Acesso do gestor"}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {doc.recusado
              ? "Esta NF foi recusada. Acesso e alterações restritos à senha master."
              : <>Envelope destinado a <span className="font-medium text-foreground">{doc.signatario_nome || "—"}</span>. Informe sua senha individual para assinar.</>}
          </p>
          {doc.recusado && doc.observacao_recusa && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Observação: </span>{doc.observacao_recusa}
            </div>
          )}
          <form onSubmit={validar} className="space-y-3">
            <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setSenhaErro(false); }} placeholder={doc.recusado ? "Senha master" : "Senha do gestor"} autoFocus />
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
    return <EnvelopeRecusado doc={doc} assinaturas={existentes} />;
  }

  if (gestaoDone) {
    const jaEnviado = doc.status === "pendente_diretoria" || doc.status === "assinado_diretoria";
    // A origem não encaminha o envelope: quem envia à diretoria é o gestor (Joselio Serur).
    const podeEnviar = !jaEnviado && !origemAtor;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-heading mb-2">{origemAtor ? "Sua etapa está assinada" : destinoGestor ? "Assinatura de origem concluída" : "Assinatura da gestão concluída"}</h1>
          <p className="text-muted-foreground mb-6">{origemAtor ? "As páginas da sua etapa estão assinadas. O envelope está com Joselio Serur, que assinará e autorizará antes do envio à diretoria." : jaEnviado ? "Todos os arquivos foram assinados e o envelope já está com a diretoria." : destinoGestor ? "Envie as páginas assinadas, com suas observações, para Joselio Serur autorizar e assinar." : "Todos os arquivos foram assinados pela gestão. Envie à diretoria para a assinatura final."}</p>

          <div className="flex flex-col gap-3 mb-6">
            {podeEnviar && (
            <Button type="button" onClick={enviarDiretoria} disabled={enviando} className="gap-2">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {destinoGestor ? "Enviar para Joselio Serur" : "Enviar para assinatura da diretoria"}
            </Button>
            )}
            <Button type="button" variant="outline" onClick={baixarEnvelope} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar envelope (PDF)
            </Button>
            <div className="text-left space-y-2">
              <p className="text-xs text-muted-foreground">Arquivos assinados (clique para baixar individual):</p>
              {arquivos.filter(Boolean).map((url, i) => {
                const sig = signedMap[i];
                const signedUrl = sig?.arquivo_url || url;
                return (
                  <button key={i} type="button" onClick={() => baixarArquivoPdf(signedUrl, fileName(signedUrl))} className="flex items-center gap-2 text-sm text-blue-600 hover:underline w-full text-left">
                    <Download className="w-3.5 h-3.5" /> {fileName(url)}
                  </button>
                );
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

  const pendingBlock = !currentSigned && assinanteNome ? [{ id: "pending", nome: assinanteNome, imagem_url: imagemUpload || "", observacao, indent, pos_x: pos.x, pos_y: pos.y, draggable: true }] : [];
  const positionerBlocks = currentSigned ? [{ id: currentSigned.id, nome: currentSigned.assinante_nome, imagem_url: currentSigned.imagem_url, observacao: currentSigned.observacao, indent: currentSigned.indent || 0, pos_x: currentSigned.pos_x ?? 10, pos_y: currentSigned.pos_y ?? 70, draggable: false }] : pendingBlock;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><FileText className="w-4 h-4" /> {doc.numero ? `Envelope ${doc.numero}` : "Documento para assinatura"}</div>
            <h1 className="text-3xl font-heading tracking-tight">{doc.titulo}</h1>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              {doc.signatario_nome && <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Gestão: {doc.signatario_nome}</span>}
              {doc.unidade_negocio && <span>UN: {doc.unidade_negocio}</span>}
              {doc.operacao && <span>Operação: {doc.operacao}</span>}
              {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(signedMap).length > 0 && (
              <Button type="button" variant="outline" onClick={baixarEnvelope} disabled={downloading} className="gap-2">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar envelope
              </Button>
            )}
            {someSignedButNotAll && !hierarquico && (
              <Button type="button" variant="secondary" onClick={() => setShowParcial(true)} className="gap-2">
                <Send className="w-4 h-4" /> Enviar parcialmente à diretoria
              </Button>
            )}
          </div>
        </div>

        <LoteFolders lotes={doc.lotes} arquivos={arquivos} signedMap={signedMap} currentIndex={currentIndex} onSelect={setCurrentIndex} />

        <div className="grid lg:grid-cols-12 gap-4">
          <div className="space-y-3 lg:col-span-8">
            <p className="text-sm font-medium">{currentSigned ? "Arquivo já assinado" : `Assinando: ${fileName(currentFile)}`}</p>
            <DocumentPositioner fileUrl={currentFile} blocks={positionerBlocks} onMove={(bid, x, y) => setPos({ x, y })} onCanvasReady={handleCanvasReady} />
            {!currentSigned && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Não concorda com a posição? Arraste o bloco de assinatura para ajustá-la na página.
              </div>
            )}
            {currentFile && !isImage(currentFile) && (<a href={currentFile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"><FileText className="w-4 h-4" /> Abrir arquivo em nova aba</a>)}
          </div>

          <div className="space-y-4 lg:col-span-4">
            {currentSigned ? (
              <Card className="rounded-2xl border-emerald-200 bg-emerald-50/40">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">Arquivo assinado</span></div>
                  <div className="flex items-center gap-4">
                    {currentSigned.imagem_url && (<Image src={currentSigned.imagem_url} alt="assinatura" className="h-14 w-28 object-contain bg-white rounded border border-border" />)}
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
                    <div className="flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="w-4 h-4" /> Existe arquivo sem observação.</div>
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
                      <Label htmlFor="cadastro">Quem está assinando (gestão) *</Label>
                      <select id="cadastro" value={cadastroId} onChange={onCadastroChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">— Selecionar do cadastro —</option>
                        {cadastrosPessoas.map((c) => (<option key={c.id} value={c.id}>{c.nome}{c.email ? ` · ${c.email}` : ""}</option>))}
                      </select>
                      <Input type="email" value={assinanteEmail} onChange={(e) => setAssinanteEmail(e.target.value)} placeholder="E-mail (opcional)" className="mt-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Unidade de negócio</Label>
                        <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">— Selecionar —</option>
                          {cadastros.filter((c) => c.tipo === "unidade").map((c) => (<option key={c.id} value={c.nome}>{c.nome}</option>))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Operação</Label>
                        <select value={operacao} onChange={(e) => setOperacao(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">— Selecionar —</option>
                          {cadastros.filter((c) => c.tipo === "operacao").map((c) => (<option key={c.id} value={c.nome}>{c.nome}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Assinatura *</Label>
                      {modo === "desenhada" ? (<SignaturePad ref={padRef} />) : (
                        <div className="space-y-2">
                          {imagemUpload ? (
                            <div className="flex items-center gap-3">
                              <Image src={imagemUpload} alt="assinatura" className="h-16 w-32 object-contain bg-white rounded border border-border" />
                              <button type="button" onClick={() => setImagemUpload("")} className="text-xs text-destructive hover:underline">Remover</button>
                            </div>
                          ) : (
                            <button type="button" onClick={buscarImagemCadastrada} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                              <Upload className="w-4 h-4" /> Buscar imagem de assinatura
                            </button>
                          )}
                          <label className="flex items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            ou enviar arquivo manualmente
                            <input type="file" accept="image/*" className="hidden" onChange={handleUploadAssinatura} />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="observacao">{autorizacaoGestor ? "Autorização do gestor *" : "Caixa de observações *"}</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">Recuo</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.max(0, v - 1))} disabled={autorizado}><Minus className="w-3.5 h-3.5" /></Button>
                          <span className="text-xs w-5 text-center tabular-nums">{indent}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setIndent((v) => Math.min(6, v + 1))} disabled={autorizado}><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      {autorizacaoGestor && <AutorizacaoAssinatura checked={autorizado} onChange={(value) => { setAutorizado(value); setObservacao(value ? `Autorizado ${new Date().toLocaleDateString("pt-BR")}` : ""); setIndent(0); setCritica(false); }} />}
                      <Textarea id="observacao" ref={obsRef} value={observacao} disabled={autorizado} onChange={(e) => { setObservacao(e.target.value); if (e.target.value.trim()) setCritica(false); }} rows={2} style={{ paddingLeft: 8 + indent * 14 }} placeholder="Observação que aparece sob a assinatura" />
                    </div>
                    <Button type="button" disabled={saving} onClick={assinarArquivo} className="w-full gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pen className="w-4 h-4" />} Assinar este arquivo e avançar</Button>
                    {loteAtual && loteAtual.arquivos.length > 1 && (
                      <Button type="button" variant="secondary" disabled={saving} onClick={assinarLote} className="w-full gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Carimbar todo o lote ({loteAtual.arquivos.length} arquivos)
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => setShowRecusa(true)} className="w-full gap-2 border-amber-400 text-amber-700 hover:bg-amber-50">
                      <Ban className="w-4 h-4" /> Recusar esta NF
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showParcial} onOpenChange={setShowParcial}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar parcialmente à diretoria?</DialogTitle>
            <DialogDescription>Existem arquivos sem assinar. Os arquivos já assinados serão enviados à diretoria agora; os pendentes permanecerão no painel disponíveis para assinatura.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowParcial(false); const u = arquivos.findIndex((_, i) => !signedMap[i]); if (u >= 0) setCurrentIndex(u); }}>Não, voltar ao arquivo</Button>
            <Button onClick={enviarParcial} disabled={enviando} className="gap-2">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Sim, enviar parcial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecusaNFDialog open={showRecusa} onClose={() => setShowRecusa(false)} doc={doc} arquivoUrl={currentFile} onRecusou={aposRecusa} />
      {senhaDialog}
      </div>
  );
}