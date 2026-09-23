import React, { useState } from "react";
import { Folder, FolderOpen, CheckCircle2, ChevronDown } from "lucide-react";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function LoteFolders({ lotes, arquivos, signedMap, currentIndex, onSelect, getUrl }) {
  const urlOf = getUrl || ((item, i) => (typeof item === "string" ? item : item?.arquivo_original_url || item?.arquivo_url || ""));
  const [openLotes, setOpenLotes] = useState(() => {
    const init = {};
    if (lotes && lotes.length) {
      const currentUrl = urlOf(arquivos[currentIndex], currentIndex);
      lotes.forEach((l, i) => {
        init[`lote-${i}`] = !!(currentUrl && l.arquivos?.includes(currentUrl));
      });
    }
    return init;
  });

  const toggle = (key) => setOpenLotes((s) => ({ ...s, [key]: !s[key] }));

  const grupos = [];
  const usados = new Set();

  if (lotes && lotes.length) {
    lotes.forEach((lote, li) => {
      const indices = arquivos
        .map((item, i) => ({ url: urlOf(item, i), i }))
        .filter(({ url }) => lote.arquivos?.includes(url))
        .map(({ i }) => i);
      indices.forEach((i) => usados.add(i));
      grupos.push({ tipo: "lote", nome: lote.nome || `Lote ${li + 1}`, indices });
    });
  }
  const individuais = arquivos.map((_, i) => i).filter((i) => !usados.has(i));
  if (individuais.length) grupos.push({ tipo: "individual", nome: "Arquivos individuais", indices: individuais });

  if (!grupos.length) return null;

  const renderChip = (i) => {
    const signed = !!signedMap[i];
    const isCurrent = i === currentIndex;
    return (
      <button
        key={i}
        type="button"
        onClick={() => onSelect(i)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors w-full text-left ${isCurrent ? "border-foreground/30 bg-foreground/5" : "border-border/60 hover:bg-muted/40"}`}
      >
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${signed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
          {signed ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
        </span>
        <span className="truncate flex-1">{fileName(urlOf(arquivos[i], i))}</span>
      </button>
    );
  };

  return (
    <div className="space-y-2 mb-6">
      {grupos.map((g, gi) => {
        const key = g.tipo === "lote" ? `lote-${gi}` : "individuais";
        const open = !!openLotes[key];
        const assinados = g.indices.filter((i) => signedMap[i]).length;
        const total = g.indices.length;
        const allDone = assinados === total;
        const temAtual = g.indices.includes(currentIndex);
        return (
          <div key={key} className={`rounded-xl border ${temAtual ? "border-foreground/30 bg-foreground/[0.03]" : "border-border/60 bg-muted/20"}`}>
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium"
            >
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
              {open
                ? <FolderOpen className={`w-4 h-4 ${allDone ? "text-emerald-600" : "text-brand"}`} />
                : <Folder className={`w-4 h-4 ${allDone ? "text-emerald-600" : "text-muted-foreground"}`} />}
              <span className="flex-1 text-left">{g.nome}</span>
              <span className={`text-xs tabular-nums px-2 py-0.5 rounded-full ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {assinados}/{total}
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 grid sm:grid-cols-2 gap-2">
                {g.indices.map(renderChip)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}