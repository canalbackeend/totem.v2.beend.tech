// ============================================================================
// Registro de auditoria (sistema de logs).
//
// Toda ação relevante da plataforma (CRUD de campanhas/terminais/empresas,
// reset de campanha e logins na plataforma/kiosk) gera uma entrada na tabela
// `audit_logs`. Isso permite ao master admin auditar reclamações de clientes,
// vendo quem fez o quê e quando.
//
// IMPORTANTE: a escrita do log é "fire-and-forget" — uma falha ao gravar o log
// NUNCA pode quebrar a ação principal (criar/editar/deletar, login, etc.).
// Qualquer erro é apenas registrado no console.
// ============================================================================

// Campos que nunca entram no diff de edição (senhas nunca são auditadas).
const SENSITIVE_FIELDS = new Set(["password", "confirm_password"]);

// Formato dos dados necessários para registrar um evento de auditoria.
// O prefixo `actor` identifica QUEM fez a ação; `entity` identifica SOBRE O QUÊ
// a ação foi feita (campanha, terminal, empresa ou o próprio login).
export interface AuditLogInput {
  actorType: string; // "user" (plataforma) ou "terminal" (kiosk)
  actorId?: string | null;
  actorLabel: string; // e-mail (ou descrição) de quem executou a ação
  companyEmail?: string | null; // e-mail da empresa dona do ator
  companyName?: string | null; // nome da empresa dona do ator
  action: string; // ex.: "campaign.create", "auth.login", "terminal.login"
  entityType: string; // "campaign" | "terminal" | "company" | "auth"
  entityId?: string | null;
  entityName?: string | null; // nome guardado mesmo se o registro for apagado depois
  details?: Record<string, unknown>; // extras: diff de edição, motivo de falha etc.
  success?: boolean; // default true
  ip?: string | null;
}

// Grava um evento de auditoria no banco.
// - O IP é capturado da requisição quando não for passado explicitamente.
// - `success` é `true` por padrão (flag de falha só é ligada quando informada).
// - O `.catch()` garante que erros de escrita nunca propagem para o chamador.
export function logAudit(prisma: any, req: any, data: AuditLogInput) {
  const ip = data.ip !== undefined ? data.ip : req?.ip || null;
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

// Constrói o diff (antes/depois) dos campos alterados em um PATCH.
// - `before` e `after` são os registros lidos antes e depois da atualização.
// - `fields` é a lista de campos que aquele recurso pode alterar.
// - Campos sensíveis (senha) são ignorados — nunca auditamos segredos.
// Usado para auditar edições de campanhas, terminais e empresas.
export function buildDiff(
  before: any,
  after: any,
  fields: string[],
): Record<string, { from: unknown; to: unknown }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of fields) {
    if (SENSITIVE_FIELDS.has(field)) continue;

    // Só compara campos que existem em pelo menos um dos lados.
    if (before?.[field] === undefined && after?.[field] === undefined) continue;

    // JSON.stringify para comparar objetos/arrays (ex.: questions) por valor.
    if (JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])) {
      changed[field] = {
        from: before?.[field] ?? null,
        to: after?.[field] ?? null,
      };
    }
  }

  return changed;
}

// Auditoria para ações de usuário autenticado (CRUD de campanhas e terminais).
// O contexto da empresa (nome) é resolvido via User, pois nesses casos a empresa
// do ator É a empresa dona do recurso. Nunca lança: qualquer falha é apenas
// registrada no console.
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
    // Identifica a empresa do usuário autenticado (o e-mail do User é o e-mail
    // da empresa; o nome fica no campo `empresa` do próprio User).
    const companyEmail = req.user?.email || null;
    let companyName: string | null = null;

    if (companyEmail && req.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { empresa: true },
      });
      companyName = user?.empresa || null;
    }

    // Terminais usam o token do dono, então `terminal_id` presente indica que
    // o ator é um kiosk (e o id a registrar é o do próprio terminal).
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

// Auditoria para ações do master admin sobre EMPRESAS (create/update/delete/
// status/password_reset). O ator é sempre um usuário da plataforma (o admin);
// a empresa registrada é a EMPRESA ALVO da ação, que pode ser diferente da
// empresa do ator — por isso o contexto vem do próprio registro `company`,
// e não do `req.user`.
export function logCompanyAction(
  prisma: any,
  req: any,
  company: { id: string; email: string; empresa: string },
  action: string,
  details?: Record<string, unknown>,
) {
  logAudit(prisma, req, {
    actorType: "user",
    actorId: req.user.id,
    actorLabel: req.user.email,
    companyEmail: company.email,
    companyName: company.empresa,
    action,
    entityType: "company",
    entityId: company.id,
    entityName: company.empresa,
    ...(details ? { details } : {}),
  });
}
