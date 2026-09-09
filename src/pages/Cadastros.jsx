import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Loader2, Mail, Phone, Building2, Briefcase, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const tipoLabel = { signatario: "Signatário", destinatario: "Destinatário", ambos: "Ambos" };

const TABS = [
  { key: "pessoas", label: "Pessoas" },
  { key: "unidade", label: "Unidades" },
  { key: "operacao", label: "Operações" },
  { key: "diretoria", label: "Diretorias" },
];

export default function Cadastros() {
  const { toast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pessoas");
  const [pessoa, setPessoa] = useState({ nome: "", email: "", telefone: "", tipo: "ambos", unidade_negocio: "", operacao: "", diretoria: "" });
  const [simples, setSimples] = useState({ unidade: "", operacao: "", diretoria: "" });
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const data = await base44.entities.Cadastro.list("-created_date", 200); setLista(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pessoas = lista.filter((c) => ["signatario", "destinatario", "ambos"].includes(c.tipo));
  const unidades = lista.filter((c) => c.tipo === "unidade");
  const operacoes = lista.filter((c) => c.tipo === "operacao");
  const diretorias = lista.filter((c) => c.tipo === "diretoria");

  const updP = (k) => (e) => setPessoa((f) => ({ ...f, [k]: e.target.value }));

  const submitPessoa = async (e) => {
    e.preventDefault();
    if (!pessoa.nome.trim()) return;
    setSaving("pessoa");
    try {
      await base44.entities.Cadastro.create(pessoa);
      setPessoa({ nome: "", email: "", telefone: "", tipo: "ambos", unidade_negocio: "", operacao: "", diretoria: "" });
      toast({ title: "Pessoa cadastrada" });
      load();
    } catch { toast({ title: "Erro ao cadastrar", variant: "destructive" }); }
    finally { setSaving(null); }
  };

  const submitSimples = async (tipo) => {
    const nome = simples[tipo].trim();
    if (!nome) return;
    setSaving(tipo);
    try {
      await base44.entities.Cadastro.create({ nome, tipo });
      setSimples((s) => ({ ...s, [tipo]: "" }));
      toast({ title: "Cadastro criado" });
      load();
    } catch { toast({ title: "Erro ao cadastrar", variant: "destructive" }); }
    finally { setSaving(null); }
  };

  const remove = async (id) => { await base44.entities.Cadastro.delete(id); load(); };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">← Voltar</Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><Users className="w-4 h-4" /> Cadastros</div>
        <h1 className="text-3xl font-heading tracking-tight mb-1">Cadastros</h1>
        <p className="text-muted-foreground mb-8">Pessoas, unidades de negócio, operações e diretorias — todos na mesma base.</p>

        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
          ))}
        </div>

        {tab === "pessoas" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="rounded-2xl border-border/60 h-fit">
              <CardContent className="p-5">
                <h2 className="font-heading mb-4">Nova pessoa</h2>
                <form onSubmit={submitPessoa} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" value={pessoa.nome} onChange={updP("nome")} required /></div>
                  <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={pessoa.email} onChange={updP("email")} /></div>
                  <div className="space-y-2"><Label htmlFor="telefone">Telefone</Label><Input id="telefone" value={pessoa.telefone} onChange={updP("telefone")} placeholder="(11) 99999-9999" /></div>
                  <div className="space-y-2"><Label htmlFor="unidade_negocio">Unidade de negócio</Label>
                    <select id="unidade_negocio" value={pessoa.unidade_negocio} onChange={updP("unidade_negocio")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">—</option>{unidades.map((u) => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="operacao">Operação</Label>
                    <select id="operacao" value={pessoa.operacao} onChange={updP("operacao")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">—</option>{operacoes.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="diretoria">Diretoria</Label>
                    <select id="diretoria" value={pessoa.diretoria} onChange={updP("diretoria")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">—</option>{diretorias.map((d) => <option key={d.id} value={d.nome}>{d.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="tipo">Tipo</Label>
                    <select id="tipo" value={pessoa.tipo} onChange={updP("tipo")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="ambos">Ambos</option><option value="signatario">Signatário</option><option value="destinatario">Destinatário</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={saving === "pessoa"} className="w-full gap-2">{saving === "pessoa" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar</Button>
                </form>
              </CardContent>
            </Card>
            <div className="lg:col-span-2 space-y-3">
              {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                : pessoas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p>
                : pessoas.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="rounded-xl border-border/60"><CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.nome}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                          {c.telefone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.telefone}</span>}
                          {c.unidade_negocio && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {c.unidade_negocio}</span>}
                          {c.operacao && <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> {c.operacao}</span>}
                          {c.diretoria && <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {c.diretoria}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{tipoLabel[c.tipo] || c.tipo}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(c.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent></Card>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {tab !== "pessoas" && (
          <SimplesTab tipo={tab} titulo={tab === "unidade" ? "Unidade de negócio" : tab === "operacao" ? "Operação" : "Diretoria"} placeholder={tab === "unidade" ? "Ex.: Operações" : tab === "operacao" ? "Ex.: Vendas" : "Ex.: Diretoria Financeira"} icone={tab === "unidade" ? Building2 : tab === "operacao" ? Briefcase : ShieldCheck} itens={tab === "unidade" ? unidades : tab === "operacao" ? operacoes : diretorias} valor={simples[tab]} onChange={(e) => setSimples((s) => ({ ...s, [tab]: e.target.value }))} onSubmit={() => submitSimples(tab)} onRemove={remove} saving={saving === tab} loading={loading} />
        )}
      </div>
    </div>
  );
}

function SimplesTab({ tipo, titulo, placeholder, icone: Icone, itens, valor, onChange, onSubmit, onRemove, saving, loading }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-border/60 h-fit">
        <CardContent className="p-5">
          <h2 className="font-heading mb-4">Nova {titulo.toLowerCase()}</h2>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor={tipo}>Nome *</Label><Input id={tipo} value={valor} onChange={onChange} placeholder={placeholder} required /></div>
            <Button type="submit" disabled={saving} className="w-full gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar</Button>
          </form>
        </CardContent>
      </Card>
      <div className="lg:col-span-2 space-y-3">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          : itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
          : itens.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="rounded-xl border-border/60"><CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0"><Icone className="w-4 h-4 text-muted-foreground shrink-0" /><p className="font-medium truncate">{c.nome}</p></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(c.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
              </CardContent></Card>
            </motion.div>
          ))}
      </div>
    </div>
  );
}