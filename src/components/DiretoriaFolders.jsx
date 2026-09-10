import React, { useState } from "react";
import { Folder, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import EnvelopeCard from "@/components/EnvelopeCard";

export default function DiretoriaFolders({ docs, signedCountFor, hasPendente, linkPara, onEnviarDiretoria, onBaixar, onExcluir, enviandoId, downloadingId }) {
  const grupos = {};
  docs.forEach((d) => {
    const key = d.diretoria || "Sem diretoria";
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(d);
  });
  const chaves = Object.keys(grupos).sort();
  const [abertas, setAbertas] = useState(() => Object.fromEntries(chaves.map((k, i) => [k, i === 0])));

  return (
    <div className="space-y-3">
      {chaves.map((key) => {
        const items = grupos[key];
        const pendentes = items.filter((d) => hasPendente(d)).length;
        return (
          <Collapsible key={key} open={abertas[key]} onOpenChange={(o) => setAbertas((s) => ({ ...s, [key]: o }))}>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-purple-50/60 hover:bg-purple-50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-medium truncate">{key}</span>
                    <span className="text-xs text-muted-foreground">{items.length} envelope(s)</span>
                    {pendentes > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{pendentes} c/ pendência</span>}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${abertas[key] ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 space-y-3 bg-background">
                  {items.map((d) => (
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
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}