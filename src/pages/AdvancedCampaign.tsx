import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Angry, Frown, Laugh, Meh, Smile, Star } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import {
  END,
  buildFlowGraph,
  serializeFlow,
  validateFlow,
  type FlowEdge,
  type Question,
} from "../lib/flow";

type FlowNodeKind = "start" | "end" | "question";

interface FlowNodeData {
  kind: FlowNodeKind;
  question?: Question;
  rules?: Record<string, string>;
  defaultNext?: string;
  endMessage?: string;
  [key: string]: unknown;
}

type FlowNodeType = Node<FlowNodeData>;

const START_ID = "node_start";
const END_ID = "node_end";

const QUESTION_TYPES = [
  "Escolha Única",
  "Múltipla Escolha",
  "SMILE 5",
  "SMILE 4",
  "NPS",
  "Avaliação de 1 à 5",
  "Colaborador",
  "Texto Aberto",
];

const TYPE_PRESETS: Record<string, { text?: string; options?: string[] }> = {
  "SMILE 5": {
    text: "Como você avalia sua experiência hoje?",
    options: ["Muito satisfeito", "Satisfeito", "Regular", "Insatisfeito", "Muito Insatisfeito"],
  },
  "SMILE 4": {
    text: "Como você avalia sua experiência hoje?",
    options: ["EXCELENTE", "BOM", "REGULAR", "RUIM"],
  },
  "NPS": {
    text: "De 0 à 10, você recomendaria a nossa empresa para um amigo ou familiar?",
    options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
  "Avaliação de 1 à 5": {
    text: "Avalie sua experiência de 1 à 5:",
    options: ["1", "2", "3", "4", "5"],
  },
};

function makeQuestionId() {
  return "q_" + Math.random().toString(36).substr(2, 9);
}

function defaultQuestion(): Question {
  return {
    id: makeQuestionId(),
    text: "",
    type: "Escolha Única",
    required: true,
    allowComment: false,
    options: [{ id: "o1", text: "Opção 1", color: "#3b82f6" }],
  };
}

function hasOptions(q: Question): boolean {
  return (q.type || "").toLowerCase() !== "texto aberto";
}

function branchesPerOption(q: Question): boolean {
  const t = (q.type || "").toLowerCase();
  return !["texto aberto", "multipla escolha", "múltipla escolha"].includes(t);
}

function isLockedType(type: string): boolean {
  const t = (type || "").toLowerCase();
  return ["smile 4", "smile 5", "avaliação de 1 à 5", "avaliação de 1 a 5"].includes(t);
}

function starOptionIcon(q: Question, optText: string): ReactNode {
  const t = (q.type || "").toLowerCase();
  const isRating = t === "avaliação de 1 à 5" || t === "avaliação de 1 a 5";
  if (!isRating) return null;
  const value = parseInt((optText || "").trim(), 10);
  const colors: Record<number, string> = {
    1: "#ef4444",
    2: "#f97316",
    3: "#e9b306",
    4: "#84cc15",
    5: "#22c55d",
  };
  const color = colors[value] || "#e9b306";
  return <Star className="w-3.5 h-3.5" style={{ color, fill: color }} />;
}

function smileOptionIcon(q: Question, optText: string): ReactNode {
  const t = (q.type || "").toLowerCase();
  const label = (optText || "").trim().toLowerCase();
  if (t === "smile 4") {
    if (label === "excelente") return <Laugh className="w-3.5 h-3.5 text-[#22c55d]" />;
    if (label === "bom") return <Smile className="w-3.5 h-3.5 text-[#84cc15]" />;
    if (label === "regular") return <Meh className="w-3.5 h-3.5 text-[#e9b306]" />;
    if (label === "ruim") return <Frown className="w-3.5 h-3.5 text-[#ef4444]" />;
  }
  if (t === "smile 5") {
    if (label === "muito satisfeito") return <Laugh className="w-3.5 h-3.5 text-[#22c55d]" />;
    if (label === "satisfeito") return <Smile className="w-3.5 h-3.5 text-[#84cc15]" />;
    if (label === "regular") return <Meh className="w-3.5 h-3.5 text-[#e9b306]" />;
    if (label === "insatisfeito") return <Frown className="w-3.5 h-3.5 text-[#f97316]" />;
    if (label === "muito insatisfeito") return <Angry className="w-3.5 h-3.5 text-[#ef4444]" />;
  }
  return null;
}

const NPS_GROUPS = [
  { label: "0-6", min: 0, max: 6, icon: <Frown className="w-3.5 h-3.5 text-[#ef4444]" />, color: "#ef4444" },
  { label: "7-8", min: 7, max: 8, icon: <Meh className="w-3.5 h-3.5 text-[#e9b306]" />, color: "#e9b306" },
  { label: "9-10", min: 9, max: 10, icon: <Laugh className="w-3.5 h-3.5 text-[#22c55d]" />, color: "#22c55d" },
] as const;

function isNps(q: Question | undefined | null): boolean {
  return (q?.type || "").toLowerCase() === "nps";
}

function npsGroupOf(value: number): (typeof NPS_GROUPS)[number] | undefined {
  return NPS_GROUPS.find((g) => value >= g.min && value <= g.max);
}

function edgeId(source: string, handle: string, target: string) {
  return `e_${source}_${handle}_${target}`;
}

function normalizeOptions(questionNodes: Question[]): Question[] {
  return questionNodes.map((q) => ({
    ...q,
    options: (q.options || []).map((o, i) => ({ ...o, id: o.id || `legacy_${i}` })),
  }));
}

// ---------- Custom nodes ----------

function StartNode() {
  return (
    <div className="rounded-lg bg-emerald-500 text-white shadow-lg w-20 h-20 flex items-center justify-center text-center">
      <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
      <Handle type="source" position={Position.Right} id="out" style={{ background: "#10b981", width: 10, height: 10 }} />
    </div>
  );
}

function EndNode({ data }: { data: FlowNodeData }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-emerald-500/40 text-white px-4 py-3 shadow-lg w-52 text-center">
      <Handle type="target" position={Position.Left} id="in" style={{ background: "#22c55e", width: 10, height: 10 }} />
      <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Finalizar</div>
      <div className="text-xs font-bold mt-0.5">Tela de agradecimento</div>
      <div className="text-[9px] text-zinc-400 mt-1 truncate">{data.endMessage || "Obrigado pela sua resposta!"}</div>
    </div>
  );
}

