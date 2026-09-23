import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, FileText, Loader2, X, CheckCircle2, Upload, Trash2 } from "lucide-react";
import { splitPdfIfNeeded } from "@/lib/pdfSplit";

// Comprime imagem via canvas antes do upload
async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name.replace(/\.(jpe?g|png|webp|gif|heic)$/i, ".jpg"), { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo").slice(0, 40) : "arquivo");
const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);

export default function CapturaMobile() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [docNumero, setDocNumero] = useState(null);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("operarCapturaMobile", { action: "get", token });
      setSession(res.data.session);
    } catch (err) {
      setError("Sessão não encontrada ou expirada.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        let filesToUpload = [file];
        // Se for PDF multipáginas, divide em páginas individuais
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          filesToUpload = await splitPdfIfNeeded(file);
        } else if (file.type.startsWith("image/")) {
          filesToUpload = [await compressImage(file)];
        }
        for (const f of filesToUpload) {
          // Tenta upload pelo cliente; se falhar, envia base64 para o backend
          try {
            const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: f });
            await base44.functions.invoke("operarCapturaMobile", { action: "addFile", token, fileUrl: file_url });
          } catch {
            // Fallback: base64 via backend
            const b64 = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.readAsDataURL(f);
            });
            await base44.functions.invoke("operarCapturaMobile", { action: "addFile", token, fileBase64: b64, fileName: f.name });
          }
        }
      }
      await loadSession();
    } catch (err) {
      setError("Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeFile = async (url) => {
    await base44.functions.invoke("operarCapturaMobile", { action: "removeFile", token, fileUrl: url });
    await loadSession();
  };

  const concluir = async () => {
    setConcluindo(true);
    try {
      const res = await base44.functions.invoke("operarCapturaMobile", { action: "concluir", token });
      setConcluido(true);
      setDocNumero(res.data.numero);
    } catch (err) {
      setError("Falha ao concluir envelope.");
    } finally {
      setConcluindo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando sessão…</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <X className="w-10 h-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-600" />
        <h1 className="text-xl font-heading">Envelope concluído!</h1>
        <p className="text-sm text-muted-foreground">{docNumero} criado e enviado para assinatura do gestor.</p>
      </div>
    );
  }

  const arquivos = session?.arquivos || [];

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-heading">{session?.titulo || "Captura mobile"}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {session?.categoria === "abastecimento" ? "Abastecimento" : "Notas e Boletos"}
          </p>
        </div>

        {/* Captura por câmera */}
        <div className="space-y-3 mb-4">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <Button
            type="button"
            className="w-full h-14 text-base gap-2"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            {uploading ? "Enviando…" : "Tirar foto"}
          </Button>

          {/* Upload de arquivo (PDF) */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />
            Anexar arquivo (PDF ou imagem)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4 text-center">
          PDFs com várias páginas são divididos automaticamente em arquivos individuais.
        </p>

        {/* Lista de arquivos capturados */}
        {arquivos.length > 0 && (
          <div className="space-y-2 mb-6">
            <p className="text-sm font-medium">{arquivos.length} arquivo(s) capturado(s)</p>
            {arquivos.map((url) => (
              <div key={url} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2">
                {isImage(url) ? (
                  <img src={url} alt="preview" className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs truncate flex-1">{fileName(url)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(url)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Concluir */}
        {arquivos.length > 0 && (
          <Button
            type="button"
            className="w-full h-14 text-base gap-2 bg-green-600 hover:bg-green-700"
            onClick={concluir}
            disabled={concluindo || uploading}
          >
            {concluindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {concluindo ? "Concluindo…" : "Concluir envelope"}
          </Button>
        )}

        {error && <p className="text-xs text-destructive text-center mt-3">{error}</p>}
      </div>
    </div>
  );
}