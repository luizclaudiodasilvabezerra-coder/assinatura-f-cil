import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Upload, X, FileText, Smartphone, Layers, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { podeCriarEnvelope, categoriaEnvelopeDoUsuario, nomeDoUsuario } from "@/lib/permissoes";
import { signatarioRedirecionado } from "@/lib/redirecionamentoAssinatura";
import CapturaMobileDialog from "@/components/CapturaMobileDialog";
import DuplicidadeDialog from "@/components/DuplicidadeDialog";
import { splitPdfIfNeeded } from "@/lib/pdfSplit";

export default function NovoDocumento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [loteAtivo, setLoteAtivo] = useState(null);
  const [cadastros, setCadastros] = useState([]);
  const [capturaMobileOpen, setCapturaMobileOpen] = useState(false);
  const [showDuplicidade, setShowDuplicidade] = useState(false);
  const [pendDuplicidade, setPendDuplicidade] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [criandoDocumento, setCriandoDocumento] = useState(false);
  const [arquivosIndividuais, setArquivosIndividuais] = useState([]);
  const [uploadingIndividual, setUploadingIndividual] = useState(false);
  const fileInputRef = useRef(null);
  const individualInputRef = useRef(null);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    categoria: categoriaEnvelopeDoUsuario(user),
    destinatario_nome: "",
    destinatario_email: "",
    signatario_nome: "",
    signatario_email: "",
    signatario_cadastro_id: "",
    diretoria: "",
    unidade_negocio: "",
    data_limite: "",
  });

  const nomeOrigem = nomeDoUsuario(user);
  const criadorOrigem = !!signatarioRedirecionado(nomeOrigem);
  useEffect(() => {
    base44.entities.Cadastro.list("-created_date", 200).then((cad) => {
      setCadastros(cad);
      if (signatarioRedirecionado(nomeDoUsuario(user))) {
        const pessoa = cad.find((c) => (c.nome || "").trim().toUpperCase() === nomeDoUsuario(user));
        if (pessoa) setForm((f) => ({ ...f, signatario_nome: pessoa.nome.trim(), signatario_email: pessoa.email || "", signatario_cadastro_id: pessoa.id }));
      }
    });
  }, [user]);

  if (!podeCriarEnvelope(user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-xl font-heading">Acesso não autorizado</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">Você não tem permissão para criar envelopes.</p>
        <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  const unidades = cadastros.filter((c) => c.tipo === "unidade");
  const diretorias = cadastros.filter((c) => c.tipo === "diretoria");

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSignatarioChange = (e) => {
    const c = cadastros.find((x) => x.id === e.target.value);
    setForm((f) => ({
      ...f,
      signatario_cadastro_id: e.target.value,
      signatario_nome: c ? c.nome : "",
      signatario_email: c && c.email ? c.email : "",
    }));
  };

  const onDestinatarioChange = (e) => {
    const c = cadastros.find((x) => x.id === e.target.value);
    setForm((f) => ({
      ...f,
      destinatario_nome: c ? c.nome : "",
      destinatario_email: c && c.email ? c.email : "",
      signatario_cadastro_id: !criadorOrigem && c ? c.id : f.signatario_cadastro_id,
      signatario_nome: !criadorOrigem && c ? c.nome : f.signatario_nome,
      signatario_email: !criadorOrigem && c?.email ? c.email : f.signatario_email,
    }));
  };

  const pessoas = cadastros.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo));

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      // Divide PDFs multipáginas em arquivos individuais antes do upload
      const allFiles = [];
      for (const file of files) {
        const split = await splitPdfIfNeeded(file);
        allFiles.push(...split);
      }
      const uploaded = await Promise.all(
        allFiles.map((file) => base44.integrations.Core.UploadFile({ file }))
      );
      const urls = uploaded.map((u) => u.file_url);
      if (loteAtivo !== null) {
        setLotes((prev) => prev.map((l, i) => i === loteAtivo ? { ...l, arquivos: [...l.arquivos, ...urls] } : l));
      }
      toast({ title: `${uploaded.length} arquivo(s) enviado(s)` });
    } catch {
      toast({ title: "Falha no envio", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const criarLote = () => {
    setLotes((prev) => [...prev, { nome: `Lote ${prev.length + 1}`, arquivos: [] }]);
    setLoteAtivo(lotes.length);
    toast({ title: `Lote ${lotes.length + 1} criado`, description: "Envie os arquivos deste lote abaixo" });
  };

  const removerLote = (index) => {
    setLotes((prev) => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, nome: `Lote ${i + 1}` })));
    setLoteAtivo((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const removerArquivoDeLote = (loteIndex, url) => {
    setLotes((prev) => prev.map((l, i) => i === loteIndex ? { ...l, arquivos: l.arquivos.filter((u) => u !== url) } : l));
  };

  const handleIndividualFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingIndividual(true);
    try {
      const allFiles = [];
      for (const file of files) {
        const split = await splitPdfIfNeeded(file);
        allFiles.push(...split);
      }
      const uploaded = await Promise.all(
        allFiles.map((file) => base44.integrations.Core.UploadFile({ file }))
      );
      const urls = uploaded.map((u) => u.file_url);
      setArquivosIndividuais((prev) => [...prev, ...urls]);
      toast({ title: `${uploaded.length} arquivo(s) enviado(s)` });
    } catch {
      toast({ title: "Falha no envio", variant: "destructive" });
    } finally {
      setUploadingIndividual(false);
      e.target.value = "";
    }
  };

  const removerArquivoIndividual = (url) => {
    setArquivosIndividuais((prev) => prev.filter((u) => u !== url));
  };

  const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo").slice(0, 40) : "arquivo");

  const criarDocumento = async (allArquivos, arquivosNf) => {
    const all = await base44.entities.Documento.list("-created_date", 1000);
    const numero = `ENV-${String((all.length || 0) + 1).padStart(4, "0")}`;
    const numerosNf = (arquivosNf || []).map((a) => a.numero_nf).filter(Boolean);
    const created = await base44.entities.Documento.create({
      ...form,
      numero,
      arquivos: allArquivos,
      arquivos_nf: arquivosNf && arquivosNf.length ? arquivosNf : undefined,
      numeros_nf: numerosNf.length ? numerosNf : undefined,
      lotes: lotes.length > 0 ? lotes : undefined,
      status: "pendente_gestao",
      pasta: "pendente",
      fluxo_hierarquico: !!signatarioRedirecionado(form.signatario_nome),
      categoria: form.categoria,
    });

    toast({ title: "Envelope criado", description: signatarioRedirecionado(form.signatario_nome) ? "Assine e coloque observação nas páginas antes de enviar a Joselio Serur." : numero });

    if (created && created.destinatario_email) {
      base44.functions.invoke("enviarAlertaDestinatario", { documentoId: created.id }).catch(() => {});
    }
    navigate("/");
  };

  const confirmarDuplicidade = async () => {
    if (!pendDuplicidade) return;
    setCriandoDocumento(true);
    try {
      await criarDocumento(pendDuplicidade.allArquivos, pendDuplicidade.resultados);
    } catch {
      toast({ title: "Erro ao criar envelope", variant: "destructive" });
    } finally {
      setCriandoDocumento(false);
      setShowDuplicidade(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    setVerificando(true);
    try {
      const allArquivos = [...arquivosIndividuais, ...lotes.flatMap((l) => l.arquivos)];
      if (allArquivos.length === 0) {
        toast({ title: "Anexe ao menos um arquivo", variant: "destructive" });
        return;
      }

      // Varredura de duplicidade em envelopes assinados e pendentes.
      let resultados = [];
      let duplicidades = [];
      try {
        const verif = await base44.functions.invoke("verificarDuplicidadeNF", { arquivos: allArquivos });
        resultados = (verif && verif.resultados) || [];
        duplicidades = (verif && verif.duplicidades) || [];
      } catch {
        // Se a verificação falhar, segue sem bloquear a criação.
      }

      if (duplicidades.length > 0) {
        setPendDuplicidade({ resultados, duplicidades, allArquivos });
        setShowDuplicidade(true);
        return;
      }

      await criarDocumento(allArquivos, resultados);
    } catch {
      toast({ title: "Erro ao criar envelope", variant: "destructive" });
    } finally {
      setSaving(false);
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-heading tracking-tight mb-1">Novo envelope</h1>
        <p className="text-muted-foreground mb-8">Crie um envelope de assinatura, aponte o signatário e anexe quantos arquivos precisar.</p>

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input id="titulo" value={form.titulo} onChange={update("titulo")} placeholder="Contrato de prestação de serviços" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={form.descricao} onChange={update("descricao")} rows={3} placeholder="Resumo do envelope a ser assinado" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria / Direcionamento *</Label>
                <select id="categoria" value={form.categoria} onChange={update("categoria")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="notas_boletos">Notas e Boletos</option>
                  <option value="abastecimento">Abastecimento</option>
                </select>
                <p className="text-xs text-muted-foreground">Define para qual fluxo o envelope será direcionado.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signatario">Signatário (pasta pendente será gerada para ele)</Label>
                <select id="signatario" value={form.signatario_cadastro_id} onChange={onSignatarioChange} disabled={criadorOrigem} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Selecionar do cadastro —</option>
                  {cadastros.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo)).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <Input value={form.signatario_nome} readOnly={criadorOrigem} onChange={update("signatario_nome")} placeholder="Ou digite o nome do signatário" className="mt-2" />
                <Input type="email" value={form.signatario_email} readOnly={criadorOrigem} onChange={update("signatario_email")} placeholder="E-mail do signatário" className="mt-2" />
                {signatarioRedirecionado(form.signatario_nome) && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <strong>{form.signatario_nome}</strong> deverá assinar e informar observação em todas as páginas. Depois, envie a <strong>Joselio Serur</strong>, que assinará e marcará <strong>Autorizado</strong> antes do envio à diretoria.
                  </div>
                )}
                </div>

              <div className="space-y-2">
                <Label htmlFor="diretoria">Diretoria de destino (após assinatura do gestor)</Label>
                <select id="diretoria" value={form.diretoria} onChange={update("diretoria")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Selecionar —</option>
                  {diretorias.map((c) => (<option key={c.id} value={c.diretoria || c.nome}>{c.diretoria || c.nome}</option>))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade_negocio">Unidade de negócio</Label>
                <select id="unidade_negocio" value={form.unidade_negocio} onChange={update("unidade_negocio")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Selecionar —</option>
                  {unidades.map((c) => (<option key={c.id} value={c.nome}>{c.nome}</option>))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="destinatario_sel">Destinatário</Label>
                  <select id="destinatario_sel" onChange={onDestinatarioChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">— Selecionar do cadastro —</option>
                    {pessoas.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                  </select>
                  <Input value={form.destinatario_nome} onChange={update("destinatario_nome")} placeholder="Ou digite o nome do destinatário" className="mt-2" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_email">E-mail do destinatário</Label>
                  <Input id="destinatario_email" type="email" value={form.destinatario_email} onChange={update("destinatario_email")} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_limite">Data limite</Label>
                <Input id="data_limite" type="date" value={form.data_limite} onChange={update("data_limite")} />
              </div>
              <div className="space-y-3">
                <Label>Anexos</Label>
                <div className="grid sm:grid-cols-3 gap-3">
                  <button type="button" onClick={criarLote} className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand/5 p-4 text-center hover:bg-brand/10 transition-colors">
                    <Layers className="w-5 h-5 text-brand" />
                    <span className="text-sm font-semibold text-brand">Criar lote</span>
                    <span className="text-xs text-muted-foreground">Agrupe arquivos em um lote</span>
                  </button>
                  <button type="button" onClick={() => setCapturaMobileOpen(true)} className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand/5 p-4 text-center hover:bg-brand/10 transition-colors">
                    <Smartphone className="w-5 h-5 text-brand" />
                    <span className="text-sm font-semibold text-brand">Captura via celular</span>
                    <span className="text-xs text-muted-foreground">Use a câmera do celular</span>
                  </button>
                  <button type="button" onClick={() => individualInputRef.current?.click()} className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand/5 p-4 text-center hover:bg-brand/10 transition-colors">
                    <Upload className="w-5 h-5 text-brand" />
                    <span className="text-sm font-semibold text-brand">Upload individual</span>
                    <span className="text-xs text-muted-foreground">Anexe arquivos avulsos</span>
                  </button>
                </div>
                <input ref={individualInputRef} type="file" className="hidden" multiple onChange={handleIndividualFiles} />

                {uploadingIndividual && (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/30 py-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando arquivos…
                  </div>
                )}

                {arquivosIndividuais.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <Upload className="w-4 h-4 text-muted-foreground" /> Arquivos individuais · {arquivosIndividuais.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {arquivosIndividuais.map((url) => (
                        <div key={url} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{fileName(url)}</span>
                          <button type="button" onClick={() => removerArquivoIndividual(url)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loteAtivo !== null && lotes[loteAtivo] && (
                  <div className="rounded-xl border-2 border-brand/40 bg-brand/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                        <FolderOpen className="w-4 h-4" /> {lotes[loteAtivo].nome} · {lotes[loteAtivo].arquivos.length} arquivo(s)
                      </span>
                      <button type="button" onClick={() => setLoteAtivo(null)} className="text-xs text-muted-foreground hover:text-foreground">
                        Fechar lote
                      </button>
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-brand/50 py-5 text-sm text-brand hover:bg-brand/10 transition-colors w-full">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? "Enviando…" : "Enviar arquivos para este lote"}
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFiles} />
                    {lotes[loteAtivo].arquivos.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {lotes[loteAtivo].arquivos.map((url) => (
                          <div key={url} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1">{fileName(url)}</span>
                            <button type="button" onClick={() => removerArquivoDeLote(loteAtivo, url)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {lotes.length > 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Deseja criar mais um lote ou finalizar? Envie novos arquivos acima para o próximo lote, ou clique em <span className="font-medium text-foreground">Criar envelope</span> para finalizar.</p>
                  </div>
                )}

                {lotes.length > 0 && (
                  <div className="space-y-3">
                    {lotes.map((lote, li) => (
                      loteAtivo === li ? null : (
                        <div key={li} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <button type="button" onClick={() => setLoteAtivo(li)} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-brand">
                              <FolderOpen className="w-4 h-4 text-muted-foreground" /> {lote.nome} · {lote.arquivos.length} arquivo(s)
                            </button>
                            <button type="button" onClick={() => removerLote(li)} className="text-muted-foreground hover:text-destructive text-xs">
                              Remover lote
                            </button>
                          </div>
                          {lote.arquivos.length > 0 ? (
                            <div className="space-y-1.5">
                              {lote.arquivos.map((url) => (
                                <div key={url} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate flex-1">{fileName(url)}</span>
                                  <button type="button" onClick={() => removerArquivoDeLote(li, url)} className="text-muted-foreground hover:text-destructive">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Lote vazio — clique para abrir e enviar arquivos</p>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button type="submit" disabled={saving || (arquivosIndividuais.length === 0 && lotes.flatMap((l) => l.arquivos).length === 0)} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {verificando ? "Verificando duplicidade…" : "Criar envelope"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <CapturaMobileDialog
        open={capturaMobileOpen}
        onClose={() => setCapturaMobileOpen(false)}
        formData={form}
        arquivosIniciais={arquivosIndividuais}
        onConcluido={() => navigate("/")}
      />
      <DuplicidadeDialog
        open={showDuplicidade}
        duplicidades={pendDuplicidade?.duplicidades || []}
        criando={criandoDocumento}
        onCancel={() => { setShowDuplicidade(false); setPendDuplicidade(null); }}
        onConfirm={confirmarDuplicidade}
      />
    </div>
  );
}