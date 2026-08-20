import nodemailer from "nodemailer";
import crypto from "crypto";
import { prisma, PORT } from "./deps";

// Email transporter
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Helper to send report emails
export async function sendDailyReports(targetTimeStr?: string) {
  console.log(`Iniciando envio de relatórios diários... ${targetTimeStr ? `[Horário Alvo: ${targetTimeStr}]` : '[Teste/Manual]'}`);
  
  try {
    // 1. Fetch campaigns that have a report email and are active
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "Ativo",
        report_email: { not: "" }
      }
    });

    if (!campaigns || campaigns.length === 0) {
      console.log("Nenhuma campanha configurada para relatórios diários.");
      return;
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 2. Filter campaigns by report time + keep only valid emails
    const campaignsToSend = campaigns.filter(c => {
      const email = (c.report_email || "").trim();
      if (!email || !EMAIL_REGEX.test(email)) return false;
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

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("GMAIL_USER/GMAIL_APP_PASSWORD não configurados. Pulando envio de relatórios.");
      return;
    }

    // 3. Cap to avoid long-running loops under heavy load
    const MAX_PER_RUN = 100;
    const toSend = campaignsToSend.slice(0, MAX_PER_RUN);
    console.log(`Enviando ${toSend.length} relatório(s) diário(s)...`);

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    // 4. Generate tokens + build mail options first (fast operations)
    const jobs: { id: string; name: string; to: string; mailOptions: any }[] = [];

    for (const campaign of toSend) {
      try {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 720); // Extends token validity to 30 days (720 hours) for seamless link access

        await prisma.reportToken.create({
          data: {
            token,
            campaign_id: campaign.id,
            expires_at: expiresAt
          }
        });

        const reportLink = `${appUrl}/relatorio-seguro/${token}`;
        const reportEmail = (campaign.report_email as string).trim();

        jobs.push({
          id: campaign.id,
          name: campaign.name,
          to: reportEmail,
          mailOptions: {
            from: `"Totem been.tech" <${process.env.GMAIL_USER}>`,
            to: reportEmail,
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
          }
        });
      } catch (campaignError) {
        console.error(`Erro ao preparar relatório da campanha ${campaign.id} (${campaign.name}):`, campaignError);
      }
    }

    // 5. Send emails with bounded concurrency.
    // Nodemailer timeouts (socketTimeout/connectionTimeout) handle hangs and close the socket.
    const BATCH_SIZE = 5;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(j => transporter.sendMail(j.mailOptions)));
      results.forEach((result, idx) => {
        const job = batch[idx];
        if (result.status === "fulfilled") {
          console.log(`Relatório enviado para ${job.to} (Campanha: ${job.id})`);
        } else {
          console.error(`Erro ao enviar e-mail para ${job.to} (Campanha: ${job.id}):`, (result.reason as Error)?.message || result.reason);
        }
      });
    }
  } catch (err) {
    console.error("Erro no processo de relatórios diários:", err);
  }
}