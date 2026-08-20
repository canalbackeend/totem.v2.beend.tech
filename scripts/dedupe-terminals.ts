import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

const rand = (digits: number) =>
  Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join("");

const buildEmail = () => `ter-${rand(5)}-${rand(3)}@be.end`;

const normalize = (email: string) => email.trim().toLowerCase().replace(/\s+/g, "");

async function main() {
  const terminals = await prisma.terminal.findMany({
    select: { id: true, email: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  const used = new Set<string>();
  for (const t of terminals) {
    if (t.email && t.email.trim()) used.add(normalize(t.email));
  }

  const report: string[] = [];
  let backfilled = 0;
  let renamed = 0;
  let normalized = 0;

  // Fase A: normaliza emails existentes (trim + lowercase)
  for (const t of terminals) {
    if (!t.email || !t.email.trim()) continue;
    const normalizedEmail = normalize(t.email);
    if (normalizedEmail !== t.email) {
      report.push(`normalizar ${t.email} -> ${normalizedEmail} (terminal ${t.id})`);
      normalized++;
      if (!DRY_RUN) {
        await prisma.terminal.update({ where: { id: t.id }, data: { email: normalizedEmail } });
      }
    }
  }

  // Fase B: preenche emails NULL/vazios com email auto-gerado único
  for (const t of terminals) {
    if (t.email && t.email.trim()) continue;
    let candidate = buildEmail();
    let guard = 0;
    while (used.has(candidate) && guard++ < 50) candidate = buildEmail();
    if (used.has(candidate)) throw new Error("Não foi possível gerar email único durante backfill.");
    used.add(candidate);
    report.push(`backfill NULL -> ${candidate} (terminal ${t.id})`);
    backfilled++;
    if (!DRY_RUN) {
      await prisma.terminal.update({ where: { id: t.id }, data: { email: candidate } });
    }
  }

  // Fase C: renomeia duplicados (mantém o mais antigo com o email original)
  const latestList = await prisma.terminal.findMany({
    select: { id: true, email: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  const byEmail = new Map<string, typeof latestList>();
  for (const t of latestList) {
    if (!t.email || !t.email.trim()) continue;
    const key = normalize(t.email);
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(t);
  }

  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    const [, ...duplicates] = group;
    for (const dup of duplicates) {
      let n = 2;
      let candidate = `${email.split("@")[0]}-${n}@${email.split("@")[1]}`;
      while (used.has(candidate) && n < 100) {
        n++;
        candidate = `${email.split("@")[0]}-${n}@${email.split("@")[1]}`;
      }
      if (used.has(candidate)) throw new Error(`Não foi possível gerar sufixo único para ${email}.`);
      used.add(candidate);
      report.push(`renomear duplicado ${email} -> ${candidate} (terminal ${dup.id})`);
      renamed++;
      if (!DRY_RUN) {
        await prisma.terminal.update({ where: { id: dup.id }, data: { email: candidate } });
      }
    }
  }

  console.log(DRY_RUN ? "=== MODO DRY-RUN (nada foi alterado) ===" : "=== RESUMO APLICADO ===");
  console.log(`total terminais: ${terminals.length}`);
  console.log(`emails normalizados: ${normalized}`);
  console.log(`emails preenchidos (NULL): ${backfilled}`);
  console.log(`duplicados renomeados: ${renamed}`);
  report.forEach((line) => console.log("  -", line));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });