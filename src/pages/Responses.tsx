import { useState, useEffect } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, ChevronUp, UserCircle2, MessageSquareText, Calendar, Star, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { MenuCards } from '../components/MenuCards';

interface CollabData {
  name: string;
  image?: string;
  count: number;
  responses: any[];
  totalScore: number;
  scoreCount: number;
  averageScore?: number;
  lowestScore?: { score: number, question: string, answer: string, comment?: string };
}

const getScoreFromAnswer = (ans: any) => {
  if (typeof ans === 'number') {
    if (ans <= 10) return ans * 10;
    return ans;
  }
  if (!ans) return null;
  const txt = String(ans).toUpperCase().trim();
  if (txt === 'MUITO SATISFEITO') return 100;
  if (txt === 'SATISFEITO') return 80;
  if (txt === 'NEUTRO' || txt === 'INDECISO' || txt === 'RAZOÁVEL') return 60;
  if (txt === 'INSATISFEITO' || txt === 'RUIM') return 40;
  if (txt === 'MUITO INSATISFEITO' || txt === 'PÉSSIMO') return 20;
  if (txt.includes('BOM') || txt === 'ÓTIMO') return 80;
  if (!isNaN(Number(txt))) {
    const num = Number(txt);
    if (num <= 10) return num * 10;
    return num;
  }
  return null;
}

