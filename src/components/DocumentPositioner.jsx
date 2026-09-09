import React, { useRef, useState } from "react";

export default function DocumentPositioner({ imageUrl, blocks, onMove }) {
  const containerRef = useRef(null);
  const [dragId, setDragId] = useState(null);
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

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none rounded-xl overflow-hidden border border-border/60 bg-muted/20"
      onMouseMove={handleMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchMove={handleMove}
      onTouchEnd={endDrag}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="documento" className="w-full block" draggable={false} />
      ) : (
        <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
          Nenhum arquivo de imagem para posicionar. Anexe uma imagem ao documento para arrastar a assinatura.
        </div>
      )}
      {blocks.map((b) => (
        <div
          key={b.id}
          onMouseDown={(e) => startDrag(e, b)}
          onTouchStart={(e) => startDrag(e, b)}
          style={{ left: `${b.pos_x}%`, top: `${b.pos_y}%`, opacity: dragId === b.id ? 0.8 : 1 }}
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
            <div className="text-[11px] bg-white/95 border border-border rounded px-1.5 py-1 mt-1 max-w-[180px] shadow-sm">{b.observacao}</div>
          )}
        </div>
      ))}
    </div>
  );
}