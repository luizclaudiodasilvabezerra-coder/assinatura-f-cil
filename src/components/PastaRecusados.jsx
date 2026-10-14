import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, FileText, ChevronDown, ChevronRight, FilePlus2, Loader2, User, Trash2, ShieldCheck, Lock, Eye, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { SENHA_MASTER_RECUSA } from "@/lib/acessos";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

const formatData = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function PastaRecusados({ recusados = [], documentos = [], linkPara, onExcluir, onRecuperou }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [abertos, setAbertos] = useState({});
  const [gerando, setGerando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [acao, setAcao] = useState(null); // { tipo: "inserir"|"excluir", rec }
  const [senha, setSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);

  const docById = useMemo(() => {
    const m = {};
    documentos.forEach((d) => { m[d.id] = d; });
    return m;
  }, [documentos]);

  const grupos = useMemo(() => {
    const m = {};
    recusados.forEach((r) => {
      if (!m[r.documento_id]) m[r.documento_id] = [];
      m[r.documento_id].push(r);
    });
    return Object.entries(m);
  }, [recusados]);

  const toggle = (id) => setAbertos((s) => ({ ...s, [id]: !s[id] }));

  const pedirSenha = (tipo, rec) => { setAcao({ tipo, rec }); setSenha(""); setSenhaErro(false); };

  const confirmarAcao = async () => {
    if (senha !== SENHA_MASTER_RECUSA) { setSenhaErro(true); return; }
    const { tipo, rec } = acao;
    setAcao(null);
    if (tipo === "inserir") await inserirNovoEnvelope(rec);
    else await excluirArquivo(rec);
  };

  const inserirNovoEnvelope = async (rec) => {
    setGerando(rec.id);
    try {
      const d = docById[rec.documento_id];
      const novo = await base44.entities.Documento.create({
        titulo: d?.titulo ? `${d.titulo} (reenvio)` : "Envelope reenvio",
        descricao: d?.descricao || "",
        numero: d?.numero || "",
        arquivos: [rec.arquivo_url],
        status: "pendente_gestao",
        pasta: "pendente",
        destinatario_nome: d?.destinatario_nome || "",
        destinatario_email: d?.destinatario_email || "",
        categoria: d?.categoria || "notas_boletos",
        fluxo_hierarquico: d?.fluxo_hierarquico || false,
        signatario_nome: d?.signatario_origem_nome || d?.signatario_nome || "",
        signatario_email: d?.signatario_origem_email || d?.signatario_email || "",
        signatario_cadastro_id: d?.signatario_origem_cadastro_id || d?.signatario_cadastro_id || "",
        diretoria: d?.diretoria || "",
        unidade_negocio: d?.unidade_negocio || "",
        operacao: d?.operacao || "",
        data_limite: d?.data_limite || "",
        processado: false,
        recusado: false,
        observacao_recusa: "",
      });
      await base44.entities.ArquivoRecusado.delete(rec.id);
      toast({ title: "Novo envelope criado", description: "A NF recusada foi inserida em um novo envelope." });
      onRecuperou?.();
      navigate(`/assinar/${novo.id}`);
    } catch (e) {
      toast({ title: "Erro ao gerar envelope", description: e.message, variant: "destructive" });
    } finally {
      setGerando(null);
    }
  };

  const excluirArquivo = async (rec) => {
    setExcluindo(rec.id);
    try {
      await base44.entities.ArquivoRecusado.delete(rec.id);
      toast({ title: "Arquivo excluído", description: "A NF recusada foi removida da pasta." });
      onRecuperou?.();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setExcluindo(null);
    }
  };

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma NF recusada.</p>;
  }

  return (
    <div className="space-y-3">
      {grupos.map(([docId, recs]) => {
        const d = docById[docId];
        const open = abertos[docId] ?? true;
        const gestor = recs.find((r) => r.gestor)?.gestor || d?.signatario_nome || "";
        return (
          <Card key={docId} className="rounded-xl border-amber-400 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => toggle(docId)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  {open ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4 text-amber-700" />}
                  <Ban className="w-4 h-4 text-amber-600" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d?.titulo || recs[0]?.documento_titulo || "Envelope"}{d?.numero ? ` · ${d.numero}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{recs.length} NF recusada{recs.length > 1 ? "s" : ""}</p>
                  </div>
                </button>
              </div>

              {gestor && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-900 bg-amber-100/70 rounded-md px-2 py-1">
                  <User className="w-3.5 h-3.5" /> Gestor: <span className="font-medium">{gestor}</span>
                </div>
              )}

              {open && (
                <div className="mt-3 space-y-2">
                  {recs.map((r) => (
                    <div key={r.id} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" /> {fileName(r.arquivo_url)}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <a href={r.arquivo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Eye className="w-3.5 h-3.5" /> Visualizar
                          </a>
                          <a href={r.arquivo_url} download={fileName(r.arquivo_url)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Baixar
                          </a>
                          <button type="button" onClick={() => pedirSenha("inserir", r)} disabled={gerando === r.id || excluindo === r.id} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:opacity-50">
                            {gerando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />} Inserir em novo envelope
                          </button>
                          <button type="button" onClick={() => pedirSenha("excluir", r)} disabled={gerando === r.id || excluindo === r.id} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50">
                            {excluindo === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Excluir
                          </button>
                        </div>
                      </div>
                      {r.data_recusa && (
                        <p className="text-xs text-amber-800 mt-1.5">Recusado em {formatData(r.data_recusa)}</p>
                      )}
                      {r.observacao && (
                        <p className="text-xs text-amber-800 mt-1"><span className="font-medium">Obs.: </span>{r.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!acao} onOpenChange={(o) => { if (!o) setAcao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" /> Confirmação com senha master</DialogTitle>
            <DialogDescription>
              {acao?.tipo === "inserir"
                ? "Informe a senha master para inserir esta NF em um novo envelope."
                : "Informe a senha master para excluir esta NF recusada."}
            </DialogDescription>
          </DialogHeader>
          <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setSenhaErro(false); }} placeholder="Senha master" autoFocus onKeyDown={(e) => { if (e.key === "Enter") confirmarAcao(); }} />
          {senhaErro && <p className="text-sm text-destructive">Senha incorreta.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcao(null)}>Cancelar</Button>
            <Button onClick={confirmarAcao} className="gap-2"><ShieldCheck className="w-4 h-4" /> Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}