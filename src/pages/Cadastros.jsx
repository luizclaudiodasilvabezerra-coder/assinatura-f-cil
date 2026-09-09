import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Loader2, Mail, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const tipoLabel = { signatario: "Signatário", destinatario: "Destinatário", ambos: "Ambos" };

export default function Cadastros() {
  const { toast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", tipo: "ambos" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Cadastro.list("-created_date", 100);
      setLista(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await base44.entities.Cadastro.create(form);
      setForm({ nome: "", email: "", telefone: "", tipo: "ambos" });
      toast({ title: "Cadastro criado" });
      load();
    } catch {
      toast({ title: "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await base44.entities.Cadastro.delete(id);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">← Voltar</Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><Users className="w-4 h-4" /> Cadastros</div>
        <h1 className="text-3xl font-heading tracking-tight mb-1">Signatários e destinatários</h1>
        <p className="text-muted-foreground mb-8">Cadastre as pessoas que aparecem na lista suspensa ao assinar documentos.</p>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="rounded-2xl border-border/60 lg:col-span-1 h-fit">
            <CardContent className="p-5">
              <h2 className="font-heading mb-4">Novo cadastro</h2>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" value={form.nome} onChange={update("nome")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={form.email} onChange={update("email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" value={form.telefone} onChange={update("telefone")} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select id="tipo" value={form.tipo} onChange={update("tipo")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="ambos">Ambos</option>
                    <option value="signatario">Signatário</option>
                    <option value="destinatario">Destinatário</option>
                  </select>
                </div>
                <Button type="submit" disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : lista.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
            ) : (
              lista.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="rounded-xl border-border/60">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.nome}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                          {c.telefone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.telefone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{tipoLabel[c.tipo] || c.tipo}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(c.id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}