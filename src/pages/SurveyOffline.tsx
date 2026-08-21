import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, setAuthToken } from '../lib/api';
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
  UserCircle2,
  Download,
  Wifi,
  WifiOff,
  RefreshCcw,
  Database,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../lib/db';
import { getNextQuestionIndex } from '../lib/flow';

const cacheImage = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const cached = await db.images.get(url);
    if (cached) return cached.base64;

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    await db.images.put({ url, base64, cached_at: Date.now() });
    return base64;
  } catch {
    return null;
  }
};

const getCachedImage = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const cached = await db.images.get(url);
    return cached?.base64 || null;
  } catch {
    return null;
  }
};

const OfflineImage: React.FC<{ src: string; alt: string; className?: string; fallback?: React.ReactNode }> = ({ src, alt, className, fallback }) => {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const cached = await getCachedImage(src);
      if (cached && mounted) setImgSrc(cached);
    };
    load();
    return () => { mounted = false; };
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={(e) => {
        if (imgSrc !== src) {
          setImgSrc(src);
        }
      }}
    />
  );
};

type SurveyStep = 'LOGIN' | 'DOWNLOAD' | 'SELECTION' | 'SURVEY' | 'THANK_YOU';

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
  id: string;
  text: string;
  type: 'SMILE 5' | 'SMILE 4' | 'NPS' | 'Escolha Única' | 'Múltipla Escolha' | 'Texto Aberto' | 'Colaborador' | 'Avaliação de 1 à 5';
  options?: { id: string; text: string; color?: string; image?: string }[];
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

