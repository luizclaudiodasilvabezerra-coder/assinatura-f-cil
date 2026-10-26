// Renomeação de arquivos de envelope na criação, com IA:
// NF → nº da NF + UF | NFS-e → nº da NFS-e + UF | Boleto → Número do Documento + UF.
// A UF vem da unidade de negócio do envelope.

const UFS = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM", "bahia": "BA", "ceara": "CE",
  "distrito federal": "DF", "espirito santo": "ES", "goias": "GO", "maranhao": "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", "para": "PA",
  "paraiba": "PB", "parana": "PR", "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
  "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE", "tocantins": "TO",
};

const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const ufDaUnidade = (unidade) => {
  const n = semAcento(String(unidade || "").trim().toLowerCase());
  if (!n) return "";
  const direto = n.match(/\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b/);
  if (direto) return direto[1].toUpperCase();
  return UFS[n] || "";
};

const extensaoDe = (url) => {
  const nome = decodeURIComponent(String(url).split("?")[0].split("/").pop() || "");
  const partes = nome.split(".");
  return partes.length > 1 ? "." + partes[partes.length - 1].toLowerCase() : "";
};

const extrairNumeroDocumento = async (base44, url) => {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analise este documento fiscal (Nota Fiscal, NFS-e ou boleto) e extraia em numero_documento, apenas dígitos e preservando os zeros à esquerda: se for boleto bancário, o Número do Documento; se for NFS-e, o número da NFS-e; caso contrário, o número da Nota Fiscal. Nunca concatene números de documentos diferentes. Se não localizar, retorne uma string vazia. Retorne somente o campo solicitado.`,
        file_urls: [url],
        response_json_schema: {
          type: "object",
          properties: { numero_documento: { type: "string" } },
          required: ["numero_documento"],
        },
      });
      const n = String(r?.numero_documento || "").replace(/\D/g, "");
      if (n) return n;
    } catch {}
  }
  return "";
};

// arquivos: [{ url, numero_documento? }] — numero_documento já extraído evita nova leitura por IA.
// Retorna { mapa: { urlAntiga: urlNova }, renomeados } — arquivos sem número continuam com a URL original.
export const renomearArquivos = async (base44, arquivos, unidade) => {
  const uf = ufDaUnidade(unidade);
  const mapa = {};
  const usados = new Set();
  const alvos = (arquivos || []).filter((a) => a && typeof a.url === "string");
  for (let i = 0; i < alvos.length; i += 6) {
    await Promise.allSettled(alvos.slice(i, i + 6).map(async (a) => {
      try {
        const numero = String(a.numero_documento || "").replace(/\D/g, "") || await extrairNumeroDocumento(base44, a.url);
        if (!numero) return;
        const ext = extensaoDe(a.url);
        const base = `${numero}${uf ? "-" + uf : ""}`;
        let nome = `${base}${ext}`.slice(0, 100);
        if (usados.has(nome.toLowerCase())) {
          let n = 2;
          while (usados.has(`${base}-${n}${ext}`.toLowerCase())) n++;
          nome = `${base}-${n}${ext}`;
        }
        usados.add(nome.toLowerCase());
        const res = await fetch(a.url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const up = await base44.asServiceRole.integrations.Core.UploadPublicFile({
          file: new File([buf], nome, { type: res.headers.get("content-type") || "application/octet-stream" }),
        });
        mapa[a.url] = up.file_url;
      } catch {}
    }));
  }
  return { mapa, renomeados: Object.keys(mapa).length };
};