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

// Consulta do sistema de logs (auditoria). Só o master admin enxerga o que
// todas as empresas fizeram: CRUD de campanhas/terminais, reset e logins.
export function registerAdminLogsRoute(app: any) {
  app.get(
    "/api/admin/logs",
    authenticateToken,
    async (req: any, res: any) => {
      try {
        if (!isMasterAdmin(req)) {
          return res
            .status(403)
            .json({ error: "Only master admin can access logs" });
        }

        const page = parseInt(req.query.page as string) || 1;
        const requestedSize = parseInt(req.query.pageSize as string) || 20;
        const pageSize = Math.min(Math.max(requestedSize, 1), 100);

        const where: any = {};

        if (req.query.search) {
          const term = String(req.query.search).trim();
          if (term) {
            where.OR = [
              { actor_label: { contains: term, mode: "insensitive" } },
              { entity_name: { contains: term, mode: "insensitive" } },
            ];
          }
        }
        if (req.query.action) where.action = String(req.query.action);
        if (req.query.entity_type) where.entity_type = String(req.query.entity_type);
        if (req.query.actor_type) where.actor_type = String(req.query.actor_type);
        if (req.query.company) {
          const term = String(req.query.company).trim();
          if (term) where.company_email = term;
        }
        if (req.query.success === "true") where.success = true;
        if (req.query.success === "false") where.success = false;

        const isDay = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v));
        if (req.query.start) {
          const v = String(req.query.start);
          where.created_at = { gte: isDay(v) ? new Date(`${v}T00:00:00.000-03:00`) : new Date(v) };
        }
        if (req.query.end) {
          const v = String(req.query.end);
          const base = isDay(v) ? new Date(`${v}T23:59:59.999-03:00`) : new Date(v);
          where.created_at = { ...(where.created_at || {}), lte: base };
        }

        const [data, count] = await prisma.$transaction([
          prisma.auditLog.findMany({
            where,
            orderBy: { created_at: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.auditLog.count({ where }),
        ]);

        res.json({ data, count, page, pageSize });
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
        if (!isMasterAdmin(req)) {
          return res
            .status(403)
            .json({ error: "Only master admin can access logs" });
        }
        const companies = await prisma.company.findMany({
          select: { email: true, empresa: true },
          orderBy: { empresa: "asc" },
        });
        res.json({
          companies: companies.map((c) => ({ email: c.email, name: c.empresa })),
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
        if (!isMasterAdmin(req)) {
          return res
            .status(403)
            .json({ error: "Only master admin can access tracking" });
        }

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
