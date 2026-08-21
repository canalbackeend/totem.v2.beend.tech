import bcrypt from "bcryptjs";
import {
  prisma,
  authenticateToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_RESET_SECRET,
  authLimiter,
  isMasterAdmin,
} from "../deps";
import { sendDailyReports } from "../email";

// ============================================================================
// Endpoints administrativos (master admin).
// ============================================================================

// Bloqueia acesso a um endpoint administrativo para quem não é o master admin.
// Retorna `true` quando o acesso é permitido; caso contrário já responde 403.
function requireMasterAdmin(req: any, res: any, endpointLabel: string): boolean {
  if (isMasterAdmin(req)) return true;
  res.status(403).json({ error: `Only master admin can access ${endpointLabel}` });
  return false;
}

// Monta o filtro (cláusula `where` do Prisma) da consulta de logs a partir dos
// parâmetros de query do frontend:
// - search: busca em quem fez (actor_label) ou na entidade (entity_name)
// - action / entity_type / actor_type: filtros exatos
// - company: filtro exato pelo e-mail da empresa
// - success: "true" ou "false"
// - start / end: período (aceita "YYYY-MM-DD", interpretado como dia em BRT)
function buildLogsFilter(query: any): any {
  const where: any = {};

  if (query.search) {
    const searchTerm = String(query.search).trim();
    if (searchTerm) {
      where.OR = [
        { actor_label: { contains: searchTerm, mode: "insensitive" } },
        { entity_name: { contains: searchTerm, mode: "insensitive" } },
      ];
    }
  }

  if (query.action) where.action = String(query.action);
  if (query.entity_type) where.entity_type = String(query.entity_type);
  if (query.actor_type) where.actor_type = String(query.actor_type);

  if (query.company) {
    const companyEmail = String(query.company).trim();
    if (companyEmail) where.company_email = companyEmail;
  }

  if (query.success === "true") where.success = true;
  if (query.success === "false") where.success = false;

  // Datas: se vier "YYYY-MM-DD", ancora em meia-noite BRT (23:59:59 no fim)
  // para o dia inteiro não cair no bucket errado.
  const isDateOnly = (value: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

  if (query.start) {
    const value = String(query.start);
    where.created_at = {
      gte: isDateOnly(value) ? new Date(`${value}T00:00:00.000-03:00`) : new Date(value),
    };
  }
  if (query.end) {
    const value = String(query.end);
    const endInstant = isDateOnly(value) ? new Date(`${value}T23:59:59.999-03:00`) : new Date(value);
    where.created_at = { ...(where.created_at || {}), lte: endInstant };
  }

  return where;
}

// Consulta do sistema de logs (auditoria). Só o master admin enxerga o que
// todas as empresas fizeram: CRUD de campanhas/terminais, reset e logins.
export function registerAdminLogsRoute(app: any) {
  app.get(
    "/api/admin/logs",
    authenticateToken,
    async (req: any, res: any) => {
      try {
        if (!requireMasterAdmin(req, res, "logs")) return;

        // Paginação (página corrente + tamanho da página, com teto de 100).
        const page = parseInt(req.query.page as string) || 1;
        const requestedPageSize = parseInt(req.query.pageSize as string) || 20;
        const pageSize = Math.min(Math.max(requestedPageSize, 1), 100);

        const where = buildLogsFilter(req.query);

        // Busca paginada + contagem total na mesma transação.
        const [entries, totalCount] = await prisma.$transaction([
          prisma.auditLog.findMany({
            where,
            orderBy: { created_at: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.auditLog.count({ where }),
        ]);

        res.json({ data: entries, count: totalCount, page, pageSize });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Lista de empresas cadastradas (gestão de empresas) para o filtro do log.
  app.get(
    "/api/admin/logs/companies",
    authenticateToken,
    async (req: any, res: any) => {
      try {
        if (!requireMasterAdmin(req, res, "logs")) return;

        const companies = await prisma.company.findMany({
          select: { email: true, empresa: true },
          orderBy: { empresa: "asc" },
        });

        res.json({
          companies: companies.map((company) => ({
            email: company.email,
            name: company.empresa,
          })),
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// Admin tracking lives here (before terminals/responses in route order)
export function registerAdminTrackingRoute(app: any) {
  app.get(
    "/api/admin/tracking",
    authenticateToken,
    async (req: any, res: any) => {
      try {
        if (!requireMasterAdmin(req, res, "tracking")) return;

        const rangeDays = Math.min(
          Math.max(parseInt(req.query.range as string) || 30, 1),
          365,
        );
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - rangeDays);

        const [profiles, companies, terminals, campaigns, responseStats] =
          await Promise.all([
            prisma.user.findMany({
              select: {
                id: true,
                email: true,
                nome: true,
                empresa: true,
                cnpj: true,
                cidade: true,
                estado: true,
                telefone: true,
                plano: true,
                vencimento: true,
                status: true,
                max_terminals: true,
                role: true,
                created_at: true,
              },
            }),
            prisma.company.findMany({
              select: {
                id: true,
                empresa: true,
                email: true,
                responsavel: true,
                cnpj: true,
                cidade: true,
                estado: true,
                telefone: true,
                plano: true,
                vencimento: true,
                status: true,
                max_terminals: true,
                created_at: true,
              },
            }),
            prisma.terminal.findMany({
              select: {
                id: true,
                user_id: true,
                name: true,
                campaigns: true,
                redirect_url: true,
                email: true,
                status: true,
                last_ping: true,
                created_at: true,
                updated_at: true,
              },
              orderBy: { created_at: "desc" },
            }),
            prisma.campaign.findMany({ select: { id: true, name: true } }),
            // Agregação exata por terminal (contagem + último registro). Evita o
            // take:100000 anterior, que sub-amostrava silenciosamente o tracking.
            prisma.response.groupBy({
              by: ["terminal_id"],
              where: { created_at: { gte: cutoff } },
              _count: { _all: true },
              _max: { created_at: true },
            }),
          ]);

        const responses = responseStats.map((stat) => ({
          terminal_id: stat.terminal_id,
          count: stat._count._all,
          latest: stat._max.created_at,
        }));

        res.json({ profiles, companies, terminals, campaigns, responses });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// Platform settings live after the responses routes in the original order
export function registerPlatformSettingsRoutes(app: any) {
  app.get(
    "/api/platform-settings/:key",
    authenticateToken,
    async (req: any, res: any) => {
      try {
        const setting = await prisma.platformSettings.findUnique({
          where: { key: req.params.key },
        });
        res.json(setting);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.patch(
    "/api/platform-settings/:key",
    authenticateToken,
    async (req: any, res: any) => {
      if (!isMasterAdmin(req)) return res.sendStatus(403);
      try {
        const setting = await prisma.platformSettings.upsert({
          where: { key: req.params.key },
          update: { value: req.body.value },
          create: { key: req.params.key, value: req.body.value },
        });

        // If we are setting the global NPS campaign, sync the campaigns table
        if (req.params.key === "global_nps_campaign_id") {
          const selectedId =
            typeof req.body.value === "object"
              ? req.body.value.id
              : req.body.value;

          // Reset all
          await prisma.campaign.updateMany({
            where: { is_global: true },
            data: { is_global: false },
          });

          // Set one
          if (selectedId && selectedId !== "none") {
            await prisma.campaign.update({
              where: { id: selectedId },
              data: { is_global: true },
            });
          }
        }

        res.json(setting);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// Emergency/trigger admin endpoints (no path overlap with tracking; registered last)
export function registerAdminLateRoutes(app: any) {
  // Emergency admin reset (useful when admin is locked out after deploy)
  app.post("/api/admin/reset-admin", authLimiter, async (req: any, res: any) => {
    try {
      const secret = req.headers["x-admin-secret"];
      if (typeof secret !== "string" || secret !== ADMIN_RESET_SECRET) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!ADMIN_PASSWORD) {
        return res
          .status(500)
          .json({ error: "ADMIN_PASSWORD não configurada no servidor." });
      }
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: { password: hashedPassword, status: "Ativo" },
        create: {
          email: ADMIN_EMAIL,
          password: hashedPassword,
          nome: "Administrador Master",
          empresa: "beend.tech",
          role: "Administrador",
          status: "Ativo",
        },
      });
      console.log(`Admin reset/created: ${ADMIN_EMAIL}`);
      res.json({ message: "Admin resetado com sucesso" });
    } catch (err: any) {
      console.error("Admin reset error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/admin/trigger-reports",
    authenticateToken,
    async (req: any, res: any) => {
      if (!isMasterAdmin(req)) return res.sendStatus(403);
      try {
        await sendDailyReports();
        res.json({ message: "Task triggered" });
      } catch (err) {
        console.error("Trigger reports error:", err);
        res.status(500).json({ error: "Erro ao disparar relatórios." });
      }
    },
  );
}
