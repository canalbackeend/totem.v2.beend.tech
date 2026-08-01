import { describe, it, expect } from "vitest";
import {
  END,
  getNextQuestionIndex,
  hasAdvancedFlow,
  validateFlow,
  buildFlowGraph,
  serializeFlow,
  type Question,
} from "../src/lib/flow";

function q(id: string, text: string, opts: string[], branch?: Question["branch"]): Question {
  return {
    id,
    text,
    type: "Escolha Única",
    required: true,
    allowComment: false,
    options: opts.map((t, i) => ({ id: `${id}_o${i}`, text: t })),
    branch,
  };
}

const vda: Question[] = [
  q("q1", "Como você avalia o serviço de transporte (VDA)?", ["Ótimo", "Bom", "Ruim"], {
    rules: { "Ótimo": END, "Bom": END, "Ruim": "q2" },
  }),
  q("q2", "Qual serviço precisa melhorar?", ["Conservação e limpeza", "Ar-condicionado", "Conduta do motorista", "Outros"], {
    rules: {
      "Conservação e limpeza": "q3",
      "Ar-condicionado": "q4",
      "Conduta do motorista": "q5",
      "Outros": "q6",
    },
  }),
  q("q3", "O que precisa melhorar na conservação e limpeza?", ["Banco sujo", "Lixo no interior"], {
    rules: { "Banco sujo": END, "Lixo no interior": END },
  }),
  q("q4", "O que precisa melhorar no ar-condicionado?", ["Não estava funcionando"], {
    rules: { "Não estava funcionando": END },
  }),
  q("q5", "O que precisa melhorar na conduta do motorista?", ["Excesso de velocidade"], {
    rules: { "Excesso de velocidade": END },
  }),
  q("q6", "O que precisa melhorar?", ["Atraso no transporte"], {
    rules: { "Atraso no transporte": END },
  }),
];

describe("hasAdvancedFlow", () => {
  it("retorna false para campanha linear", () => {
    const linear = [q("a", "P1", ["Sim", "Não"])];
    expect(hasAdvancedFlow(linear)).toBe(false);
  });

  it("retorna true quando qualquer pergunta tem branch", () => {
    expect(hasAdvancedFlow(vda)).toBe(true);
  });
});

describe("getNextQuestionIndex - fluxo linear (retrocompatibilidade)", () => {
  const linear = [
    q("a", "P1", ["Sim", "Não"]),
    q("b", "P2", ["Sim", "Não"]),
    q("c", "P3", ["Sim", "Não"]),
  ];

  it("avança de 1 em 1 e finaliza no fim", () => {
    expect(getNextQuestionIndex(linear, 0, [])).toBe(1);
    expect(getNextQuestionIndex(linear, 1, [])).toBe(2);
    expect(getNextQuestionIndex(linear, 2, [])).toBeNull();
  });

  it("ignora respostas e mantém comportamento linear", () => {
    expect(getNextQuestionIndex(linear, 0, ["Sim"])).toBe(1);
  });
});

describe("getNextQuestionIndex - fluxo VDA", () => {
  it("Ótimo encerra", () => {
    expect(getNextQuestionIndex(vda, 0, ["Ótimo"])).toBeNull();
  });

  it("Bom encerra", () => {
    expect(getNextQuestionIndex(vda, 0, ["Bom"])).toBeNull();
  });

  it("Ruim direciona para Q2 (índice 1)", () => {
    expect(getNextQuestionIndex(vda, 0, ["Ruim"])).toBe(1);
  });

  it("cada serviço direciona para sua tela", () => {
    expect(getNextQuestionIndex(vda, 1, ["Ruim", "Conservação e limpeza"])).toBe(2);
    expect(getNextQuestionIndex(vda, 1, ["Ruim", "Ar-condicionado"])).toBe(3);
    expect(getNextQuestionIndex(vda, 1, ["Ruim", "Conduta do motorista"])).toBe(4);
    expect(getNextQuestionIndex(vda, 1, ["Ruim", "Outros"])).toBe(5);
  });

  it("telas de problema encerram", () => {
    expect(getNextQuestionIndex(vda, 2, ["Banco sujo"])).toBeNull();
    expect(getNextQuestionIndex(vda, 3, ["Não estava funcionando"])).toBeNull();
    expect(getNextQuestionIndex(vda, 5, ["Atraso no transporte"])).toBeNull();
  });
});

