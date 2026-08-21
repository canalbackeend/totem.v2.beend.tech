import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, parseCampaignList } from "../server.ts";
import { getSatisfactionScore, getPerceptionKey } from "../src/lib/metrics.ts";

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
