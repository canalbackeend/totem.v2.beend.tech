import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, parseCampaignList } from "../server.ts";
import { getSatisfactionScore, getPerceptionKey } from "../src/lib/metrics.ts";
import { calculateCampaignMetrics } from "../src/server/metrics.ts";
import { toISODate } from "../src/server/deps.ts";

describe("parseCampaignList", () => {
  it("retorna array vazio para valores vazios/indefinidos", () => {
    expect(parseCampaignList(null)).toEqual([]);
    expect(parseCampaignList(undefined)).toEqual([]);
    expect(parseCampaignList("")).toEqual([]);
    expect(parseCampaignList("   ")).toEqual([]);
  });

  it("parseia CSV com vírgulas", () => {
    expect(parseCampaignList("A,B,C")).toEqual(["A", "B", "C"]);
    expect(parseCampaignList(" A , B ")).toEqual(["A", "B"]);
  });

  it("parseia JSON array", () => {
    expect(parseCampaignList('["A","B"]')).toEqual(["A", "B"]);
  });

  it("ignora itens não-string em arrays", () => {
    expect(parseCampaignList('[1, "A", null]')).toEqual(["A"]);
    expect(parseCampaignList(["A", 2, {}])).toEqual(["A"]);
  });

  it("cai para CSV se o JSON for inválido", () => {
    expect(parseCampaignList('["A", "B"')).toEqual(['["A"', '"B"']);
  });

  it("retorna array vazio para tipos não esperados", () => {
    expect(parseCampaignList(42)).toEqual([]);
    expect(parseCampaignList({})).toEqual([]);
  });
});

describe("GET /api/health", () => {
  it("responde ok com database checada", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("ok");
  });
});

describe("getSatisfactionScore", () => {
  it("NPS 0 é valor válido e conta como ruim (25)", () => {
    expect(getSatisfactionScore(0)).toBe(25);
    expect(getPerceptionKey(0)).toBe("ruim");
  });

  it("NPS 0 não é confundido com null/undefined", () => {
    expect(getSatisfactionScore(0)).not.toBeNull();
    expect(getSatisfactionScore(null)).toBeNull();
    expect(getSatisfactionScore(undefined)).toBeNull();
    expect(getSatisfactionScore("")).toBeNull();
  });

  it("NPS 9-10 = excelente, 7-8 = bom, 5-6 = regular", () => {
    expect(getSatisfactionScore(10)).toBe(100);
    expect(getSatisfactionScore(9)).toBe(100);
    expect(getSatisfactionScore(8)).toBe(75);
    expect(getSatisfactionScore(7)).toBe(75);
    expect(getSatisfactionScore(6)).toBe(50);
    expect(getSatisfactionScore(5)).toBe(50);
    expect(getSatisfactionScore(4)).toBe(25);
    expect(getSatisfactionScore(1)).toBe(25);
  });

  it("SMILE 5 mapeia texto para scores", () => {
    expect(getSatisfactionScore("Muito Satisfeito", "SMILE 5")).toBe(100);
    expect(getSatisfactionScore("Satisfeito", "SMILE 5")).toBe(75);
    expect(getSatisfactionScore("Regular", "SMILE 5")).toBe(50);
    expect(getSatisfactionScore("Muito Insatisfeito", "SMILE 5")).toBe(25);
  });

  it("Avaliação de 1 à 5 mapeia numericamente", () => {
    expect(getSatisfactionScore(5, "Avaliação de 1 à 5")).toBe(100);
    expect(getSatisfactionScore(4, "Avaliação de 1 à 5")).toBe(75);
    expect(getSatisfactionScore(3, "Avaliação de 1 à 5")).toBe(50);
    expect(getSatisfactionScore(2, "Avaliação de 1 à 5")).toBe(25);
  });
});

describe("calculateCampaignMetrics", () => {
  const campaign = {
    questions: [
      { text: "Recomendaria?", type: "NPS" },
      { text: "Como avalia o serviço?", type: "SMILE 5" },
    ],
  };

  it("NPS não entra na média geral de satisfação (CSAT)", () => {
    const responses = [
      { answers: JSON.stringify([
        { question: "Recomendaria?", type: "NPS", answer: 10 },
        { question: "Como avalia o serviço?", type: "SMILE 5", answer: "Satisfeito" },
      ]) },
    ];
    const m = calculateCampaignMetrics(campaign, responses as any);
    // NPS 10 → 100 não pode poluir a média CSAT (que deve ser 75, só SMILE)
    expect(m.overallSatisfaction).toBe(75);
    expect(m.totalResponses).toBe(1);
    // NPS ainda calcula separadamente
    expect(m.nps.score).toBe(100);
    expect(m.nps.promotores).toBe(1);
  });

  it("campanha só NPS reporta CSAT 0 (sem contaminação)", () => {
    const npsOnly = {
      questions: [{ text: "Recomendaria?", type: "NPS" }],
    };
    const responses = [
      { answers: JSON.stringify([
        { question: "Recomendaria?", type: "NPS", answer: 7 },
      ]) },
    ];
    const m = calculateCampaignMetrics(npsOnly, responses as any);
    expect(m.overallSatisfaction).toBe(0);
    expect(m.nps.neutros).toBe(1);
  });
});

describe("toISODate (fuso de Brasília)", () => {
  it("mantém o dia BRT mesmo quando o horário já passou da meia-noite em UTC", () => {
    // 2026-08-02T00:30:00.000Z = 2026-08-01 21:30 em Brasília (UTC-3)
    expect(toISODate("2026-08-02T00:30:00.000Z")).toBe("2026-08-01");
  });

  it("mantém o dia BRT para horários diurnos", () => {
    expect(toISODate("2026-08-01T15:00:00.000Z")).toBe("2026-08-01");
  });
});
