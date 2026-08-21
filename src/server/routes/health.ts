import { prisma, authenticateToken, isMasterAdmin } from "../deps";

export function registerHealthRoutes(app: any) {
  // Health check
  app.get("/api/health", async (req: any, res: any) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        database: "ok",
        uptime: Math.round(process.uptime())
      });
    } catch (err) {
      console.error("Health check database error:", err);
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        database: "error",
        uptime: Math.round(process.uptime())
      });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const isMaster = isMasterAdmin(req);

      let campaignFilter: any = {};
      let terminalFilter: any = {};
      let responseFilter: any = {};

      if (!isMaster) {
         campaignFilter.user_id = userId;
         terminalFilter.user_id = userId;
         responseFilter.campaign = { user_id: userId };
      }

      const [termCount, campaigns, responses, user] = await Promise.all([
        prisma.terminal.count({ where: terminalFilter }),
        prisma.campaign.findMany({ where: campaignFilter }),
        prisma.response.findMany({ 
          where: {
            ...responseFilter,
            campaign: {
              ...campaignFilter,
              status: 'Ativo'
            }
          },
          include: {
            campaign: true
          },
          orderBy: { created_at: "desc" },
          take: 5000
        }),
        prisma.user.findUnique({ where: { id: userId } })
      ]);

      const maxTerminals = isMaster ? -1 : (user?.max_terminals || 10);
      
      let totalQuestions = 0;
      let totalCollaborators = 0;
      let hasCollaborators = false;

      campaigns.forEach((camp: any) => {
        const qArray = (Array.isArray(camp.questions) ? camp.questions : []) as any[];
        totalQuestions += qArray.length;
        
        const collabQuestions = qArray.filter((q: any) => q.type === 'Colaborador');
        if (collabQuestions.length > 0) hasCollaborators = true;
        
        const uniqueCollabs = new Set();
        collabQuestions.forEach((q: any) => {
          (q.options || []).forEach((opt: any) => uniqueCollabs.add(opt.id || opt.text));
        });
        totalCollaborators += uniqueCollabs.size;
      });

      const feedbackResponses = responses.filter((fb: any) => {
        const answers = (Array.isArray(fb.answers) ? fb.answers : []) as any[];
        const questions = (Array.isArray(fb.campaign?.questions) ? fb.campaign.questions : []) as any[];
        return answers.some((a: any) => {
          if (a.comment && a.comment.trim().length > 0) return true;
          const qInfo = questions.find((q: any) => q.text === a.question);
          if (qInfo?.type === 'Texto Aberto' && typeof a.answer === 'string' && a.answer.trim().length > 0) return true;
          return false;
        });
      });

      res.json({
        terminals: termCount,
        maxTerminals,
        userStatus: user?.status || "Ativo",
        campaigns: campaigns.length,
        questions: totalQuestions,
        collaborators: totalCollaborators,
        feedbacks: feedbackResponses.length,
        hasCollaborators
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}