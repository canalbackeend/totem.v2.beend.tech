import { prisma, authenticateToken, publicResponseLimiter, whitelist, ADMIN_EMAIL } from "./deps";
import { getPerceptionKey } from "../lib/metrics";

async function handleCreateResponse(req: any, res: any) {
  try {
    const campaignId = req.body.campaign_id;
    if (!campaignId) return res.status(400).json({ error: "campaign_id is required" });

    if (typeof campaignId !== "string" || !req.body.answers || !Array.isArray(req.body.answers)) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    const sanitizeAnswers = (answers: any[]) =>
      answers.slice(0, 100).map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const safe: any = {};
        if (typeof item.type === "string") safe.type = item.type.slice(0, 100);
        if (typeof item.question === "string") safe.question = item.question.slice(0, 1000);
        if (typeof item.text === "string") safe.text = item.text.slice(0, 1000);
        if (typeof item.question_id === "string") safe.question_id = item.question_id.slice(0, 100);
        if (typeof item.comment === "string") safe.comment = item.comment.slice(0, 2000);
        const answer = item.answer;
        if (typeof answer === "string") safe.answer = answer.slice(0, 2000);
        else if (typeof answer === "number") safe.answer = answer;
        else if (typeof answer === "boolean") safe.answer = answer;
        else if (Array.isArray(answer)) {
          safe.answer = answer
            .slice(0, 50)
            .map((a: any) => (typeof a === "string" ? a.slice(0, 500) : a))
            .filter((a: any) => typeof a === "string" || typeof a === "number");
        }
        return safe;
      }).filter(Boolean);
    req.body.answers = sanitizeAnswers(req.body.answers);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { user: true }
    });

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Authorization: only allow submissions tied to the caller's own terminal/campaign.
    // Prevents injecting responses into other companies' campaigns (public and authenticated).
    const terminalId = req.body.terminal_id;
    const isPublicEndpoint = req.path.startsWith("/api/public/");
    if (isPublicEndpoint) {
      if (!terminalId) return res.status(400).json({ error: "terminal_id é obrigatório" });
      const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
      if (!terminal) return res.status(403).json({ error: "Terminal não encontrado" });
      if (terminal.user_id !== campaign.user_id) {
        return res.status(403).json({ error: "Terminal não pertence à campanha informada" });
      }
    } else {
      const isMasterAdmin = req.user.email === ADMIN_EMAIL && !req.user.terminal_id;
      if (req.user.terminal_id) {
        if (!terminalId || terminalId !== req.user.terminal_id) {
          return res.status(403).json({ error: "Só é permitido enviar respostas do próprio terminal" });
        }
        if (campaign.user_id !== req.user.id) {
          return res.status(403).json({ error: "Campanha não pertence à sua empresa" });
        }
      } else if (!isMasterAdmin) {
        if (terminalId) {
          const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
          if (!terminal || terminal.user_id !== req.user.id) {
            return res.status(403).json({ error: "Terminal não pertence à sua empresa" });
          }
        }
        if (campaign.user_id !== req.user.id) {
          return res.status(403).json({ error: "Campanha não pertence à sua empresa" });
        }
      }
    }

    // Validate created_at (dedupe key) before querying with it
    let createdDate: Date | null = null;
    if (req.body.created_at) {
      createdDate = new Date(req.body.created_at);
      if (isNaN(createdDate.getTime())) createdDate = null;
    }

    // Prevent duplicates during sync
    if (createdDate && terminalId) {
      const existing = await prisma.response.findFirst({
        where: {
          campaign_id: campaignId,
          terminal_id: terminalId,
          created_at: createdDate
        }
      });
      if (existing) {
        return res.json(existing); // Already synced
      }
    }

    // Check account expiration for Teste 7 dias
    const owner = campaign.user;
    if (owner && owner.plano === "Teste 7 dias" && owner.vencimento) {
      const expirationDate = new Date(owner.vencimento);
      if (new Date() > expirationDate) {
        return res.status(403).json({ error: "Período de teste expirado. Terminal inativo." });
      }
    }

    // Ensure response is linked to the campaign owner
    const bodyAnswers = req.body.answers || [];
    const collabAnswer = bodyAnswers.find((a: any) => a.type === 'Colaborador');
    const createFields = whitelist(req.body, ["campaign_id", "terminal_id", "answers"]);
    if (createdDate) {
      createFields.created_at = req.body.created_at;
    }
    const responseData = {
      ...createFields,
      user_id: campaign.user_id,
      collaborator_name: collabAnswer?.answer || req.body.collaborator_name || null
    };

    const response = await prisma.response.create({
      data: responseData
    });

    // Automatically update the campaign's responses_count and perceptions
    const answers = req.body.answers || [];
    const ratingAnswer = answers.find((a: any) => ['SMILE 4', 'SMILE 5', 'NPS', 'Avaliação de 1 à 5'].includes(a?.type)) || answers[answers.length - 1];
    const lastAnswer = ratingAnswer ? ratingAnswer.answer : null;

    let updateData: any = {
      responses_count: (campaign.responses_count || 0) + 1
    };

    if (lastAnswer !== null && lastAnswer !== undefined && (typeof lastAnswer === 'string' || typeof lastAnswer === 'number')) {
      const perception = getPerceptionKey(lastAnswer, ratingAnswer?.type);
      if (perception) {
        const field = `perception_${perception}` as 'perception_excelente' | 'perception_bom' | 'perception_regular' | 'perception_ruim';
        updateData[field] = (campaign[field] || 0) + 1;
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData
    });

    res.json(response);
  } catch (err: any) {
    console.error("Response creation error:", err);
    res.status(500).json({ error: err.message });
  }
}

