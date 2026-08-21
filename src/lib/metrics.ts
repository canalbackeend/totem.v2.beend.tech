// Métricas de satisfação: converte respostas de qualquer tipo de pergunta
// (SMILE 4/5, NPS, Avaliação de 1 à 5, etc.) em um score numérico 100/75/50/25.

// Score possível de satisfação (usado na média geral e no gráfico de evolução).
export type SatisfactionScore = 100 | 75 | 50 | 25;

// Converte o valor de uma resposta em um score de satisfação (100=ótimo, 25=ruim).
// - `answerValue`: valor bruto da resposta (string, número ou boolean).
// - `questionType`: tipo da pergunta (ex.: "SMILE 5", "NPS", "Avaliação de 1 à 5").
// Retorna null para respostas vazias ou não classificáveis (ex.: texto aberto).
export function getSatisfactionScore(answerValue: any, questionType?: string): SatisfactionScore | null {
  if (answerValue === null || answerValue === undefined || answerValue === '') return null;

  // Normaliza o valor: versão em string maiúscula (para matching textual)
  // e versão numérica (para escalas numéricas como NPS e estrelas).
  const normalizedAnswer = String(answerValue).trim().toUpperCase();
  const numericValue = Number(answerValue);
  const isNumericAnswer = !isNaN(numericValue) && typeof answerValue !== 'boolean';

  // --- Score 100 (Excelente) ---
  // Texto: "Muito Satisfeito", "Excelente", "Muito Bom", "Ótimo".
  // NPS: 9 ou 10. SMILE 5: valor 5. SMILE 4: valor 4. Avaliação 1-5: valor 5.
  if (['MUITO SATISFEITO', 'EXCELENTE', 'MUITO BOM', 'ÓTIMO'].includes(normalizedAnswer)
    || (isNumericAnswer && numericValue >= 9)
    || (isNumericAnswer && questionType === 'SMILE 5' && numericValue === 5)
    || (isNumericAnswer && questionType === 'SMILE 4' && numericValue === 4)
    || (isNumericAnswer && questionType === 'Avaliação de 1 à 5' && numericValue === 5)) {
    return 100;
  }

  // --- Score 75 (Bom) ---
  // Texto: "Satisfeito", "Bom". NPS: 7 ou 8. SMILE 5: valor 4. SMILE 4: valor 3. Avaliação 1-5: valor 4.
  if (['SATISFEITO', 'BOM'].includes(normalizedAnswer)
    || (isNumericAnswer && numericValue >= 7 && numericValue <= 8)
    || (isNumericAnswer && questionType === 'SMILE 5' && numericValue === 4)
    || (isNumericAnswer && questionType === 'SMILE 4' && numericValue === 3)
    || (isNumericAnswer && questionType === 'Avaliação de 1 à 5' && numericValue === 4)) {
    return 75;
  }

  // --- Score 50 (Regular) ---
  // Texto: "Regular", "Médio". NPS: 5 ou 6. SMILE 5: valor 3. SMILE 4: valor 2. Avaliação 1-5: valor 3.
  if (['REGULAR', 'MÉDIO'].includes(normalizedAnswer)
    || (isNumericAnswer && numericValue >= 5 && numericValue <= 6)
    || (isNumericAnswer && questionType === 'SMILE 5' && numericValue === 3)
    || (isNumericAnswer && questionType === 'SMILE 4' && numericValue === 2)
    || (isNumericAnswer && questionType === 'Avaliação de 1 à 5' && numericValue === 3)) {
    return 50;
  }

  // --- Score 25 (Ruim) ---
  // Texto: "Ruim", "Péssimo", "Insatisfeito", "Muito Insatisfeito".
  // NPS: 0 a 4. SMILE 5: 1 ou 2. SMILE 4: 1. Avaliação 1-5: 1 ou 2.
  if (['RUIM', 'PÉSSIMO', 'INSATISFEITO', 'MUITO INSATISFEITO'].includes(normalizedAnswer)
    || (isNumericAnswer && numericValue <= 4)
    || (isNumericAnswer && questionType === 'SMILE 5' && numericValue <= 2)
    || (isNumericAnswer && questionType === 'SMILE 4' && numericValue === 1)
    || (isNumericAnswer && questionType === 'Avaliação de 1 à 5' && numericValue <= 2)) {
    return 25;
  }

  // Valor não reconhecido (ex.: resposta de texto aberto) — não pontua.
  return null;
}

// Chave de percepção usada para incrementar os contadores da campanha
// (perception_excelente / bom / regular / ruim).
export type PerceptionKey = 'excelente' | 'bom' | 'regular' | 'ruim';

// Converte uma resposta em sua chave de percepção (excelente/bom/regular/ruim).
// Retorna null se a resposta não puder ser pontuada.
export function getPerceptionKey(answerValue: any, questionType?: string): PerceptionKey | null {
  const score = getSatisfactionScore(answerValue, questionType);
  if (score === null) return null;
  if (score === 100) return 'excelente';
  if (score === 75) return 'bom';
  if (score === 50) return 'regular';
  return 'ruim';
}