export default function SurveyOffline() {
  const [step, setStep] = useState<SurveyStep>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentComment, setCurrentComment] = useState("");
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [pendingResponses, setPendingResponses] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [remainingTime, setRemainingTime] = useState(60);
  const [restartCountdown, setRestartCountdown] = useState(3);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncRunningRef = useRef(false)
  const componentMountedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    let healthAbort: AbortController | null = null

    const checkConnectivity = async () => {
      healthAbort?.abort()
      healthAbort = new AbortController()
      const timer = setTimeout(() => healthAbort!.abort(), 5000)

      try {
        const res = await fetch('/api/health', { method: 'HEAD', signal: healthAbort.signal })
        if (!cancelled) setIsOnline(res.ok)
      } catch {
        if (!cancelled) setIsOnline(false)
      } finally {
        clearTimeout(timer)
      }
    }

    checkConnectivity()
    const healthInterval = setInterval(checkConnectivity, 15000)

    const handleOnline = () => checkConnectivity()
    const handleOffline = () => setIsOnline(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkConnectivity()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(healthInterval)
      healthAbort?.abort()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    return () => { componentMountedRef.current = false }
  }, [])

  const syncResponses = async (manual = false) => {
    if (!isOnline) {
      if (manual) toast.error('Conexão offline. Sincronização indisponível.');
      return;
    }

    if (syncRunningRef.current) {
      if (manual) toast.info('Sincronização já em andamento...');
      return;
    }

    syncRunningRef.current = true
    let successCount = 0
    let totalCount = 0
    let hasPermanentError = false
    let permanentErrorMsg = ''
    let hasRateLimit = false
    try {
      const unsynced = await db.responses.where('synced').equals(0).toArray()
      totalCount = unsynced.length
      if (totalCount === 0) {
        setAuthError(null)
        if (manual) toast.info('Todas as respostas já estão sincronizadas.')
        return
      }

      setSyncing(true)
      for (const res of unsynced) {
        if (!componentMountedRef.current || hasRateLimit) break

        try {
          await api.post('/responses', {
            campaign_id: res.campaign_id,
            terminal_id: res.terminal_id,
            answers: res.answers,
            created_at: res.created_at,
            collaborator_name: (res as any).collaborator_name || null
          })
          await db.responses.update(res.id!, { synced: 1 })
          successCount++
        } catch (err: any) {
          const msg = err?.message || ''
          if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('Muitas requisições')) {
            hasRateLimit = true
            console.warn('Rate limit hit. Pausing sync momentarily.')
            if (manual) toast.warning('Limite de requisições atingido. Aguardando...')
            break
          } else if (msg.includes('401') || msg.includes('403') || msg.includes('Forbidden') || msg.includes('Unauthorized') || msg.includes('Token') || msg.includes('expirado') || msg.includes('bloqueada') || msg.includes('bloqueado')) {
            hasPermanentError = true
            permanentErrorMsg = msg
            console.error('Permanent sync error (auth/expiration):', msg)
          } else {
            console.error('Transient sync error (network):', msg)
          }
        }

        await new Promise(r => setTimeout(r, 300))
      }
    } catch (err) {
      console.error('Unexpected sync error:', err)
      if (manual) toast.error('Erro inesperado na sincronização.')
    } finally {
      setSyncing(false)
      syncRunningRef.current = false
    }

    if (!componentMountedRef.current) return

    if (hasPermanentError) {
      setAuthError(permanentErrorMsg)
      if (manual) {
        if (permanentErrorMsg.includes('bloqueada') || permanentErrorMsg.includes('bloqueado')) {
          toast.error('Conta bloqueada, impossível sincronizar os dados. Suas respostas locais estão preservadas.', { duration: 8000 })
        } else {
          toast.error('Erro de autenticação ou expiração. Faça login novamente.', { duration: 8000 })
        }
      }
    } else {
      setAuthError(null)
    }

    if (hasRateLimit && !isOnline) {
      if (manual) toast.warning('Sincronização pausada por limite de requisições.')
    }

    if (successCount > 0) {
      if (manual) {
        const msg = successCount === totalCount
          ? `${successCount} respostas sincronizadas com sucesso!`
          : `${successCount} de ${totalCount} respostas sincronizadas. Algumas falharam.`
        toast.success(msg)
      } else {
        console.log(`${successCount}/${totalCount} responses synced in background.`)
      }
    }
  }

  const mountedRef = useRef(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    const justMounted = !mountedRef.current
    const transitionedOnline = isOnline && !prevOnlineRef.current

    if (justMounted || transitionedOnline) {
      mountedRef.current = true
      if (isOnline) syncResponses()
    }

    prevOnlineRef.current = isOnline
  }, [isOnline])

  // Background sync every 30s
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (isOnline && !syncing) {
        syncResponses()
      }
    }, 30000)
    return () => clearInterval(syncInterval)
  }, [isOnline, syncing])

  const [tapCount, setTapCount] = useState(0);

  const handleSecretTap = () => {
    setTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 6) {
        db.terminal.clear();
        db.campaigns.clear();
        localStorage.removeItem('terminal_session');
        setTerminal(null);
        setSelectedCampaign(null);
        setAvailableCampaigns([]);
        setStep('LOGIN');
        db.responses.where('synced').equals(0).count().then(pending => {
          if (pending > 0) {
            toast.info(`Terminal deslogado. ${pending} respostas pendentes foram mantidas e serão sincronizadas após novo login.`, { duration: 8000 });
          } else {
            toast.info('Terminal deslogado e dados locais limpos');
          }
        });
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

  const handleReLogin = () => {
    setAuthToken(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('terminal_session')
    setTerminal(null)
    setSelectedCampaign(null)
    setStep('LOGIN')
    setAuthError(null)
    toast.info('Token limpo. Faça login novamente.', { duration: 5000 })
  }

  // Pulse pending count
  useEffect(() => {
    const checkPending = async () => {
      const count = await db.responses.where('synced').equals(0).count();
      setPendingResponses(count);
    };
    checkPending();
    const t = setInterval(checkPending, 5000);
    return () => clearInterval(t);
  }, []);

  // Initialize from db
  useEffect(() => {
    const init = async () => {
      const savedTerm = await db.terminal.toCollection().first();
      if (savedTerm) {
        setTerminal(savedTerm);
        const campaigns = await db.campaigns.toArray();
        setAvailableCampaigns(campaigns);
        if (campaigns.length > 0) {
          if (campaigns.length === 1) {
            setSelectedCampaign(campaigns[0]);
            setStep('SURVEY');
            startInactivityTimer();
          } else {
            setStep('SELECTION');
          }
        } else {
          setStep('DOWNLOAD');
        }
      } else {
        setStep('LOGIN');
      }
    };
    init();
  }, []);

  const downloadData = async () => {
    if (!isOnline) {
      toast.error('Você precisa estar online para baixar as campanhas.');
      return;
    }
    if (!terminal) return;

    setLoading(true);
    try {
      const campaignNames = terminal.campaigns.split(',').map(c => c.trim());
      const data = await api.get('/campaigns', { 
        names: campaignNames.join(','), 
        status: 'Ativo' 
      });

      if (data && data.length > 0) {
        await db.campaigns.clear();
        await db.campaigns.bulkAdd(data);
        setAvailableCampaigns(data);

        if (terminal.logo_url) {
          await cacheImage(terminal.logo_url);
        }

        for (const camp of data) {
          for (const q of (camp.questions || [])) {
            for (const opt of (q.options || [])) {
              if (opt.image) {
                await cacheImage(opt.image);
              }
            }
          }
        }

        if (data.length === 1) {
          setSelectedCampaign(data[0]);
          setStep('SURVEY');
          startInactivityTimer();
        } else {
          setStep('SELECTION');
        }
        toast.success(`Campanhas baixadas: ${data.length}`);
      } else {
        toast.error('Nenhuma campanha ativa encontrada para download.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      console.error(err);
      if (msg.includes('bloqueada') || msg.includes('bloqueado')) {
        setAuthError('Conta bloqueada, impossível sincronizar os dados.');
        toast.error('Conta bloqueada, impossível sincronizar os dados.', { duration: 8000 });
      } else {
        toast.error('Erro ao baixar campanhas');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.error('Login requer internet.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/terminals/login', {
        email: loginForm.email,
        password: loginForm.password
      });

      const term: Terminal = {
        id: data.id,
        name: data.name,
        user_id: data.user_id,
        campaigns: data.campaigns,
        email: data.email,
        company_name: data.company_name || 'Minha Empresa',
        logo_url: data.logo_url || null
      };

      await db.terminal.clear();
      await db.terminal.add(term);
      setTerminal(term);
      setAuthToken(data.access_token);
      setAuthError(null);
      setStep('DOWNLOAD');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('bloqueada') || msg.includes('bloqueado')) {
        setAuthError('Conta bloqueada, impossível sincronizar os dados.');
        toast.error('Conta bloqueada, impossível sincronizar os dados.', { duration: 8000 });
      } else {
        toast.error('Credenciais inválidas ou erro de conexão');
      }
    } finally {
      setLoading(false);
    }
  };

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    setRemainingTime(60);
    inactivityTimerRef.current = setInterval(() => {
      setRemainingTime(prev => Math.max(0, prev - 1));
    }, 1000);
  }, []);

  const resetSurvey = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentComment("");
    if (availableCampaigns.length > 1) {
      setStep('SELECTION');
      setSelectedCampaign(null);
    } else if (availableCampaigns.length === 0) {
      setStep('DOWNLOAD');
      setSelectedCampaign(null);
    } else {
      setStep('SURVEY');
    }
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    setRemainingTime(60);
    startInactivityTimer();
  }, [availableCampaigns.length, startInactivityTimer]);

  useEffect(() => {
    if (remainingTime <= 0 && (step === 'SURVEY' || step === 'SELECTION')) {
      resetSurvey();
    }
  }, [remainingTime, step, resetSurvey]);

  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    };
  }, []);

  const handleTouch = () => {
    if (step === 'SURVEY' || step === 'SELECTION') {
      setRemainingTime(60);
      if (step === 'SURVEY') startInactivityTimer();
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
    if (authError?.includes('bloqueada') || authError?.includes('bloqueado')) return;
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
      return;
    }

    if (currentQuestion?.type === 'Avaliação de 1 à 5') {
      const newAnswers = [...answers];
      newAnswers[currentQuestionIndex] = value;
      setAnswers(newAnswers);
      return;
    }

    if (currentQuestion?.allowComment && currentQuestion?.type !== 'Texto Aberto') {
      const newAnswers = [...answers];
      newAnswers[currentQuestionIndex] = value;
      setAnswers(newAnswers);
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = value;
    setAnswers(newAnswers);
    setCurrentComment("");

    const nextIndex = selectedCampaign
      ? getNextQuestionIndex(selectedCampaign.questions, currentQuestionIndex, newAnswers)
      : null;
    if (selectedCampaign && nextIndex !== null) {
      setCurrentQuestionIndex(nextIndex);
      setRemainingTime(60); 
    } else {
      finishSurvey(newAnswers);
    }
  };

  const nextQuestion = () => {
    if (authError?.includes('bloqueada') || authError?.includes('bloqueado')) return;
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

    const nextIndex = selectedCampaign
      ? getNextQuestionIndex(selectedCampaign.questions, currentQuestionIndex, finalAnswers)
      : null;
    if (selectedCampaign && nextIndex !== null) {
      setCurrentComment("");
      setCurrentQuestionIndex(nextIndex);
      setRemainingTime(60);
    } else {
      finishSurvey(finalAnswers);
    }
  };

  const finishSurvey = async (finalAnswers: any[]) => {
    if (!selectedCampaign || !terminal) return;
    if (authError?.includes('bloqueada') || authError?.includes('bloqueado')) return;
    setLoading(true);
    
    try {
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
          answer: val === undefined || val === null ? null : val,
          ...(cmt ? { comment: cmt } : {})
        };
      });

      // Save locally first
      const collabAns = formattedAnswers.find((a: any) => a.type === 'Colaborador');
      await db.responses.add({
        campaign_id: selectedCampaign.id,
        terminal_id: terminal.id,
        answers: formattedAnswers,
        created_at: new Date().toISOString(),
        synced: 0,
        collaborator_name: collabAns?.answer || null
      });

      setStep('THANK_YOU');
      startRestartCountdown();
      
      // Try background sync immediately
      syncResponses();
    } catch (err) {
      toast.error('Erro ao salvar resposta localmente');
    } finally {
      setLoading(false);
    }
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

  const renderLogin = () => (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white leading-tight">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-900 rounded-3xl shadow-2xl border border-white/5 overflow-hidden"
      >
        <div className="p-8 text-center space-y-6">
          <div className="relative inline-block">
             <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg blur opacity-25"></div>
             <div className="relative">
                <span className="text-4xl font-logo text-white lowercase">beend.tech</span>
                <span className="block text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1">HÍBRIDO / OFFLINE</span>
             </div>
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Acesso Offline</h1>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <TerminalIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
              <input 
                type="email" required
                placeholder="E-mail do Terminal"
                className="w-full pl-12 pr-4 py-3 bg-black border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm"
                value={loginForm.email}
                onChange={e => setLoginForm({...loginForm, email: e.target.value})}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
              <input 
                type="password" required
                placeholder="Senha"
                className="w-full pl-12 pr-4 py-3 bg-black border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Logar Online'}
          </button>
          {!isOnline && (
            <p className="text-orange-500 text-[10px] font-black uppercase text-center">
              Login requer conexão com a internet
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );

  const renderDownload = () => (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white leading-tight">
      <div className="max-w-md w-full bg-zinc-900 p-8 rounded-3xl border border-white/5 space-y-8 text-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
          <Download className="text-blue-500 w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase">Pronto para Offline</h2>
          <p className="text-zinc-500 text-sm font-medium">Baixe os dados da campanha para poder responder sem internet.</p>
        </div>
        <button 
          onClick={downloadData} disabled={loading}
          className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase flex items-center justify-center gap-3"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Baixar Campanhas <ChevronRight /></>}
        </button>
      </div>
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
              <div className="flex gap-2">
                 <span className={`text-[10px] font-black uppercase ${isOnline ? 'text-green-500' : 'text-zinc-600'}`}>
                   {isOnline ? '● ONLINE' : '● OFFLINE'}
                 </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {isOnline && (
             <button onClick={downloadData} className="p-2 text-zinc-500 hover:text-white" title="Atualizar dados">
               <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>
           )}
           <button onClick={handleSecretTap} className="p-2 text-zinc-900 transition-colors hover:text-zinc-700">
             <TerminalIcon size={12}/>
           </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center px-6 max-w-4xl mx-auto w-full pt-8 pb-48">
        <p className="text-zinc-400 text-lg font-black uppercase tracking-[0.15em] text-center mb-6">Selecione uma pesquisa para iniciar</p>
        <div className="flex flex-col gap-3 w-full">
          {(() => {
const cardColors = [
  { border: 'border-blue-500/50', borderB: 'border-b-blue-500/40', bg: 'bg-blue-500/15', text: 'text-blue-400', hoverBorder: 'hover:border-blue-500/70', hoverBg: 'hover:bg-blue-500/25' },
              { border: 'border-emerald-500/50', borderB: 'border-b-emerald-500/40', bg: 'bg-emerald-500/15', text: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/70', hoverBg: 'hover:bg-emerald-500/25' },
              { border: 'border-purple-500/50', borderB: 'border-b-purple-500/40', bg: 'bg-purple-500/15', text: 'text-purple-400', hoverBorder: 'hover:border-purple-500/70', hoverBg: 'hover:bg-purple-500/25' },
              { border: 'border-pink-500/50', borderB: 'border-b-pink-500/40', bg: 'bg-pink-500/15', text: 'text-pink-400', hoverBorder: 'hover:border-pink-500/70', hoverBg: 'hover:bg-pink-500/25' },
              { border: 'border-orange-500/50', borderB: 'border-b-orange-500/40', bg: 'bg-orange-500/15', text: 'text-orange-400', hoverBorder: 'hover:border-orange-500/70', hoverBg: 'hover:bg-orange-500/25' },
              { border: 'border-cyan-500/50', borderB: 'border-b-cyan-500/40', bg: 'bg-cyan-500/15', text: 'text-cyan-400', hoverBorder: 'hover:border-cyan-500/70', hoverBg: 'hover:bg-cyan-500/25' },
              { border: 'border-amber-500/50', borderB: 'border-b-amber-500/40', bg: 'bg-amber-500/15', text: 'text-amber-400', hoverBorder: 'hover:border-amber-500/70', hoverBg: 'hover:bg-amber-500/25' },
              { border: 'border-rose-500/50', borderB: 'border-b-rose-500/40', bg: 'bg-rose-500/15', text: 'text-rose-400', hoverBorder: 'hover:border-rose-500/70', hoverBg: 'hover:bg-rose-500/25' },
            ];
            return availableCampaigns.map((camp, idx) => {
              const c = cardColors[idx % cardColors.length];
              return (
              <motion.button
                key={camp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => selectCampaign(camp)}
                className={`${c.bg} ${c.hoverBg} border-2 ${c.border} border-b-[6px] ${c.borderB} p-5 rounded-[3rem] text-left transition-all group relative overflow-hidden flex flex-row items-center gap-4 ${c.hoverBorder}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors shrink-0 ${c.bg}`}>
                  <Layout className={`w-5 h-5 transition-colors ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight truncate">{camp.name}</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">{camp.questions.length} Perguntas • Toque para iniciar</p>
                </div>
                <div className="shrink-0">
                  <div className={`p-1.5 rounded-full shadow-sm group-hover:translate-x-2 transition-transform ${c.bg}`}>
                    <ChevronRight className={`w-4 h-4 transition-colors ${c.text}`} />
                  </div>
                </div>
              </motion.button>
            )});
          })()}
        </div>
      </main>
      {renderFooter()}
    </div>
  );

    const renderSurvey = () => {
    if (!selectedCampaign) return null;

    const isBlocked = !!authError && (authError.includes('bloqueada') || authError.includes('bloqueado'));

    if (isBlocked) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white leading-tight">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 rounded-3xl shadow-2xl border border-red-500/30 overflow-hidden"
          >
            <div className="p-10 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                <Lock className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black uppercase tracking-tight text-red-500">CONTA BLOQUEADA</h2>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                  Conta bloqueada, impossível sincronizar os dados. Suas respostas locais estão preservadas e serão sincronizadas após o desbloqueio.
                </p>
              </div>
              <button
                onClick={handleReLogin}
                className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black uppercase text-sm transition-colors"
              >
                Refazer Login
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    if (!selectedCampaign.questions || selectedCampaign.questions.length === 0) {
      return renderThankYou();
    }
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
                      OFFLINE
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">
                  PERGUNTA {currentQuestionIndex + 1} DE {selectedCampaign.questions.length}
                </p>
              </div>
           </div>
           <div className="text-right hidden sm:block">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">EMPRESA</p>
              <p className="text-sm font-black text-white uppercase">{terminal?.company_name}</p>
           </div>
        </header>

        <main className="flex-1 flex flex-col items-center px-6 max-w-4xl mx-auto w-full pt-12 pb-48">
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
                          className="w-full h-24 p-4 rounded-3xl bg-zinc-900 border-2 border-white/5 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-zinc-800 resize-none transition-all text-left text-white"
                        />
                      </div>
                    </div>
                  )}

                  {(isMultipleChoice(currentQuestion.type) || currentQuestion.type === 'Avaliação de 1 à 5' || (currentQuestion.allowComment && currentQuestion.type !== 'Texto Aberto')) && (
                    <div className="flex justify-center mt-12">
                      <button 
                        onClick={nextQuestion}
                        disabled={currentQuestion.required ? (
                          isMultipleChoice(currentQuestion.type) 
                            ? !hasMultipleChoiceValue(answers[currentQuestionIndex])
                            : (answers[currentQuestionIndex] === undefined)
                        ) : false}
                        className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-xl uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-3"
                      >
                        {currentQuestion.type === 'Avaliação de 1 à 5'
                          ? 'CONFIRMAR NOTA'
                          : (currentQuestionIndex === selectedCampaign.questions.length - 1 ? 'Finalizar' : 'Avançar')}
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  )}
              </motion.div>
            </AnimatePresence>
        </main>
        {renderFooter()}
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
            <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[8rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] bg-zinc-900 border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-white/5 group-hover:border-transparent'}`}>
              <opt.icon 
                className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} 
                style={{ color: opt.color }} 
                strokeWidth={1.5}
              />
            </div>
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors ${isSelected ? 'text-blue-500' : 'text-zinc-500 group-hover:text-white'}`}>{opt.label}</span>
          </motion.button>
        );
      });
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
            <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[9rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] bg-zinc-900 border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-white/5 group-hover:border-transparent'}`}>
              <opt.icon 
                className={`w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} 
                style={{ color: opt.color }} 
                strokeWidth={1.5}
              />
            </div>
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors ${isSelected ? 'text-blue-500' : 'text-zinc-500 group-hover:text-white'}`}>{opt.label}</span>
          </motion.button>
        );
      });
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
                  className={`flex-1 max-w-[80px] aspect-square rounded-xl sm:rounded-2xl border-2 shadow-sm flex items-center justify-center text-lg sm:text-2xl md:text-3xl font-black transition-all min-w-0 shrink ${isSelected ? 'scale-110 shadow-lg ring-2 ring-offset-1' : 'border-white/5 bg-zinc-900'}`}
                  style={{ color, ...isSelected ? { borderColor: color, backgroundColor: 'black' } : {} }}
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

    if (q.type === 'Avaliação de 1 à 5') {
      const selectedRating = answers[currentQuestionIndex] as number || 0;
      const starOpts = [
        { value: 1, label: "Uma estrela", color: "#ef4444" },
        { value: 2, label: "Duas estrelas", color: "#f97316" },
        { value: 3, label: "Três estrelas", color: "#e9b306" },
        { value: 4, label: "Quatro estrelas", color: "#84cc15" },
        { value: 5, label: "Cinco estrelas", color: "#22c55d" },
      ];
      return (
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-6 w-full">
          {starOpts.map((opt) => {
            const isFilled = opt.value <= selectedRating;
            return (
              <motion.button
                key={opt.value}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAnswer(opt.value)}
                className={`flex flex-col items-center gap-2 sm:gap-4 group shrink min-w-0 flex-1 w-full ${isFilled ? 'scale-110' : ''}`}
              >
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[8rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] bg-zinc-900 border-2 flex items-center justify-center transition-all ${isFilled ? 'border-blue-500 shadow-xl shadow-blue-500/20' : 'border-white/5 group-hover:border-transparent'}`}>
                  <Star
                    className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 transition-all ${isFilled ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: isFilled ? opt.color : '#555' }}
                    strokeWidth={isFilled ? 2 : 1.5}
                    fill={isFilled ? opt.color : 'transparent'}
                  />
                </div>
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-white">{opt.value}</span>
                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors ${isFilled ? 'text-blue-500' : 'text-zinc-500 group-hover:text-white'}`}>{opt.label}</span>
              </motion.button>
            );
          })}
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
        <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
          {(q.options || []).map((opt, idx) => {
            const isSelected = isMultipleChoice(q.type) 
              ? currentAnswers.includes(opt.text)
              : currentTextAnswer === opt.text;
            const optColor = opt.color || '#3b82f6';

            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(opt.text)}
                className="flex flex-row items-center gap-4 p-5 rounded-[3rem] border-2 border-b-[6px] text-left transition-all group"
                style={{
                  backgroundColor: isSelected ? `${optColor}80` : `${optColor}50`,
                  borderColor: optColor,
                  borderBottomColor: optColor,
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: isSelected ? optColor : `${optColor}40` }}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                    isSelected ? 'scale-110 text-white' : ''
                  }`} style={{ color: isSelected ? undefined : optColor }}>
                    {isSelected ? '●' : '○'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-lg font-black uppercase tracking-tight block truncate text-white">
                    {opt.text}
                  </span>
                </div>
                <div className="shrink-0">
                  <div className="p-1.5 rounded-full group-hover:translate-x-2 transition-transform"
                    style={{ backgroundColor: `${optColor}25` }}
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: optColor }} />
                  </div>
                </div>
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
                    <OfflineImage src={opt.image} alt={opt.text} className="w-full h-full object-cover" />
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
            className="w-full bg-zinc-900 border-2 border-white/5 rounded-3xl p-8 text-xl font-medium focus:outline-none focus:border-blue-500 transition-all font-sans text-white placeholder:text-zinc-600"
            placeholder="Toque para digitar seu comentário opcional..."
            onFocus={() => setRemainingTime(120)} 
            value={currentComment}
            onChange={(e) => setCurrentComment(e.target.value)}
          />
          <button 
            onClick={() => handleAnswer(currentComment)}
            disabled={q.required && !currentComment.trim()}
            className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            Enviar Comentário
          </button>
        </div>
      );
    }

    return null;
  };

  const renderFooter = () => {
    const progress = selectedCampaign 
      ? ((currentQuestionIndex) / selectedCampaign.questions.length) * 100 
      : 0;

    return (
      <footer className="fixed bottom-0 left-0 right-0 pt-4 pb-4 px-6 md:pt-6 md:pb-6 md:px-10 space-y-4 bg-black z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {selectedCampaign && (
          <div className="relative h-3 w-full bg-zinc-900 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="absolute inset-y-0 left-0 bg-blue-600 shadow-lg"
            />
          </div>
        )}

        {authError && (
          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-wider truncate">
                {authError.includes('expirado') ? 'ACESSO EXPIRADO' :
                 authError.includes('bloqueada') || authError.includes('bloqueado') ? 'CONTA BLOQUEADA' :
                 'ERRO DE AUTENTICAÇÃO'}
              </span>
            </div>
            <button
              onClick={handleReLogin}
              className="shrink-0 text-[9px] font-black text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl uppercase tracking-wider transition-colors"
            >
              Refazer Login
            </button>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div 
            className="flex items-center gap-4 bg-zinc-900 px-6 py-3 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-800 transition-all active:scale-95"
            onClick={() => syncResponses(true)}
            title="Clique para sincronizar agora"
          >
            <div 
              className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-sm"
            >
              <div className="relative">
                {pendingResponses > 0 ? (
                  <RefreshCcw className={`text-orange-400 w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                ) : (
                  <CheckCircle2 className="text-blue-400 w-5 h-5" />
                )}
                {pendingResponses > 0 && (
                   <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${pendingResponses > 0 ? 'text-orange-400' : 'text-zinc-500'}`}>
                {pendingResponses > 0 ? `${pendingResponses} RESPOSTAS Pendentes` : 'SINCRONIZADO'}
              </span>
              <span className="text-xs font-black text-white uppercase tracking-tight">Toque para Sincronizar</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 rounded-2xl border border-white/5">
              <div className="flex flex-col items-end">
                <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                  {isOnline ? 'CONEXÃO' : 'OFFLINE'}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-[10px] font-black text-white">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-1" />
              
              <div className="flex flex-col items-start">
                <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${pendingResponses > 0 ? 'text-orange-400 animate-pulse' : 'text-blue-400'}`}>
                  {pendingResponses > 0 ? 'PENDENTE' : 'SINCRONIZADO'}
                </span>
                <div className="flex items-center gap-1.5">
                  {pendingResponses > 0 ? (
                    <RefreshCcw size={10} className={`text-orange-400 ${syncing ? 'animate-spin' : ''}`} />
                  ) : (
                    <CheckCircle2 size={10} className="text-blue-400" />
                  )}
                  <span className="text-[10px] font-black text-white">{pendingResponses > 0 ? pendingResponses : 'LÍMPO'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div onClick={handleSecretTap} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer ${remainingTime < 15 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-zinc-900 text-zinc-500'}`}>
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
    );
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
            <OfflineImage src={terminal.logo_url} alt="Logo" className="w-full h-auto object-contain" />
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
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/30">
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

  switch(step) {
    case 'LOGIN': return renderLogin();
    case 'DOWNLOAD': return renderDownload();
    case 'SELECTION': return renderSelection();
    case 'SURVEY': return renderSurvey();
    case 'THANK_YOU': return renderThankYou();
    default: return null;
  }
}
