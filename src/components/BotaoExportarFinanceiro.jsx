import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FolderInput } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

// --- Persistência do handle do diretório no IndexedDB (reuso entre sessões) ---
const DB_NAME = "financeiroDirDB";
const STORE = "dirHandle";
const KEY = "financeiro";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function loadHandle() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch { return null; }
}
async function ensurePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

export default function BotaoExportarFinanceiro({ docId, docData }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const exportar = async (e) => {
    e.stopPropagation();
    if (!("showDirectoryPicker" in window)) {
      toast({ title: "Navegador não suportado", description: "Use Chrome ou Edge (desktop) para exportar diretamente para a pasta.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1. Reutiliza o diretório salvo (Z:\Financeiro); se não tiver permissão, abre o seletor
      let dirHandle = await loadHandle();
      if (!dirHandle || !(await ensurePermission(dirHandle))) {
        dirHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "financeiro" });
        await saveHandle(dirHandle);
      }

      // 2. Subpasta do mês conforme a data do envelope (data_limite)
      const data = docData ? new Date(docData) : new Date();
      const mes = MESES[data.getMonth()];
      const ano = data.getFullYear();
      const subpasta = `NOTAS_${mes}_${ano}`;
      setProgress(`Preparando pasta ${subpasta}...`);

      // Cria (se não existir) ou abre a subpasta do mês
      const monthDir = await dirHandle.getDirectoryHandle(subpasta, { create: true });

      // 3. Varredura: somente as NF do envelope (registradas em RelatorioNF), sem duplicatas
      const relatorios = await base44.entities.RelatorioNF.filter({ documento_id: docId }, "-created_date", 200);
      const arquivos = [...new Set(relatorios.map((r) => r.arquivo_url).filter(Boolean))];

      if (arquivos.length === 0) {
        toast({ title: "Nenhuma NF encontrada", description: "Não há notas fiscais registradas para este envelope.", variant: "destructive" });
        return;
      }

      // 4. Baixa e grava cada NF na pasta do mês
      let ok = 0;
      let falhas = 0;
      for (let i = 0; i < arquivos.length; i++) {
        const url = arquivos[i];
        try {
          setProgress(`Gravando NF ${i + 1} de ${arquivos.length}...`);
          const resp = await fetch(url);
          if (!resp.ok) throw new Error("Falha no download");
          const blob = await resp.blob();
          const nome = decodeURIComponent(url.split("/").pop() || `nf_${Date.now()}.pdf`);
          const fh = await monthDir.getFileHandle(nome, { create: true });
          const writable = await fh.createWritable();
          await writable.write(blob);
          await writable.close();
          ok++;
        } catch (err) {
          console.error("Erro ao gravar", url, err);
          falhas++;
        }
      }

      // 5. Registra a exportação para auditoria
      try {
        await base44.entities.ExportFinanceiro.create({
          documento_id: docId,
          arquivos,
          mes_ano: `${mes}_${ano}`,
          caminho_destino: `${dirHandle.name}\\${subpasta}`,
          status: "concluido",
          data_export: new Date().toISOString(),
          exportado_por: user?.email || user?.full_name || "—",
        });
      } catch (err) { console.warn("Registro de auditoria não salvo:", err); }

      if (falhas === 0) {
        toast({ title: "Exportação concluída", description: `${ok} NF(s) gravada(s) em ${dirHandle.name}\\${subpasta}.` });
      } else {
        toast({ title: "Exportação parcial", description: `${ok} gravada(s), ${falhas} com falha em ${subpasta}.`, variant: "destructive" });
      }
    } catch (err) {
      if (err.name === "AbortError") return; // usuário cancelou o seletor
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <Button type="button" size="sm" onClick={exportar} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderInput className="w-3.5 h-3.5" />}
      {loading ? (progress || "Exportando...") : "Enviar p/ Financeiro"}
    </Button>
  );
}