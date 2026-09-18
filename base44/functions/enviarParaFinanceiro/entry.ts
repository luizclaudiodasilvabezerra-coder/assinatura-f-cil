import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documento_id } = body;
    if (!documento_id) return Response.json({ error: 'documento_id é obrigatório' }, { status: 400 });

    const doc = await base44.entities.Documento.get(documento_id);
    if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });

    // Somente notas fiscais (notas_boletos)
    if (doc.categoria === "abastecimento") {
      return Response.json({ error: 'Apenas notas fiscais podem ser exportadas para o Financeiro' }, { status: 400 });
    }

    // Varredura dos arquivos assinados no envelope
    // Prioriza assinaturas da diretoria (master); se não houver, usa as da gestão
    const assinaturas = await base44.entities.Assinatura.filter({ documento_id }, "-created_date", 100);
    const masters = assinaturas.filter(a => a.etapa === "master" && a.arquivo_url);
    const gestao = assinaturas.filter(a => a.etapa !== "master" && a.arquivo_url);
    const arquivos = (masters.length > 0 ? masters : gestao).map(a => a.arquivo_url);

    if (arquivos.length === 0) {
      return Response.json({ error: 'Nenhum arquivo assinado encontrado no envelope' }, { status: 400 });
    }

    // Determina a pasta do mês a partir da data de criação do envelope
    const data = new Date(doc.created_date);
    const mes = MESES[data.getMonth()];
    const ano = data.getFullYear();
    const mes_ano = `${mes}_${ano}`;
    const caminho_destino = `Z:\\Financeiro\\NOTAS_${mes_ano}`;

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