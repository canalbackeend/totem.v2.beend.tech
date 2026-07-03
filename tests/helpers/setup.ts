import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export let adminUser: any;
export let testCampaign: any;
export let terminalA: any;
export let terminalB: any;

export async function seedTestData() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  adminUser = await prisma.user.upsert({
    where: { email: "adm@beend.tech" },
    update: {},
    create: {
      email: "adm@beend.tech",
      password: hashedPassword,
      nome: "Admin Test",
      empresa: "Test Corp",
      role: "Administrador",
      status: "Ativo",
    },
  });

  terminalA = await prisma.terminal.upsert({
    where: { id: "test-terminal-a" },
    update: { name: "TERM-A", user_id: adminUser.id },
    create: {
      id: "test-terminal-a",
      name: "TERM-A",
      user_id: adminUser.id,
      password: await bcrypt.hash("term123", 10),
    },
  });

  terminalB = await prisma.terminal.upsert({
    where: { id: "test-terminal-b" },
    update: { name: "TERM-B", user_id: adminUser.id },
    create: {
      id: "test-terminal-b",
      name: "TERM-B",
      user_id: adminUser.id,
      password: await bcrypt.hash("term123", 10),
    },
  });

  const existing = await prisma.campaign.findFirst({ where: { name: "Campanha Teste" } });
  if (existing) {
    testCampaign = existing;
  } else {
    const first = await prisma.campaign.findFirst({ orderBy: { created_at: "asc" } });
    if (first) {
      testCampaign = first;
    } else {
      testCampaign = await prisma.campaign.create({
        data: {
          name: "Campanha Teste",
          type: "pesquisa",
          status: "Ativo",
          user_id: adminUser.id,
          questions: [
            { text: "Como você avalia nosso serviço?", type: "SMILE 5" },
            { text: "Recomendaria para um amigo?", type: "NPS" },
          ],
        },
      });
    }
  }
}

export async function cleanupTestData() {
  const ids = ["test-date-a", "test-date-b", "test-date-c", "test-date-d"];
  await prisma.response.deleteMany({ where: { id: { in: ids } } });
}

export { prisma };
