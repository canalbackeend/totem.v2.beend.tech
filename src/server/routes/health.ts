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
        // Seleciona apenas respostas + campaign_id (sem include pesado). A contagem
        // de feedbacks é exata: sem take que transformava a métrica em amostra.
        prisma.response.findMany({ 
          where: {
            ...responseFilter,
            campaign: {
              ...campaignFilter,
              status: 'Ativo'
            }
          },
          select: {
            campaign_id: true,
            answers: true
          },
          orderBy: { created_at: "desc" }
        }),
        prisma.user.findUnique({ where: { id: userId } })
      ]);

      const maxTerminals = isMaster ? -1 : (user?.max_terminals || 10);
      
      let totalQuestions = 0;
      let totalCollaborators = 0;
      let hasCollaborators = false;

      campaigns.forEach((campaign: any) => {
        const qArray = (Array.isArray(campaign.questions) ? campaign.questions : []) as any[];
        totalQuestions += qArray.length;
        
        const collabQuestions = qArray.filter((question: any) => question.type === 'Colaborador');
        if (collabQuestions.length > 0) hasCollaborators = true;
        
        const uniqueCollabs = new Set();
        collabQuestions.forEach((question: any) => {
          (question.options || []).forEach((opt: any) => uniqueCollabs.add(opt.id || opt.text));
        });
        totalCollaborators += uniqueCollabs.size;
      });

      // Mapa campanha -> perguntas (para detectar perguntas 'Texto Aberto')
      const questionsByCampaign = new Map<string, any[]>();
      campaigns.forEach((campaign: any) => {
        questionsByCampaign.set(campaign.id, Array.isArray(campaign.questions) ? campaign.questions : []);
      });

      const feedbackResponses = responses.filter((response: any) => {
        const answers = (Array.isArray(response.answers) ? response.answers : []) as any[];
        const questions = questionsByCampaign.get(response.campaign_id) || [];
        return answers.some((answer: any) => {
          if (answer.comment && answer.comment.trim().length > 0) return true;
          const matchedQuestion = questions.find((question: any) => question.text === answer.question);
          if (matchedQuestion?.type === 'Texto Aberto' && typeof answer.answer === 'string' && answer.answer.trim().length > 0) return true;
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