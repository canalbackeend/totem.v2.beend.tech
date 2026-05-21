import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal as TerminalIcon, 
  Lock, 
  ChevronRight, 
  CheckCircle2, 
  Layout, 
  ArrowLeft,
  Timer,
  Laugh,
  Smile,
  Meh,
  Frown,
  Angry,
  Loader2,
  Building2,
  LogOut,
  ChevronLeft,
  UserCircle2
} from 'lucide-react';
import { toast } from 'sonner';

type SurveyStep = 'LOGIN' | 'SELECTION' | 'SURVEY' | 'THANK_YOU';

interface Terminal {
  id: string;
  name: string;
  user_id: string;
  campaigns: string;
  email: string;
  company_name?: string;
  logo_url?: string;
}

interface Question {
  text: string;
  type: 'SMILE 5' | 'SMILE 4' | 'NPS' | 'Escolha Única' | 'Múltipla Escolha' | 'Texto Aberto' | 'Colaborador';
  options?: { text: string; color?: string; image?: string }[];
  required?: boolean;
  allowComment?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  questions: Question[];
  status: string;
  responses_count?: number;
}

const isMultipleChoice = (type?: string) => {
  if (!type) return false;
  const t = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t === 'multipla escolha' || t === 'escolha multipla';
};

const isSingleChoice = (type?: string) => {
  if (!type) return false;
  const t = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t === 'escolha unica' || t === 'unica escolha';
};

const hasMultipleChoiceValue = (ans: any) => {
  if (!ans) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  if (typeof ans === 'object' && 'value' in ans) {
    return Array.isArray(ans.value) ? ans.value.length > 0 : !!ans.value;
  }
  return false;
};

