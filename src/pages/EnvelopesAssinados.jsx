import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, PackageCheck, Lock, ShieldCheck, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";
import { validarSenhaConcluidos, CONCLUIDOS_LABEL } from "@/lib/acessos";
import { useAuth } from "@/lib/AuthContext";
import { podeAcessarConcluidos } from "@/lib/permissoes";
import PastaConcluidos from "@/components/PastaConcluidos";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";

export default function EnvelopesAssinados() {
  const { tipo } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);

  const [docs, setDocs] = useState([]);
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroProc, setFiltroProc] = useState(""); // "" | "processado" | "nao"
  const [filtroGestor, setFiltroGestor] = useState("");
  const [filtroDiretoria, setFiltroDiretoria] = useState("");

  const label = CONCLUIDOS_LABEL[tipo] || "Concluídos";
  const splitDiretoria = tipo === "financeiro";
  const autorizado = podeAcessarConcluidos(user, tipo);

  useEffect(() => {
    if (autorizado) setUnlocked(true);
  }, [autorizado]);

  const validar = (e) => {
    e.preventDefault();
    if (validarSenhaConcluidos(tipo, senha)) { setUnlocked(true); setSenhaErro(false); }
    else setSenhaErro(true);
  };

  const load = async () => {
    try {
      const statusList = splitDiretoria ? ["assinado_diretoria", "pendente_diretoria"] : ["assinado_diretoria"];
      const [d, s] = await Promise.all([
        Promise.all(statusList.map((st) => base44.entities.Documento.filter({ status: st }, "-created_date", 200))).then((r) => r.flat()),
        base44.entities.Assinatura.list("-created_date", 1000),
      ]);
      setDocs(d);
      setSigs(s);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (unlocked) load(); }, [unlocked]);

  const gestores = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => d.signatario_nome && set.add(d.signatario_nome));
    return Array.from(set);
  }, [docs]);

  const diretorias = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => d.diretoria && set.add(d.diretoria));
    return Array.from(set);
  }, [docs]);

  const aplicarFiltros = (lista) => lista.filter((d) => {
    if (filtroProc === "processado" && !d.processado) return false;
    if (filtroProc === "nao" && d.processado) return false;
    if (filtroGestor && d.signatario_nome !== filtroGestor) return false;
    if (filtroDiretoria && d.diretoria !== filtroDiretoria) return false;
    return true;
  });

  const concluidas = useMemo(() => aplicarFiltros(docs.filter((d) => d.status === "assinado_diretoria")), [docs, filtroProc, filtroGestor, filtroDiretoria]);
  const naoConcluidas = useMemo(() => aplicarFiltros(docs.filter((d) => d.status === "pendente_diretoria")), [docs, filtroProc, filtroGestor, filtroDiretoria]);
  const docsFiltrados = splitDiretoria ? [...concluidas, ...naoConcluidas] : concluidas;

  const responsavel = () => user?.email || user?.full_name || "—";

  const processar = async (d) => {
    const agora = new Date().toISOString();
    const resp = responsavel();
    await base44.entities.Documento.update(d.id, { processado: true, data_processamento: agora, processado_por: resp });
    setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, processado: true, data_processamento: agora, processado_por: resp } : x)));
    toast({ title: "Envelope processado", description: "Processamento registrado." });
  };

  const darBaixa = async (ids) => {
    const agora = new Date().toISOString();
    const resp = responsavel();
    await base44.entities.Documento.bulkUpdate(ids.map((id) => ({ id, processado: true, data_processamento: agora, processado_por: resp })));
    const idSet = new Set(ids);
    setDocs((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, processado: true, data_processamento: agora, processado_por: resp } : x)));
    toast({ title: "Baixa registrada", description: `${ids.length} envelope(s) processado(s) por ${resp}.` });
  };

  const concluirManual = async (docId) => {
    await base44.entities.Documento.update(docId, { status: "assinado_diretoria" });
    setDocs((prev) => prev.map((x) => (x.id === docId ? { ...x, status: "assinado_diretoria" } : x)));
    toast({ title: "Envelope concluído", description: "Autorização manual registrada. Envelope movido para assinaturas concluídas." });
  };

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-heading mb-2">Acesso não autorizado</h1>
          <p className="text-sm text-muted-foreground mb-6">Você não tem permissão para acessar esta pasta.</p>
          <Button asChild variant="outline"><Link to="/">Voltar ao painel</Link></Button>
        </motion.div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading text-center mb-1">{label}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Informe a senha para acessar os envelopes concluídos.</p>
          <form onSubmit={validar} className="space-y-3">
            <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setSenhaErro(false); }} placeholder="Senha" autoFocus />
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <UIImage src={LOGO_URL} alt="LOGMAM transportes" className="h-16 w-auto object-contain" />
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-emerald-600 mb-2"><PackageCheck className="w-4 h-4" /> Módulo de envelopes concluídos</div>
            <h1 className="text-3xl font-heading tracking-tight">{label}</h1>
            <p className="text-muted-foreground mt-2">Histórico de envelopes assinados pela diretoria. Exportação individual ou em massa.</p>
          </div>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="w-4 h-4" /> Filtros:</div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Processamento</label>
            <select value={filtroProc} onChange={(e) => setFiltroProc(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              <option value="processado">Processado</option>
              <option value="nao">Não processado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Gestor</label>
            <select value={filtroGestor} onChange={(e) => setFiltroGestor(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Diretoria</label>
            <select value={filtroDiretoria} onChange={(e) => setFiltroDiretoria(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todas</option>
              {diretorias.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : splitDiretoria ? (
          <div className="space-y-2">
            <PastaConcluidos titulo="Assinaturas Concluídas pela Diretoria" docs={concluidas} sigs={sigs} accent="emerald" showProcessar onProcessar={processar} onDarBaixa={darBaixa} />
            <PastaConcluidos titulo="Não Concluídas pela Diretoria" docs={naoConcluidas} sigs={sigs} accent="amber" showConcluirManual onConcluirManual={concluirManual} />
          </div>
        ) : docsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum envelope com os filtros selecionados.</p>
        ) : (
          <PastaConcluidos titulo="Assinaturas Concluídas pela Diretoria" docs={docsFiltrados} sigs={sigs} accent="emerald" showProcessar onProcessar={processar} onDarBaixa={darBaixa} />
        )}
      </div>
    </div>
  );
}