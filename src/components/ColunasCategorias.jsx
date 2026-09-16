import React from "react";
import { Link } from "react-router-dom";
import { FileText, Fuel, ChevronRight } from "lucide-react";

const statusInfo = (status) => {
  switch (status) {
    case "pendente_gestao": return { label: "Pendente gestão", cls: "bg-amber-100 text-amber-700" };
    case "assinado_gestao": return { label: "Assinado gestão", cls: "bg-blue-100 text-blue-700" };
    case "pendente_diretoria": return { label: "Pendente diretoria", cls: "bg-purple-100 text-purple-700" };
    case "assinado_diretoria": return { label: "Concluído", cls: "bg-emerald-100 text-emerald-700" };
    default: return { label: status || "—", cls: "bg-muted text-muted-foreground" };
  }
};

function Coluna({ titulo, Icon, headerClass, docs, linkPara }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`rounded-t-xl px-4 py-2.5 ${headerClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="font-heading font-semibold text-sm">{titulo}</h3>
          <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">{docs.length}</span>
        </div>
      </div>
      <div className="border border-t-0 border-border/60 rounded-b-xl p-2 space-y-1.5 min-h-[80px] bg-card/50">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum envelope.</p>
        ) : (
          docs.map((d) => {
            const si = statusInfo(d.status);
            return (
              <Link key={d.id} to={linkPara(d)} className="block">
                <div className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.numero && <span className="text-[10px] font-mono text-muted-foreground">{d.numero}</span>}
                      {d.signatario_nome && <span className="text-[10px] text-muted-foreground truncate">{d.signatario_nome}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${si.cls}`}>{si.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ColunasCategorias({ documentos, linkPara }) {
  const notasBoletos = documentos.filter((d) => (d.categoria || "notas_boletos") === "notas_boletos" && d.status !== "assinado_diretoria");
  const abastecimento = documentos.filter((d) => d.categoria === "abastecimento" && d.status !== "assinado_diretoria");

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <Coluna titulo="Notas e Boletos" Icon={FileText} headerClass="bg-blue-600 text-white" docs={notasBoletos} linkPara={linkPara} />
      <Coluna titulo="Envelopes Abastecimentos" Icon={Fuel} headerClass="bg-amber-600 text-white" docs={abastecimento} linkPara={linkPara} />
    </div>
  );
}