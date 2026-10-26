import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { renomearArquivos } from '../../shared/renomearArquivosIA.ts';

// Renomeia os arquivos do envelope na criação via IA:
// NF → nº da NF + UF | NFS-e → nº da NFS-e + UF | Boleto → Número do Documento + UF.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) || {};
    const arquivos = Array.isArray(body.arquivos) ? body.arquivos : [];
    if (arquivos.length === 0 || arquivos.length > 100) return Response.json({ error: 'Envie de 1 a 100 arquivos.' }, { status: 400 });
    const appFilesPrefix = 'https://base44.app/api/apps/6aa074a5ce060f1b2caeee8f/files/';
    if (arquivos.some((a) => !a || typeof a.url !== 'string' || a.url.length > 2048 || !a.url.startsWith(appFilesPrefix))) {
      return Response.json({ error: 'Arquivos inválidos para renomeação.' }, { status: 400 });
    }
    if (typeof body.unidade !== 'string' || !body.unidade.trim()) return Response.json({ error: 'unidade obrigatória' }, { status: 400 });

    const { mapa, renomeados } = await renomearArquivos(base44, arquivos, body.unidade);
    return Response.json({ ok: true, mapa, renomeados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}