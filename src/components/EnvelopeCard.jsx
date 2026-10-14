import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, Loader2, Send, Download, Trash2, AlertTriangle, ShieldCheck, Ban } from "lucide-react";
import { formatDate } from "@/lib/signatureUtils";
import ShareIcons from "@/components/ShareIcons";
import { stageStyles, stageLabel } from "@/lib/stageStyles";
import { signatarioRedirecionado } from "@/lib/redirecionamentoAssinatura";

export default function EnvelopeCard({
  d,
  signedCount,
  hasPendente,
  linkPara,
  onEnviarDiretoria,
  onBaixar,
  onExcluir,
  enviandoId,
  downloadingId,
}) {
  const signed = signedCount;
  const total = d.arquivos?.length || 0;
  const pendente = hasPendente;
  const recusado = !!d.recusado;
  return (
    <Card className={`rounded-xl transition-all hover:shadow-md ${recusado ? "border-amber-400 bg-amber-50/60 hover:border-amber-500" : pendente ? "border-red-400 bg-red-50/40 hover:border-red-500" : "border-border/60 hover:border-foreground/20"}`}>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <Link to={linkPara(d)} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {d.numero && <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.numero}</span>}
            <p className="font-medium truncate">{d.titulo}</p>
            {recusado && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full"><Ban className="w-3 h-3" /> NF recusada</span>}
            {pendente && !recusado && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Arquivo pendente</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {signed}/{total} assinadas</span>
            {d.destinatario_nome && <span>Dest.: {d.destinatario_nome}</span>}
            {d.signatario_nome && <span>Gestão: {d.signatario_nome}</span>}
            {d.diretoria && <span>Diretoria: {d.diretoria}</span>}
            {d.unidade_negocio && <span>UN: {d.unidade_negocio}</span>}
            {d.data_limite && <span>{formatDate(d.data_limite)}</span>}
          </p>
          {recusado && d.observacao_recusa && (
            <p className="text-xs text-amber-800 mt-1.5 flex items-start gap-1.5">
              <Ban className="w-3 h-3 mt-0.5 shrink-0" />
              <span><span className="font-medium">NF(s) recusada(s): </span>{d.observacao_recusa}</span>
            </p>
          )}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {d.status === "assinado_gestao" && (
            <button type="button" onClick={() => onEnviarDiretoria(d)} disabled={enviandoId === d.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50" title={signatarioRedirecionado(d.signatario_nome) ? "Enviar para Joselio Serur" : "Enviar para assinatura da diretoria"}>
              {enviandoId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {signatarioRedirecionado(d.signatario_nome) ? "Enviar a Joselio" : "Enviar à diretoria"}
            </button>
          )}
          {d.status === "pendente_diretoria" && (
            <Link to={`/assinar-diretoria/${d.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700" title="Assinar como diretoria">
              <ShieldCheck className="w-3.5 h-3.5" /> Diretoria
            </Link>
          )}
          {d.status !== "pendente_gestao" && (
            <button type="button" onClick={() => onBaixar(d)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Baixar envelope (PDF)">
              {downloadingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
          )}
          <button type="button" onClick={() => onExcluir(d)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive" title="Excluir envelope">
            <Trash2 className="w-4 h-4" />
          </button>
          <ShareIcons title={d.titulo} signUrl={`${window.location.origin}${linkPara(d)}`} />
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stageStyles[d.status] || "bg-slate-100 text-slate-600"}`}>{stageLabel[d.status] || d.status}</span>
        </div>
      </CardContent>
    </Card>
  );
}