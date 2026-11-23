import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Image as UIImage } from "@/components/ui/image";
import IdentificacaoEmail from "@/components/IdentificacaoEmail";
import { safeReturnTo } from "@/lib/authReturnTo";
import { lerSessaoLink } from "@/lib/acessoLink";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";

export default function Capa() {
  const [verificando, setVerificando] = useState(true);
  const returnTo = safeReturnTo();

  // Sessão já identificada no navegador (mesmo depois de fechar o app): entra direto.
  useEffect(() => {
    const destino = returnTo === window.location.pathname ? "/" : returnTo;
    if (lerSessaoLink()) {
      window.location.href = destino;
      return;
    }
    setVerificando(false);
  }, [returnTo]);

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-background to-muted/40">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <UIImage src={LOGO_URL} alt="Assinatura Fácil Log" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-heading tracking-tight text-brand">Assinatura Fácil Log</h1>
          <p className="text-sm text-muted-foreground mt-2">Plataforma de assinaturas digitais</p>
        </motion.div>

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <ShieldCheck className="w-4 h-4" /> Acesso restrito a usuários autorizados
            </div>
            <IdentificacaoEmail returnTo={returnTo} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}