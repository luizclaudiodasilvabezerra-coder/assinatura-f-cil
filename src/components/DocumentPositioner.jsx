import React, { useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";

const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const isPdf = (url) => url && /\.pdf$/i.test(url);

export default function DocumentPositioner({ fileUrl, blocks, onMove }) {
  const containerRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const offset = useRef({ x: 0, y: 0 });

  const startDrag = (e, block) => {
    if (!block.draggable) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offset.current = {
      x: clientX - rect.left - (block.pos_x / 100) * rect.width,
      y: clientY - rect.top - (block.pos_y / 100) * rect.height,
    };
    setDragId(block.id);
  };

  const handleMove = (e) => {
    if (!dragId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left - offset.current.x) / rect.width) * 100;
    const y = ((clientY - rect.top - offset.current.y) / rect.height) * 100;
    onMove(dragId, Math.max(0, Math.min(92, x)), Math.max(0, Math.min(92, y)));
  };

  const endDrag = () => setDragId(null);

  const pdfSrc = (url) => {
    const sep = url.includes("#") ? "&" : "#";
    return `${url}${sep}zoom=${Math.round(zoom * 100)}`;
  };

  const renderFile = () => {
    if (!fileUrl) {
      return (
        <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
          Nenhum arquivo anexado a este documento.
        </div>
      );
    }
    if (isImage(fileUrl)) {
      return <img src={fileUrl} alt="documento" className="w-full block" draggable={false} />;
    }
    if (isPdf(fileUrl)) {
      return <iframe src={pdfSrc(fileUrl)} title="documento" className="w-full h-[80vh] block bg-white" draggable={false} />;
    }
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Pré-visualização não disponível para este tipo de arquivo.</span>
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Abrir em nova aba</a>
      </div>
    );
  };

  const wrapperWidth = isImage(fileUrl) ? `${zoom * 100}%` : "100%";

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border/60 bg-muted/20">
      <div className="w-full overflow-auto" style={{ maxHeight: "82vh" }}>
        <div
          ref={containerRef}
          className="relative"
          style={{ width: wrapperWidth }}
          onMouseMove={handleMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchMove={handleMove}
          onTouchEnd={endDrag}
        >
          {renderFile()}
          {isPdf(fileUrl) && (
            <div className="absolute inset-0 z-10" style={{ pointerEvents: dragId ? "auto" : "none" }} />
          )}
          {blocks.map((b) => (
            <div
              key={b.id}
              onMouseDown={(e) => startDrag(e, b)}
              onTouchStart={(e) => startDrag(e, b)}
              style={{ left: `${b.pos_x}%`, top: `${b.pos_y}%`, opacity: dragId === b.id ? 0.8 : 1, zIndex: 20 }}
              className={`absolute ${b.draggable ? "cursor-move" : "cursor-default"}`}
            >
              {b.imagem_url ? (
                <img src={b.imagem_url} alt="assinatura" className="h-14 w-28 object-contain bg-white/70 rounded shadow-sm" draggable={false} />
              ) : (
                <div className="h-14 w-28 rounded bg-white/70 border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">assinatura</div>
              )}
              {b.nome && (
                <div className="text-center text-[11px] mt-0.5 bg-white/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">{b.nome}</div>
              )}
              {b.observacao && (
                <div style={{ paddingLeft: (b.indent || 0) * 14 }} className="text-[11px] bg-white/95 border border-border rounded px-1.5 py-1 mt-1 max-w-[180px] shadow-sm">{b.observacao}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-white/95 rounded-lg border border-border/60 shadow-sm px-1.5 py-1">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Reduzir">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Ampliar">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}