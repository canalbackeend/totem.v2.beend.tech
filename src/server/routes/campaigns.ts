import { prisma, authenticateToken, whitelist, ADMIN_EMAIL, parseCampaignList } from "../deps";
import { getSatisfactionScore } from "../../lib/metrics";
import { calculateCampaignMetrics } from "../metrics";

// Campaign metrics + secure report token (registered before upload/campaign CRUD)
export function registerCampaignMetricsRoutes(app: any) {
  // API: Get metrics for a campaign
  app.get("/api/campaigns/:id/metrics", authenticateToken, async (req: any, res: any) => {
    const { id } = req.params;
    const { start, end } = req.query;

    try {
      const userId = req.user.id;
      const isMasterAdmin = req.user.email === ADMIN_EMAIL;

      const whereCampaign: any = { id };
      if (!isMasterAdmin) {
        whereCampaign.user_id = userId;
      }

      const campaign = await prisma.campaign.findFirst({
        where: whereCampaign
      });

      if (!campaign) return res.status(404).json({ error: "Campanha não encontrada ou acesso negado" });

      const whereResponses: any = { campaign_id: id };
      
      // Terminal manager restriction
      if (req.user.terminal_id) {
        whereResponses.terminal_id = req.user.terminal_id;
      }

      if (start || end) {
        whereResponses.created_at = {};
        if (start) whereResponses.created_at.gte = new Date(start as string);
        if (end) whereResponses.created_at.lte = new Date(end as string);
      }

      const responses = await prisma.response.findMany({
        where: whereResponses,
        orderBy: { created_at: "desc" },
        take: 5000
      });
      const metrics = calculateCampaignMetrics(campaign, responses || []);

      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Check and consume report token
  app.get("/api/reports/check-token/:token", async (req, res) => {
    const { token } = req.params;

    try {
      const data = await prisma.reportToken.findUnique({
        where: { token },
        include: {
          campaign: true
        }
      });

      if (!data || data.is_used || data.expires_at < new Date()) {
        return res.status(404).json({ error: "Token inválido ou expirado" });
      }

      const campaignId = data.campaign_id;
      const userId = data.campaign?.user_id;

      // Fetch Profile
      let profile = null;
      if (userId) {
        profile = await prisma.user.findUnique({
          where: { id: userId }
        });
      }

      // Fetch Responses for the period relative to when the report was generated (Yesterday)
      const tokenDate = new Date(data.created_at);
      const reportDate = new Date(tokenDate);
      reportDate.setDate(reportDate.getDate() - 1);
      
      const startOfDay = new Date(reportDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(reportDate);
      endOfDay.setHours(23, 59, 59, 999);

      let responses = await prisma.response.findMany({
        where: {
          campaign_id: campaignId,
          created_at: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          terminal: {
            select: { name: true }
          }
        }
      });

      // Fetch Evolution Data (Last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const evolutionData = await prisma.response.findMany({
        where: {
          campaign_id: campaignId,
          created_at: {
            gte: sevenDaysAgo
          }
        },
        select: {
          created_at: true,
          answers: true
        },
        orderBy: { created_at: 'asc' }
      });

      // Calculate Metrics for the main result set
      const metrics = calculateCampaignMetrics(data.campaign, responses || []);

      console.log(`Token validado: ${token}. Campanha: ${campaignId}. Respostas: ${responses.length}. Evolução: ${evolutionData?.length}`);

      res.json({
        ...data,
        profile,
        responses,
        metrics,
        evolution: evolutionData || [],
        reference_date: reportDate.toISOString()
      });
    } catch (err: any) {
      console.error("Erro na API check-token:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

// Campaign CRUD, global, evolution and clone
export function registerCampaignRoutes(app: any) {
  // Global Campaign for Portal NPS
  app.get("/api/campaigns/global", authenticateToken, async (req, res) => {
    try {
      const campaign = await prisma.campaign.findFirst({
        where: { is_global: true }
      });
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/campaigns", authenticateToken, async (req: any, res) => {
    try {
      const { names, status } = req.query;
      const where: any = {};
      
      if (names) {
        where.name = { in: (names as string).split(",") };
      }
      
      if (status) {
        where.status = status as string;
      }

      // Standard user restriction
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }

      // Terminal manager restriction (extra filter)
      if (req.user.terminal_id) {
        const terminal = await prisma.terminal.findUnique({ where: { id: req.user.terminal_id } });
        if (terminal && terminal.campaigns) {
          const assigned = parseCampaignList(terminal.campaigns);
          
          if (assigned.length > 0) {
            // If query names already present, intersect them
            if (where.name) {
              const currentNames = (where.name.in as string[]);
              where.name.in = currentNames.filter(n => assigned.includes(n));
            } else {
              where.name = { in: assigned };
            }
          } else {
            where.id = "NONE";
          }
        } else {
          where.id = "NONE";
        }
      }

      const isMasterAdmin = req.user.email === ADMIN_EMAIL;

      let isAdmin = false;
      if (!isMasterAdmin) {
        const profile = await prisma.user.findUnique({ where: { id: req.user.id } });
        isAdmin = profile?.role === "Administrador";
      }

      if (isMasterAdmin || isAdmin) {
        const companies = await prisma.company.findMany({
          select: { email: true, empresa: true }
        });
        const companyMap = new Map(companies.map(c => [c.email, c.empresa]));

        const campaigns = await prisma.campaign.findMany({
          where,
          include: { user: { select: { email: true, empresa: true } } },
          orderBy: { created_at: "desc" }
        });

        const enriched = campaigns.map(({ user, ...rest }) => ({
          ...rest,
          company_name: companyMap.get(user.email) || user.empresa || null
        }));
        res.json(enriched);
      } else {
        const campaigns = await prisma.campaign.findMany({
          where,
          orderBy: { created_at: "desc" }
        });
        res.json(campaigns);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      const where: any = { id: req.params.id };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }
      const campaign = await prisma.campaign.findFirst({
        where
      });
      if (!campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const campaign = await prisma.campaign.create({
        data: { ...whitelist(req.body, ["name", "type", "status", "description", "privacy_text", "questions", "report_email", "report_time", "is_global", "thank_you_message", "start_image", "end_image", "flow_layout"]), user_id: req.user.id }
      });
      res.json(campaign);
    } catch (err: any) {
      console.error("Campaign create error:", err);
      res.status(500).json({ error: "Erro ao criar campanha." });
    }
  });

  app.patch("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const where: any = { id: req.params.id };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }
      const existing = await prisma.campaign.findFirst({ where });
      if (!existing) {
        return res.status(404).json({ error: "Campanha não encontrada ou sem permissão" });
      }
      const campaign = await prisma.campaign.update({
        where: { id: req.params.id },
        data: whitelist(req.body, ["name", "type", "status", "description", "privacy_text", "questions", "report_email", "report_time", "is_global", "thank_you_message", "start_image", "end_image", "flow_layout"])
      });

      // Propagate name change to terminals that store campaign names
      if (req.body.name && req.body.name !== existing.name) {
        const oldName = existing.name;
        const newName = req.body.name;
        const affectedTerminals = await prisma.terminal.findMany({
          where: { campaigns: { contains: oldName } }
        });
        for (const term of affectedTerminals) {
          if (!term.campaigns) continue;
          const updated = parseCampaignList(term.campaigns)
            .map((c: string) => c === oldName ? newName : c)
            .join(',');
          if (updated !== term.campaigns) {
            await prisma.terminal.update({
              where: { id: term.id },
              data: { campaigns: updated }
            });
          }
        }
      }

      res.json(campaign);
    } catch (err: any) {
      console.error("Campaign update error:", err);
      res.status(500).json({ error: "Erro ao atualizar campanha." });
    }
  });

  app.delete("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const where: any = { id: req.params.id };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }
      const existing = await prisma.campaign.findFirst({ where });
      if (!existing) {
        return res.status(404).json({ error: "Campanha não encontrada ou sem permissão" });
      }
      await prisma.campaign.delete({
        where: { id: req.params.id }
      });
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/campaigns/:id/evolution", authenticateToken, async (req: any, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);
      const where: any = { id: req.params.id };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }
      const campaign = await prisma.campaign.findFirst({ where });
      if (!campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }

      const queryStartDate = req.query.startDate as string;
      const queryEndDate = req.query.endDate as string;
      const queryTerminalId = req.query.terminal_id as string;

      let startDate: Date;
      let endDate: Date;
      let totalDays: number;

      if (queryStartDate || queryEndDate) {
        endDate = queryEndDate ? new Date(queryEndDate + "T23:59:59.999Z") : new Date();
        startDate = queryStartDate ? new Date(queryStartDate + "T00:00:00.000Z") : new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 6);
        startDate.setUTCHours(0, 0, 0, 0);
        totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        endDate = new Date();
        endDate.setUTCHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - days + 1);
        startDate.setUTCHours(0, 0, 0, 0);
        totalDays = days;
      }

      const whereResponses: any = {
        campaign_id: req.params.id,
        created_at: {
          gte: startDate,
          lte: endDate
        }
      };

      if (queryTerminalId) {
        whereResponses.terminal_id = queryTerminalId;
      }

      const responses = await prisma.response.findMany({
        where: whereResponses,
        select: {
          created_at: true,
          answers: true
        },
        orderBy: { created_at: "asc" },
        take: 10000
      });

      const dailyData: Record<string, { scoreSum: number; answerCount: number; dates: Date; responseCount: number }> = {};

      for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        dailyData[key] = { scoreSum: 0, answerCount: 0, dates: d, responseCount: 0 };
      }

      for (const r of responses) {
        const key = r.created_at.toISOString().split("T")[0];
        if (!dailyData[key]) continue;
        dailyData[key].responseCount++;

        try {
          const answers = typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers;
          if (Array.isArray(answers)) {
            for (const a of answers) {
              const score = getSatisfactionScore(a.answer ?? a.value, a.type);
              if (score !== null) {
                dailyData[key].scoreSum += score;
                dailyData[key].answerCount++;
              }
            }
          }
        } catch {}
      }

      const evolution = Object.keys(dailyData)
        .sort()
        .map((key) => {
          const d = dailyData[key];
          const satisfaction = d.answerCount > 0 ? Math.round((d.scoreSum / d.answerCount) * 100) / 100 : 0;
          return {
            name: d.dates.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            satisfaction,
            prevSatisfaction: 0,
            responses: d.responseCount
          };
        });

      res.json({ evolution, days, campaign_id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/campaigns/:id/clone", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
      const where: any = { id: req.params.id };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = req.user.id;
      }
      const existing = await prisma.campaign.findFirst({ where });
      if (!existing) {
        return res.status(404).json({ error: "Campanha não encontrada ou sem permissão" });
      }

      const cloned = await prisma.campaign.create({
        data: {
          user_id: req.user.id,
          name: `${existing.name} (Cópia)`,
          type: existing.type,
          status: "Inativo",
          description: existing.description,
          privacy_text: existing.privacy_text,
          questions: existing.questions,
          responses_count: 0,
          perception_excelente: 0,
          perception_bom: 0,
          perception_regular: 0,
          perception_ruim: 0,
          is_global: false,
          report_email: existing.report_email,
          report_time: existing.report_time,
          thank_you_message: existing.thank_you_message,
          start_image: existing.start_image,
          end_image: existing.end_image
        }
      });
      res.json(cloned);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Campaign reset lives after proposals in the original route order
export function registerCampaignResetRoute(app: any) {
  // Reset Campaign Stats
  app.post("/api/campaigns/:id/reset", authenticateToken, async (req: any, res) => {
    try {
      const campaignId = req.params.id;
      const userId = req.user.id;

      const where: any = { id: campaignId };
      if (req.user.email !== ADMIN_EMAIL) {
        where.user_id = userId;
      }

      // Verify ownership
      const campaign = await prisma.campaign.findFirst({
        where
      });

      if (!campaign) return res.sendStatus(404);

      // Reset stats in campaign and delete all responses
      await prisma.$transaction([
        prisma.response.deleteMany({
          where: { campaign_id: campaignId }
        }),
        prisma.campaign.update({
          where: { id: campaignId },
          data: {
            responses_count: 0,
            perception_excelente: 0,
            perception_bom: 0,
            perception_regular: 0,
            perception_ruim: 0
          }
        })
      ]);

      res.json({ message: "Campaign reset successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}