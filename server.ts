import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import cron from "node-cron";
import dotenv from "dotenv";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Validate Environment Variables (Optional for local testing)
if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  console.warn("WARNING: DATABASE_URL environment variable is missing for production.");
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required. Set a strong secret key.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "adm@beend.tech";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("FATAL: ADMIN_PASSWORD environment variable is required. Set a strong password for the admin account.");
  process.exit(1);
}

const prisma = new PrismaClient();

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

async function ensureAdminExists() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          password: hashedPassword,
          nome: "Administrador Master",
          empresa: "beend.tech",
          role: "Administrador",
          status: "Ativo"
        }
      });
      console.log(`Master admin created: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error("Error ensuring admin exists:", err);
  }
}

// Sync all companies to users table to ensure everyone can login
async function syncCompaniesToUsers() {
  try {
    const companies = await prisma.company.findMany();
    for (const comp of companies) {
      const cleanEmail = String(comp.email).trim().toLowerCase();
      if (!cleanEmail) continue;

      const passwordToUse = comp.password || "123456";
      const hashedPassword = comp.password?.startsWith("$2b$") 
        ? comp.password 
        : await bcrypt.hash(passwordToUse, 10);

      await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          empresa: comp.empresa,
          responsavel: comp.responsavel,
          cnpj: comp.cnpj,
          telefone: comp.telefone,
          status: comp.status,
          plano: comp.plano || "Mensal",
          vencimento: comp.vencimento
        },
        create: {
          email: cleanEmail,
          password: hashedPassword,
          empresa: comp.empresa,
          responsavel: comp.responsavel,
          cnpj: comp.cnpj,
          telefone: comp.telefone,
          status: comp.status,
          plano: comp.plano || "Mensal",
          vencimento: comp.vencimento
        }
      });
    }
    console.log("Sync companies to users completed.");
  } catch (err) {
    console.error("Error syncing companies to users:", err);
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password, nome, empresa } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Calculate 7 days trial
    const now = new Date();
    const trialExpiration = new Date(now);
    trialExpiration.setDate(trialExpiration.getDate() + 7);

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        nome: nome || cleanEmail.split('@')[0],
        empresa: empresa || "Minha Empresa",
        plano: "Teste 7 dias",
        vencimento: trialExpiration.toISOString(),
        status: "Ativo"
      },
    });

    // 2. Create Company to show in /empresas list
    await prisma.company.create({
      data: {
        empresa: empresa || "Minha Empresa",
        email: cleanEmail,
        // password: password, // REMOVED: security risk
        responsavel: nome || cleanEmail.split('@')[0],
        cnpj: "", // Required field in schema
        plano: "Teste 7 dias",
        vencimento: trialExpiration.toISOString(),
        status: "Ativo"
      }
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ user, session: { access_token: token } });
  } catch (err: any) {
    console.error("Register error:", err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "Este e-mail já está em uso." });
    }
    res.status(500).json({ error: "Erro ao criar conta: " + err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.password) {
      console.log(`Login failed: user not found or no password for ${cleanEmail}`);
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log(`Login failed: incorrect password for ${cleanEmail}`);
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
    if (user.status !== "Ativo") {
      return res.status(403).json({ error: "Conta bloqueada. Entre em contato com o suporte." });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ user, session: { access_token: token } });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erro na conexão com o banco: " + err.message });
  }
});

app.post("/api/terminals/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const terminals = await prisma.terminal.findMany({
      where: { email }
    });

    let matchedTerminal = null;
    for (const terminal of terminals) {
      if (!terminal.password) continue;
      const isValid = terminal.password.startsWith("$2b$") || terminal.password.startsWith("$2a$")
        ? await bcrypt.compare(password, terminal.password)
        : password === terminal.password;
      if (isValid) {
        matchedTerminal = terminal;
        if (!terminal.password.startsWith("$2b$") && !terminal.password.startsWith("$2a$")) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await prisma.terminal.update({
            where: { id: terminal.id },
            data: { password: hashedPassword }
          });
        }
        break;
      }
    }

    if (!matchedTerminal) {
      return res.status(401).json({ error: "Credenciais de terminal inválidas" });
    }

    const user = await prisma.user.findUnique({ where: { id: matchedTerminal.user_id } });
    
    if (user && user.status !== "Ativo") {
      return res.status(403).json({ error: "Conta bloqueada. Entre em contato com o suporte." });
    }

    if (user && user.plano === "Teste 7 dias" && user.vencimento) {
      const expirationDate = new Date(user.vencimento);
      if (new Date() > expirationDate) {
        return res.status(403).json({ error: "Período de teste expirado. Entre em contato com o suporte." });
      }
    }

    // Terminals use a simple token tied to their owner (user_id) but we can put the terminal ID in the token too
    const token = jwt.sign({ id: matchedTerminal.user_id, terminal_id: matchedTerminal.id, email: matchedTerminal.email }, JWT_SECRET);
    
    res.json({
      id: matchedTerminal.id,
      name: matchedTerminal.name,
      user_id: matchedTerminal.user_id,
      campaigns: matchedTerminal.campaigns,
      email: matchedTerminal.email,
      company_name: user?.empresa || "Minha Empresa",
      logo_url: user?.logo_url,
      access_token: token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  try {
    const userRole = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!userRole) return res.status(404).json({ error: "User not found" });
    
    const userData = {
      ...userRole,
      terminal_id: req.user.terminal_id
    };

    res.json({ user: userData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function calculateCampaignMetrics(campaign: any, responses: any[]) {
  if (!campaign || !responses.length) {
    return {
      nps: { score: 0, promotores: 0, neutros: 0, detratores: 0, total: 0 },
      overallSatisfaction: 0,
      totalResponses: responses.length,
      questionStats: []
    };
  }

  const npsQ = campaign.questions?.find((q: any) => q.type === 'NPS');
  const normalizedNpsText = npsQ ? String(npsQ.text || '').trim().toLowerCase() : '';
  
  let p = 0, n = 0, d = 0, npsTotal = 0;
  let totalSatSum = 0;
  let totalSatAnswers = 0;

  const statsMap = new Map();

  responses.forEach(r => {
    let answers = [];
    try {
      answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
    } catch (e) { answers = []; }

    answers.forEach((a: any) => {
      const qText = String(a.question || '').trim();
      const qKey = qText.toLowerCase();
      const campaignQ = campaign.questions?.find((cq: any) => String(cq.text || '').trim().toLowerCase() === qKey);
      const qType = a.type || campaignQ?.type;
      
      // NPS Logic - ONLY if answer is NOT null
      if (normalizedNpsText && qKey === normalizedNpsText && a.answer !== null && a.answer !== undefined && a.answer !== '') {
        const val = Number(a.answer);
        if (!isNaN(val)) {
          npsTotal++;
          if (val >= 9) p++; 
          else if (val >= 7) n++; 
          else d++;
        }
      }

      // General Satisfaction (CSAT) Logic
      // Helper to map values
      const getSatisfactionScore = (ans: any, type: string) => {
        if (ans === null || ans === undefined || ans === '') return null;
        
        const valStr = String(ans).trim().toUpperCase();
        const num = Number(ans);
        const isNum = !isNaN(num) && typeof ans !== 'boolean';

        if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM', 'ÓTIMO', '5', '9', '10'].includes(valStr) || (isNum && num >= 9) || (isNum && type === 'SMILE 5' && num === 5) || (isNum && type === 'SMILE 4' && num === 4)) {
          return 100;
        } else if (['SATISFEITO', 'BOM', '4', '7', '8'].includes(valStr) || (isNum && num >= 7 && num <= 8) || (isNum && type === 'SMILE 5' && num === 4) || (isNum && type === 'SMILE 4' && num === 3)) {
          return 75;
        } else if (['REGULAR', 'MÉDIO', '3', '5', '6'].includes(valStr) || (isNum && num >= 5 && num <= 6) || (isNum && type === 'SMILE 5' && num === 3) || (isNum && type === 'SMILE 4' && num === 2)) {
          return 50;
        } else if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO', '2', '1', '0', '4', '3'].includes(valStr) || (isNum && num <= 4) || (isNum && type === 'SMILE 5' && num <= 2) || (isNum && type === 'SMILE 4' && num === 1)) {
          return 25;
        }
        return null;
      };

      const score = getSatisfactionScore(a.answer, qType || '');
      if (score !== null) {
        totalSatSum += score;
        totalSatAnswers++;
      }

      // Track stats per question
      if (!statsMap.has(qText)) {
        statsMap.set(qText, { satSum: 0, satCount: 0, count: 0, type: qType, distribution: {} });
      }
      const s = statsMap.get(qText);
      
      // Increment engagement count ONLY if answer is not empty
      if (a.answer !== null && a.answer !== undefined && (Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== '')) {
        s.count++;
        if (score !== null) {
          s.satSum += score;
          s.satCount++;
        }

        // Track distribution (handling arrays for Multi-Choice)
        if (qType !== 'Texto Aberto') {
          const answersToTrack = Array.isArray(a.answer) ? a.answer : [a.answer];
          answersToTrack.forEach((val: any) => {
            if (val !== null && val !== undefined) {
              const optionKey = String(val).trim().toUpperCase();
              if (optionKey) {
                s.distribution[optionKey] = (s.distribution[optionKey] || 0) + 1;
              }
            }
          });
        }
      }
    });
  });

  const npsScore = npsTotal > 0 ? ((p - d) / npsTotal) * 100 : 0;
  const overallSatisfaction = totalSatAnswers > 0 ? totalSatSum / totalSatAnswers : 0;

  const questionStats = Array.from(statsMap.entries()).map(([text, s]) => {
    return {
      text,
      satisfaction: s.satCount > 0 ? s.satSum / s.satCount : 0,
      count: s.count,
      type: s.type,
      distribution: s.distribution
    };
  });

  return {
    nps: { score: npsScore, promotores: p, neutros: n, detratores: d, total: npsTotal },
    overallSatisfaction,
    totalResponses: responses.length,
    questionStats
  };
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// Dashboard Stats
app.get("/api/dashboard/stats", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const isMasterAdmin = req.user.email === ADMIN_EMAIL;

    let campaignFilter: any = {};
    let terminalFilter: any = {};
    let responseFilter: any = {};

    if (!isMasterAdmin) {
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
        }
      }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    const maxTerminals = isMasterAdmin ? -1 : (user?.max_terminals || 10);
    
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

    const responses = await prisma.response.findMany({ where: whereResponses });
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

// Helper to send report emails
async function sendDailyReports(targetTimeStr?: string) {
  console.log(`Iniciando envio de relatórios diários... ${targetTimeStr ? `[Horário Alvo: ${targetTimeStr}]` : '[Teste/Manual]'}`);
  
  try {
    // 1. Fetch campaigns that have a report email and are active
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "Ativo",
        report_email: { not: null }
      }
    });

    if (!campaigns || campaigns.length === 0) {
      console.log("Nenhuma campanha configurada para relatórios diários.");
      return;
    }

    // Filter campaigns by report time
    const campaignsToSend = campaigns.filter(c => {
      if (targetTimeStr) {
        const campaignTime = (c as any).report_time || "08:00"; 
        return campaignTime === targetTimeStr;
      }
      return true; 
    });

    if (campaignsToSend.length === 0) {
      console.log("Nenhuma campanha agendada para o horário atual.");
      return;
    }

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    for (const campaign of campaignsToSend) {
      // 2. Generate secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 720); // Extends token validity to 30 days (720 hours) for seamless link access 

      // 3. Save token
      await prisma.reportToken.create({
        data: {
          token,
          campaign_id: campaign.id,
          expires_at: expiresAt
        }
      });

      // 4. Send email
      const reportLink = `${appUrl}/relatorio-seguro/${token}`;
      
      const mailOptions = {
        from: `"Totem been.tech" <${process.env.GMAIL_USER}>`,
        to: campaign.report_email!,
        subject: `Relatório Diário: ${campaign.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f39c13; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">been.tech</h1>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #333;">Olá! Aqui está seu relatório diário.</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                O relatório da campanha <strong>"${campaign.name}"</strong> referente ao dia de ontem já está disponível para visualização.
              </p>
              <div style="text-align: center; margin: 40px 0;">
                <a href="${reportLink}" style="background-color: #0b82ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Visualizar Relatório Completo
                </a>
              </div>
              <p style="color: #999; font-size: 12px; font-style: italic;">
                * Este link é de uso único e expirará em 24 horas por motivos de segurança.
              </p>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-t: 1px solid #eee;">
              <p style="color: #999; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} been.tech. Todos os direitos reservados.</p>
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Relatório enviado para ${campaign.report_email} (Campanha: ${campaign.id})`);
      } catch (mailError) {
        console.error(`Erro ao enviar e-mail para ${campaign.report_email}:`, mailError);
      }
    }
  } catch (err) {
    console.error("Erro no processo de relatórios diários:", err);
  }
}

// Helper to upload base64 to Supabase bucket "medias"
async function uploadBase64ToSupabase(base64Str: string, folder: string): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase não está configurado. Por favor, defina SUPABASE_URL e SUPABASE_ANON_KEY nas suas variáveis de ambiente.");
  }

  // Parse the base64 string
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    if (base64Str.startsWith("http")) {
      return base64Str;
    }
    throw new Error("Formato de imagem inválido. Deve ser um base64 válido.");
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  let ext = "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
  else if (mimeType.includes("gif")) ext = "gif";
  else if (mimeType.includes("webp")) ext = "webp";
  else if (mimeType.includes("svg")) ext = "svg";

  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("medias")
    .upload(filename, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao enviar para o Supabase Storage: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from("medias")
    .getPublicUrl(filename);

  return publicUrl;
}

app.post("/api/upload", authenticateToken, async (req: any, res: any) => {
  const { image, folder } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Imagem em formato base64 é obrigatória" });
  }
  try {
    // Only allow managers or users to upload to their own spaces if needed later
    // For now, just ensuring auth is active
    const url = await uploadBase64ToSupabase(image, folder || "geral");
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint to download and serve images with CORS headers (public for PDF logos)
app.get("/api/proxy-image", async (req: any, res: any) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "Parâmetro url é obrigatório" });
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: "URL inválida" });
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from remote: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
    res.end(buffer);
  } catch (err: any) {
    console.error("Error proxying image:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- APP ROUTES ---

// Campaigns
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
        let assigned: string[] = [];
        try {
          assigned = JSON.parse(terminal.campaigns);
        } catch (e) {
          assigned = terminal.campaigns.split(',').map(c => c.trim()).filter(Boolean);
        }
        
        if (Array.isArray(assigned) && assigned.length > 0) {
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
    
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { created_at: "desc" }
    });
    res.json(campaigns);
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
      data: { ...req.body, user_id: req.user.id }
    });
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      data: req.body
    });
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    const days = parseInt(req.query.days as string) || 7;
    const where: any = { id: req.params.id };
    if (req.user.email !== ADMIN_EMAIL) {
      where.user_id = req.user.id;
    }
    const campaign = await prisma.campaign.findFirst({ where });
    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada" });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const responses = await prisma.response.findMany({
      where: {
        campaign_id: req.params.id,
        created_at: {
          gte: startDate,
          lte: today
        }
      },
      select: {
        created_at: true,
        answers: true
      },
      orderBy: { created_at: "asc" }
    });

    const dailyData: Record<string, { scoreSum: number; answerCount: number; dates: Date; responseCount: number }> = {};

    for (let i = 0; i < days; i++) {
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
            const val = String(a.answer || a.value || "").toUpperCase();
            let score = 0;
            if (["MUITO SATISFEITO", "EXCELENTE", "MUITO BOM"].includes(val) || (typeof (a.answer || a.value) === "number" && (a.answer || a.value) >= 9)) {
              score = 100;
            } else if (["SATISFEITO", "BOM"].includes(val) || (typeof (a.answer || a.value) === "number" && (a.answer || a.value) >= 7 && (a.answer || a.value) <= 8)) {
              score = 75;
            } else if (["REGULAR"].includes(val) || (typeof (a.answer || a.value) === "number" && (a.answer || a.value) >= 5 && (a.answer || a.value) <= 6)) {
              score = 50;
            } else if (["RUIM", "PÉSSIMO", "INSATISFEITO", "MUITO INSATISFEITO"].includes(val) || (typeof (a.answer || a.value) === "number" && (a.answer || a.value) <= 4)) {
              score = 25;
            }
            if (score > 0) {
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
        report_time: existing.report_time
      }
    });
    res.json(cloned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Shop Products
app.get("/api/products", async (req, res) => {
  try {
    const products = await prisma.shopProduct.findMany({
      orderBy: { created_at: "desc" }
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", authenticateToken, async (req: any, res) => {
  try {
    // Check if master admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only master admin can manage products" });
    }
    const product = await prisma.shopProduct.create({
      data: { ...req.body, user_id: req.user.id }
    });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/products/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only master admin can manage products" });
    }
    const product = await prisma.shopProduct.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only master admin can manage products" });
    }
    await prisma.shopProduct.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Tracking
app.get("/api/admin/tracking", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only master admin can access tracking" });
    }

    const [profiles, companies, terminals, campaigns, responses] = await Promise.all([
      prisma.user.findMany(),
      prisma.company.findMany(),
      prisma.terminal.findMany({ orderBy: { created_at: "desc" } }),
      prisma.campaign.findMany({ select: { id: true, name: true } }),
      prisma.response.findMany({ select: { terminal_id: true, created_at: true } })
    ]);

    res.json({ profiles, companies, terminals, campaigns, responses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Terminals
app.get("/api/terminals", authenticateToken, async (req: any, res) => {
  try {
    const where: any = { user_id: req.user.id };
    if (req.user.terminal_id) {
      where.id = req.user.terminal_id;
    }

    const terminals = await prisma.terminal.findMany({
      where,
      orderBy: { created_at: "desc" }
    });
    const sanitized = terminals.map(({ password, ...rest }) => ({ ...rest, password: null }));
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/terminals", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    if (user.status !== "Ativo") {
      return res.status(403).json({ error: "Empresa bloqueada. Entre em contato com o suporte." });
    }

    const isMasterAdmin = req.user.email === ADMIN_EMAIL;

    if (!isMasterAdmin && user.max_terminals > 0) {
      const termCount = await prisma.terminal.count({ where: { user_id: req.user.id } });
      if (termCount >= user.max_terminals) {
        return res.status(403).json({ error: `Limite de terminais atingido (${user.max_terminals}). Entre em contato com o suporte para aumentar seu limite.` });
      }
    }

    const { password, ...rest } = req.body;
    const plainPassword = password || "term123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const terminal = await prisma.terminal.create({
      data: { ...rest, password: hashedPassword, user_id: req.user.id }
    });
    const { password: _, ...terminalWithoutHash } = terminal;
    res.json({ ...terminalWithoutHash, password: plainPassword });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/terminals/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
    const { password, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const terminal = await prisma.terminal.update({
      where: { id: req.params.id, user_id: req.user.id },
      data: updateData
    });
    const { password: _, ...terminalWithoutHash } = terminal;
    res.json({ ...terminalWithoutHash, password: password || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/terminals/:id/reset-password", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
    const newPassword = req.body.password || "term123";
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const terminal = await prisma.terminal.update({
      where: { id: req.params.id, user_id: req.user.id },
      data: { password: hashedPassword }
    });
    const { password: _, ...terminalWithoutHash } = terminal;
    res.json({ ...terminalWithoutHash, password: newPassword });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/terminals/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.terminal_id) return res.status(403).json({ error: "Access denied" });
    await prisma.terminal.delete({
      where: { id: req.params.id, user_id: req.user.id }
    });
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Responses
app.get("/api/responses", authenticateToken, async (req: any, res) => {
  const { campaign_id, startDate, endDate, terminal_id } = req.query;
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
      const start = new Date(startDate as string);
      if (!isNaN(start.getTime())) {
        where.created_at = { ...where.created_at, gte: start };
      }
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      if (!isNaN(end.getTime())) {
        where.created_at = { ...where.created_at, lte: end };
      }
    }
    
    // Authorization filter
    if (!isMasterAdmin && !isAdmin) {
      if (req.user.terminal_id) {
        where.terminal_id = req.user.terminal_id;
      } else if (terminal_id && terminal_id !== 'all') {
        where.terminal_id = terminal_id as string;
      }
      
      if (profile?.empresa) {
        // Find all users in the same company
        const companyUsers = await prisma.user.findMany({
          where: { empresa: profile.empresa },
          select: { id: true }
        });
        const userIds = companyUsers.map(u => u.id);
        where.campaign = { user_id: { in: userIds } };
      } else {
        where.campaign = { user_id: userId };
      }
    }

    const responses = await prisma.response.findMany({
      where,
      include: {
        campaign: { select: { name: true, questions: true, status: true, user_id: true } },
        terminal: { select: { name: true } },
        user: { select: { empresa: true } }
      },
      orderBy: { created_at: "desc" }
    });
    res.json(responses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/responses", async (req, res) => {
  try {
    const campaignId = req.body.campaign_id;
    if (!campaignId) return res.status(400).json({ error: "campaign_id is required" });

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { user: true }
    });

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Prevent duplicates during sync
    if (req.body.created_at && req.body.terminal_id) {
      const existing = await prisma.response.findFirst({
        where: {
          campaign_id: campaignId,
          terminal_id: req.body.terminal_id,
          created_at: new Date(req.body.created_at)
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
    const responseData = {
      ...req.body,
      user_id: campaign.user_id
    };

    const response = await prisma.response.create({
      data: responseData
    });

    // Automatically update the campaign's responses_count and perceptions
    const answers = req.body.answers || [];
    const lastAnsObj = answers[answers.length - 1];
    const lastAnswer = lastAnsObj ? lastAnsObj.answer : null;

    let updateData: any = {
      responses_count: (campaign.responses_count || 0) + 1
    };

    if (lastAnswer !== null && lastAnswer !== undefined && (typeof lastAnswer === 'string' || typeof lastAnswer === 'number')) {
      const val = typeof lastAnswer === 'string' ? lastAnswer.toUpperCase() : lastAnswer;
      if (val === 'MUITO SATISFEITO' || val === 'EXCELENTE' || val === 'MUITO BOM' || (typeof val === 'number' && val >= 9)) {
        updateData.perception_excelente = (campaign.perception_excelente || 0) + 1;
      } else if (val === 'SATISFEITO' || val === 'BOM' || (typeof val === 'number' && val >= 7 && val <= 8)) {
        updateData.perception_bom = (campaign.perception_bom || 0) + 1;
      } else if (val === 'REGULAR' || (typeof val === 'number' && val >= 5 && val <= 6)) {
        updateData.perception_regular = (campaign.perception_regular || 0) + 1;
      } else if (val === 'RUIM' || val === 'PÉSSIMO' || val === 'INSATISFEITO' || val === 'MUITO INSATISFEITO' || (typeof val === 'number' && val <= 4)) {
        updateData.perception_ruim = (campaign.perception_ruim || 0) + 1;
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
});

// Platform Settings
app.get("/api/platform-settings/:key", async (req, res) => {
  try {
    const setting = await prisma.platformSettings.findUnique({
      where: { key: req.params.key }
    });
    res.json(setting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/platform-settings/:key", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const setting = await prisma.platformSettings.upsert({
      where: { key: req.params.key },
      update: { value: req.body.value },
      create: { key: req.params.key, value: req.body.value }
    });

    // If we are setting the global NPS campaign, sync the campaigns table
    if (req.params.key === 'global_nps_campaign_id') {
      const selectedId = typeof req.body.value === 'object' ? req.body.value.id : req.body.value;
      
      // Reset all
      await prisma.campaign.updateMany({
        where: { is_global: true },
        data: { is_global: false }
      });

      // Set one
      if (selectedId && selectedId !== 'none') {
        await prisma.campaign.update({
          where: { id: selectedId },
          data: { is_global: true }
        });
      }
    }

    res.json(setting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Companies
app.get("/api/companies", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  const { page = "1", pageSize = "10" } = req.query;
  const p = parseInt(page as string);
  const ps = parseInt(pageSize as string);
  
  try {
    const [companies, count] = await prisma.$transaction([
      prisma.company.findMany({
        orderBy: { created_at: "desc" },
        skip: (p - 1) * ps,
        take: ps
      }),
      prisma.company.count()
    ]);
    res.json({ data: companies, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/companies/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    res.json(company);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/companies", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const cleanEmail = String(req.body.email).trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    
    const company = await prisma.company.create({ 
      data: { 
        ...req.body, 
        email: cleanEmail,
        password: undefined // REMOVED: security risk
      } 
    });
    
    // Create or update corresponding user so they can login
    const rawPassword = String(req.body.password || '123456').trim();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    
    await prisma.user.upsert({
      where: { email: cleanEmail },
      update: {
        empresa: company.empresa,
        responsavel: company.responsavel,
        password: hashedPassword,
        cnpj: company.cnpj,
        telefone: company.telefone,
        status: company.status,
        plano: company.plano || 'Mensal',
        vencimento: company.vencimento
      },
      create: {
        email: cleanEmail,
        password: hashedPassword,
        empresa: company.empresa,
        responsavel: company.responsavel,
        cnpj: company.cnpj,
        telefone: company.telefone,
        plano: company.plano || 'Mensal',
        vencimento: company.vencimento,
        status: company.status
      }
    });

    res.json(company);
  } catch (err: any) {
    console.error("Create company error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/companies/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const oldCompany = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!oldCompany) return res.status(404).json({ error: "Empresa não encontrada" });

    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = String(updateData.email).trim().toLowerCase();
    }

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: updateData
    });

    // Sync with User table
    const cleanEmail = company.email;
    const oldEmail = oldCompany.email;

    const userUpdateData: any = {
      empresa: company.empresa,
      responsavel: company.responsavel,
      cnpj: company.cnpj,
      telefone: company.telefone,
      status: company.status,
      plano: company.plano || 'Mensal',
      vencimento: company.vencimento
    };

    if (req.body.password) {
      const rawPassword = String(req.body.password).trim();
      userUpdateData.password = await bcrypt.hash(rawPassword, 10);
      userUpdateData.email = cleanEmail; // Ensure email is also updated in User table
    }

    // If email changed, we need to update the user with the OLD email to the NEW email
    if (cleanEmail !== oldEmail) {
      userUpdateData.email = cleanEmail;
      await prisma.user.updateMany({
        where: { email: oldEmail },
        data: userUpdateData
      });
    } else {
      await prisma.user.updateMany({
        where: { email: cleanEmail },
        data: userUpdateData
      });
    }

    res.json(company);
  } catch (err: any) {
    console.error("Update company error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/companies/:id/reset-password", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

    const newPassword = req.body.password || '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.company.update({
        where: { id: req.params.id },
        data: { password: newPassword } // Original keeps the plaintext one for reference in this specific app logic it seems
      }),
      prisma.user.updateMany({
        where: { email: company.email },
        data: { password: hashedPassword }
      })
    ]);

    res.json({ message: "Senha alterada com sucesso" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/companies/:id/status", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const { status } = req.body;
    if (!["Ativo", "Bloqueado"].includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use 'Ativo' ou 'Bloqueado'." });
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

    const user = await prisma.user.findUnique({ where: { email: company.email } });

    await prisma.$transaction([
      prisma.company.update({
        where: { id: req.params.id },
        data: { status }
      }),
      prisma.user.updateMany({
        where: { email: company.email },
        data: { status }
      }),
      ...(user ? [prisma.terminal.updateMany({
        where: { user_id: user.id },
        data: { status: status === "Bloqueado" ? "Bloqueado" : "offline" }
      })] : [])
    ]);

    res.json({ message: `Empresa ${status === "Ativo" ? "desbloqueada" : "bloqueada"} com sucesso`, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/companies/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROPOSALS (Admin Only) ---

async function generateProposalNumber() {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const last = await prisma.proposal.findFirst({
    where: { proposal_number: { startsWith: prefix } },
    orderBy: { proposal_number: "desc" },
    select: { proposal_number: true }
  });
  if (!last) return `${prefix}0001`;
  const lastNum = parseInt(last.proposal_number.split("-")[2]);
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

app.get("/api/proposals", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { client_name: { contains: search, mode: "insensitive" } },
        { proposal_number: { contains: search, mode: "insensitive" } }
      ];
    }

    const [data, count] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.proposal.count({ where })
    ]);

    res.json({ data, count, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/proposals/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proposals", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const proposalNumber = await generateProposalNumber();
    const today = new Date();
    const validity = new Date(today);
    validity.setDate(validity.getDate() + 10);

    const defaults = {
      greeting: `Prezado(a) ${req.body.contact_person || "Cliente"},`,
      general_description: "Temos o prazer de apresentar nossa solução completa de coleta de feedbacks e pesquisa de satisfação. Nossa plataforma oferece terminais inteligentes integrados a um painel de análise em tempo real, permitindo que você transforme cada interação em insights valiosos para o crescimento do seu negócio.",
      implementation_reqs: "• Instalação e configuração dos terminais\n• Criação e personalização das campanhas de pesquisa\n• Treinamento da equipe para operação do sistema\n• Integração com sistemas existentes (se aplicável)",
      technical_support: "Suporte técnico especializado durante horário comercial (segunda a sexta, 9h às 18h). Atendimento via telefone, e-mail e acesso remoto quando necessário.",
      warranty: "Garantia de 12 meses contra defeitos de fabricação e funcionamento. Manutenção preventiva e corretiva inclusas durante o período de vigência do contrato.",
      resources: ["Painel de análise em tempo real", "Relatórios automáticos por e-mail", "Terminais com modo offline", "Pesquisas personalizáveis (NPS, SMILE, Texto Aberto)", "Dashboard com métricas de satisfação", "Exportação de dados em CSV e PDF"],
      payment_terms: "Pagamento via boleto bancário ou PIX, com vencimento todo dia 10 de cada mês. Primeiro faturamento após a instalação dos terminais.",
      final_considerations: "Esta proposta é válida até a data de vencimento indicada acima. Após este período, os valores poderão ser revisados."
    };

    const proposal = await prisma.proposal.create({
      data: {
        proposal_number: proposalNumber,
        client_name: req.body.client_name || "",
        contact_person: req.body.contact_person || "",
        email: req.body.email || "",
        phone: req.body.phone || "",
        cep: req.body.cep || "",
        address: req.body.address || "",
        proposal_date: req.body.proposal_date || today.toISOString().split("T")[0],
        validity_date: req.body.validity_date || validity.toISOString().split("T")[0],
        greeting: req.body.greeting || defaults.greeting,
        general_description: req.body.general_description || defaults.general_description,
        implementation_reqs: req.body.implementation_reqs || defaults.implementation_reqs,
        technical_support: req.body.technical_support || defaults.technical_support,
        warranty: req.body.warranty || defaults.warranty,
        resources: req.body.resources || defaults.resources,
        payment_terms: req.body.payment_terms || defaults.payment_terms,
        final_considerations: req.body.final_considerations || defaults.final_considerations,
        observations: req.body.observations || "",
        plan_type: req.body.plan_type || "Mensal",
        monthly_value: parseFloat(req.body.monthly_value) || 0,
        plan_description: req.body.plan_description || "",
        items: req.body.items || [],
        shipping_cost: parseFloat(req.body.shipping_cost) || 0,
        images: req.body.images || [],
        image_library: req.body.image_library || [],
        responsible_name: req.body.responsible_name || "",
        responsible_phone: req.body.responsible_phone || "",
        status: req.body.status || "Rascunho"
      }
    });

    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/proposals/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const existing = await prisma.proposal.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Proposta não encontrada" });

    const updateData = { ...req.body };
    if (updateData.items && Array.isArray(updateData.items)) {
      updateData.items = updateData.items.map((item: any) => ({
        ...item,
        total: (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0)
      }));
    }
    if (updateData.monthly_value) updateData.monthly_value = parseFloat(updateData.monthly_value);
    if (updateData.shipping_cost) updateData.shipping_cost = parseFloat(updateData.shipping_cost);

    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/proposals/:id", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    await prisma.proposal.delete({ where: { id: req.params.id } });
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proposals/:id/clone", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const existing = await prisma.proposal.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Proposta não encontrada" });

    const proposalNumber = await generateProposalNumber();
    const today = new Date();
    const validity = new Date(today);
    validity.setDate(validity.getDate() + 10);

    const cloned = await prisma.proposal.create({
      data: {
        proposal_number: proposalNumber,
        client_name: existing.client_name,
        contact_person: existing.contact_person,
        email: existing.email,
        phone: existing.phone,
        cep: existing.cep,
        address: existing.address,
        proposal_date: today.toISOString().split("T")[0],
        validity_date: validity.toISOString().split("T")[0],
        greeting: existing.greeting,
        general_description: existing.general_description,
        implementation_reqs: existing.implementation_reqs,
        technical_support: existing.technical_support,
        warranty: existing.warranty,
        resources: existing.resources,
        payment_terms: existing.payment_terms,
        final_considerations: existing.final_considerations,
        plan_type: existing.plan_type,
        monthly_value: existing.monthly_value,
        plan_description: existing.plan_description,
        items: existing.items,
        shipping_cost: existing.shipping_cost,
        images: [],
        image_library: existing.image_library,
        responsible_name: existing.responsible_name,
        responsible_phone: existing.responsible_phone,
        status: "Rascunho"
      }
    });

    res.json(cloned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/proposals/:id/status", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const { status } = req.body;
    if (!["Rascunho", "Enviada", "Aprovada", "Recusada"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proposals/:id/send", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  try {
    const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } });
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!proposal.email) return res.status(400).json({ error: "E-mail do cliente não informado" });

    const items = (proposal.items as any[]) || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
    const totalGeral = subtotal + (proposal.shipping_cost || 0);

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || "-"}${item.description ? `<br><small style="color: #999;">${item.description}</small>` : ""}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${formatCurrency(parseFloat(item.unit_price) || 0)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${formatCurrency(parseFloat(item.total) || 0)}</td>
      </tr>
    `).join("");

    const appUrl = process.env.APP_URL || "https://totem.v2.beend.tech";
    const proposalLink = `${appUrl}/propostas/visualizar/${proposal.id}`;

    const mailOptions = {
      from: `"beend.tech" <${process.env.GMAIL_USER}>`,
      to: proposal.email,
      subject: `Proposta Comercial ${proposal.proposal_number} - beend.tech`,
      html: `
        <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #0b82ff, #0b6ed4); padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">beend.tech</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Solução Inteligente de Feedback</p>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #333; margin: 0 0 5px;">Proposta Comercial ${proposal.proposal_number}</h2>
            <p style="color: #999; font-size: 13px; margin: 0 0 25px;">${proposal.client_name}</p>
            
            <p style="color: #555; font-size: 15px; line-height: 1.6;">${proposal.greeting || "Prezado(a),"}</p>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">${proposal.general_description || ""}</p>
            
            ${items.length > 0 ? `
              <div style="margin: 25px 0;">
                <h3 style="color: #333; font-size: 16px; border-bottom: 2px solid #0b82ff; padding-bottom: 8px;">Itens e Valores</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                  <thead>
                    <tr style="background: #f8f9fa;">
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Item</th>
                      <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Qtd</th>
                      <th style="padding: 10px; text-align: right; font-size: 12px; color: #666;">Unit.</th>
                      <th style="padding: 10px; text-align: right; font-size: 12px; color: #666;">Total</th>
                    </tr>
                  </thead>
                  <tbody>${itemsHtml}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; color: #333;">Subtotal:</td>
                      <td style="padding: 10px; text-align: right; font-weight: bold; color: #333;">R$ ${formatCurrency(subtotal)}</td>
                    </tr>
                    ${proposal.shipping_cost > 0 ? `
                    <tr>
                      <td colspan="3" style="padding: 10px; text-align: right; color: #666;">Frete:</td>
                      <td style="padding: 10px; text-align: right; color: #666;">R$ ${formatCurrency(proposal.shipping_cost || 0)}</td>
                    </tr>` : ""}
                    <tr style="background: #0b82ff; color: white;">
                      <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px;">TOTAL:</td>
                      <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px;">R$ ${formatCurrency(totalGeral)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ` : ""}
            
            ${proposal.payment_terms ? `
              <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                <h4 style="color: #333; margin: 0 0 8px; font-size: 14px;">Forma de Pagamento</h4>
                <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${proposal.payment_terms}</p>
              </div>
            ` : ""}
            
            ${proposal.observations ? `
              <div style="margin: 20px 0; padding: 15px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <h4 style="color: #333; margin: 0 0 8px; font-size: 14px;">Observações</h4>
                <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${proposal.observations}</p>
              </div>
            ` : ""}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${proposalLink}" style="background-color: #0b82ff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Baixar Proposta Completa (PDF)
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; font-style: italic;">
              * Proposta válida até ${new Date(proposal.validity_date).toLocaleDateString("pt-BR")}.
            </p>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #999; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} beend.tech. Todos os direitos reservados.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: "Enviada" }
    });

    res.json({ message: "Proposta enviada com sucesso!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Campaign Stats
app.post("/api/campaigns/:id/reset", authenticateToken, async (req: any, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, user_id: userId }
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

// Profile / Profiles
app.patch("/api/profiles/:id", authenticateToken, async (req: any, res) => {
  if (req.user.id !== req.params.id && req.user.email !== ADMIN_EMAIL) {
     return res.sendStatus(403);
  }
  try {
    const { password, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const profile = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Survey Specific (Get terminal and campaign by ID/slug)
app.get("/api/survey/:id", async (req, res) => {
  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: req.params.id }
    });
    if (!terminal) return res.status(404).json({ error: "Terminal não encontrado" });
    
    // Fetch company info for the logo
    const user = await prisma.user.findUnique({ where: { id: terminal.user_id } });

    res.json({
      ...terminal,
      company_name: user?.empresa || "Minha Empresa",
      logo_url: user?.logo_url
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/survey/terminal/:id", async (req, res) => {
  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: req.params.id }
    });
    res.json(terminal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/survey/campaign/:id", async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id }
    });
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule task to run every minute and check the time
cron.schedule("* * * * *", () => {
  const now = new Date();
  
  // Format as HH:mm in America/Sao_Paulo timezone
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const targetTimeStr = formatter.format(now);
  sendDailyReports(targetTimeStr);
}, {
  timezone: "America/Sao_Paulo"
});

app.post("/api/admin/trigger-reports", authenticateToken, async (req: any, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.sendStatus(403);
  await sendDailyReports();
  res.json({ message: "Task triggered" });
});

async function startServer() {
  // Seed the admin user if missing and sync companies
  await ensureAdminExists();
  await syncCompaniesToUsers();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
