import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Smile, 
  Meh, 
  Frown, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Monitor, 
  Tag,
  ArrowRight,
  Download,
  X,
  MessageSquare,
  CheckCircle2,
  Clock,
  Laugh,
  Angry,
  ChevronDown
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface ResponseAnswer {
  question: string;
  type?: string;
  answer: any;
  comment?: string;
}

interface RawResponse {
  id: string;
  created_at: string;
  campaign_id: string;
  terminal_id: string;
  user_id: string;
  answers: ResponseAnswer[];
  campaign: { 
    name: string;
    questions: { text: string; type: string }[];
    status: string;
  };
  terminal: { name: string } | null;
  user: { empresa: string } | null;
}

export default function Feedbacks() {
  const { user, isAdmin, isMasterAdmin, isTerminal } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [feedbacks, setFeedbacks] = useState<RawResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<RawResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    
    const fetchFeedbacks = async () => {
      setLoading(true);
      try {
         // Define query params
        let query = '';
        if (isTerminal && user.terminal_id) {
          query = `?terminal_id=${user.terminal_id}`;
        }
        
        const data = await api.get(`/responses${query}`);
        // Filter valid ones
        const validFeedbacks = (data || []).filter((f: any) => f.campaign && f.campaign.status === 'Ativo') as RawResponse[];
        setFeedbacks(validFeedbacks);
      } catch (err) {
        console.error('Error fetching feedbacks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbacks();

    // Auto-refresh when user returns to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchFeedbacks();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const ratingConfig: Record<string, any> = {
    'EXCELENTE': { color: '#22c55d', icon: Laugh, label: 'Excelente' },
    'MUITO SATISFEITO': { color: '#22c55d', icon: Laugh, label: 'Muito Satisfeito' },
    'BOM': { color: '#84cc15', icon: Smile, label: 'Bom' },
    'SATISFEITO': { color: '#84cc15', icon: Smile, label: 'Satisfeito' },
    'REGULAR': { color: '#e9b306', icon: Meh, label: 'Regular' },
    'RUIM': { color: '#f97316', icon: Frown, label: 'Ruim' },
    'INSATISFEITO': { color: '#f97316', icon: Frown, label: 'Insatisfeito' },
    'PÉSSIMO': { color: '#ef4444', icon: Angry, label: 'Péssimo' },
    'MUITO INSATISFEITO': { color: '#ef4444', icon: Angry, label: 'Muito Insatisfeito' }
  };

  const getSentimentInfo = (answers: ResponseAnswer[]) => {
    // Find the primary sentiment answer (usually the last one or dedicated question)
    const lastAnswerRaw = answers[answers.length - 1]?.answer;
    const lastAnswer = typeof lastAnswerRaw === 'string' ? lastAnswerRaw.toUpperCase() : lastAnswerRaw;
    
    // If it's NPS (number), handle it
    if (typeof lastAnswer === 'number') {
      let color = '#ef4444';
      let label = 'Detrator';
      let icon = Frown;
      if (lastAnswer >= 7 && lastAnswer <= 8) {
        color = '#e9b306';
        label = 'Neutro';
        icon = Meh;
      } else if (lastAnswer >= 9) {
        color = '#22c55d';
        label = 'Promotor';
        icon = Laugh;
      }
      return { color, label, icon: icon as any };
    }

    const config = ratingConfig[lastAnswer as string] || { color: '#64748b', icon: MessageSquare, label: 'Feedback' };
    return config;
  };

  const ratingLabels = [
    'EXCELENTE', 'MUITO SATISFEITO', 'BOM', 'SATISFEITO', 'REGULAR', 
    'RUIM', 'INSATISFEITO', 'PÉSSIMO', 'MUITO INSATISFEITO'
  ];

  const hasTextualContent = (fb: RawResponse) => {
    const questions = fb.campaign?.questions || [];
    
    return fb.answers.some(a => {
      // 1. Check for explicit comment field
      if (a.comment && a.comment.trim().length > 0) return true;
      
      // 2. Check if it's an "Open Text" question type
      const q = questions.find(q => q.text === a.question);
      const type = a.type || (q ? q.type : undefined);
      if (type === 'Texto Aberto' && typeof a.answer === 'string' && a.answer.trim().length > 0) {
        return true;
      }
      
      return false;
    });
  };

  const filteredFeedbacks = (feedbacks || [])
    .filter(fb => hasTextualContent(fb))
    .filter(fb => 
      fb.campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fb.terminal?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      fb.answers.some(a => 
        (a.comment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof a.answer === 'string' && a.answer.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );


  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Header */}
          <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Feedbacks</h2>
              <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Histórico de participação nas pesquisas</p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className={`mt-6 p-4 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col md:flex-row gap-4 items-center transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por campanha, terminal ou comentário..." 
                className={`w-full rounded-md py-2.5 pl-10 pr-4 text-sm outline-none transition-colors ${
                  isDarkMode 
                    ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                    : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Feedbacks List */}
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className={`p-12 rounded-md border flex flex-col items-center justify-center space-y-4 transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
              }`}>
                <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${isDarkMode ? 'border-zinc-800 border-t-blue-500' : 'border-blue-500'}`}></div>
                <p className={`font-bold uppercase tracking-widest text-xs ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Carregando Feedbacks...</p>
              </div>
            ) : filteredFeedbacks.length === 0 ? (
              <div className={`p-12 rounded-md border flex flex-col items-center justify-center text-center space-y-4 transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-600' : 'bg-white border-slate-100 text-slate-400'
              }`}>
                <MessageSquare size={48} strokeWidth={1} />
                <p className="font-bold uppercase tracking-widest text-xs">Nenhum feedback encontrado</p>
              </div>
            ) : (
              filteredFeedbacks.map((fb, idx) => {
                const sentiment = getSentimentInfo(fb.answers);
                const firstComment = fb.answers.find(a => a.comment)?.comment;

                return (
                  <motion.div
                    key={fb.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden border group transition-all ${
                      isDarkMode ? 'bg-zinc-900 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 hover:border-[#0b82ff]'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row items-stretch">
                      <div 
                        className="w-full lg:w-2 shrink-0" 
                        style={{ backgroundColor: sentiment.color }} 
                      />
                      
                      <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded truncate max-w-[80px] transition-colors ${
                              isDarkMode ? 'bg-black text-zinc-600' : 'bg-slate-100 text-slate-500'
                            }`}>#{fb.id.split('-')[0]}</span>
                            <h4 className={`text-sm font-bold truncate transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {fb.user?.empresa || 'Anônimo'}
                            </h4>
                          </div>
                          <div className="flex flex-col gap-0.5 ml-0.5">
                            <div className={`flex items-center gap-1.5 text-[11px] transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                              <Calendar size={12} className={isDarkMode ? 'text-zinc-700' : 'text-slate-400'} />
                              <span>{new Date(fb.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>

                        <div className={`space-y-2 lg:border-l lg:pl-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <div className="flex items-center gap-2">
                            <Tag size={14} className={isDarkMode ? 'text-zinc-700' : 'text-slate-400'} />
                            <span className={`text-[11px] font-bold truncate transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-600'}`}>{fb.campaign.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Monitor size={14} className={isDarkMode ? 'text-zinc-700' : 'text-slate-400'} />
                            <span className={`text-[11px] font-medium truncate transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>{fb.terminal?.name || 'Portal Web'}</span>
                          </div>
                        </div>

                        <div className={`lg:border-l lg:pl-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center gap-2">
                              {sentiment.icon && <sentiment.icon size={20} fill={sentiment.color} stroke={isDarkMode ? "#18181b" : "white"} />}
                              <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: sentiment.color }}>
                                {sentiment.label}
                              </span>
                            </div>
                            {firstComment && (
                              <p className={`text-[11px] line-clamp-2 italic leading-relaxed transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                                "{firstComment}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className={`lg:border-l lg:pl-6 flex items-center justify-end transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedFeedback(fb)}
                            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                              isDarkMode 
                                ? 'text-blue-400 border-blue-500/20 hover:bg-blue-600 hover:text-white hover:border-blue-600' 
                                : 'text-[#0b82ff] border-[#0b82ff] group-hover:bg-[#0b82ff] group-hover:text-white'
                            }`}
                          >
                            Ver Detalhes
                            <ArrowRight size={12} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeedback(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-6 flex justify-between items-center shrink-0 transition-colors ${
                isDarkMode ? 'bg-black/40 text-blue-500' : 'bg-[#0b82ff] text-white'
              }`}>
                <div className="space-y-1">
                  <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-white'}`}>Detalhes do Feedback</h3>
                  <div className={`flex items-center gap-3 text-[11px] font-bold opacity-80 uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-white'}`}>
                    <span>#{selectedFeedback.id.split('-')[0]}</span>
                    <span>•</span>
                    <span>{new Date(selectedFeedback.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFeedback(null)}
                  className={`p-2 rounded-full transition-colors ${
                    isDarkMode ? 'text-zinc-400 hover:bg-white/5' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                <div className={`grid grid-cols-2 gap-6 p-4 rounded-xl border transition-colors ${
                  isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="space-y-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Campanha</span>
                    <p className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{selectedFeedback.campaign.name}</p>
                  </div>
                  <div className="space-y-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Terminal</span>
                    <p className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{selectedFeedback.terminal?.name || 'Portal Web'}</p>
                  </div>
                </div>

                {/* Answers List */}
                <div className="space-y-6">
                  <h4 className={`text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-colors ${
                    isDarkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    <CheckCircle2 size={14} className="text-blue-500" />
                    Feedback Textual
                  </h4>
                  
                  <div className="space-y-8">
                    {selectedFeedback.answers
                      .filter(ans => {
                        if (ans.comment && ans.comment.trim()) return true;
                        const q = selectedFeedback.campaign?.questions.find(q => q.text === ans.question);
                        const type = ans.type || (q ? q.type : undefined);
                        return type === 'Texto Aberto' && typeof ans.answer === 'string' && ans.answer.trim().length > 0;
                      })
                      .map((ans, idx) => {
                        const q = selectedFeedback.campaign?.questions.find(q => q.text === ans.question);
                        const type = ans.type || (q ? q.type : undefined);
                        return (
                        <div key={idx} className={`space-y-3 relative pl-6 border-l-2 transition-colors ${isDarkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-blue-500" />
                          <div className="space-y-1">
                            <p className={`text-sm font-bold leading-tight transition-colors ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'}`}>
                              {ans.question}
                            </p>
                            {/* If it was a 'Texto Aberto', the answer IS the text. If it was a choice with comment, answer is the choice. */}
                            {typeof ans.answer === 'string' && type === 'Texto Aberto' ? (
                              <div className={`p-4 rounded-xl border mt-2 transition-colors ${
                                isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-50 border-slate-100'
                              }`}>
                                <p className={`text-sm leading-relaxed italic transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>"{ans.answer}"</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-sm font-black px-2 py-0.5 rounded uppercase transition-colors ${
                                  isDarkMode ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50'
                                }`}>
                                  {ans.answer}
                                </span>
                              </div>
                            )}
                          </div>

                          {ans.comment && (
                            <div className={`p-4 rounded-xl border flex gap-3 transition-colors ${
                              isDarkMode ? 'bg-black/30 border-white/5' : 'bg-amber-50 border-amber-100'
                            }`}>
                              <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-amber-600'}`}>Comentário Adicional</span>
                                <p className={`text-sm leading-relaxed italic transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-amber-900'}`}>
                                  "{ans.comment}"
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )})}
                    
                    {/* Background context (quantitative) */}
                    <div className={`pt-4 border-t transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                       <details className="group">
                          <summary className={`text-[10px] font-black uppercase tracking-widest cursor-pointer list-none flex items-center justify-between transition-colors ${
                            isDarkMode ? 'text-zinc-600 hover:text-zinc-400' : 'text-slate-400 hover:text-slate-600'
                          }`}>
                            Ver todas as marcações quantitativas
                            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                            {selectedFeedback.answers
                              .filter(ans => {
                                const qInfo = selectedFeedback.campaign?.questions.find(q => q.text === ans.question);
                                const isTextual = (ans.comment && ans.comment.trim()) || (qInfo?.type === 'Texto Aberto');
                                return !isTextual;
                              })
                              .map((ans, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border transition-colors ${
                                  isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'
                                }`}>
                                  <p className={`text-[10px] font-bold truncate mb-1 ${isDarkMode ? 'text-zinc-700' : 'text-slate-500'}`}>{ans.question}</p>
                                  <p className={`text-[11px] font-black uppercase ${isDarkMode ? 'text-zinc-500' : 'text-slate-800'}`}>{String(ans.answer)}</p>
                                </div>
                              ))}
                          </div>
                       </details>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={`p-6 border-t flex justify-end shrink-0 transition-colors ${
                isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <button 
                  onClick={() => setSelectedFeedback(null)}
                  className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    isDarkMode 
                      ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/5' 
                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

