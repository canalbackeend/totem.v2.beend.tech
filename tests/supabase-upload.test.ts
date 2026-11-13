import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mocks hoisted: o módulo de uploads importa deps e dns no topo.
const h = vi.hoisted(() => ({
  upload: vi.fn(),
  getBucket: vi.fn(),
  createBucket: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: { lookup: h.lookup },
}));

vi.mock("../src/server/deps", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, buffer: Buffer, options: unknown) => h.upload(bucket, path, buffer, options),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://abc.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
      getBucket: h.getBucket,
      createBucket: h.createBucket,
    },
  },
  authenticateToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  supabaseServiceKey: "",
  supabaseStorageBucket: "uploads",
  supabaseUrl: "https://abc.supabase.co",
  supabaseHost: "abc.supabase.co",
}));

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function loadModule() {
  vi.resetModules();
  return import("../src/server/uploads");
}

beforeEach(() => {
  h.upload.mockReset();
  h.getBucket.mockReset();
  h.createBucket.mockReset();
  h.lookup.mockReset();
  h.lookup.mockResolvedValue({ address: "1.2.3.4", family: 4 });
  h.upload.mockResolvedValue({ data: {}, error: null });
});

describe("upload para o Supabase Storage", () => {
  it("envia para o bucket configurado e devolve a URL pública", async () => {
    const { uploadBase64ToSupabase } = await loadModule();

    const url = await uploadBase64ToSupabase(PNG, "profiles");

    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.upload.mock.calls[0][0]).toBe("uploads");
    expect(url).toContain("/storage/v1/object/public/uploads/profiles/");
  });

  it("cai para 'medias' quando o bucket 'uploads' não existe (e fica nele)", async () => {
    h.upload
      .mockResolvedValueOnce({ data: null, error: { message: "Bucket not found" } })
      .mockResolvedValue({ data: {}, error: null });

    const { uploadBase64ToSupabase } = await loadModule();

    const url = await uploadBase64ToSupabase(PNG, "profiles");
    expect(h.upload.mock.calls.map((c) => c[0])).toEqual(["uploads", "medias"]);
    expect(url).toContain("/public/medias/");

    // Segundo upload usa o bucket já resolvido, sem tentar 'uploads' de novo.
    await uploadBase64ToSupabase(PNG, "profiles");
    expect(h.upload).toHaveBeenCalledTimes(3);
    expect(h.upload.mock.calls[2][0]).toBe("medias");
  });

  it("não troca de bucket quando o erro é de permissão (RLS)", async () => {
    h.upload.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });

    const { uploadBase64ToSupabase } = await loadModule();

    await expect(uploadBase64ToSupabase(PNG, "profiles")).rejects.toThrow(/row-level security/);
    expect(h.upload).toHaveBeenCalledTimes(1);
  });

  it("traduz 'fetch failed' citando o host do Supabase", async () => {
    h.upload.mockResolvedValue({ data: null, error: { message: "fetch failed" } });

    const { uploadBase64ToSupabase } = await loadModule();

    await expect(uploadBase64ToSupabase(PNG, "profiles")).rejects.toThrow(/abc\.supabase\.co/);
  });

  it("falha antes de tentar upload quando o DNS do Supabase não resolve", async () => {
    h.lookup.mockRejectedValue({ code: "ENOTFOUND" });

    const { uploadBase64ToSupabase } = await loadModule();

    await expect(uploadBase64ToSupabase(PNG, "profiles")).rejects.toThrow(/ENOTFOUND/);
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("não cria bucket quando só há chave anon", async () => {
    const { uploadBase64ToSupabase } = await loadModule();
    await uploadBase64ToSupabase(PNG, "profiles");
    expect(h.createBucket).not.toHaveBeenCalled();
  });

  it("rejeita SVG (XSS) e arquivos acima de 5MB", async () => {
    const { uploadBase64ToSupabase } = await loadModule();

    await expect(
      uploadBase64ToSupabase("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "x"),
    ).rejects.toThrow(/não permitido/);

    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
    await expect(uploadBase64ToSupabase(`data:image/png;base64,${big}`, "x")).rejects.toThrow(
      /tamanho máximo/,
    );
  });
});

describe("/api/upload e /api/health", () => {
  it("expõe o último erro no status de storage", async () => {
    h.upload.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });

    const { registerUploadRoutes, getStorageStatus } = await loadModule();

    const app = express();
    app.use(express.json({ limit: "10mb" }));
    registerUploadRoutes(app);

    const res = await request(app).post("/api/upload").send({ image: PNG, folder: "profiles" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/row-level security/);

    const status = getStorageStatus();
    expect(status.host).toBe("abc.supabase.co");
    expect(status.bucket).toBe("uploads");
    expect(status.lastError?.message).toMatch(/row-level security/);
  });

  it("mostra dns como não verificado antes do primeiro upload", async () => {
    const { getStorageStatus } = await loadModule();
    expect(getStorageStatus().dns).toBe("não verificado");
  });
});
