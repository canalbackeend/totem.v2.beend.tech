export type SatisfactionScore = 100 | 75 | 50 | 25;

export function getSatisfactionScore(ans: any, type?: string): SatisfactionScore | null {
  if (ans === null || ans === undefined || ans === '') return null;

  const valStr = String(ans).trim().toUpperCase();
  const num = Number(ans);
  const isNum = !isNaN(num) && typeof ans !== 'boolean';

  if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM', 'ÓTIMO'].includes(valStr) || (isNum && num >= 9) || (isNum && type === 'SMILE 5' && num === 5) || (isNum && type === 'SMILE 4' && num === 4) || (isNum && type === 'Avaliação de 1 à 5' && num === 5)) {
    return 100;
  } else if (['SATISFEITO', 'BOM'].includes(valStr) || (isNum && num >= 7 && num <= 8) || (isNum && type === 'SMILE 5' && num === 4) || (isNum && type === 'SMILE 4' && num === 3) || (isNum && type === 'Avaliação de 1 à 5' && num === 4)) {
    return 75;
  } else if (['REGULAR', 'MÉDIO'].includes(valStr) || (isNum && num >= 5 && num <= 6) || (isNum && type === 'SMILE 5' && num === 3) || (isNum && type === 'SMILE 4' && num === 2) || (isNum && type === 'Avaliação de 1 à 5' && num === 3)) {
    return 50;
  } else if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO'].includes(valStr) || (isNum && num <= 4) || (isNum && type === 'SMILE 5' && num <= 2) || (isNum && type === 'SMILE 4' && num === 1) || (isNum && type === 'Avaliação de 1 à 5' && num <= 2)) {
    return 25;
  }
  return null;
}

export type PerceptionKey = 'excelente' | 'bom' | 'regular' | 'ruim';

export function getPerceptionKey(ans: any, type?: string): PerceptionKey | null {
  const score = getSatisfactionScore(ans, type);
  if (score === null) return null;
  if (score === 100) return 'excelente';
  if (score === 75) return 'bom';
  if (score === 50) return 'regular';
  return 'ruim';
}