import { describe, it, expect } from "vitest";
import {
  normalizeSupabaseUrl,
  parseSupabaseHost,
  projectRefFromHost,
  decodeSupabaseKey,
  inspectSupabaseConfig,
} from "../src/server/supabase-config";

// Chave no formato legado (JWT) com o ref do projeto no payload.
function jwtKey(role: string, ref: string): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ iss: "supabase", role, ref })}.assinatura`;
}

describe("normalizeSupabaseUrl", () => {
  it("remove espaços, aspas e barra final", () => {
    expect(normalizeSupabaseUrl('  "https://abc.supabase.co/"  ')).toBe("https://abc.supabase.co");
  });

  it("mantém vazio quando não há valor", () => {
    expect(normalizeSupabaseUrl(undefined)).toBe("");
    expect(normalizeSupabaseUrl(null)).toBe("");
  });
});

describe("parseSupabaseHost / projectRefFromHost", () => {
  it("extrai o host e o ref do projeto", () => {
    const host = parseSupabaseHost("https://qukumumiqrodoctlqanw.supabase.co");
    expect(host).toBe("qukumumiqrodoctlqanw.supabase.co");
    expect(projectRefFromHost(host)).toBe("qukumumiqrodoctlqanw");
  });

  it("devolve vazio para URL inválida", () => {
    expect(parseSupabaseHost("nao-e-url")).toBe("");
    expect(parseSupabaseHost("ftp://abc.supabase.co")).toBe("");
  });

  it("não confunde hosts que não são Supabase", () => {
    expect(projectRefFromHost("meusite.com")).toBeNull();
  });
});

describe("decodeSupabaseKey", () => {
  it("lê role e ref de uma chave JWT", () => {
    expect(decodeSupabaseKey(jwtKey("anon", "abc"))).toEqual({ role: "anon", ref: "abc" });
  });

  it("devolve null para as chaves novas (sb_secret_...) e lixo", () => {
    expect(decodeSupabaseKey("sb_publishable_123")).toBeNull();
    expect(decodeSupabaseKey("")).toBeNull();
  });
});

describe("inspectSupabaseConfig", () => {
  const url = "https://qukumumiqrodoctlqanw.supabase.co";

  it("aceita URL e chave do mesmo projeto", () => {
    const cfg = inspectSupabaseConfig({
      url,
      anonKey: jwtKey("anon", "qukumumiqrodoctlqanw"),
    });
    expect(cfg.errors).toEqual([]);
    expect(cfg.host).toBe("qukumumiqrodoctlqanw.supabase.co");
    expect(cfg.keyRef).toBe("qukumumiqrodoctlqanw");
  });

  it("acusa chave de outro projeto (incidente de produção)", () => {
    const cfg = inspectSupabaseConfig({
      url, // projeto novo
      anonKey: jwtKey("anon", "vinluptfndimrhnnqfwt"), // chave do projeto antigo
    });
    expect(cfg.errors.join(" ")).toContain("vinluptfndimrhnnqfwt");
    expect(cfg.errors.join(" ")).toContain("qukumumiqrodoctlqanw");
  });

  it("acusa URL inválida", () => {
    const cfg = inspectSupabaseConfig({ url: "qukumumiqrodoctlqanw", anonKey: jwtKey("anon", "x") });
    expect(cfg.errors.join(" ")).toMatch(/SUPABASE_URL inválida/);
  });

  it("acusa placeholder não substituído", () => {
    const cfg = inspectSupabaseConfig({ url: "https://<project-ref>.supabase.co", anonKey: "k" });
    expect(cfg.errors.join(" ")).toMatch(/placeholder/);
  });

  it("acusa ausência de chave", () => {
    const cfg = inspectSupabaseConfig({ url });
    expect(cfg.errors.join(" ")).toMatch(/Nenhuma chave/);
  });

  it("avisa quando não há service_role", () => {
    const cfg = inspectSupabaseConfig({ url, anonKey: jwtKey("anon", "qukumumiqrodoctlqanw") });
    expect(cfg.warnings.join(" ")).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("não reclama de ausência de chave quando há service_role", () => {
    const cfg = inspectSupabaseConfig({
      url,
      serviceKey: jwtKey("service_role", "qukumumiqrodoctlqanw"),
    });
    expect(cfg.errors).toEqual([]);
    expect(cfg.warnings).toEqual([]);
  });
});