describe("getNextQuestionIndex - casos especiais", () => {
  it("aceita wrapper {value, comment}", () => {
    expect(getNextQuestionIndex(vda, 0, [{ value: "Ruim", comment: "ok" }])).toBe(1);
  });

  it("valor não mapeado em pergunta com branch encerra (safe default)", () => {
    const partial = [q("a", "P1", ["Sim", "Não"], { rules: { Sim: END } })];
    expect(getNextQuestionIndex(partial, 0, ["Não"])).toBeNull();
  });

  it("suporta defaultNext para perguntas sem opções", () => {
    const flow = [
      q("a", "P1", ["Sim", "Não"], { rules: { Sim: "b", "Não": END } }),
      { id: "b", text: "Comentário", type: "Texto Aberto", branch: { defaultNext: "c" } } as Question,
      q("c", "P3", ["ok"], { rules: { ok: END } }),
    ];
    expect(getNextQuestionIndex(flow, 1, ["qualquer texto"])).toBe(2);
    expect(getNextQuestionIndex(flow, 2, ["ok"])).toBeNull();
  });

  it("retorna null para campanha vazia", () => {
    expect(getNextQuestionIndex([], 0, [])).toBeNull();
  });

  it("alvo inexistente encerra com segurança", () => {
    const broken = [q("a", "P1", ["Sim"], { rules: { Sim: "nao_existe" } })];
    expect(getNextQuestionIndex(broken, 0, ["Sim"])).toBeNull();
  });
});

describe("validateFlow", () => {
  it("fluxo VDA é válido e sem avisos", () => {
    const r = validateFlow(vda);
    expect(r.cycles).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.unreachable).toEqual([]);
  });

  it("detecta ciclo", () => {
    const cyclic = [
      q("a", "A", ["x"], { rules: { x: "b" } }),
      q("b", "B", ["y"], { rules: { y: "a" } }),
    ];
    const r = validateFlow(cyclic);
    expect(r.cycles.length).toBeGreaterThan(0);
  });

  it("detecta pergunta inacessível", () => {
    const unreachable = [
      q("a", "A", ["x"], { rules: { x: END } }),
      q("b", "B", ["y"], { rules: { y: END } }),
    ];
    const r = validateFlow(unreachable);
    expect(r.unreachable.length).toBe(1);
    expect(r.unreachable[0]).toContain("B");
  });

  it("detecta alvo inválido", () => {
    const bad = [q("a", "A", ["x"], { rules: { x: "ghost" } })];
    const r = validateFlow(bad);
    expect(r.errors.length).toBe(1);
  });
});

describe("round-trip serializeFlow / buildFlowGraph", () => {
  it("mantém grafo e ordem (start no índice 0)", () => {
    const graph = buildFlowGraph(vda, "Obrigado por participar!");
    const { questions, thank_you_message } = serializeFlow(graph);

    expect(thank_you_message).toBe("Obrigado por participar!");
    expect(questions[0].id).toBe("q1");
    expect(questions.length).toBe(6);
    expect(getNextQuestionIndex(questions, 0, ["Ruim"])).toBe(1);
    expect(getNextQuestionIndex(questions, 1, ["Ruim", "Outros"])).toBe(5);

    const rebuilt = buildFlowGraph(questions);
    expect(rebuilt.edges.length).toBe(graph.edges.length);
    expect(rebuilt.startId).toBe("q1");
  });

  it("preenche END para opções sem regra", () => {
    const loose = [q("a", "A", ["x", "y"], { rules: { x: END } })];
    const { questions } = serializeFlow(buildFlowGraph(loose));
    expect(questions[0].branch?.rules).toEqual({ x: END, y: END });
  });
});
