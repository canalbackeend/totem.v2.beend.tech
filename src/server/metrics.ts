import { getSatisfactionScore } from "../lib/metrics";

export function calculateCampaignMetrics(campaign: any, responses: any[]) {
  if (!campaign || !responses.length) {
    return {
      nps: { score: 0, promotores: 0, neutros: 0, detratores: 0, total: 0 },
      overallSatisfaction: 0,
      totalResponses: responses.length,
      questionStats: []
    };
  }

  const npsQ = campaign.questions?.find((q: any) => q.type === 'NPS');
  const normalizedNpsText = npsQ ? String(npsQ.text || '').trim().toLowerCase() : '';
  
  let p = 0, n = 0, d = 0, npsTotal = 0;
  let totalSatSum = 0;
  let totalSatAnswers = 0;

  const statsMap = new Map();

  responses.forEach(r => {
    let answers = [];
    try {
      answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
    } catch (e) { answers = []; }

    answers.forEach((a: any) => {
      const qText = String(a.question || '').trim();
      const qKey = qText.toLowerCase();
      const campaignQ = campaign.questions?.find((cq: any) => String(cq.text || '').trim().toLowerCase() === qKey);
      const qType = a.type || campaignQ?.type;
      
      // NPS Logic - ONLY if answer is NOT null
      if (normalizedNpsText && qKey === normalizedNpsText && a.answer !== null && a.answer !== undefined && a.answer !== '') {
        const val = Number(a.answer);
        if (!isNaN(val)) {
          npsTotal++;
          if (val >= 9) p++; 
          else if (val >= 7) n++; 
          else d++;
        }
      }

      // General Satisfaction (CSAT) Logic
      const score = getSatisfactionScore(a.answer, qType || '');
      if (score !== null) {
        totalSatSum += score;
        totalSatAnswers++;
      }

      // Track stats per question
      if (!statsMap.has(qText)) {
        statsMap.set(qText, { satSum: 0, satCount: 0, count: 0, type: qType, distribution: {} });
      }
      const s = statsMap.get(qText);
      
      // Increment engagement count ONLY if answer is not empty
      if (a.answer !== null && a.answer !== undefined && (Array.isArray(a.answer) ? a.answer.length > 0 : a.answer !== '')) {
        s.count++;
        if (score !== null) {
          s.satSum += score;
          s.satCount++;
        }

        // Track distribution (handling arrays for Multi-Choice)
        if (qType !== 'Texto Aberto') {
          const answersToTrack = Array.isArray(a.answer) ? a.answer : [a.answer];
          answersToTrack.forEach((val: any) => {
            if (val !== null && val !== undefined) {
              const optionKey = String(val).trim().toUpperCase();
              if (optionKey) {
                s.distribution[optionKey] = (s.distribution[optionKey] || 0) + 1;
              }
            }
          });
        }
      }
    });
  });

  const npsScore = npsTotal > 0 ? ((p - d) / npsTotal) * 100 : 0;
  const overallSatisfaction = totalSatAnswers > 0 ? totalSatSum / totalSatAnswers : 0;

  const questionStats = Array.from(statsMap.entries()).map(([text, s]) => {
    return {
      text,
      satisfaction: s.satCount > 0 ? s.satSum / s.satCount : 0,
      count: s.count,
      type: s.type,
      distribution: s.distribution
    };
  });

  return {
    nps: { score: npsScore, promotores: p, neutros: n, detratores: d, total: npsTotal },
    overallSatisfaction,
    totalResponses: responses.length,
    questionStats
  };
}