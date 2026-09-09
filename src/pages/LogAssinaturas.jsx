import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, PenLine, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/signatureUtils";

export default function LogAssinaturas() {
  const [assinaturas, setAssinaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Assinatura.list("-created_date", 100);
        setAssinaturas(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return assinaturas;
    const q = query.toLowerCase();
    return assinaturas.filter(
      (a) =>
        a.assinante_nome?.toLowerCase().includes(q) ||
        a.documento_titulo?.toLowerCase().includes(q) ||
        a.assinante_email?.toLowerCase().includes(q)
    );
  }, [assinaturas, query]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <PenLine className="w-4 h-4" /> Histórico
        </div>
        <h1 className="text-3xl font-heading tracking-tight mb-1">Log de assinaturas</h1>
        <p className="text-muted-foreground mb-8">Registro completo e auditável de todas as assinaturas coletadas.</p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por assinante, documento ou e-mail"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Nenhuma assinatura encontrada.</p>
            <Button asChild variant="outline"><Link to="/novo">Criar um documento</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="rounded-xl border-border/60">
                  <CardContent className="p-4 flex items-center gap-4">
                    {a.imagem_url ? (
                      <img src={a.imagem_url} alt="assinatura" className="h-12 w-24 object-contain bg-white rounded border border-border/60 shrink-0" />
                    ) : (
                      <div className="h-12 w-24 rounded bg-muted flex items-center justify-center shrink-0">
                        <PenLine className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.assinante_nome}</p>
                      <p className="text-sm text-muted-foreground truncate">{a.documento_titulo || "—"}</p>
                      {a.assinante_email && <p className="text-xs text-muted-foreground truncate">{a.assinante_email}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium mb-1">{a.status}</span>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium mb-1 ml-1">{a.etapa === "master" ? "Diretoria" : "Gestão"}</span>
                      <p className="text-xs text-muted-foreground">{formatDateTime(a.data_assinatura || a.created_date)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}