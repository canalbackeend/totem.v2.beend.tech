import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.ts";

const prisma = new PrismaClient();

let campaignId = "";
let terminalId = "";
const createdIds: string[] = [];

beforeAll(async () => {
  const campaign = await prisma.campaign.findFirst({ orderBy: { created_at: "desc" } });
  const terminal = await prisma.terminal.findFirst();
  campaignId = campaign?.id || "";
  terminalId = terminal?.id || "";
});

afterAll(async () => {
  if (createdIds.length) {
    await prisma.response.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe("POST /api/public/responses - sanitizacao preserva dados do /survey", () => {
  it("preserva question, comment e answer em array (multipla escolha)", async () => {
    expect(campaignId).toBeTruthy();
    expect(terminalId).toBeTruthy();

    const res = await request(app)
      .post("/api/public/responses")
      .send({
        campaign_id: campaignId,
        terminal_id: terminalId,
        created_at: new Date().toISOString(),
        answers: [
          { question: "Como avalia hoje?", type: "SMILE 4", answer: "EXCELENTE", comment: "Atendimento otimo" },
          { question: "Quais canais?", type: "Múltipla Escolha", answer: ["WhatsApp", "Presencial"] },
        ],
      });

    expect([200, 201]).toContain(res.status);
    const storedId = res.body?.id;
    expect(storedId).toBeTruthy();
    createdIds.push(storedId);

    const stored = await prisma.response.findUnique({ where: { id: storedId } });
    const answers = Array.isArray(stored?.answers)
      ? (stored!.answers as any[])
      : JSON.parse((stored!.answers as unknown as string) || "[]");

    expect(answers.length).toBe(2);

    const smile = answers.find((a) => a.type === "SMILE 4");
    expect(smile).toMatchObject({
      question: "Como avalia hoje?",
      type: "SMILE 4",
      answer: "EXCELENTE",
      comment: "Atendimento otimo",
    });

    const mc = answers.find((a) => a.type === "Múltipla Escolha");
    expect(mc.question).toBe("Quais canais?");
    expect(Array.isArray(mc.answer)).toBe(true);
    expect(mc.answer).toEqual(["WhatsApp", "Presencial"]);
  });
});

describe("POST /api/public/responses - deduplicacao (M13)", () => {
  it("resposta identica dentro da janela nao cria duplicata", async () => {
    expect(campaignId).toBeTruthy();
    expect(terminalId).toBeTruthy();

    const payload = {
      campaign_id: campaignId,
      terminal_id: terminalId,
      created_at: new Date().toISOString(),
      answers: [
        { question: "Dedup test?", type: "SMILE 4", answer: "BOM" },
      ],
    };

    const first = await request(app).post("/api/public/responses").send(payload);
    expect([200, 201]).toContain(first.status);
    const firstId = first.body?.id;
    expect(firstId).toBeTruthy();
    createdIds.push(firstId);

    // Replay the exact same payload within the dedup window
    const second = await request(app).post("/api/public/responses").send(payload);
    expect(second.status).toBe(200);
    expect(second.body?.duplicate).toBe(true);

    // Confirm only one row persisted for that payload
    const all = await prisma.response.findMany({
      where: { campaign_id: campaignId, terminal_id: terminalId },
      select: { answers: true },
      take: 500,
    });
    const matches = all.filter((r: any) => {
      const ans = Array.isArray(r.answers) ? r.answers : JSON.parse(String(r.answers) || "[]");
      return ans.some((a: any) => a.type === "SMILE 4" && a.question === "Dedup test?" && a.answer === "BOM");
    });
    expect(matches.length).toBe(1);
  });
});