import React, { useEffect, useRef, useState } from "react";
import { Plus, Minus, Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import PdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);
const isPdf = (url) => url && /\.pdf$/i.test(url);

export default function DocumentPositioner({ fileUrl, blocks, onMove }) {
  const outerRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pdfSize, setPdfSize] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  // Renderiza a primeira página do PDF num canvas (alinhamento perfeito com a página real)
  useEffect(() => {
    if (!isPdf(fileUrl)) { setPdfSize(null); return; }
    let cancelled = false;
    setPdfLoading(true);
    (async () => {
      try {
        const task = pdfjsLib.getDocument(fileUrl);
        const pdf = await task.promise;
        if (cancelled) { await pdf.destroy(); return; }
        const page = await pdf.getPage(1);
        const avail = outerRef.current?.clientWidth || 800;
        const base = page.getViewport({ scale: 1 });
        const fitScale = avail / base.width;
        const scale = fitScale * zoom;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) { await pdf.destroy(); return; }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) { setPdfSize({ w: viewport.width, h: viewport.height }); setPdfLoading(false); }
        await pdf.destroy();
      } catch {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, zoom]);

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
    onMove(dragId, Math.max(0, Math.min(85, x)), Math.max(0, Math.min(92, y)));
  };

  const endDrag = () => setDragId(null);

  const renderFile = () => {
    if (!fileUrl) {
      return <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">Nenhum arquivo anexado a este documento.</div>;
    }
    if (isImage(fileUrl)) {
      return <img src={fileUrl} alt="documento" className="w-full block" draggable={false} />;
    }
    if (isPdf(fileUrl)) {
      return (
        <div className="relative">
          {pdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <canvas ref={canvasRef} className="block bg-white max-w-full" />
        </div>
      );
    }
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Pré-visualização não disponível para este tipo de arquivo.</span>
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Abrir em nova aba</a>
      </div>
    );
  };

  const wrapperWidth = isImage(fileUrl) ? `${zoom * 100}%` : (pdfSize ? `${pdfSize.w}px` : "100%");

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border/60 bg-muted/20">
      <div ref={outerRef} className="w-full overflow-auto" style={{ maxHeight: "82vh" }}>
        <div
          ref={containerRef}
          className="relative mx-auto"
          style={{ width: wrapperWidth }}
          onMouseMove={handleMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchMove={handleMove}
          onTouchEnd={endDrag}
        >
          {renderFile()}
          {blocks.map((b) => (
            <div
              key={b.id}
              onMouseDown={(e) => startDrag(e, b)}
              onTouchStart={(e) => startDrag(e, b)}
              style={{ left: `${b.pos_x}%`, top: `${b.pos_y}%`, opacity: dragId === b.id ? 0.8 : 1, zIndex: 20 }}
              className={`absolute ${b.draggable ? "cursor-move" : "cursor-default"}`}
            >
              <div className="flex items-center gap-2 bg-white/85 rounded shadow-sm border border-border/70 px-1.5 py-1">
                {b.imagem_url ? (
                  <img src={b.imagem_url} alt="assinatura" className="h-20 w-40 object-contain" draggable={false} />
                ) : (
                  <div className="h-20 w-40 flex items-center justify-center text-[11px] text-muted-foreground border border-dashed border-border rounded">assinatura</div>
                )}
                <div className="flex flex-col">
                  {b.nome && <span className="text-[11px] leading-tight whitespace-nowrap">{b.nome}</span>}
                  {b.observacao && <span className="text-[10px] leading-tight text-muted-foreground whitespace-nowrap max-w-[160px] truncate">{b.observacao}</span>}
                </div>
              </div>
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