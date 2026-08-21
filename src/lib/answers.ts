// Helpers compartilhados para manipulação do campo `answers` das respostas.
// O campo pode ser persistido como JSON string (legado) ou como array nativo.

// Converte o campo `answers` em um array. Se for uma string JSON, faz o parse;
// se for inválido, retorna array vazio. Nunca lança exceção.
export function parseAnswers(answers: any): any[] {
  if (answers == null) return [];
  if (Array.isArray(answers)) return answers;
  if (typeof answers === "string") {
    try {
      const parsed = JSON.parse(answers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Normaliza um valor JSON para uma string estável (independente da ordem das chaves).
// Necessário para a deduplicação, pois o Postgres JSONB pode reordenar chaves de objetos.
export function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Sanitiza um array de respostas antes de persistir:
// - Limita a quantidade de itens (100) e o tamanho de cada campo.
// - Mantém apenas tipos seguros (string, número, boolean ou array de string/número).
export function sanitizeAnswers(answers: any[]): any[] {
  return (answers || [])
    .slice(0, 100)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const safe: any = {};
      if (typeof item.type === "string") safe.type = item.type.slice(0, 100);
      if (typeof item.question === "string") safe.question = item.question.slice(0, 1000);
      if (typeof item.text === "string") safe.text = item.text.slice(0, 1000);
      if (typeof item.question_id === "string") safe.question_id = item.question_id.slice(0, 100);
      if (typeof item.comment === "string") safe.comment = item.comment.slice(0, 2000);
      const answer = item.answer;
      if (typeof answer === "string") safe.answer = answer.slice(0, 2000);
      else if (typeof answer === "number") safe.answer = answer;
      else if (typeof answer === "boolean") safe.answer = answer;
      else if (Array.isArray(answer)) {
        safe.answer = answer
          .slice(0, 50)
          .map((answerValue: any) => (typeof answerValue === "string" ? answerValue.slice(0, 500) : answerValue))
          .filter((answerValue: any) => typeof answerValue === "string" || typeof answerValue === "number");
      }
      return safe;
    })
    .filter(Boolean);
}
