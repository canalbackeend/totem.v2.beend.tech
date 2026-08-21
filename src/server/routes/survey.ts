import { prisma, publicTerminal, parseCampaignList } from "../deps";

// Survey Specific (Get terminal and campaign by ID/slug)
export function registerSurveyRoutes(app: any) {
  app.get("/api/survey/:id", async (req: any, res: any) => {
    try {
      const terminal = await prisma.terminal.findUnique({
        where: { id: req.params.id }
      });
      if (!terminal) return res.status(404).json({ error: "Terminal não encontrado" });
      
      // Fetch company info for the logo
      const user = await prisma.user.findUnique({ where: { id: terminal.user_id } });

      res.json({
        ...publicTerminal(terminal),
        company_name: user?.empresa || "Minha Empresa",
        logo_url: user?.logo_url
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/survey/terminal/:id", async (req: any, res: any) => {
    try {
      const terminal = await prisma.terminal.findUnique({
        where: { id: req.params.id }
      });
      res.json(publicTerminal(terminal));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/survey/campaign/:id", async (req: any, res: any) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id }
      });
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/survey/terminal/:id/campaigns", async (req: any, res: any) => {
    try {
      const terminal = await prisma.terminal.findUnique({
        where: { id: req.params.id }
      });
      if (!terminal || !terminal.campaigns) {
        return res.json([]);
      }

      const campaignNames = parseCampaignList(terminal.campaigns);

      const allCampaigns = await prisma.campaign.findMany({
        where: {
          user_id: terminal.user_id,
          status: 'Ativo'
        }
      });

      const matched = allCampaigns.filter(c => campaignNames.includes(c.name));
      res.json(matched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}