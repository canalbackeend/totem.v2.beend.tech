export interface QuestionOption {
  id: string;
  text: string;
  color?: string;
  image?: string;
}

export interface Question {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  allowComment?: boolean;
  options?: QuestionOption[];
  branch?: {
    rules: Record<string, string>;
    defaultNext?: string;
  };
}

export const END = "END";

// Desempacota uma resposta que pode estar no formato { value, comment },
// retornando apenas o valor (usado no fluxo condicional).
function unwrapAnswer(answer: any): any {
  if (answer && typeof answer === "object" && !Array.isArray(answer) && "value" in answer) {
    return answer.value;
  }
  return answer;
}

// Retorna o índice da pergunta com o id informado, ou -1 se não existir.
function findIndexById(questions: Question[], id: string): number {
  return questions.findIndex((question) => question.id === id);
}

// Indica se a lista de perguntas possui fluxo avançado (desvios condicionais).
export function hasAdvancedFlow(questions: Question[]): boolean {
  return Array.isArray(questions) && questions.some((question) => question && question.branch);
}

// Tipos de pergunta que suportam desvio condicional (as demais sempre avançam em sequência).
export function isBranchableType(type: string): boolean {
  if (!type) return false;
  const lowercaseType = type.toLowerCase();
  return !["texto aberto", "multipla escolha", "múltipla escolha"].includes(lowercaseType);
}

// Calcula o índice da próxima pergunta a exibir, com base nas respostas dadas.
// - Sem fluxo avançado: simplesmente avança em sequência (próximo índice).
// - Com fluxo avançado: segue a regra de desvio da resposta, o defaultNext, ou encerra.
// Retorna null quando o questionário deve terminar.
export function getNextQuestionIndex(
  questions: Question[],
  currentIndex: number,
  answers: any[]
): number | null {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!hasAdvancedFlow(questions)) {
    const next = currentIndex + 1;
    return next < questions.length ? next : null;
  }

  const currentQuestion = questions[currentIndex];
  const branch = currentQuestion && currentQuestion.branch;

  if (branch) {
    const answerValue = unwrapAnswer(answers?.[currentIndex]);
    // Regra de desvio selecionada pela resposta do usuário.
    const targetId =
      answerValue !== undefined && answerValue !== null && answerValue !== ""
        ? branch.rules?.[String(answerValue)]
        : undefined;

    if (targetId === END) return null;
    if (targetId) {
      const targetIndex = findIndexById(questions, targetId);
      return targetIndex >= 0 ? targetIndex : null;
    }

    // Sem regra para a resposta: usa o desvio padrão (se configurado).
    if (branch.defaultNext === END) return null;
    if (branch.defaultNext) {
      const targetIndex = findIndexById(questions, branch.defaultNext);
      return targetIndex >= 0 ? targetIndex : null;
    }

    // Sem regra e sem default: encerra o questionário.
    return null;
  }

  const next = currentIndex + 1;
  return next < questions.length ? next : null;
}

export interface FlowValidation {
  cycles: string[];
  unreachable: string[];
  errors: string[];
}

function edgesFrom(questions: Question[], index: number): number[] {
  const question = questions[index];
  if (!question) return [];
  if (question.branch) {
    const targets: number[] = [];
    if (question.branch.rules) {
      for (const target of Object.values(question.branch.rules)) {
        if (target !== END) {
          const targetIndex = findIndexById(questions, target);
          if (targetIndex >= 0) targets.push(targetIndex);
        }
      }
    }
    if (question.branch.defaultNext && question.branch.defaultNext !== END) {
      const targetIndex = findIndexById(questions, question.branch.defaultNext);
      if (targetIndex >= 0) targets.push(targetIndex);
    }
    return targets;
  }
  const next = index + 1;
  return next < questions.length ? [next] : [];
}

