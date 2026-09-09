import React, { useState } from "react";
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
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    destinatario_nome: "",
    destinatario_email: "",
    data_limite: "",
  });

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
      await base44.entities.Documento.create({
        ...form,
        arquivos,
        status: "pendente",
        pasta: "recentes",
      });
      toast({ title: "Documento criado" });
      navigate("/");
    } catch {
      toast({ title: "Erro ao criar documento", variant: "destructive" });
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
        <h1 className="text-3xl font-heading tracking-tight mb-1">Novo documento</h1>
        <p className="text-muted-foreground mb-8">Crie uma solicitação de assinatura e anexe quantos arquivos precisar.</p>

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input id="titulo" value={form.titulo} onChange={update("titulo")} placeholder="Contrato de prestação de serviços" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={form.descricao} onChange={update("descricao")} rows={3} placeholder="Resumo do documento a ser assinado" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="destinatario_nome">Destinatário</Label>
                  <Input id="destinatario_nome" value={form.destinatario_nome} onChange={update("destinatario_nome")} placeholder="Nome do signatário" />
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
                  Criar solicitação
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}