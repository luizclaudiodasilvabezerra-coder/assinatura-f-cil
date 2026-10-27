import React from "react";
import { FileText, Fuel } from "lucide-react";
import EnvelopeCard from "@/components/EnvelopeCard";

function Coluna({ titulo, Icon, headerClass, docs, signedCountFor, hasPendente, linkPara, onEnviarDiretoria, onBaixar, onExcluir, enviandoId, downloadingId, somenteVisualizacao }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`rounded-t-xl px-4 py-2.5 ${headerClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="font-heading font-semibold text-sm">{titulo}</h3>
          <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">{docs.length}</span>
        </div>
      </div>
      <div className="border border-t-0 border-border/60 rounded-b-xl p-2 space-y-2 min-h-[80px] bg-card/30">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum envelope.</p>
        ) : (
          docs.map((d) => (
            <EnvelopeCard
              key={d.id}
              d={d}
              signedCount={signedCountFor(d.id)}
              hasPendente={hasPendente(d)}
              linkPara={linkPara}
              onEnviarDiretoria={onEnviarDiretoria}
              onBaixar={onBaixar}
              onExcluir={onExcluir}
              enviandoId={enviandoId}
              downloadingId={downloadingId}
              somenteVisualizacao={somenteVisualizacao}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ColunasCategorias({ documentos, signedCountFor, hasPendente, linkPara, onEnviarDiretoria, onBaixar, onExcluir, enviandoId, downloadingId, somenteVisualizacao }) {
  const notasBoletos = documentos.filter((d) => (d.categoria || "notas_boletos") === "notas_boletos" && d.status !== "assinado_diretoria");
  const abastecimento = documentos.filter((d) => d.categoria === "abastecimento" && d.status !== "assinado_diretoria");

  const colunaProps = { signedCountFor, hasPendente, linkPara, onEnviarDiretoria, onBaixar, onExcluir, enviandoId, downloadingId, somenteVisualizacao };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <Coluna titulo="Notas e Boletos" Icon={FileText} headerClass="bg-blue-600 text-white" docs={notasBoletos} {...colunaProps} />
      <Coluna titulo="Envelopes Abastecimentos" Icon={Fuel} headerClass="bg-amber-600 text-white" docs={abastecimento} {...colunaProps} />
    </div>
  );
}