export function validateFlow(questions: Question[]): FlowValidation {
  const result: FlowValidation = { cycles: [], unreachable: [], errors: [] };
  if (!Array.isArray(questions) || questions.length === 0) return result;

  const indexById = new Map(questions.map((question, index) => [question.id, index]));

  // 1. Destinos inválidos: regras apontando para perguntas inexistentes.
  questions.forEach((question) => {
    if (!question.branch) return;
    const collect = (target: string | undefined) => {
      if (!target || target === END) return;
      if (!indexById.has(target)) {
        result.errors.push(`Pergunta "${question.text || question.id}" aponta para um destino inexistente (${target}).`);
      }
    };
    if (question.branch.rules) Object.values(question.branch.rules).forEach(collect);
    collect(question.branch.defaultNext);
  });

  // 2. Ciclos (DFS a partir do índice 0, seguindo todas as transições possíveis).
  const state = new Array<number>(questions.length).fill(0); // 0 não visitado, 1 na pilha, 2 concluído
  const stack: number[] = [];

  const dfs = (index: number) => {
    if (state[index] === 2) return;
    if (state[index] === 1) {
      const start = stack.indexOf(index);
      const cyclePath = stack
        .slice(start)
        .map((cycleQuestionIndex) => questions[cycleQuestionIndex].text || questions[cycleQuestionIndex].id);
      result.cycles.push(`Ciclo detectado: ${cyclePath.join(" → ")}`);
      return;
    }
    state[index] = 1;
    stack.push(index);
    for (const targetIndex of edgesFrom(questions, index)) dfs(targetIndex);
    stack.pop();
    state[index] = 2;
  };

  if (questions.length > 0) dfs(0);

  // 3. Inalcançáveis: perguntas que nunca são exibidas a partir do início.
  const reached = new Array<number>(questions.length).fill(0);
  const walk = (index: number) => {
    if (reached[index]) return;
    reached[index] = 1;
    for (const targetIndex of edgesFrom(questions, index)) walk(targetIndex);
  };
  if (questions.length > 0) walk(0);

  questions.forEach((question, index) => {
    if (!reached[index]) {
      result.unreachable.push(`Pergunta "${question.text || question.id}" nunca será exibida.`);
    }
  });

  return result;
}

export interface FlowEdge {
  sourceId: string;
  optionText?: string;
  targetId: string;
}

export interface FlowGraph {
  startId: string;
  questionNodes: Question[];
  edges: FlowEdge[];
  endMessage?: string;
}

export function buildFlowGraph(questions: Question[], endMessage?: string): FlowGraph {
  const questionNodes = Array.isArray(questions) ? questions : [];
  const edges: FlowEdge[] = [];

  for (const question of questionNodes) {
    if (question.branch?.rules) {
      for (const [optionText, target] of Object.entries(question.branch.rules)) {
        edges.push({ sourceId: question.id, optionText, targetId: target });
      }
    }
    if (question.branch?.defaultNext) {
      edges.push({ sourceId: question.id, targetId: question.branch.defaultNext });
    }
  }

  return {
    startId: questionNodes[0]?.id || "",
    questionNodes,
    edges,
    endMessage,
  };
}

// Adiciona um id a uma lista, evitando duplicatas.

export function serializeFlow(graph: FlowGraph): {
  questions: Question[];
  thank_you_message?: string;
} {
  const { questionNodes, edges, startId } = graph;
  const nodeById = new Map(questionNodes.map((node) => [node.id, node]));

  // Mapa de arestas: pergunta de origem → ids de destino.
  const targetsFrom = new Map<string, string[]>();
  for (const edge of edges) {
    if (!targetsFrom.has(edge.sourceId)) targetsFrom.set(edge.sourceId, []);
    targetsFrom.get(edge.sourceId)!.push(edge.targetId);
  }

  // BFS a partir do início, mantendo a primeira pergunta no índice 0.
  const ordered: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = startId ? [startId] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(id);
    for (const targetId of targetsFrom.get(id) || []) {
      if (targetId !== END && !visited.has(targetId)) queue.push(targetId);
    }
  }

  // Adiciona qualquer nó não alcançado (não deve ocorrer após a validação, mas preserva dados).
  for (const node of questionNodes) {
    if (!visited.has(node.id)) ordered.push(node.id);
  }

  // Regras de desvio por opção (ex.: opção "Sim" → pergunta X).
  const ruleBySourceOption = new Map<string, Record<string, string>>();
  for (const edge of edges) {
    if (edge.optionText === undefined) continue;
    if (!ruleBySourceOption.has(edge.sourceId)) ruleBySourceOption.set(edge.sourceId, {});
    ruleBySourceOption.get(edge.sourceId)![edge.optionText] = edge.targetId;
  }
  // Desvio padrão por pergunta (sem opção vinculada).
  const defaultBySource = new Map<string, string>();
  for (const edge of edges) {
    if (edge.optionText !== undefined) continue;
    defaultBySource.set(edge.sourceId, edge.targetId);
  }

  // Reconstrói cada pergunta com seu bloco de desvio (branch).
  const questions = ordered
    .map((id) => {
      const node = nodeById.get(id);
      if (!node) return null;
      const rules: Record<string, string> = {};
      const sourceRules = ruleBySourceOption.get(id) || {};
      for (const option of node.options || []) {
        rules[option.text] = sourceRules[option.text] || END;
      }
      const defaultNext = defaultBySource.get(id);
      const hasRules = Object.keys(rules).length > 0;
      if (hasRules || defaultNext) {
        return {
          ...node,
          branch: {
            ...(hasRules ? { rules } : {}),
            ...(defaultNext ? { defaultNext } : {}),
          },
        };
      }
      return { ...node, branch: { rules: {} } };
    })
    .filter(Boolean) as Question[];

  return {
    questions,
    ...(graph.endMessage ? { thank_you_message: graph.endMessage } : {}),
  };
}
