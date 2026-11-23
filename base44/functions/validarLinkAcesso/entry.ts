import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Valida o token de um link pessoal de acesso e devolve apenas a identidade vinculada.
export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) return Response.json({ error: 'Token ausente' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const { items } = await base44.asServiceRole.entities.AcessoLink.filter(
      { token, ativo: true },
      { limit: 1 }
    );
    const link = items?.[0];
    if (!link) return Response.json({ error: 'Link inválido ou desativado' }, { status: 404 });

    await base44.asServiceRole.entities.AcessoLink.update(link.id, {
      ultimo_acesso: new Date().toISOString(),
    });

    return Response.json({ email: link.email, nome: link.nome || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}