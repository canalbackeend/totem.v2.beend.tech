import crypto from "crypto";
import { supabase, authenticateToken, supabaseServiceKey, supabaseStorageBucket } from "./deps";

// Upload de imagens para o Supabase Storage.
// O bucket é resolvido em tempo de execução: SUPABASE_STORAGE_BUCKET quando definido,
// senão tenta os nomes usados nos projetos beend.tech ("uploads" e "medias").
// SVG é vetor de stored-XSS (pode embutir scripts) e foi removido.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const FALLBACK_BUCKETS = ["uploads", "medias"];
const BUCKET_CANDIDATES = [...new Set([supabaseStorageBucket.trim(), ...FALLBACK_BUCKETS].filter(Boolean))];

// Bucket que funcionou de fato (cacheado após o primeiro upload bem-sucedido).
let resolvedBucket: string | null = null;
let bucketEnsured = false;

/** Estado do Storage para diagnóstico (sem expor chaves). */
export function getStorageStatus() {
  return {
    configured: Boolean(supabase),
    key: supabaseServiceKey ? "service_role" : "anon",
    bucket: resolvedBucket ?? (supabaseStorageBucket.trim() || BUCKET_CANDIDATES[0]),
    candidates: BUCKET_CANDIDATES,
  };
}

function isMissingBucket(message: string): boolean {
  return /bucket.*not found|not found.*bucket|does not exist|não existe/i.test(message);
}

// A chave anon não tem permissão para ler/criar buckets; só a service_role cria.
async function ensureBucket(bucket: string): Promise<void> {
  if (!supabase || !supabaseServiceKey || bucketEnsured) return;
  try {
    const { data } = await supabase.storage.getBucket(bucket);
    if (!data) {
      await supabase.storage.createBucket(bucket, { public: true });
    }
    bucketEnsured = true;
  } catch (err) {
    // Ignora: o upload abaixo reporta o erro real (ex.: RLS com a chave anon).
    console.warn(`Não foi possível garantir o bucket '${bucket}' no Supabase:`, err);
  }
}

async function uploadBase64ToSupabase(base64Str: string, folder: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase não está configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) nas variáveis de ambiente.",
    );
  }

  // Sanitize folder
  const safeFolder = (folder || "geral").replace(/[^a-zA-Z0-9_-]/g, '');

  // Parse the base64 string
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    if (base64Str.startsWith("http")) {
      return base64Str;
    }
    throw new Error("Formato de imagem inválido. Deve ser um base64 válido.");
  }

  const mimeType = matches[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Tipo de arquivo não permitido. Use apenas JPEG, PNG, GIF ou WebP.");
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error("Imagem muito grande. O tamanho máximo é 5MB.");
  }

  let ext = "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
  else if (mimeType.includes("gif")) ext = "gif";
  else if (mimeType.includes("webp")) ext = "webp";

  const filename = `${safeFolder}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}.${ext}`;

  const candidates = resolvedBucket ? [resolvedBucket] : BUCKET_CANDIDATES;
  let lastError: Error | null = null;

  for (const bucket of candidates) {
    await ensureBucket(bucket);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
      });

    if (!error) {
      if (resolvedBucket !== bucket) {
        resolvedBucket = bucket;
        if (bucket !== supabaseStorageBucket.trim()) {
          console.warn(
            `Supabase Storage: usando o bucket '${bucket}'. Defina SUPABASE_STORAGE_BUCKET='${bucket}' para fixar.`,
          );
        }
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
      return publicUrl;
    }

    lastError = new Error(error.message);
    if (!isMissingBucket(error.message)) break; // erro de permissão/tamanho: não adianta trocar de bucket
  }

  throw new Error(
    `Erro ao enviar para o Supabase Storage (bucket tentado: ${candidates.join(", ")}): ${lastError?.message ?? "erro desconhecido"}`,
  );
}

// Proxy endpoint to download and serve images with CORS headers (public for PDF logos)
const ALLOWED_PROXY_DOMAINS = process.env.SUPABASE_URL ? [new URL(process.env.SUPABASE_URL).hostname] : [];

export function registerUploadRoutes(app: any) {
  app.post("/api/upload", authenticateToken, async (req: any, res: any) => {
    const { image, folder } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Imagem em formato base64 é obrigatória" });
    }
    try {
      const url = await uploadBase64ToSupabase(image, folder || "geral");
      res.json({ url });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Erro ao fazer upload da imagem." });
    }
  });

  app.get("/api/proxy-image", async (req: any, res: any) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Parâmetro url é obrigatório" });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "URL inválida" });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: "Protocolo não permitido" });
    }
    if (!ALLOWED_PROXY_DOMAINS.some((d) => parsed.hostname === d)) {
      return res.status(403).json({ error: "Domínio não autorizado" });
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
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
}
