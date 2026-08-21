import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getPerceptionKey } from "../src/lib/metrics";
import { parseAnswers } from "../src/lib/answers";

dotenv.config();

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const CAMPAIGN_ID = process.argv.find((a) => a.startsWith("--campaign="))?.split("=")[1];

// Recalcula os contadores de uma campanha a partir das respostas reais:
// responses_count e perception_excelente/bom/regular/ruim. Usado para curar
// qualquer drift histórico (contadores foram incrementados fora de transação
// no passado). Mesma lógica de percepção do handler de respostas.
async function reconcileCampaign(campaignId: string) {
  const responses = await prisma.response.findMany({
    where: { campaign_id: campaignId },
    select: { answers: true },
  });

  const counters: any = {
    responses_count: responses.length,
    perception_excelente: 0,
    perception_bom: 0,
    perception_regular: 0,
    perception_ruim: 0,
  };

  for (const response of responses) {
    const answers = parseAnswers(response.answers);
    const ratingAnswer =
      answers.find((a: any) => ['SMILE 4', 'SMILE 5', 'NPS', 'Avaliação de 1 à 5'].includes(a?.type)) ||
      answers[answers.length - 1];
    const lastAnswer = ratingAnswer ? ratingAnswer.answer : null;

    if (lastAnswer !== null && lastAnswer !== undefined && (typeof lastAnswer === 'string' || typeof lastAnswer === 'number')) {
      const perception = getPerceptionKey(lastAnswer, ratingAnswer?.type);
      if (perception) {
        counters[`perception_${perception}`]++;
      }
    }
  }

  return counters;
}

async function main() {
  const campaigns = CAMPAIGN_ID
    ? await prisma.campaign.findMany({ where: { id: CAMPAIGN_ID } })
    : await prisma.campaign.findMany({ select: { id: true, name: true } });

  if (campaigns.length === 0) {
    console.log("Nenhuma campanha encontrada.");
    return;
  }

  console.log(`Reconciliando ${campaigns.length} campanha(s)...`);
  let fixed = 0;

  for (const campaign of campaigns) {
    const counters = await reconcileCampaign(campaign.id);
    const current = await prisma.campaign.findUnique({ where: { id: campaign.id } });

    const changed =
      !current ||
      current.responses_count !== counters.responses_count ||
      current.perception_excelente !== counters.perception_excelente ||
      current.perception_bom !== counters.perception_bom ||
      current.perception_regular !== counters.perception_regular ||
      current.perception_ruim !== counters.perception_ruim;

    if (changed) {
      fixed++;
      console.log(`  campanha ${campaign.id} (${campaign.name || "?"}):`);
      console.log(`    atual:     ${current ? `${current.responses_count}/${current.perception_excelente}/${current.perception_bom}/${current.perception_regular}/${current.perception_ruim}` : "não existe"}`);
      console.log(`    recalc:    ${counters.responses_count}/${counters.perception_excelente}/${counters.perception_bom}/${counters.perception_regular}/${counters.perception_ruim}`);
      if (!DRY_RUN) {
        await prisma.campaign.update({ where: { id: campaign.id }, data: counters });
      }
    }
  }

  console.log(DRY_RUN ? "=== MODO DRY-RUN (nada alterado) ===" : "=== RESUMO ===");
  console.log(`campanhas com drift corrigido: ${fixed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
