import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Upload, X, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function NovoDocumento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [cadastros, setCadastros] = useState([]);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    destinatario_nome: "",
    destinatario_email: "",
    signatario_nome: "",
    signatario_email: "",
    signatario_cadastro_id: "",
    diretoria: "",
    unidade_negocio: "",
    data_limite: "",
  });

  useEffect(() => {
    base44.entities.Cadastro.list("-created_date", 200).then(setCadastros).catch(() => {});
  }, []);

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
      signatario_cadastro_id: c ? c.id : f.signatario_cadastro_id,
      signatario_nome: c ? c.nome : f.signatario_nome,
      signatario_email: c && c.email ? c.email : f.signatario_email,
    }));
  };

  const pessoas = cadastros.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo));

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => base44.integrations.Core.UploadFile({ file }))
      );
      setArquivos((prev) => [...prev, ...uploaded.map((u) => u.file_url)]);
      toast({ title: `${files.length} arquivo(s) enviado(s)` });
    } catch {
      toast({ title: "Falha no envio", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeArquivo = (url) => setArquivos((prev) => prev.filter((u) => u !== url));
  const fileName = (url) => decodeURIComponent(url.split("/").pop() || "arquivo").slice(0, 40);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      const all = await base44.entities.Documento.list("-created_date", 1000);
      const numero = `ENV-${String((all.length || 0) + 1).padStart(4, "0")}`;
      const created = await base44.entities.Documento.create({
        ...form,
        numero,
        arquivos,
        status: "pendente_gestao",
        pasta: "pendente",
      });
      toast({ title: "Envelope criado", description: numero });
      if (created && created.destinatario_email) {
        base44.functions.invoke("enviarAlertaDestinatario", { documentoId: created.id }).catch(() => {});
      }
      navigate("/");
    } catch {
      toast({ title: "Erro ao criar envelope", variant: "destructive" });
    } finally {
      setSaving(false);
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
                <Label htmlFor="signatario">Signatário (pasta pendente será gerada para ele)</Label>
                <select id="signatario" value={form.signatario_cadastro_id} onChange={onSignatarioChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— Selecionar do cadastro —</option>
                  {cadastros.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo)).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <Input value={form.signatario_nome} onChange={update("signatario_nome")} placeholder="Ou digite o nome do signatário" className="mt-2" />
                <Input type="email" value={form.signatario_email} onChange={update("signatario_email")} placeholder="E-mail do signatário" className="mt-2" />
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
              <div className="space-y-2">
                <Label>Anexos (múltiplos)</Label>
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Enviando…" : "Clique para enviar um ou mais arquivos"}
                  <input type="file" className="hidden" multiple onChange={handleFiles} />
                </label>
                {arquivos.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {arquivos.map((url) => (
                      <div key={url} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{fileName(url)}</span>
                        <button type="button" onClick={() => removeArquivo(url)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Criar envelope
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}