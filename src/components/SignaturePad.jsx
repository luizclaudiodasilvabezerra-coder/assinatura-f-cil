import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

const SignaturePad = forwardRef(({ onChange }, ref) => {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPoint = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    setDrawing(true);
    lastPoint.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
    setHasContent(true);
  };

  const stop = () => {
    if (drawing && hasContent) onChange?.(canvasRef.current.toDataURL("image/png"));
    setDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange?.(null);
  };

  useImperativeHandle(ref, () => ({
    getDataURL: () => canvasRef.current.toDataURL("image/png"),
    isEmpty: () => !hasContent,
  }));

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={260}
          className="w-full h-[260px] touch-none cursor-crosshair bg-white"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground text-sm">Desenhe sua assinatura aqui</span>
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-2">
        <Eraser className="w-4 h-4" /> Limpar
      </Button>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";
export default SignaturePad;