function QuestionNode({ data, selected }: { data: FlowNodeData; selected?: boolean }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const q = data.question;
  const t = q?.type || "";
  const showOptionRows = hasOptions(q || { type: t } as Question);
  const perOption = branchesPerOption(q || { type: t } as Question);
  const locked = isLockedType(t);
  const options = q?.options || [];

  return (
    <div
      className={`rounded-xl px-3 py-2 shadow-lg w-60 border-2 transition-colors ${
        selected
          ? isDarkMode ? "bg-blue-950/50 border-blue-500" : "bg-blue-50 border-blue-500"
          : isDarkMode ? "bg-zinc-800/70 border-white/10" : "bg-white border-zinc-200"
      }`}
    >
      <Handle type="target" position={Position.Left} id="in" style={{ background: "#0b82ff", width: 10, height: 10 }} />
      <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>{t || "Pergunta"}</div>
      <div className={`text-xs font-semibold leading-tight min-h-[16px] ${isDarkMode ? "text-zinc-100" : "text-zinc-800"}`}>
        {q?.text?.trim() ? q.text : "(sem texto)"}
      </div>
      <div className="mt-2 space-y-1">
        {isNps(q) ? (
          NPS_GROUPS.map((g) => {
            const mapped = data.rules?.[g.label];
            return (
              <div key={g.label} className={`relative flex items-center justify-between gap-2 rounded px-2 py-1 ${isDarkMode ? "bg-zinc-800/80" : "bg-zinc-50"}`}>
                <span className="flex items-center gap-1.5 min-w-0">
                  {g.icon}
                  <span className={`text-[10px] font-bold truncate ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>{g.label}</span>
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mapped ? "bg-emerald-500" : "bg-red-500"}`} title={mapped ? "Conectado" : "Sem destino"} />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={g.label}
                  style={{ background: mapped ? "#22c55e" : "#ef4444", width: 8, height: 8 }}
                />
              </div>
            );
          })
        ) : (
          <>
            {showOptionRows && options.length === 0 && (
              <div className="text-[9px] text-amber-600 font-bold">Nenhuma opção — adicione no painel</div>
            )}
            {showOptionRows && options.map((opt) => {
              if (perOption) {
                const mapped = data.rules?.[opt.id];
                return (
                  <div key={opt.id} className={`relative flex items-center justify-between gap-2 rounded px-2 py-1 ${isDarkMode ? "bg-zinc-800/80" : "bg-zinc-50"}`}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {smileOptionIcon(q, opt.text)}
                      {starOptionIcon(q, opt.text)}
                      {!locked && opt.color && <span className={`w-2.5 h-2.5 rounded-full shrink-0 border ${isDarkMode ? "border-white/10" : "border-black/10"}`} style={{ background: opt.color }} />}
                      <span className={`text-[10px] truncate ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>{opt.text || "(vazio)"}</span>
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mapped ? "bg-emerald-500" : "bg-red-500"}`} title={mapped ? "Conectado" : "Sem destino"} />
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={opt.id}
                      style={{ background: mapped ? "#22c55e" : "#ef4444", width: 8, height: 8 }}
                    />
                  </div>
                );
              }
              return (
                <div key={opt.id} className={`flex items-center gap-1.5 rounded px-2 py-1 ${isDarkMode ? "bg-zinc-800/80" : "bg-zinc-50"}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 border ${isDarkMode ? "border-white/10" : "border-black/10"}`} style={{ background: opt.color || "#3b82f6" }} />
                  <span className={`text-[10px] truncate ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>{opt.text || "(vazio)"}</span>
                </div>
              );
            })}
            {!perOption && (
              <div className={`relative flex items-center justify-between rounded px-2 py-1 ${isDarkMode ? "bg-zinc-800/80" : "bg-zinc-50"}`}>
                <span className={`text-[10px] ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>{showOptionRows ? "Continua →" : "Resposta livre"}</span>
                <Handle type="source" position={Position.Right} id="next" style={{ background: data.defaultNext ? "#22c55e" : "#ef4444", width: 8, height: 8 }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { start: StartNode, end: EndNode, question: QuestionNode };

// ---------- Editor ----------

function EditorInner() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const isEdit = !!id;

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const updateNodeInternals = useUpdateNodeInternals();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campaign info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportTime, setReportTime] = useState("08:00");
  const [privacyText, setPrivacyText] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");

  // Layout helper
  const layout = (questionNodes: Question[], startId: string) => {
    const layers = new Map<string, number>();
    const queue: string[] = startId ? [startId] : [];
    if (startId) layers.set(startId, 0);
    const byId = new Map(questionNodes.map((n) => [n.id, n]));
    const outTargets = new Map<string, string[]>();
    for (const n of questionNodes) {
      if (!n.branch) continue;
      const targets: string[] = [];
      if (n.branch.rules) for (const t of Object.values(n.branch.rules)) if (t !== END) targets.push(t);
      if (n.branch.defaultNext && n.branch.defaultNext !== END) targets.push(n.branch.defaultNext);
      outTargets.set(n.id, targets);
    }
    let qi = 0;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const nextLayer = (layers.get(cur) ?? 0) + 1;
      for (const t of outTargets.get(cur) || []) {
        if (!byId.has(t)) continue;
        if (!layers.has(t)) {
          layers.set(t, nextLayer);
          queue.push(t);
        }
      }
      void qi;
    }
    // Unreachable get appended last
    const layered: string[] = [];
    const maxLayer = layers.size ? Math.max(...layers.values()) : 0;
    for (let l = 0; l <= maxLayer + 1; l++) {
      layered.push(...questionNodes.filter((n) => layers.get(n.id) === l).map((n) => n.id));
    }
    for (const n of questionNodes) if (!layers.has(n.id) && !layered.includes(n.id)) layered.push(n.id);

    const positions = new Map<string, { x: number; y: number }>();
    const col = new Map<number, number>();
    layered.forEach((nid, i) => {
      const layer = layers.get(nid) ?? maxLayer + 1;
      const row = col.get(layer) ?? 0;
      col.set(layer, row + 1);
      positions.set(nid, { x: 320 + layer * 280, y: 40 + row * 170 });
    });
    return positions;
  };

  const buildNodesFromGraph = (questionNodes: Question[], startId: string, endMessage?: string, savedLayout?: Record<string, { x: number; y: number }>) => {
    const normalized = normalizeOptions(questionNodes);
    const positions = layout(normalized, startId);
    const qNodes: FlowNodeType[] = normalized.map((q) => ({
      id: q.id,
      type: "question",
      position: savedLayout?.[q.id] || positions.get(q.id) || { x: 400, y: 200 },
      data: { kind: "question", question: q },
    }));
    const startPos = { x: 20, y: 60 + (positions.get(startId)?.y ?? 0) };
    const maxX = qNodes.reduce((m, n) => Math.max(m, n.position.x), 320) + 320;
    return [
      { id: START_ID, type: "start", position: savedLayout?.[START_ID] || startPos, data: { kind: "start" } },
      ...qNodes,
      { id: END_ID, type: "end", position: savedLayout?.[END_ID] || { x: maxX, y: 60 + (positions.get(startId)?.y ?? 0) }, data: { kind: "end", endMessage } },
    ] as FlowNodeType[];
  };

  const buildEdgesFromGraph = (graph: ReturnType<typeof buildFlowGraph>) => {
    const normalized = normalizeOptions(graph.questionNodes);
    const startEdge =
      graph.startId && graph.questionNodes.some((n) => n.id === graph.startId)
        ? [{ id: edgeId(START_ID, "out", graph.startId), source: START_ID, sourceHandle: "out", target: graph.startId, targetHandle: "in" }]
        : [];
    const mapTarget = (targetId: string) => (targetId === END ? END_ID : targetId);
    const qEdges: Edge[] = [];
    const npsHandled = new Set<string>();

    for (const e of graph.edges) {
      const sourceQ = normalized.find((n) => n.id === e.sourceId);
      if (isNps(sourceQ)) {
        if (!npsHandled.has(e.sourceId)) {
          npsHandled.add(e.sourceId);
          for (const g of NPS_GROUPS) {
            const groupEdges = graph.edges.filter(
              (fe) =>
                fe.sourceId === e.sourceId &&
                fe.optionText !== undefined &&
                npsGroupOf(parseInt(fe.optionText, 10))?.label === g.label
            );
            if (groupEdges.length === 0) continue;
            const targetId = groupEdges[0].targetId;
            qEdges.push({
              id: edgeId(e.sourceId, g.label, targetId),
              source: e.sourceId,
              sourceHandle: g.label,
              target: mapTarget(targetId),
              targetHandle: "in",
            });
          }
        }
        continue;
      }
      let sourceHandle = e.optionText ?? "next";
      if (e.optionText !== undefined) {
        const opt = sourceQ?.options?.find((o) => o.text === e.optionText);
        if (opt) sourceHandle = opt.id;
      }
      qEdges.push({
        id: edgeId(e.sourceId, sourceHandle, e.targetId),
        source: e.sourceId,
        sourceHandle,
        target: mapTarget(e.targetId),
        targetHandle: "in",
      });
    }
    return [...startEdge, ...qEdges];
  };

  const cleanInvalidEdges = (edges: Edge[], nodes: FlowNodeType[]): Edge[] => {
    const validHandles = new Set<string>();
    for (const n of nodes) {
      if (n.data.kind === "start") {
        validHandles.add(`${n.id}::out`);
        continue;
      }
      if (n.data.kind === "end") continue;
      const q = n.data.question as Question;
      if (isNps(q)) {
        for (const g of NPS_GROUPS) validHandles.add(`${n.id}::${g.label}`);
        continue;
      }
      const perOption = branchesPerOption(q);
      if (!perOption) {
        validHandles.add(`${n.id}::next`);
      } else {
        for (const o of q.options || []) validHandles.add(`${n.id}::${o.id}`);
      }
    }
    return edges.filter((e) => validHandles.has(`${e.source}::${e.sourceHandle || ""}`));
  };

  // Load (edit mode)
  useEffect(() => {
    (async () => {
      if (!isEdit) {
        setNodes([
          { id: START_ID, type: "start", position: { x: 20, y: 200 }, data: { kind: "start" } },
          { id: END_ID, type: "end", position: { x: 900, y: 200 }, data: { kind: "end", endMessage: "" } },
        ]);
        setLoading(false);
        return;
      }
      try {
        const data = await api.get(`/campaigns/${id}`);
        setTitle(data.name || "");
        setDescription(data.description || "");
        setReportEmail(data.report_email || "");
        setReportTime(data.report_time || "08:00");
        setPrivacyText(data.privacy_text || "");
        setThankYouMessage(data.thank_you_message || "");
        const graph = buildFlowGraph(data.questions || [], data.thank_you_message || "");
        const loadedNodes = buildNodesFromGraph(graph.questionNodes, graph.startId, graph.endMessage, data.flow_layout?.nodes);
        setNodes(loadedNodes);
        setEdges(cleanInvalidEdges(buildEdgesFromGraph(graph), loadedNodes));
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar a campanha");
        navigate("/campanhas");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Recompose rules whenever edges change (keeps red/green dots + serialization accurate)
  useEffect(() => {
    setNodes((ns) => {
      let changed = false;
      const next = ns.map((n) => {
        if (n.data.kind !== "question") return n;
        const qid = n.id;
        const rules: Record<string, string> = {};
        let defaultNext: string | undefined;
        for (const e of edges) {
          if (e.source !== qid) continue;
          if (e.sourceHandle === "next") {
            defaultNext = e.target === END_ID ? END : e.target;
          } else if (e.sourceHandle) {
            rules[e.sourceHandle] = e.target === END_ID ? END : e.target;
          }
        }
        const sameRules = JSON.stringify(n.data.rules || {}) === JSON.stringify(rules);
        const sameDefault = (n.data.defaultNext || "") === (defaultNext || "");
        if (sameRules && sameDefault) return n;
        changed = true;
        return { ...n, data: { ...n.data, rules, defaultNext } };
      });
      return changed ? next : ns;
    });
  }, [edges, setNodes]);

  const updateNodeData = (nodeId: string, patch: Partial<FlowNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  };

  const upsertEdge = (source: string, sourceHandle: string, target: string) => {
    if (!sourceHandle || !target) return;
    setEdges((eds) => {
      const filtered = eds.filter((e) => !(e.source === source && e.sourceHandle === sourceHandle));
      return [...filtered, { id: edgeId(source, sourceHandle, target), source, sourceHandle, target, targetHandle: "in" }];
    });
  };

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

  const addQuestion = () => {
    const q = defaultQuestion();
    const count = nodes.filter((n) => n.data.kind === "question").length;
    setNodes((ns) => [
      ...ns,
      { id: q.id, type: "question", position: { x: 380 + count * 24, y: 120 + count * 60 }, data: { kind: "question", question: q } },
    ]);
    setSelectedId(q.id);
    const startHasEdge = edges.some((e) => e.source === START_ID);
    if (!startHasEdge) {
      upsertEdge(START_ID, "out", q.id);
    }
  };

  const removeQuestion = (nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
  };

  const patchQuestion = (nodeId: string, patch: Partial<Question>) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || n.data.kind !== "question") return n;
        const q = { ...(n.data.question as Question), ...patch };
        return { ...n, data: { ...n.data, question: q } };
      })
    );
  };

  const changeType = (nodeId: string, type: string) => {
    const current = nodes.find((n) => n.id === nodeId);
    const prev = current?.data.question as Question | undefined;
    if (!prev) return;
    const q: Question = { ...prev, type };
    const preset = TYPE_PRESETS[type];
    if (preset && prev.type !== type) {
      if (preset.text) q.text = preset.text;
      if (preset.options) {
        q.options = preset.options.map((text, i) => ({ id: "o" + (i + 1), text }));
      }
    }
    if (!hasOptions(q)) {
      q.options = [];
    } else if (!q.options || q.options.length === 0) {
      q.options = [{ id: "o1", text: "Opção 1", color: "#3b82f6" }];
    }

    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, question: q } } : n)));

    updateNodeInternals(nodeId);

    if (isNps(prev) || isNps(q)) {
      setEdges((eds) => eds.filter((e) => e.source !== nodeId));
      return;
    }

    const newPerOption = branchesPerOption(q);
    const newOptIds = new Set((q.options || []).map((o) => o.id));
    setEdges((eds) =>
      eds.filter((e) => {
        if (e.source !== nodeId) return true;
        if (e.sourceHandle === "next") return !newPerOption;
        return !!newPerOption && e.sourceHandle && newOptIds.has(e.sourceHandle);
      })
    );
  };

  const addOption = (nodeId: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || n.data.kind !== "question") return n;
        const q = { ...(n.data.question as Question) };
        if (isLockedType(q.type)) return n;
        const options = q.options || [];
        q.options = [...options, { id: "o" + Math.random().toString(36).substr(2, 6), text: `Opção ${options.length + 1}`, color: "#3b82f6" }];
        return { ...n, data: { ...n.data, question: q } };
      })
    );
    updateNodeInternals(nodeId);
  };

  const renameOption = (nodeId: string, optionId: string, text: string, oldText: string) => {
    void oldText;
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || n.data.kind !== "question") return n;
        const q = { ...(n.data.question as Question) };
        if (isLockedType(q.type)) return n;
        q.options = (q.options || []).map((o) => (o.id === optionId ? { ...o, text } : o));
        return { ...n, data: { ...n.data, question: q } };
      })
    );
  };

  const removeOption = (nodeId: string, optionId: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || n.data.kind !== "question") return n;
        const question = { ...(n.data.question as Question) };
        if (isLockedType(question.type)) return n;
        question.options = (question.options || []).filter((o) => o.id !== optionId);
        return { ...n, data: { ...n.data, question } };
      })
    );
    setEdges((eds) => eds.filter((e) => !(e.source === nodeId && e.sourceHandle === optionId)));
    updateNodeInternals(nodeId);
  };

  const changeOptionColor = (nodeId: string, optionId: string, color: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== nodeId || n.data.kind !== "question") return n;
        const q = { ...(n.data.question as Question) };
        q.options = (q.options || []).map((o) => (o.id === optionId ? { ...o, color } : o));
        return { ...n, data: { ...n.data, question: q } };
      })
    );
  };

  const isValidConnection = (conn: Connection) => {
    if (!conn.source || !conn.target) return false;
    if (conn.source === conn.target) return false;
    if (conn.source === END_ID || conn.target === START_ID) return false;
    return true;
  };

  const onConnect = (conn: Connection) => {
    if (!conn.source || !conn.target || !conn.sourceHandle) return;
    upsertEdge(conn.source, conn.sourceHandle, conn.target);
  };

  const questionTargets = useMemo(
    () =>
      nodes
        .filter((n) => n.data.kind === "question")
        .map((n) => ({ id: n.id, label: (n.data.question?.text || "").trim() || "(sem texto)" })),
    [nodes]
  );

  const buildPayload = () => {
    const questionNodes = nodes
      .filter((n) => n.data.kind === "question")
      .map((n) => n.data.question as Question);
    const startEdge = edges.find((e) => e.source === START_ID);
    const startId = startEdge?.target || "";
    const flowEdges: FlowEdge[] = [];
    for (const e of edges) {
      if (e.source === START_ID) continue;
      const sourceQ = questionNodes.find((n) => n.id === e.source);
      if (!sourceQ) continue;
      const target = e.target === END_ID ? END : e.target;
      if (isNps(sourceQ)) {
        const group = NPS_GROUPS.find((g) => g.label === e.sourceHandle);
        if (!group) continue;
        for (let v = group.min; v <= group.max; v++) {
          flowEdges.push({ sourceId: e.source, optionText: String(v), targetId: target });
        }
        continue;
      }
      if (e.sourceHandle === "next") {
        flowEdges.push({ sourceId: e.source, targetId: target });
      } else if (e.sourceHandle) {
        const opt = sourceQ.options?.find((o) => o.id === e.sourceHandle);
        if (!opt) continue;
        flowEdges.push({ sourceId: e.source, optionText: opt.text, targetId: target });
      }
    }
    return serializeFlow({ startId, questionNodes, edges: flowEdges, endMessage: thankYouMessage.trim() });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("O título da campanha é obrigatório.");

    const questionCount = nodes.filter((n) => n.data.kind === "question").length;
    if (questionCount === 0) return toast.warning("Adicione pelo menos uma pergunta.");

    const hasStartEdge = edges.some((e) => e.source === START_ID);
    if (!hasStartEdge) return toast.warning("Conecte o Node Início à primeira pergunta.");

    const { questions, thank_you_message } = buildPayload();
    const validation = validateFlow(questions);

    if (validation.cycles.length > 0) {
      toast.error("Não é possível salvar: " + validation.cycles[0]);
      return;
    }
    if (validation.errors.length > 0) {
      toast.error("Não é possível salvar: " + validation.errors[0]);
      return;
    }
    if (validation.unreachable.length > 0) {
      toast.warning(validation.unreachable[0] + " (será salvo mesmo assim)");
    }

    setSaving(true);
    try {
      const payload = {
        name: title,
        description,
        report_email: reportEmail,
        report_time: reportTime,
        privacy_text: privacyText,
        type: "Externa",
        questions,
        thank_you_message,
        flow_layout: {
          nodes: Object.fromEntries(nodes.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }])),
        },
      };
      if (isEdit) {
        await api.patch(`/campaigns/${id}`, payload);
      } else {
        await api.post("/campaigns", payload);
      }
      toast.success(isEdit ? "Campanha atualizada!" : "Campanha criada com sucesso!");
      setTimeout(() => navigate("/campanhas"), 500);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar campanha.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b82ff]"></div>
      </div>
    );
  }

  const selectedKind = selectedNode?.data.kind;

  return (
    <>
      <Breadcrumbs />
      <div className="flex h-[calc(100vh-56px)]">
        {/* Canvas */}
        <div className="flex-1 relative">
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 max-w-[70%]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da campanha *"
              className={`border rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-400 w-96 ${isDarkMode ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
            />
            <button
              onClick={addQuestion}
              className="bg-[#f39c13] text-white px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider shadow cursor-pointer hover:bg-orange-500"
            >
              + Adicionar Pergunta
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider shadow cursor-pointer hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar Campanha"}
            </button>
            <button
              onClick={() => navigate("/campanhas")}
              className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider shadow cursor-pointer ${isDarkMode ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"}`}
            >
              Voltar
            </button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            colorMode={isDarkMode ? "dark" : "light"}
            fitView
            minZoom={0.25}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            <Controls />
          </ReactFlow>
          <div className={`absolute top-3 right-3 z-[9999] pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? "bg-zinc-800/80 text-amber-400 border-white/10" : "bg-white/80 text-amber-600 border-zinc-200"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Beta
          </div>
        </div>

        {/* Panel */}
        <div className={`w-[340px] border-l overflow-y-auto p-4 space-y-4 ${isDarkMode ? "border-white/10 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
          {!selectedNode ? (
            <div className={`text-sm ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
              <p className={`font-bold mb-2 ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>Fluxo da Campanha</p>
              <p>Clique em um node para editar. Conecte cada opção de resposta a uma próxima pergunta ou à tela final.</p>
              <p className={`mt-2 text-xs ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>• Node verde = Início<br />• Node escuro = Finalizar<br />• Conecte arrastando da bolinha colorida da opção</p>
            </div>
          ) : selectedKind === "start" ? (
            <div className="space-y-3">
              <p className={`font-bold text-sm ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>Node Início</p>
              <label className={`block text-xs font-semibold ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>Primeira pergunta</label>
              <select
                value={edges.find((e) => e.source === START_ID)?.target || ""}
                onChange={(e) => upsertEdge(START_ID, "out", e.target.value)}
                className={`w-full border rounded-md px-3 py-2 text-sm ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
              >
                <option value="">Selecione...</option>
                {questionTargets.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          ) : selectedKind === "end" ? (
            <div className="space-y-3">
              <p className={`font-bold text-sm ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>Node Finalizar</p>
              <label className={`block text-xs font-semibold ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>Mensagem de agradecimento</label>
              <textarea
                value={thankYouMessage}
                onChange={(e) => {
                  setThankYouMessage(e.target.value);
                  updateNodeData(END_ID, { endMessage: e.target.value });
                }}
                placeholder="Obrigado pela sua resposta!"
                className={`w-full border rounded-md px-3 py-2 text-sm min-h-[80px] ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
              />
            </div>
          ) : selectedKind === "question" && selectedNode.data.question ? (
            <QuestionPanel
              nodeId={selectedNode.id}
              question={selectedNode.data.question}
              questionTargets={questionTargets}
              rules={selectedNode.data.rules || {}}
              defaultNext={selectedNode.data.defaultNext}
              edges={edges}
              onPatch={patchQuestion}
              onTypeChange={changeType}
              onAddOption={addOption}
              onRenameOption={renameOption}
              onRemoveOption={removeOption}
              onChangeOptionColor={changeOptionColor}
              onWire={upsertEdge}
              onRemove={removeQuestion}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

interface QuestionPanelProps {
  nodeId: string;
  question: Question;
  questionTargets: { id: string; label: string }[];
  rules: Record<string, string>;
  defaultNext?: string;
  edges: Edge[];
  onPatch: (nodeId: string, patch: Partial<Question>) => void;
  onTypeChange: (nodeId: string, type: string) => void;
  onAddOption: (nodeId: string) => void;
  onRenameOption: (nodeId: string, optionId: string, text: string, oldText: string) => void;
  onRemoveOption: (nodeId: string, optionId: string) => void;
  onChangeOptionColor: (nodeId: string, optionId: string, color: string) => void;
  onWire: (source: string, sourceHandle: string, target: string) => void;
  onRemove: (nodeId: string) => void;
}

function QuestionPanel({
  nodeId,
  question,
  questionTargets,
  rules,
  defaultNext,
  edges,
  onPatch,
  onTypeChange,
  onAddOption,
  onRenameOption,
  onRemoveOption,
  onChangeOptionColor,
  onWire,
  onRemove,
}: QuestionPanelProps) {
  const locked = isLockedType(question.type);
  const showOptions = hasOptions(question);
  const perOption = branchesPerOption(question);
  const showColor = !locked && ["Escolha Única", "Múltipla Escolha"].includes(question.type);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const inputCls = `border rounded px-2 py-1 text-sm min-w-0 ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`;
  const labelCls = `block text-xs font-semibold mb-1 ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={`font-bold text-sm ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>Pergunta</p>
        <button
          onClick={() => onRemove(nodeId)}
          className={`text-[10px] font-bold uppercase border rounded-md px-2 py-1 cursor-pointer ${isDarkMode ? "text-red-400 border-red-500/30 hover:bg-red-500/10" : "text-red-600 border-red-200 hover:bg-red-50"}`}
        >
          Remover
        </button>
      </div>

      <div>
        <label className={labelCls}>Texto da pergunta</label>
        <textarea
          value={question.text}
          onChange={(e) => onPatch(nodeId, { text: e.target.value })}
          className={`w-full border rounded-md px-3 py-2 text-sm min-h-[60px] ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
        />
      </div>

      <div>
        <label className={labelCls}>Tipo</label>
        <select
          value={question.type}
          onChange={(e) => onTypeChange(nodeId, e.target.value)}
          className={`w-full border rounded-md px-3 py-2 text-sm ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <label className={`flex items-center gap-1.5 text-xs ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
          <input
            type="checkbox"
            checked={!!question.required}
            onChange={(e) => onPatch(nodeId, { required: e.target.checked })}
          />
          Obrigatória
        </label>
        <label className={`flex items-center gap-1.5 text-xs ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
          <input
            type="checkbox"
            checked={!!question.allowComment}
            onChange={(e) => onPatch(nodeId, { allowComment: e.target.checked })}
          />
          Permitir comentário
        </label>
      </div>

      {isNps(question) ? (
        <div className="space-y-3">
          <p className={`text-xs font-semibold ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>Rotas de saída</p>
          {NPS_GROUPS.map((g) => {
            const mapped = rules[g.label];
            const targetId = mapped === END ? END_ID : mapped;
            return (
              <div key={g.label} className={`border rounded-md p-2 flex items-center gap-2 ${isDarkMode ? "border-white/10" : "border-zinc-100"}`}>
                <span className="flex items-center gap-1.5 min-w-0">
                  {g.icon}
                  <span className={`text-sm font-bold truncate min-w-0 ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>{g.label}</span>
                </span>
                <span className="text-[10px] text-zinc-400 whitespace-nowrap">ir para:</span>
                <select
                  value={targetId || ""}
                  onChange={(e) => onWire(nodeId, g.label, e.target.value)}
                  className={`flex-1 min-w-0 border rounded px-2 py-1 text-sm ${isDarkMode ? "bg-zinc-800 text-white" : "bg-white"} ${targetId ? "border-emerald-200" : "border-red-300"}`}
                >
                  <option value="">Selecione...</option>
                  <option value={END_ID}>Finalizar pesquisa</option>
                  {questionTargets
                    .filter((t) => t.id !== nodeId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      ) : showOptions ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className={`text-xs font-semibold ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>Opções</p>
            {!locked && (
              <button
                onClick={() => onAddOption(nodeId)}
                className={`text-[10px] font-bold uppercase border rounded-md px-2 py-1 cursor-pointer ${isDarkMode ? "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" : "text-blue-600 border-blue-200 hover:bg-blue-50"}`}
              >
                + Opção
              </button>
            )}
          </div>
          {question.options?.map((opt, i) => {
            const mapped = rules[opt.id];
            const targetId = mapped === END ? END_ID : mapped;
            return (
              <div key={opt.id} className={`border rounded-md p-2 space-y-2 ${isDarkMode ? "border-white/10" : "border-zinc-100"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">{i + 1}.</span>
                  {locked ? (
                    <span className={`flex-1 text-sm truncate min-w-0 ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>{opt.text || "(vazio)"}</span>
                  ) : (
                    <input
                      value={opt.text}
                      onChange={(e) => onRenameOption(nodeId, opt.id, e.target.value, opt.text)}
                      placeholder="Texto da opção"
                      className={inputCls}
                    />
                  )}
                  {showColor && (
                    <span className={`relative w-6 h-6 rounded-md overflow-hidden border shrink-0 ${isDarkMode ? "border-white/10" : "border-zinc-200"}`} title="Cor da opção">
                      <input
                        type="color"
                        value={opt.color || "#3b82f6"}
                        onChange={(e) => onChangeOptionColor(nodeId, opt.id, e.target.value)}
                        className="absolute -inset-1 w-10 h-10 border-none bg-none cursor-pointer"
                      />
                    </span>
                  )}
                  {!locked && (
                    <button
                      onClick={() => onRemoveOption(nodeId, opt.id)}
                      className="text-zinc-400 hover:text-red-500 text-sm cursor-pointer"
                      title="Remover opção"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {perOption && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">ir para:</span>
                    <select
                      value={targetId || ""}
                      onChange={(e) => onWire(nodeId, opt.id, e.target.value)}
                      className={`flex-1 min-w-0 border rounded px-2 py-1 text-sm ${isDarkMode ? "bg-zinc-800 text-white" : "bg-white"} ${targetId ? "border-emerald-200" : "border-red-300"}`}
                    >
                      <option value="">Selecione...</option>
                      <option value={END_ID}>Finalizar pesquisa</option>
                      {questionTargets
                        .filter((t) => t.id !== nodeId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          {!perOption && (
            <div>
              <label className={labelCls}>Próxima pergunta (após a resposta)</label>
              <select
                value={defaultNext && defaultNext !== END ? defaultNext : defaultNext === END ? END_ID : ""}
                onChange={(e) => onWire(nodeId, "next", e.target.value)}
                className={`w-full border rounded-md px-3 py-2 text-sm ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
              >
                <option value="">Selecione...</option>
                <option value={END_ID}>Finalizar pesquisa</option>
                {questionTargets
                  .filter((t) => t.id !== nodeId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls}>Próxima pergunta (após a resposta)</label>
          <select
            value={defaultNext && defaultNext !== END ? defaultNext : defaultNext === END ? END_ID : ""}
            onChange={(e) => onWire(nodeId, "next", e.target.value)}
            className={`w-full border rounded-md px-3 py-2 text-sm ${isDarkMode ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-800"}`}
          >
            <option value="">Selecione...</option>
            <option value={END_ID}>Finalizar pesquisa</option>
            {questionTargets
              .filter((t) => t.id !== nodeId)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
          </select>
        </div>
      )}

      <div className={`pt-1 text-[10px] ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
        Conexões ativas: {edges.filter((e) => e.source === nodeId).length}
      </div>
    </div>
  );
}

export default function AdvancedCampaign() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
