import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiLimiter } from "./deps";
import { registerEarlyAuthRoutes, registerAuthRoutes } from "./routes/auth";
import { registerHealthRoutes } from "./routes/health";
import { registerCampaignMetricsRoutes, registerCampaignRoutes, registerCampaignResetRoute } from "./routes/campaigns";
import { registerUploadRoutes } from "./uploads";
import { registerShopRoutes } from "./routes/shop";
import { registerAdminTrackingRoute, registerPlatformSettingsRoutes, registerAdminLateRoutes, registerAdminLogsRoute } from "./routes/admin";
import { registerTerminalRoutes } from "./routes/terminals";
import { registerResponseRoutes } from "./responses";
import { registerCompanyRoutes } from "./routes/companies";
import { registerProposalRoutes } from "./routes/proposals";
import { registerProfileRoutes } from "./routes/profiles";
import { registerSurveyRoutes } from "./routes/survey";

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://viacep.com.br"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false,
  }));
  app.use(cors({ origin: process.env.APP_URL || "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: false }));

  // /api/auth/register must stay before the global API limiter (original ordering)
  registerEarlyAuthRoutes(app);

  // Global API rate limiter
  app.use("/api", apiLimiter);

  registerAuthRoutes(app);
  registerHealthRoutes(app);
  registerCampaignMetricsRoutes(app);
  registerUploadRoutes(app);
  registerCampaignRoutes(app);
  registerShopRoutes(app);
  registerAdminTrackingRoute(app);
  registerAdminLogsRoute(app);
  registerTerminalRoutes(app);
  registerResponseRoutes(app);
  registerPlatformSettingsRoutes(app);
  registerCompanyRoutes(app);
  registerProposalRoutes(app);
  registerCampaignResetRoute(app);
  registerProfileRoutes(app);
  registerSurveyRoutes(app);
  registerAdminLateRoutes(app);

  // Centralized error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  });

  return app;
}

export const app = buildApp();