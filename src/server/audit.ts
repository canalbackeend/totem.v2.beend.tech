// Registro de auditoria (sistema de logs).
//
// logAudit é fire-and-forget: falhas de escrita do log NUNCA quebram a ação
// principal (criar/editar/deletar campanha, login, etc.). Qualquer erro é
// apenas registrado no console.

// Campos que nunca entram no diff (senhas nunca são auditadas).
const SENSITIVE_FIELDS = new Set(["password", "confirm_password"]);

// Campo usados para marcar entradas criadas pelos testes (facilita a limpeza).
export function logAudit(
  prisma: any,
  req: any,
  data: {
    actorType: string;
    actorId?: string | null;
    actorLabel: string;
    companyEmail?: string | null;
    companyName?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    details?: Record<string, unknown>;
    success?: boolean;
    ip?: string | null;
  },
) {
  const ip = data.ip !== undefined ? data.ip : (req?.ip || null);
  const details = data.details || {};
  prisma.auditLog
    .create({
      data: {
        actor_type: data.actorType,
        actor_id: data.actorId ?? null,
        actor_label: data.actorLabel || "",
        company_email: data.companyEmail ?? null,
        company_name: data.companyName ?? null,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId ?? null,
        entity_name: data.entityName ?? null,
        details,
        ip,
        success: data.success !== false,
      },
    })
    .catch((err: any) => {
      console.error("Falha ao registrar log de auditoria:", err?.message || err);
    });
}

// Constrói o diff (antes/depois) dos campos alterados em um PATCH, ignorando
// campos sensíveis (senha). Usado para auditar edições de campanhas/terminais.
export function buildDiff(before: any, after: any, fields: string[]): Record<string, { from: unknown; to: unknown }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    if (SENSITIVE_FIELDS.has(field)) continue;
    if (before?.[field] !== undefined || after?.[field] !== undefined) {
      if (JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])) {
        changed[field] = { from: before?.[field] ?? null, to: after?.[field] ?? null };
      }
    }
  }
  return changed;
}

// Marca os testes: entradas com details.test === true são removidas no afterAll.
export function testMarker(): Record<string, unknown> {
  return { test: true };
}

// Auditoria para ações de usuário autenticado (CRUD de campanhas/terminais/
// empresas). Resolve o contexto da empresa (nome) via User e grava o log.
// Nunca lança: qualquer falha é apenas logada no console.
export async function logUserAction(
  prisma: any,
  req: any,
  opts: {
    action: string;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    details?: Record<string, unknown>;
    success?: boolean;
  },
) {
  try {
    const companyEmail = req.user?.email || null;
    let companyName: string | null = null;
    if (companyEmail && req.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { empresa: true },
      });
      companyName = user?.empresa || null;
    }
    logAudit(prisma, req, {
      actorType: req.user?.terminal_id ? "terminal" : "user",
      actorId: req.user?.terminal_id || req.user?.id || null,
      actorLabel: req.user?.email || "desconhecido",
      companyEmail,
      companyName,
      ...opts,
    });
  } catch (err: any) {
    console.error("Falha ao resolver contexto de auditoria:", err?.message || err);
  }
}
