import React, { useCallback, useRef, useState } from "react";
import SenhaPdfDialog from "@/components/SenhaPdfDialog";

// Centraliza o pedido de senha de PDFs protegidos: `comSenha(arquivo, executar)`
// roda a operação, e quando o backend sinaliza que o PDF tem senha, abre o diálogo,
// guarda a senha para o resto da sessão e repete a operação.
export default function useSenhaPdf() {
  const [pedido, setPedido] = useState(null);
  const pedidoRef = useRef(null);
  const cacheRef = useRef({});

  const pedirSenha = useCallback((arquivo, erro) => new Promise((resolve) => {
    pedidoRef.current = { arquivo, resolve };
    setPedido({ arquivo, erro: !!erro });
  }), []);

  const confirmar = useCallback((senha) => {
    const p = pedidoRef.current;
    if (!p) return;
    cacheRef.current[p.arquivo] = senha;
    pedidoRef.current = null;
    setPedido(null);
    p.resolve(senha);
  }, []);

  const cancelar = useCallback(() => {
    const p = pedidoRef.current;
    pedidoRef.current = null;
    setPedido(null);
    p?.resolve(null);
  }, []);

  const comSenha = useCallback(async (arquivo, executar) => {
    let senha = cacheRef.current[arquivo];
    let falhouAntes = false;
    for (;;) {
      try {
        return await executar(senha);
      } catch (e) {
        if (!e?.precisaSenha) throw e;
        falhouAntes = falhouAntes || !!senha || !!e.senhaIncorreta;
        senha = await pedirSenha(arquivo, falhouAntes);
        if (!senha) throw e;
      }
    }
  }, [pedirSenha]);

  const senhaDialog = (
    <SenhaPdfDialog
      open={!!pedido}
      arquivo={pedido?.arquivo}
      erro={pedido?.erro}
      onConfirmar={confirmar}
      onCancelar={cancelar}
    />
  );

  return { comSenha, senhaDialog };
}