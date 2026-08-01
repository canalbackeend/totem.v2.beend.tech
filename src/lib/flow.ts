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

function unwrapAnswer(ans: any): any {
  if (ans && typeof ans === "object" && !Array.isArray(ans) && "value" in ans) {
    return ans.value;
  }
  return ans;
}

function findIndexById(questions: Question[], id: string): number {
  return questions.findIndex((q) => q.id === id);
}

export function hasAdvancedFlow(questions: Question[]): boolean {
  return Array.isArray(questions) && questions.some((q) => q && q.branch);
}

export function isBranchableType(type: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return !["texto aberto", "multipla escolha", "múltipla escolha"].includes(t);
}

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

  const q = questions[currentIndex];
  const branch = q && q.branch;

  if (branch) {
    const val = unwrapAnswer(answers?.[currentIndex]);
    const rule =
      val !== undefined && val !== null && val !== ""
        ? branch.rules?.[String(val)]
        : undefined;

    if (rule === END) return null;
    if (rule) {
      const idx = findIndexById(questions, rule);
      return idx >= 0 ? idx : null;
    }

    if (branch.defaultNext === END) return null;
    if (branch.defaultNext) {
      const idx = findIndexById(questions, branch.defaultNext);
      return idx >= 0 ? idx : null;
    }

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

function edgesFrom(questions: Question[], i: number): number[] {
  const q = questions[i];
  if (!q) return [];
  if (q.branch) {
    const targets: number[] = [];
    if (q.branch.rules) {
      for (const target of Object.values(q.branch.rules)) {
        if (target !== END) {
          const idx = findIndexById(questions, target);
          if (idx >= 0) targets.push(idx);
        }
      }
    }
    if (q.branch.defaultNext && q.branch.defaultNext !== END) {
      const idx = findIndexById(questions, q.branch.defaultNext);
      if (idx >= 0) targets.push(idx);
    }
    return targets;
  }
  const next = i + 1;
  return next < questions.length ? [next] : [];
}

export function validateFlow(questions: Question[]): FlowValidation {
  const result: FlowValidation = { cycles: [], unreachable: [], errors: [] };
  if (!Array.isArray(questions) || questions.length === 0) return result;

  const byId = new Map(questions.map((q, i) => [q.id, i]));

  // 1. Invalid targets
  questions.forEach((q, i) => {
    if (!q.branch) return;
    const collect = (target: string | undefined) => {
      if (!target || target === END) return;
      if (!byId.has(target)) {
        result.errors.push(`Pergunta "${q.text || q.id}" aponta para um destino inexistente (${target}).`);
      }
    };
    if (q.branch.rules) Object.values(q.branch.rules).forEach(collect);
    collect(q.branch.defaultNext);
    void i;
  });

  // 2. Cycles (DFS from index 0, following all possible transitions)
  const state = new Array<number>(questions.length).fill(0); // 0 unvisited, 1 in-stack, 2 done
  const stack: number[] = [];

  const dfs = (i: number) => {
    if (state[i] === 2) return;
    if (state[i] === 1) {
      const start = stack.indexOf(i);
      const cyclePath = stack
        .slice(start)
        .map((x) => questions[x].text || questions[x].id);
      result.cycles.push(`Ciclo detectado: ${cyclePath.join(" → ")}`);
      return;
    }
    state[i] = 1;
    stack.push(i);
    for (const t of edgesFrom(questions, i)) dfs(t);
    stack.pop();
    state[i] = 2;
  };

  if (questions.length > 0) dfs(0);

  // 3. Unreachable (questions that can never be shown from the start)
  const reached = new Array<number>(questions.length).fill(0);
  const walk = (i: number) => {
    if (reached[i]) return;
    reached[i] = 1;
    for (const t of edgesFrom(questions, i)) walk(t);
  };
  if (questions.length > 0) walk(0);

  questions.forEach((q, i) => {
    if (!reached[i]) {
      result.unreachable.push(`Pergunta "${q.text || q.id}" nunca será exibida.`);
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

  for (const q of questionNodes) {
    if (q.branch?.rules) {
      for (const [optionText, target] of Object.entries(q.branch.rules)) {
        edges.push({ sourceId: q.id, optionText, targetId: target });
      }
    }
    if (q.branch?.defaultNext) {
      edges.push({ sourceId: q.id, targetId: q.branch.defaultNext });
    }
  }

  return {
    startId: questionNodes[0]?.id || "",
    questionNodes,
    edges,
    endMessage,
  };
}

function addUnique(list: string[], id: string) {
  if (!list.includes(id)) list.push(id);
}

export function serializeFlow(graph: FlowGraph): {
  questions: Question[];
  thank_you_message?: string;
} {
  const { questionNodes, edges, startId } = graph;
  const nodeById = new Map(questionNodes.map((n) => [n.id, n]));

  const targetsFrom = new Map<string, string[]>();
  for (const e of edges) {
    if (!targetsFrom.has(e.sourceId)) targetsFrom.set(e.sourceId, []);
    targetsFrom.get(e.sourceId)!.push(e.targetId);
  }

  // BFS from start to keep the start node at index 0
  const ordered: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = startId ? [startId] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(id);
    for (const t of targetsFrom.get(id) || []) {
      if (t !== END && !visited.has(t)) queue.push(t);
    }
  }

  // Append any node not reached (shouldn't happen after validation, but keep data)
  for (const n of questionNodes) {
    if (!visited.has(n.id)) ordered.push(n.id);
  }

  const ruleBySourceOption = new Map<string, Record<string, string>>();
  for (const e of edges) {
    if (e.optionText === undefined) continue;
    if (!ruleBySourceOption.has(e.sourceId)) ruleBySourceOption.set(e.sourceId, {});
    ruleBySourceOption.get(e.sourceId)![e.optionText] = e.targetId;
  }
  const defaultBySource = new Map<string, string>();
  for (const e of edges) {
    if (e.optionText !== undefined) continue;
    defaultBySource.set(e.sourceId, e.targetId);
  }

  const questions = ordered
    .map((id) => {
      const node = nodeById.get(id);
      if (!node) return null;
      const rules: Record<string, string> = {};
      const sourceRules = ruleBySourceOption.get(id) || {};
      for (const opt of node.options || []) {
        rules[opt.text] = sourceRules[opt.text] || END;
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
