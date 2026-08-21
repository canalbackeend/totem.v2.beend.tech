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

        const [profiles, companies, terminals, campaigns, responses] =
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
            prisma.response.findMany({
              where: { created_at: { gte: cutoff } },
              select: { terminal_id: true, created_at: true },
              orderBy: { created_at: "desc" },
              take: 100000,
            }),
          ]);

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
