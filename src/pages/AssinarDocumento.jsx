import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileText, CheckCircle2, Calendar, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SignaturePad from "@/components/SignaturePad";
import { dataURLToFile, formatDate } from "@/lib/signatureUtils";

export default function AssinarDocumento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const padRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ assinante_nome: "", assinante_email: "", observacao: "" });

  useEffect(() => {
    (async () => {
      try {
        const d = await base44.entities.Documento.get(id);
        setDoc(d);
        if (d.destinatario_nome) setForm((f) => ({ ...f, assinante_nome: d.destinatario_nome }));
        if (d.destinatario_email) setForm((f) => ({ ...f, assinante_email: d.destinatario_email }));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.assinante_nome.trim()) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return;
    }
    if (padRef.current?.isEmpty()) {
      toast({ title: "Desenhe sua assinatura", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const dataURL = padRef.current.getDataURL();
      const file = dataURLToFile(dataURL, "assinatura.png");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Assinatura.create({
        documento_id: id,
        documento_titulo: doc.titulo,
        assinante_nome: form.assinante_nome,
        assinante_email: form.assinante_email,
        observacao: form.observacao,
        imagem_url: file_url,
        status: "assinado",
        data_assinatura: new Date().toISOString(),
      });
      await base44.entities.Documento.update(id, { status: "assinado" });
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
          <p className="text-muted-foreground mb-6">Sua assinatura foi salva no log e o documento marcado como assinado.</p>
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
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileText className="w-4 h-4" /> Documento para assinatura
          </div>
          <h1 className="text-3xl font-heading tracking-tight">{doc.titulo}</h1>
          {doc.descricao && <p className="text-muted-foreground mt-2">{doc.descricao}</p>}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            {doc.destinatario_nome && <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {doc.destinatario_nome}</span>}
            {doc.data_limite && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(doc.data_limite)}</span>}
          </div>
        </div>

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assinante_nome">Nome do assinante *</Label>
                  <Input id="assinante_nome" value={form.assinante_nome} onChange={update("assinante_nome")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assinante_email">E-mail</Label>
                  <Input id="assinante_email" type="email" value={form.assinante_email} onChange={update("assinante_email")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assinatura *</Label>
                <SignaturePad ref={padRef} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea id="observacao" value={form.observacao} onChange={update("observacao")} rows={2} placeholder="Comentário sobre a assinatura" />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar assinatura
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}