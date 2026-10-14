// Posicionamento automático da assinatura, por prioridade:
// 1) Espaço em branco da página que enquadre a assinatura sem sobrepor conteúdo.
// 2) Espelhar as assinaturas (lado oposto às já existentes), buscando espaço em branco e evitando sobreposição.
// 3) Se não conseguir os dois primeiros, retorna null → o usuário arrasta manualmente.
//
// Opera sobre o canvas já renderizado da página (pixel analysis). Retorna { x, y } em % (topo/esquerda
// do bloco de imagem) ou null quando nenhum espaço em branco é encontrado.
export function detectarPosicaoAssinatura(canvas, {
  assinaturasMesmoArquivo = [],
  ladoPreferido = "esquerda",
  larguraPct = 12, // ~ largura da imagem da assinatura em % da página
  alturaPct = 8,   // ~ altura da imagem da assinatura em % da página
} = {}) {
  if (!canvas) return null;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return null;

  let imageData;
  try {
    imageData = canvas.getContext("2d").getImageData(0, 0, W, H);
  } catch {
    return null;
  }
  const data = imageData.data;

  // Verifica se a região (px) é majoritariamente branca.
  const ehBranco = (x0, y0, w, h) => {
    let escuro = 0;
    let total = 0;
    const stepX = Math.max(1, Math.floor(w / 10));
    const stepY = Math.max(1, Math.floor(h / 6));
    for (let py = y0; py < y0 + h; py += stepY) {
      for (let px = x0; px < x0 + w; px += stepX) {
        const i = (py * W + px) * 4;
        if (i + 2 >= data.length) continue;
        total++;
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) escuro++;
      }
    }
    return total > 0 && escuro / total < 0.03;
  };

  // Pegadas (footprints) das assinaturas já existentes neste mesmo arquivo.
  const pegadas = (assinaturasMesmoArquivo || [])
    .filter((a) => a && (a.pos_x != null || a.pos_y != null))
    .map((a) => ({ x: a.pos_x ?? 3, y: a.pos_y ?? 90, w: larguraPct, h: alturaPct }));

  const sobrepoe = (x, y) =>
    pegadas.some((p) =>
      !(x + larguraPct <= p.x || x >= p.x + p.w || y + alturaPct <= p.y || y >= p.y + p.h)
    );

  // Varre o lado escolhido de baixo (rodapé) para cima, buscando espaço em branco sem sobreposição.
  const varrerLado = (lado) => {
    const yMin = 8;
    const yMax = 86; // mantém a assinatura no rodapé/inferior da página
    const xMin = lado === "direita" ? 52 : 2;
    const xMax = lado === "direita" ? 86 : 38; // imagem permanece na metade escolhida
    for (let y = yMax; y >= yMin; y -= 2) {
      for (let x = xMin; x <= xMax; x += 2) {
        const cx = Math.floor((x / 100) * W);
        const cy = Math.floor((y / 100) * H);
        const cw = Math.max(1, Math.floor((larguraPct / 100) * W));
        const ch = Math.max(1, Math.floor((alturaPct / 100) * H));
        if (cx + cw <= W && cy + ch <= H && ehBranco(cx, cy, cw, ch) && !sobrepoe(x, y)) {
          return { x, y };
        }
      }
    }
    return null;
  };

  // 1) Lado preferido (espelho do lado ocupado); 2) lado oposto; 3) null (arrasta).
  return varrerLado(ladoPreferido) || varrerLado(ladoPreferido === "direita" ? "esquerda" : "direita");
}