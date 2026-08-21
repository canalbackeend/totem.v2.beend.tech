import { getSatisfactionScore } from "../lib/metrics";
import { parseAnswers } from "../lib/answers";

// Calcula as métricas agregadas de uma campanha a partir das respostas coletadas:
// - NPS (promotores/neutros/detratores e score final)
// - Satisfação geral (média CSAT, excluindo perguntas NPS)
// - Estatísticas por pergunta (média de satisfação, contagem e distribuição de respostas)
export function calculateCampaignMetrics(campaign: any, responses: any[]) {
  // Sem campanha ou sem respostas: retorna métricas zeradas.
  if (!campaign || !responses.length) {
    return {
      nps: { score: 0, promotores: 0, neutros: 0, detratores: 0, total: 0 },
      overallSatisfaction: 0,
      totalResponses: responses.length,
      questionStats: []
    };
  }

  // Localiza a pergunta NPS da campanha (se houver) — o cálculo NPS depende dela.
  const npsQuestion = campaign.questions?.find((question: any) => question.type === 'NPS');
  const normalizedNpsText = npsQuestion ? String(npsQuestion.text || '').trim().toLowerCase() : '';

  // Contadores de NPS: promotores (9-10), neutros (7-8), detratores (0-6).
  let promoterCount = 0, neutralCount = 0, detractorCount = 0, npsTotal = 0;

  // Acumuladores da satisfação geral (média CSAT).
  let totalSatisfactionSum = 0;
  let totalSatisfactionAnswers = 0;

  // Estatísticas por pergunta: texto → { soma de satisfação, contagem, distribuição, tipo }.
  const statsMap = new Map();

  responses.forEach((response) => {
    // `answers` pode vir como JSON string (legado) ou já como array.
    const answers = parseAnswers(response.answers);

    answers.forEach((answer: any) => {
      // Normaliza o texto da pergunta para localizar a pergunta correspondente na campanha.
      const questionText = String(answer.question || '').trim();
      const questionLookupKey = questionText.toLowerCase();
      const matchedCampaignQuestion = campaign.questions?.find(
        (question: any) => String(question.text || '').trim().toLowerCase() === questionLookupKey
      );
      // Tipo da pergunta: preferência pelo tipo gravado na resposta, senão o da campanha.
      const questionType = answer.type || matchedCampaignQuestion?.type;

      // ---- Cálculo NPS (somente se a resposta não for nula/vazia) ----
      if (normalizedNpsText && questionLookupKey === normalizedNpsText && answer.answer !== null && answer.answer !== undefined && answer.answer !== '') {
        const npsValue = Number(answer.answer);
        if (!isNaN(npsValue)) {
          npsTotal++;
          if (npsValue >= 9) promoterCount++;
          else if (npsValue >= 7) neutralCount++;
          else detractorCount++;
        }
      }

      // ---- Satisfação geral (CSAT) ----
      // NPS é excluído: ele é pontuado separadamente (0-10) e não deve ser misturado
      // com a escala 100/75/50/25 das demais perguntas.
      const score = questionType !== 'NPS' ? getSatisfactionScore(answer.answer, questionType || '') : null;
      if (score !== null) {
        totalSatisfactionSum += score;
        totalSatisfactionAnswers++;
      }

      // ---- Estatísticas por pergunta ----
      if (!statsMap.has(questionText)) {
        statsMap.set(questionText, { satisfactionSum: 0, satisfactionCount: 0, count: 0, type: questionType, distribution: {} });
      }
      const questionStat = statsMap.get(questionText);

      // Conta apenas respostas preenchidas (não nulas/vazias).
      if (answer.answer !== null && answer.answer !== undefined && (Array.isArray(answer.answer) ? answer.answer.length > 0 : answer.answer !== '')) {
        questionStat.count++;
        if (score !== null) {
          questionStat.satisfactionSum += score;
          questionStat.satisfactionCount++;
        }

        // Distribuição de respostas por opção (exceto texto aberto).
        // Para múltipla escolha, cada valor selecionado é contabilizado.
        if (questionType !== 'Texto Aberto') {
          const answersToTrack = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
          answersToTrack.forEach((optionValue: any) => {
            if (optionValue !== null && optionValue !== undefined) {
              const optionKey = String(optionValue).trim().toUpperCase();
              if (optionKey) {
                questionStat.distribution[optionKey] = (questionStat.distribution[optionKey] || 0) + 1;
              }
            }
          });
        }
      }
    });
  });

  // Score NPS = % de promotores - % de detratores (varia de -100 a 100).
  const npsScore = npsTotal > 0 ? ((promoterCount - detractorCount) / npsTotal) * 100 : 0;
  // Média geral de satisfação = soma dos scores / número de respostas pontuadas.
  const overallSatisfaction = totalSatisfactionAnswers > 0 ? totalSatisfactionSum / totalSatisfactionAnswers : 0;

  const questionStats = Array.from(statsMap.entries()).map(([text, questionStat]) => {
    return {
      text,
      satisfaction: questionStat.satisfactionCount > 0 ? questionStat.satisfactionSum / questionStat.satisfactionCount : 0,
      count: questionStat.count,
      type: questionStat.type,
      distribution: questionStat.distribution
    };
  });

  return {
    nps: { score: npsScore, promotores: promoterCount, neutros: neutralCount, detratores: detractorCount, total: npsTotal },
    overallSatisfaction,
    totalResponses: responses.length,
    questionStats
  };
}
