import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documento_id, caminho_destino: caminhoCustom, mes_ano: mesAnoCustom } = body;
    if (!documento_id) return Response.json({ error: 'documento_id é obrigatório' }, { status: 400 });

    const doc = await base44.entities.Documento.get(documento_id);
    if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });

    // Somente notas fiscais (notas_boletos)
    if (doc.categoria === "abastecimento") {
      return Response.json({ error: 'Apenas notas fiscais podem ser exportadas para o Financeiro' }, { status: 400 });
    }

    // Varredura: somente as NF do envelope (registradas em RelatorioNF)
    // Cada registro de RelatorioNF já aponta para o arquivo assinado correspondente
    const relatorios = await base44.entities.RelatorioNF.filter({ documento_id }, "-created_date", 200);
    const arquivos = relatorios.map(r => r.arquivo_url).filter(Boolean);

    if (arquivos.length === 0) {
      return Response.json({ error: 'Nenhuma NF encontrada para exportação neste envelope' }, { status: 400 });
    }

    // Determina a pasta do mês a partir da data de criação do envelope
    // (pode ser sobrescrita pelo usuário ao escolher o diretório de destino)
    const data = new Date(doc.created_date);
    const mes = MESES[data.getMonth()];
    const ano = data.getFullYear();
    const mes_ano = mesAnoCustom || `${mes}_${ano}`;
    const caminho_destino = caminhoCustom || `Z:\\Financeiro\\NOTAS_${mes_ano}`;

    // Cria o job de exportação (o agente local processará)
    const exportJob = await base44.entities.ExportFinanceiro.create({
      documento_id,
      documento_titulo: doc.titulo,
      arquivos,
      mes_ano,
      caminho_destino,
      status: "pendente",
      exportado_por: user.email || user.full_name || "—"
    });

    return Response.json({
      ok: true,
      export_id: exportJob.id,
      arquivos: arquivos.length,
      caminho: caminho_destino
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}