export default function Survey() {
  const [step, setStep] = useState<SurveyStep>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentComment, setCurrentComment] = useState("");
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // Timer states
  const [remainingTime, setRemainingTime] = useState(60);
  const [restartCountdown, setRestartCountdown] = useState(3);
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Secret logout state
  const [tapCount, setTapCount] = useState(0);

  const handleSecretTap = () => {
    setTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 6) {
        localStorage.removeItem('terminal_session');
        setTerminal(null);
        setSelectedCampaign(null);
        setAvailableCampaigns([]);
        setStep('LOGIN');
        toast.info('Terminal deslogado com sucesso');
        return 0;
      }
      return newCount;
    });
  };

  useEffect(() => {
    if (tapCount > 0) {
      const t = setTimeout(() => setTapCount(0), 1000);
      return () => clearTimeout(t);
    }
  }, [tapCount]);

  // Stability features (Heartbeat and Visibility)
  useEffect(() => {
    // 1. Silent Refresh on Focus/Visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && terminal) {
        console.log("Kiosk is back! Refreshing data...");
        fetchCampaigns(terminal);
      }
    };

    // 2. Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(async () => {
      if (terminal && document.visibilityState === 'visible') {
        try {
          await api.get('/health');
          console.log("Heartbeat sent...");
        } catch (e) {
          console.warn("Heartbeat failed, device might be offline");
        }
      }
    }, 60000); // 1 minute

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [terminal]);

  // Initialize from persistence
  useEffect(() => {
    const savedTerminal = localStorage.getItem('terminal_session');
    if (savedTerminal) {
      const parsed = JSON.parse(savedTerminal) as Terminal;
      setTerminal(parsed);
      // Ensure we have a valid token (silent logic in api.ts handles this usually, 
      // but kiosk might need explicit attention)
      fetchCampaigns(parsed);
    }
  }, []);

  const fetchCampaigns = async (term: Terminal) => {
    setLoading(true);
    try {
      const campaignNames = term.campaigns.split(',').map(c => c.trim());
      
      const data = await api.get('/campaigns', { 
        names: campaignNames.join(','), 
        status: 'Ativo' 
      });

      setAvailableCampaigns(data || []);
      
      if (data && data.length === 1) {
        setSelectedCampaign(data[0]);
        setStep('SURVEY');
        startInactivityTimer();
      } else if (data && data.length > 1) {
        setStep('SELECTION');
      } else {
        toast.error('Nenhuma campanha ativa encontrada para este terminal.');
        setStep('LOGIN');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/terminals/login', {
        email: loginForm.email,
        password: loginForm.password
      });

      if (!data || !data.id) {
        toast.error('Credenciais inválidas');
        return;
      }

      const terminalData: Terminal = {
        id: data.id,
        name: data.name,
        user_id: data.user_id,
        campaigns: data.campaigns,
        email: data.email,
        company_name: data.company_name || 'Minha Empresa',
        logo_url: data.logo_url || null
      };

      setTerminal(terminalData);
      localStorage.setItem('terminal_session', JSON.stringify(terminalData));
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
      }
      
      // The API login returns a token
      fetchCampaigns(terminalData);
    } catch (err: any) {
      console.error(err);
      toast.error('Ocorreu um erro ao tentar logar');
    } finally {
      setLoading(false);
    }
  };

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    setRemainingTime(60);
    inactivityTimerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          resetSurvey();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetSurvey = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentComment("");
    if (availableCampaigns.length > 1) {
      setStep('SELECTION');
      setSelectedCampaign(null);
    } else {
      setStep('SURVEY');
    }
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    setRemainingTime(60);
    startInactivityTimer();
  }, [availableCampaigns.length, startInactivityTimer]);

  const handleTouch = () => {
    if (step === 'SURVEY' || step === 'SELECTION') {
      setRemainingTime(60);
    }
  };

  const selectCampaign = (camp: Campaign) => {
    setSelectedCampaign(camp);
    setStep('SURVEY');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentComment("");
    startInactivityTimer();
  };

  const handleAnswer = async (value: any) => {
    // For multiple choice, we might want to handle it differently, 
    // but the terminal interface usually expects single taps for speed.
    // If it's truly multiple choice with checkboxes, we'd need a "Confirm" button.
    // However, given the context of a feedback terminal, we'll implement it as single-tap for now
    // or handle array values if needed.
    
    // Check if it's multiple choice and if it's already an array
    const currentQuestion = selectedCampaign?.questions[currentQuestionIndex];
    if (currentQuestion && isMultipleChoice(currentQuestion.type)) {
      let currentAnswer = answers[currentQuestionIndex] || [];
      if (currentAnswer && typeof currentAnswer === 'object' && !Array.isArray(currentAnswer) && 'value' in currentAnswer) {
        currentAnswer = currentAnswer.value || [];
      }
      const index = currentAnswer.indexOf(value);
      let newAnswer;
      if (index === -1) {
        newAnswer = [...currentAnswer, value];
      } else {
        newAnswer = currentAnswer.filter((v: any) => v !== value);
      }
      
      const newAnswers = [...answers];
      newAnswers[currentQuestionIndex] = newAnswer;
      setAnswers(newAnswers);
      // We don't advance yet for Multiple Choice
      return;
    }

    if (currentQuestion?.allowComment && currentQuestion?.type !== 'Texto Aberto') {
      const newAnswers = [...answers];
      newAnswers[currentQuestionIndex] = value;
      setAnswers(newAnswers);
      // Removed return; to allow common logic specifically setCurrentComment if needed
      // Actually, handleAnswer for allowComment STAYING on same question is intended to capture value
      // but NOT increment question yet. The value is captured, comment is in state.
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = value;
    setAnswers(newAnswers);
    setCurrentComment("");

    const nextIndex = currentQuestionIndex + 1;
    if (selectedCampaign && nextIndex < selectedCampaign.questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentComment("");
      setRemainingTime(60); 
    } else {
      finishSurvey(newAnswers);
    }
  };

  const nextQuestion = () => {
    const currentQuestion = selectedCampaign?.questions[currentQuestionIndex];
    let finalAnswers = [...answers];

    if (currentQuestion?.allowComment && currentComment.trim() !== '') {
      const val = finalAnswers[currentQuestionIndex];
      finalAnswers[currentQuestionIndex] = { 
        value: val !== undefined ? val : (isMultipleChoice(currentQuestion.type) ? [] : null), 
        comment: currentComment.trim() 
      };
      setAnswers(finalAnswers);
    }

    const nextIndex = currentQuestionIndex + 1;
    if (selectedCampaign && nextIndex < selectedCampaign.questions.length) {
      setCurrentComment("");
      setCurrentQuestionIndex(nextIndex);
      setRemainingTime(60);
    } else {
      finishSurvey(finalAnswers);
    }
  };

  const finishSurvey = async (finalAnswers: any[]) => {
    setLoading(true);
    setCurrentComment("");
    
    // Retry logic for robustness in kiosk environments
    let retries = 3;
    let success = false;
    let lastError = null;

    while (retries > 0 && !success) {
      try {
        if (!selectedCampaign) return;

        const formattedAnswers = selectedCampaign.questions.map((q, idx) => {
          const ansInfo = finalAnswers[idx];
          let val = ansInfo;
          let cmt = null;
          if (ansInfo && typeof ansInfo === 'object' && !Array.isArray(ansInfo) && 'value' in ansInfo) {
            val = ansInfo.value;
            cmt = ansInfo.comment;
          }
          return {
            question: q.text,
            type: q.type,
            answer: val || null,
            ...(cmt ? { comment: cmt } : {})
          };
        });

        const { id: campId, ...updateData } = {
          id: selectedCampaign.id,
          responses_count: (selectedCampaign.responses_count || 0) + 1
        } as any;

        const lastAnswerRaw = finalAnswers[finalAnswers.length - 1]; 
        const lastAnswer = (lastAnswerRaw && typeof lastAnswerRaw === 'object' && !Array.isArray(lastAnswerRaw) && 'value' in lastAnswerRaw) 
           ? lastAnswerRaw.value 
           : lastAnswerRaw;

        if (typeof lastAnswer === 'string' || typeof lastAnswer === 'number') {
          const val = typeof lastAnswer === 'string' ? lastAnswer.toUpperCase() : lastAnswer;
          if (val === 'MUITO SATISFEITO' || val === 'EXCELENTE' || val === 'MUITO BOM' || (typeof val === 'number' && val >= 9)) {
            updateData.perception_excelente = ((selectedCampaign as any).perception_excelente || 0) + 1;
          } else if (val === 'SATISFEITO' || val === 'BOM' || (typeof val === 'number' && val >= 7 && val <= 8)) {
            updateData.perception_bom = ((selectedCampaign as any).perception_bom || 0) + 1;
          } else if (val === 'REGULAR' || (typeof val === 'number' && val >= 5 && val <= 6)) {
             updateData.perception_regular = ((selectedCampaign as any).perception_regular || 0) + 1;
          } else if (val === 'RUIM' || val === 'PÉSSIMO' || val === 'INSATISFEITO' || val === 'MUITO INSATISFEITO' || (typeof val === 'number' && val <= 4)) {
            updateData.perception_ruim = ((selectedCampaign as any).perception_ruim || 0) + 1;
          }
        }

        // Save response using internal API
        await api.post('/responses', {
          campaign_id: selectedCampaign.id,
          terminal_id: terminal?.id,
          answers: formattedAnswers
        });

        // Update campaign counts
        try {
          await api.patch(`/campaigns/${selectedCampaign.id}`, updateData);
        } catch (e) {
          console.warn('Skipped inline campaign PATCH update, backend handled it:', e);
        }
        
        success = true;
        setStep('THANK_YOU');
        startRestartCountdown();
      } catch (err: any) {
        lastError = err;
        retries--;
        if (retries > 0) {
          console.warn(`Submission failed. Retrying... (${3 - retries}/3)`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        }
      }
    }

    if (!success) {
      console.error('Final submission failure:', lastError);
      toast.error('Erro de conexão. Verifique a internet do terminal.');
    }
    
    setLoading(false);
  };

  const startRestartCountdown = () => {
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    setRestartCountdown(3);
    const interval = setInterval(() => {
      setRestartCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          resetSurvey();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.removeItem('terminal_session');
    setTerminal(null);
    setAvailableCampaigns([]);
    setSelectedCampaign(null);
    setStep('LOGIN');
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
  };

  const renderLogin = () => (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/5"
      >
        <div className="p-8 pb-0 text-center space-y-8">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex flex-col items-center">
                <span className="text-5xl font-logo text-white lowercase tracking-tighter">beend.tech</span>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-1 ml-1.5 whitespace-nowrap drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">SMART SOLUTION</span>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">Acesso do Terminal</h1>
            <p className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase mt-1 px-4">
              Utilize as credenciais fornecidas na dashboard para conectar este dispositivo
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-MAIL DO TERMINAL</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <TerminalIcon className="h-4 w-4 text-zinc-600" />
                </div>
                <input 
                  type="email" 
                  required
                  placeholder="ex: terminal-01@be.end"
                  className="block w-full pl-11 pr-4 py-3.5 bg-black border border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-white"
                  value={loginForm.email}
                  onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">SENHA DE ACESSO</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-600" />
                </div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-4 py-3.5 bg-black border border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-white"
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#0b82ff] hover:bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Conectar Terminal
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
            beend.tech feedback systems © 2024
          </p>
        </form>
      </motion.div>
    </div>
  );

  const renderSelection = () => (
    <div className="min-h-screen bg-black flex flex-col text-white" onTouchStart={handleTouch} onClick={handleTouch}>
      <header className="p-8 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Building2 className="text-blue-500 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">{terminal?.company_name}</h2>
              {!isOnline && (
                <span className="bg-red-500 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase text-white animate-pulse">
                  Offline
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Selecione uma pesquisa para iniciar</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 text-zinc-500 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 max-w-4xl mx-auto w-full pt-0 pb-48">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {availableCampaigns.map((camp, idx) => (
            <motion.button
              key={camp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => selectCampaign(camp)}
              className="bg-zinc-900 hover:bg-zinc-800 border-2 border-white/5 hover:border-blue-500/30 p-8 rounded-[2rem] text-left transition-all group relative overflow-hidden flex flex-col gap-4"
            >
              <div className="bg-black w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-500/10 transition-colors">
                <Layout className="w-6 h-6 text-zinc-500 group-hover:text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{camp.name}</h3>
                <p className="text-sm text-zinc-500 font-medium mt-1">{camp.questions.length} Perguntas • Toque para iniciar</p>
              </div>
              <div className="mt-auto flex justify-end">
                <div className="bg-black p-2 rounded-full shadow-sm group-hover:translate-x-2 transition-transform">
                  <ChevronRight className="text-zinc-600 group-hover:text-blue-500" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </main>
      
      {renderFooter()}
    </div>
  );

  const renderSurvey = () => {
    if (!selectedCampaign) return null;
    const currentQuestion = selectedCampaign.questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const progress = ((currentQuestionIndex) / selectedCampaign.questions.length) * 100;

    return (
      <div className="min-h-screen bg-black flex flex-col text-white" onTouchStart={handleTouch} onClick={handleTouch}>
        <header className="p-6 md:p-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {availableCampaigns.length > 1 && (
              <button 
                onClick={() => setStep('SELECTION')}
                className="w-12 h-12 flex items-center justify-center bg-zinc-900 rounded-2xl hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">{selectedCampaign.name}</h2>
                {!isOnline && (
                  <span className="bg-red-500 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase text-white animate-pulse">
                    Conexão Perdida
                  </span>
                )}
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">PERGUNTA {currentQuestionIndex + 1} DE {selectedCampaign.questions.length}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">EMPRESA</p>
            <p className="text-sm font-black text-white uppercase">{terminal?.company_name}</p>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center px-6 max-w-4xl mx-auto w-full pt-0 pb-48">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h1 className="text-3xl md:text-5xl font-black text-yellow-400 tracking-tighter uppercase leading-tight">
                  {currentQuestion.text}
                </h1>
                <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-xs">Toque em uma das opções abaixo</p>
              </div>

              <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-6 w-full">
                {renderQuestionOptions(currentQuestion)}
              </div>

              {(currentQuestion.allowComment && currentQuestion.type !== 'Texto Aberto') && (
                <div className="flex justify-center mt-8 w-full">
                  <div className="w-full">
                    <label className="block text-center text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Comentário Adicional (Opcional)</label>
                    <textarea 
                      value={currentComment}
                      onChange={(e) => setCurrentComment(e.target.value)}
                      onFocus={() => setRemainingTime(120)}
                      placeholder="Gostaria de deixar um comentário sobre sua resposta?"
                      className="w-full h-24 p-4 rounded-[5px] bg-zinc-900 border-2 border-white/5 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-zinc-800 resize-none transition-all text-left selection:bg-blue-500/20 text-white"
                    />
                  </div>
                </div>
              )}

              {(isMultipleChoice(currentQuestion.type) || (currentQuestion.allowComment && currentQuestion.type !== 'Texto Aberto')) && (
                <div className="flex justify-center mt-12">
                  <button 
                    onClick={nextQuestion}
                    disabled={currentQuestion.required ? (
                      isMultipleChoice(currentQuestion.type) 
                        ? !hasMultipleChoiceValue(answers[currentQuestionIndex])
                        : (answers[currentQuestionIndex] === undefined)
                    ) : false}
                    className="bg-[#0b82ff] text-white px-12 py-5 rounded-[5px] font-black text-xl uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-3"
                  >
                    {currentQuestionIndex === selectedCampaign.questions.length - 1 ? 'Finalizar' : 'Avançar'}
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 pt-4 pb-4 px-6 md:pt-6 md:pb-6 md:px-10 space-y-4 bg-black z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="relative h-3 w-full bg-zinc-900 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute inset-y-0 left-0 bg-blue-600 shadow-lg"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 bg-zinc-900 px-6 py-3 rounded-2xl border border-white/5">
              <div 
                className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-sm cursor-pointer"
                onClick={handleSecretTap}
              >
                <TerminalIcon className="text-blue-500 w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">TERMINAL ATIVO</span>
                <span className="text-sm font-black text-white uppercase">{terminal?.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${remainingTime < 15 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-zinc-900 text-zinc-500'}`}>
                  <Timer className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-[60px]">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">TIME OUT</span>
                  <span className={`text-xl font-black tabular-nums ${remainingTime < 15 ? 'text-red-500' : 'text-white'}`}>{remainingTime}s</span>
                </div>
              </div>
              
              <div className="hidden md:block h-10 w-px bg-white/10" />
              
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SISTEMA POR</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-logo text-white lowercase">beend.tech</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  };

  const renderQuestionOptions = (q: Question) => {
    if (q.type === 'SMILE 5') {
      const options = [
        { label: "Muito satisfeito", icon: Laugh, color: "#22c55d", value: 'Muito satisfeito' },
        { label: "Satisfeito", icon: Smile, color: "#84cc15", value: 'Satisfeito' },
        { label: "Regular", icon: Meh, color: "#e9b306", value: 'Regular' },
        { label: "Insatisfeito", icon: Frown, color: "#f97316", value: 'Insatisfeito' },
        { label: "Muito Insatisfeito", icon: Angry, color: "#ef4444", value: 'Muito Insatisfeito' }
      ];
      return options.map((opt, idx) => {
        const isSelected = answers[currentQuestionIndex] === opt.value;
        return (
        <motion.button
          key={idx}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAnswer(opt.value)}
          className={`flex flex-col items-center gap-2 sm:gap-4 group shrink min-w-0 flex-1 w-full ${isSelected ? 'scale-110' : ''}`}
        >
          <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[8rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] bg-zinc-900 border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-white/5 shadow-sm shadow-black/50 group-hover:shadow-xl group-hover:border-transparent'}`}>
            <opt.icon 
              className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} 
              style={{ color: opt.color }} 
              strokeWidth={1.5}
            />
          </div>
          <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors uppercase tracking-[0.2em] ${isSelected ? 'text-blue-500' : 'text-zinc-500 group-hover:text-white'}`}>{opt.label}</span>
        </motion.button>
      )});
    }

    if (q.type === 'SMILE 4') {
      const options = [
        { label: "EXCELENTE", icon: Laugh, color: "#22c55d", value: 'EXCELENTE' },
        { label: "BOM", icon: Smile, color: "#84cc15", value: 'BOM' },
        { label: "REGULAR", icon: Meh, color: "#e9b306", value: 'REGULAR' },
        { label: "RUIM", icon: Frown, color: "#ef4444", value: 'RUIM' }
      ];
      return options.map((opt, idx) => {
        const isSelected = answers[currentQuestionIndex] === opt.value;
        return (
        <motion.button
          key={idx}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAnswer(opt.value)}
          className={`flex flex-col items-center gap-2 sm:gap-4 group shrink min-w-0 flex-1 w-full ${isSelected ? 'scale-110' : ''}`}
        >
          <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[9rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] bg-zinc-900 border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-white/5 shadow-sm shadow-black/50 group-hover:shadow-xl group-hover:border-transparent'}`}>
            <opt.icon 
              className={`w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} 
              style={{ color: opt.color }} 
              strokeWidth={1.5}
            />
          </div>
          <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors uppercase tracking-[0.2em] ${isSelected ? 'text-blue-500' : 'text-zinc-500 group-hover:text-white'}`}>{opt.label}</span>
        </motion.button>
      )});
    }

    if (q.type === 'NPS') {
      return (
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex justify-center gap-1 sm:gap-2 md:gap-4 flex-nowrap overflow-x-hidden p-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              let color = '#ef4444'; 
              if (num >= 7 && num <= 8) color = '#e9b306'; 
              if (num >= 9) color = '#22c55d'; 
              const isSelected = answers[currentQuestionIndex] === num;
              
              return (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAnswer(num)}
                  className={`flex-1 max-w-[80px] aspect-square rounded-xl sm:rounded-2xl border-2 shadow-sm flex items-center justify-center text-lg sm:text-2xl md:text-3xl font-black transition-all min-w-0 shrink ${isSelected ? 'scale-110 shadow-lg ring-2 ring-offset-1' : 'border-white/5 bg-zinc-900 hover:shadow-lg hover:border-transparent'}`}
                  style={{ color, ...isSelected ? { borderColor: color, backgroundColor: 'black', '--tw-ring-color': color } as React.CSSProperties : {} }}
                >
                  {num}
                </motion.button>
              );
            })}
          </div>
          <div className="w-full flex justify-between px-2 mt-4 text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest max-w-[900px]">
            <span>Extremamente improvável</span>
            <span>Extremamente provável</span>
          </div>
        </div>
      );
    }

    if (isSingleChoice(q.type) || isMultipleChoice(q.type)) {
      let currentAnswers = answers[currentQuestionIndex] || [];
      if (currentAnswers && typeof currentAnswers === 'object' && !Array.isArray(currentAnswers) && 'value' in currentAnswers) {
        currentAnswers = currentAnswers.value || [];
      }
      
      let currentTextAnswer = answers[currentQuestionIndex];
      if (currentTextAnswer && typeof currentTextAnswer === 'object' && !Array.isArray(currentTextAnswer) && 'value' in currentTextAnswer) {
        currentTextAnswer = currentTextAnswer.value;
      }
      
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          {(q.options || []).map((opt, idx) => {
            const isSelected = isMultipleChoice(q.type) 
              ? currentAnswers.includes(opt.text)
              : currentTextAnswer === opt.text;

            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(opt.text)}
                className={`flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all text-left ${
                  isSelected 
                    ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10' 
                    : 'bg-zinc-900 border-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-black border-white/10 text-transparent'
                }`}>
                  <CheckCircle2 size={16} />
                </div>
                <span className={`text-xl font-black uppercase tracking-tight ${isSelected ? 'text-blue-500' : 'text-zinc-300'}`}>
                  {opt.text}
                </span>
              </motion.button>
            );
          })}
        </div>
      );
    }

    if (q.type === 'Colaborador') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full">
          {(q.options || []).map((opt, idx) => {
            const isSelected = answers[currentQuestionIndex] === opt.text;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(opt.text)}
                className={`flex flex-col items-center gap-4 p-6 rounded-[2.5rem] border-2 transition-all ${
                  isSelected 
                    ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10' 
                    : 'bg-zinc-900 border-white/5 hover:bg-zinc-800'
                }`}
              >
                <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 shadow-sm transition-all ${
                  isSelected ? 'border-blue-500' : 'border-black'
                }`}>
                  {opt.image ? (
                    <img src={opt.image} alt={opt.text} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <UserCircle2 size={64} className="text-zinc-700" />
                    </div>
                  )}
                </div>
                <span className={`text-xs font-black uppercase tracking-widest text-center truncate w-full ${
                  isSelected ? 'text-white' : 'text-white/70'
                }`}>
                  {opt.text}
                </span>
              </motion.button>
            );
          })}
        </div>
      );
    }

    if (q.type === 'Texto Aberto') {
      return (
        <div className="w-full space-y-6">
          <textarea 
            rows={4}
            className="w-full bg-zinc-900 border-2 border-white/5 rounded-[2rem] p-8 text-xl font-medium focus:outline-none focus:border-blue-500 transition-all font-sans text-white placeholder:text-zinc-600"
            placeholder="Toque para digitar seu comentário opcional..."
            onFocus={() => setRemainingTime(120)} 
            value={currentComment}
            onChange={(e) => setCurrentComment(e.target.value)}
          />
          <button 
            onClick={() => handleAnswer(currentComment)}
            disabled={q.required && !currentComment.trim()}
            className="w-full bg-[#0b82ff] text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            Enviar Comentário
          </button>
        </div>
      );
    }

    return null;
  };

  const renderThankYou = () => (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start pt-4 pb-0 px-10 text-center space-y-8 text-white">
      <div className="flex flex-col items-center gap-6 mt-4">
        <motion.div 
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="w-32 h-32 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20"
        >
          <CheckCircle2 className="w-16 h-16 text-blue-500" />
        </motion.div>

        {terminal?.logo_url && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-96 flex items-center justify-center overflow-hidden"
          >
            <img src={terminal.logo_url} alt="Logo" className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
          </motion.div>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">
          Obrigado pelo seu feedback!
        </h1>
        <p className="text-zinc-500 font-bold uppercase tracking-[0.4em] text-sm">
          Sua opinião é muito importante para nós.
        </p>
      </div>

      <div>
        <div className="inline-flex flex-col items-center gap-4 bg-zinc-900 px-10 py-6 rounded-3xl border border-white/5">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">REINICIANDO EM</span>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-[#0b82ff] rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/30">
              {restartCountdown}
            </div>
            <span className="text-sm font-black text-white uppercase">Segundos</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <span className="text-lg font-logo text-white lowercase">beend.tech</span>
        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">feedback systems</span>
      </div>
    </div>
  );

  const renderFooter = () => (
    <footer className="fixed bottom-0 left-0 right-0 pt-4 pb-4 px-8 bg-black border-t border-white/5 text-white z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center cursor-pointer"
            onClick={handleSecretTap}
          >
            <TerminalIcon className="text-zinc-500 w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">TERMINAL</p>
            <p className="text-sm font-black text-zinc-300 uppercase">{terminal?.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SISTEMA POR</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-logo text-white lowercase">beend.tech</span>
          </div>
        </div>
      </div>
    </footer>
  );

  switch (step) {
    case 'LOGIN': return renderLogin();
    case 'SELECTION': return renderSelection();
    case 'SURVEY': return renderSurvey();
    case 'THANK_YOU': return renderThankYou();
    default: return renderLogin();
  }
}