export default function Responses() {
  const { user, isMasterAdmin, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [collabs, setCollabs] = useState<CollabData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch active campaigns
        const campaigns = await api.get('/campaigns');
        const activeCampaigns = (campaigns || []).filter((c: any) => c.status === 'Ativo');

        if (!activeCampaigns || activeCampaigns.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Extract unique collaborators from campaigns
        const collabMap = new Map<string, CollabData>();
        activeCampaigns.forEach((camp: any) => {
          const qList = camp.questions || [];
          qList.filter((q: any) => q.type === 'Colaborador').forEach((q: any) => {
            (q.options || []).forEach((opt: any) => {
              const cName = opt.text;
              if (!collabMap.has(cName)) {
                collabMap.set(cName, { name: cName, image: opt.image, count: 0, responses: [], totalScore: 0, scoreCount: 0 });
              } else if (opt.image) {
                collabMap.get(cName)!.image = opt.image;
              }
            });
          });
        });

        // 3. Fetch responses
        const responses = await api.get('/responses');

        if (responses) {
          responses.forEach((r: any) => {
            let parsedAnswers = r.answers;
            if (typeof parsedAnswers === 'string') {
              try { parsedAnswers = JSON.parse(parsedAnswers); } catch(e) {}
            }
            if (Array.isArray(parsedAnswers)) {
              const colabAns = parsedAnswers.find(a => a.type === 'Colaborador' || (a.question && a.question.toLowerCase().includes('colaborador')));
              if (colabAns && colabAns.answer) {
                const targetCollab = colabAns.answer;
                const cData = collabMap.get(targetCollab) || { name: targetCollab, count: 0, responses: [], totalScore: 0, scoreCount: 0 } as CollabData;
                
                cData.count++;
                cData.responses.push({ ...r, answers: parsedAnswers });
                
                parsedAnswers.forEach((ans: any) => {
                  if (ans.type !== 'Colaborador' && !ans.question.toLowerCase().includes('colaborador')) {
                    const score = getScoreFromAnswer(ans.answer);
                    if (score !== null) {
                      cData.totalScore += score;
                      cData.scoreCount += 1;
                      
                      if (!cData.lowestScore || score < cData.lowestScore.score) {
                         cData.lowestScore = { score, question: ans.question, answer: ans.answer, comment: ans.comment };
                      }
                    }
                  }
                });

                if (!collabMap.has(targetCollab)) {
                  collabMap.set(targetCollab, cData);
                }
              }
            }
          });
        }

        const sorted = Array.from(collabMap.values()).map(c => ({
          ...c, 
          averageScore: c.scoreCount > 0 ? (c.totalScore / c.scoreCount) : 0 
        })).sort((a, b) => {
          if (b.averageScore !== a.averageScore) {
             return (b.averageScore || 0) - (a.averageScore || 0);
          }
          return b.count - a.count;
        });
        
        setCollabs(sorted);
      } catch (err) {
        console.error('Error fetching collaborators data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh when user returns to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const filteredCollabs = collabs.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const formatDate = (ds: string) => {
    const d = new Date(ds);
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }).format(d);
  };

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Header */}
          <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Desempenho da Equipe</h2>
              <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Acompanhamento e evolução dos colaboradores nas campanhas</p>
            </div>
          </div>

          <div className={`mt-6 p-4 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col md:flex-row gap-4 items-center transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por colaborador..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-md text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${
                  isDarkMode 
                    ? 'bg-black border border-white/5 text-white focus:ring-1 focus:ring-white/10' 
                    : 'bg-slate-50 border-none text-slate-700 focus:ring-1 focus:ring-slate-200'
                }`}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className={`w-10 h-10 border-4 rounded-full animate-spin ${isDarkMode ? 'border-zinc-800 border-t-blue-500' : 'border-blue-200 border-t-blue-500'}`}></div>
              <p className={`font-medium mt-4 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Carregando dados dos colaboradores...</p>
            </div>
          ) : filteredCollabs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center items-center py-20 px-4"
            >
              <div className="text-center max-w-sm">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border transition-colors ${
                  isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-slate-100'
                }`}>
                  <UserCircle2 size={32} className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'} />
                </div>
                <h3 className={`text-lg font-bold tracking-tight mb-2 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Nenhum Colaborador Encontrado</h3>
                <p className={`text-sm leading-relaxed transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Não encontramos avaliações direcionadas a colaboradores. Certifique-se de que a campanha possui uma pergunta do tipo &quot;Colaborador&quot;.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="mt-8 space-y-4">
              {filteredCollabs.map((collab, index) => {
                const isExpanded = expandedId === collab.name;
                return (
                  <motion.div 
                    key={collab.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-xl shadow-sm border transition-all duration-300 overflow-hidden ${
                      isExpanded 
                        ? (isDarkMode ? 'bg-zinc-900 border-blue-900/50 ring-1 ring-blue-900/20' : 'bg-white border-blue-200 shadow-md ring-1 ring-blue-50') 
                        : (isDarkMode ? 'bg-zinc-900 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 hover:border-slate-200')
                    }`}
                  >
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : collab.name)}
                      className="p-5 flex items-center justify-between cursor-pointer group select-none"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full border shadow-sm flex items-center justify-center overflow-hidden shrink-0 transition-colors ${
                          isDarkMode ? 'bg-black border-white/5' : 'bg-slate-100 border-slate-200'
                        }`}>
                          {collab.image ? (
                            <img src={collab.image} alt={collab.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserCircle2 size={24} className={isDarkMode ? 'text-zinc-800' : 'text-slate-300'} />
                          )}
                        </div>
                        <div>
                          <h3 className={`text-[15px] font-black tracking-tight uppercase flex items-center gap-2 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {index === 0 && collab.count > 0 && <Trophy size={16} className="text-yellow-500" />}
                            <span>{collab.name}</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ml-2 transition-colors ${
                              isDarkMode ? 'text-zinc-500 bg-black' : 'text-slate-400 bg-slate-100'
                            }`}>
                              #{index + 1}
                            </span>
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest transition-colors ${
                              isDarkMode ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-blue-600 bg-blue-50 border-blue-100'
                            }`}>
                              <MessageSquareText size={10} className="mr-1 inline" />
                              {collab.count} avaliaç{collab.count === 1 ? 'ão' : 'ões'}
                            </span>
                            
                            {collab.averageScore !== undefined && collab.averageScore > 0 && (
                              <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest transition-colors ${
                                collab.averageScore >= 80 
                                  ? (isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-green-600 bg-green-50 border-green-100') :
                                collab.averageScore >= 60 
                                  ? (isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-yellow-600 bg-yellow-50 border-yellow-100') :
                                (isDarkMode ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-red-600 bg-red-50 border-red-100')
                              }`}>
                                <Star size={10} className="mr-1 inline" />
                                {collab.averageScore.toFixed(1)}% Satisfação
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {collab.lowestScore && collab.averageScore !== undefined && collab.averageScore < 80 && (
                          <div className="hidden lg:flex flex-col items-end mr-4 text-right">
                            <span className={`text-[10px] font-bold uppercase tracking-widest gap-1 flex items-center ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Ponto de Atenção</span>
                            <span className="text-xs font-semibold text-red-500 truncate max-w-[200px]" title={collab.lowestScore.question}>
                              {collab.lowestScore.question}
                            </span>
                          </div>
                        )}
                        <div className={`flex items-center transition-colors ${isDarkMode ? 'text-zinc-600 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-500'}`}>
                          <span className="text-xs font-black uppercase tracking-widest mr-3 hidden sm:block">
                            {isExpanded ? 'Ocultar' : 'Detalhes'}
                          </span>
                          <div className={`p-2 rounded-full transition-colors ${
                            isExpanded 
                              ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-500') 
                              : (isDarkMode ? 'bg-black' : 'bg-slate-50')
                          }`}>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                          className={`transition-colors border-t ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}
                        >
                          <div className="p-6">
                            {collab.responses.length === 0 ? (
                              <div className="text-center py-8">
                                <MessageSquareText size={32} className={`mx-auto mb-3 ${isDarkMode ? 'text-zinc-800' : 'text-slate-300'}`} />
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Ainda não há avaliações para este colaborador.</p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {collab.responses.map((resp: any, i: number) => {
                                  const renderAnswers = resp.answers.filter((a: any) => a.type !== 'Colaborador' && !a.question.toLowerCase().includes('colaborador'));
                                  
                                  return (
                                    <div key={i} className={`rounded-lg p-5 shadow-sm border transition-colors ${
                                      isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-200'
                                    }`}>
                                      <div className={`flex justify-between items-start mb-4 pb-4 border-b transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                        <div className={`flex items-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                                          <Calendar size={14} />
                                          <span className="text-xs font-bold uppercase tracking-widest">
                                            {formatDate(resp.created_at)}
                                          </span>
                                        </div>
                                        <div className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider transition-colors ${
                                          isDarkMode ? 'text-zinc-600 bg-black' : 'text-slate-400 bg-slate-50'
                                        }`}>
                                          {resp.campaign?.name || 'Campanha Desconhecida'}
                                        </div>
                                      </div>

                                      <div className="space-y-6">
                                        {renderAnswers.length === 0 && (
                                          <p className={`text-xs italic ${isDarkMode ? 'text-zinc-700' : 'text-slate-500'}`}>Nenhuma resposta adicional registrada.</p>
                                        )}
                                        {renderAnswers.map((ans: any, j: number) => (
                                          <div key={j} className="space-y-2">
                                            <p className={`text-sm font-bold tracking-tight transition-colors ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>{ans.question}</p>
                                            <div className="flex items-center gap-3">
                                              <span className={`px-3 py-1.5 rounded text-sm font-bold tracking-tight shadow-sm border transition-colors ${
                                                isDarkMode 
                                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                                  : 'bg-[#f0f9ff] text-[#0b82ff] border-[#e0f2fe]'
                                              }`}>
                                                {ans.answer}
                                              </span>
                                            </div>
                                            {ans.comment && (
                                              <div className={`mt-3 p-4 rounded-lg relative before:content-[''] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-[#0b82ff] before:rounded-r transition-colors ${
                                                isDarkMode ? 'bg-black/50' : 'bg-slate-50'
                                              }`}>
                                                <p className={`text-sm italic leading-relaxed select-text ml-2 transition-colors ${
                                                  isDarkMode ? 'text-zinc-500' : 'text-slate-600'
                                                }`}>"{ans.comment}"</p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