export function registerResponseRoutes(app: any) {
  app.get("/api/responses", authenticateToken, async (req: any, res) => {
    const { campaign_id, startDate, endDate, terminal_id, collaborator_name } = req.query;
    const userId = req.user.id;
    const isMasterAdmin = req.user.email === ADMIN_EMAIL && !req.user.terminal_id;
    
    try {
      const profile = await prisma.user.findUnique({ where: { id: userId } });
      const isAdmin = profile?.role === "Administrador" && !req.user.terminal_id;

      const where: any = {};
      if (campaign_id) {
        where.campaign_id = campaign_id as string;
      }

      if (startDate) {
        const start = new Date(startDate + "T00:00:00.000Z");
        if (!isNaN(start.getTime())) {
          where.created_at = { ...where.created_at, gte: start };
        }
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59.999Z");
        if (!isNaN(end.getTime())) {
          where.created_at = { ...where.created_at, lte: end };
        }
      }
      
      // Authorization filter - terminal filter applies to all
      if (req.user.terminal_id) {
        where.terminal_id = req.user.terminal_id;
      } else if (terminal_id && terminal_id !== 'all') {
        where.terminal_id = terminal_id as string;
      }

      // Collaborator filter
      if (collaborator_name) {
        where.collaborator_name = collaborator_name as string;
      }

      // Company filter only for non-admin users
      if (!isMasterAdmin && !isAdmin) {
        where.campaign = { user_id: userId };
      }

      // Limit results to the most recent N to avoid loading the whole table
      // (huge payloads freeze the event loop with JSON.stringify and exhaust memory).
      // TODO: move collaborator aggregation to the server for unbounded accuracy.
      const responses = await prisma.response.findMany({
        where,
        include: {
          campaign: { select: { name: true, status: true, user_id: true } },
          terminal: { select: { name: true } },
          user: { select: { empresa: true } }
        },
        orderBy: { created_at: "desc" },
        take: 5000
      });
      res.json(responses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/responses", authenticateToken, handleCreateResponse);
  app.post("/api/public/responses", publicResponseLimiter, handleCreateResponse);
}