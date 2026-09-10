import React from "react";
import { User, AlertTriangle, FileText } from "lucide-react";

export default function GestorBanner({ docs, signedCountFor, hasPendente }) {
  const grupos = {};
  docs.forEach((d) => {
    const key = d.signatario_nome || "Sem gestor";
    if (!grupos[key]) grupos[key] = { envelopes: 0, arquivosPend: 0, arquivosTotal: 0, comPendencia: 0 };
    grupos[key].envelopes++;
    const total = d.arquivos?.length || 0;
    const signed = signedCountFor(d.id);
    grupos[key].arquivosPend += Math.max(0, total - signed);
    grupos[key].arquivosTotal += total;
    if (hasPendente(d)) grupos[key].comPendencia++;
  });
  const chaves = Object.keys(grupos).sort();

  if (!chaves.length) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-blue-700" />
        <p className="text-sm font-medium text-blue-900">Pendências por gestor</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {chaves.map((key) => {
          const g = grupos[key];
          return (
            <div key={key} className="rounded-xl bg-background border border-border/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-medium text-sm truncate">{key}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {g.envelopes} envelope(s)</span>
                <span>{g.arquivosPend} arquivo(s) pendente(s) de {g.arquivosTotal}</span>
                {g.comPendencia > 0 && <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle className="w-3 h-3" /> {g.comPendencia} c/ pendência</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}