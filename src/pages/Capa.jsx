import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Lock, FileText } from "lucide-react";
import { Image as UIImage } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";
const SENHA_CAPA = "LOG@2026";

export default function Capa() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);

  const entrar = (e) => {
    e.preventDefault();
    if (senha === SENHA_CAPA) { sessionStorage.setItem("capa_ok", "1"); navigate("/"); }
    else setErro(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-background to-muted/40">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <UIImage src={LOGO_URL} alt="Assinatura Fácil Log" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-heading tracking-tight text-brand">Assinatura Fácil Log</h1>
          <p className="text-sm text-muted-foreground mt-2">Plataforma de assinaturas digitais</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex justify-center mb-8 [perspective:1000px]">
          <div className="relative w-40 h-52 rounded-xl bg-card border border-border shadow-2xl [transform:rotateY(-18deg)_rotateX(8deg)] [transform-style:preserve-3d]">
            <div className="absolute inset-0 rounded-xl p-4 flex flex-col gap-2">
              <div className="h-3 w-2/3 rounded bg-brand/80" />
              <div className="h-2 w-full rounded bg-muted mt-3" />
              <div className="h-2 w-5/6 rounded bg-muted" />
              <div className="h-2 w-4/6 rounded bg-muted" />
              <div className="h-2 w-5/6 rounded bg-muted" />
              <div className="mt-auto flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-brand" />
                <div className="h-2 w-12 rounded bg-brand/60" />
              </div>
            </div>
          </div>
        </motion.div>

        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-6">
            <form onSubmit={entrar} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="w-4 h-4" /> Informe a senha para acessar (web ou mobile)</div>
              <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(false); }} placeholder="Senha de acesso" autoFocus />
              {erro && <p className="text-sm text-destructive">Senha incorreta.</p>}
              <Button type="submit" className="w-full gap-2 bg-brand text-white hover:bg-brand/90"><ShieldCheck className="w-4 h-4" /> Entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}