import { describe, it, expect } from "vitest";
import {
  randomDigits,
  buildTerminalEmail,
  normalizeEmail,
  isValidEmail,
  generateAutoEmail,
} from "../src/server/terminal-email";

describe("randomDigits", () => {
  it("retorna a quantidade de dígitos solicitada", () => {
    expect(randomDigits(5)).toMatch(/^\d{5}$/);
    expect(randomDigits(3)).toMatch(/^\d{3}$/);
  });
});

describe("buildTerminalEmail / generateAutoEmail", () => {
  it("monta no formato ter-{5dig}-{3dig}@be.end", () => {
    expect(buildTerminalEmail("12345", "678")).toBe("ter-12345-678@be.end");
  });

  it("auto-gerado segue o formato (sem ano fixo)", () => {
    const email = generateAutoEmail();
    expect(email).toMatch(/^ter-\d{5}-\d{3}@be\.end$/);
  });
});

describe("normalizeEmail", () => {
  it("remove espaços e converte para minúsculas", () => {
    expect(normalizeEmail("  Ter-26-424@BE.End ")).toBe("ter-26-424@be.end");
  });

  it("converte vazios em string vazia", () => {
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail(null as any)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("aceita emails válidos", () => {
    expect(isValidEmail("ter-12345-678@be.end")).toBe(true);
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejeita formatos inválidos", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("sem-arroba")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});