import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNextQuestionIndex } from '../lib/flow';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import {
  CheckCircle2,
  ChevronRight,
  Frown,
  Meh,
  Smile,
  Timer,
  Loader2,
  Building2,
  UserCircle2,
  Star
} from 'lucide-react';

interface Terminal {
  id: string;
  name: string;
  user_id: string;
  redirect_url?: string;
  company_name?: string;
  logo_url?: string;
}

interface Question {
  id: string;
  text: string;
  type: 'SMILE 5' | 'SMILE 4' | 'NPS' | 'Escolha Única' | 'Múltipla Escolha' | 'Texto Aberto' | 'Colaborador' | 'Avaliação de 1 à 5';
  options?: { id: string; text: string; color?: string; image?: string; value: any }[];
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

export default function SurveyWeb() {
  const { terminalId, campaignId } = useParams();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [step, setStep] = useState<'LOADING' | 'SELECTION' | 'SURVEY' | 'THANK_YOU' | 'ERROR'>('LOADING');
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentComment, setCurrentComment] = useState("");

  useEffect(() => {
    fetchData();
  }, [terminalId, campaignId]);

  const fetchData = async () => {
    if (!terminalId) {
      setStep('ERROR');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const termData = await api.get(`/survey/terminal/${terminalId}`);
      if (!termData) {
         throw new Error('Terminal não encontrado.');
      }

      setTerminal(termData);

      if (campaignId) {
        const campData = await api.get(`/survey/campaign/${campaignId}`);
        if (!campData) {
          throw new Error('Campanha não encontrada.');
        }
        
        if (campData.status !== 'Ativo') {
          throw new Error('Esta campanha não está mais ativa.');
        }
        
        setCampaign(campData);
        setStep('SURVEY');
      } else {
        const terminalCampaignsData = await api.get(`/survey/terminal/${terminalId}/campaigns`);
        const activeCampaigns = terminalCampaignsData || [];
        
        if (activeCampaigns.length === 0) {
          throw new Error('Nenhuma campanha ativa vinculada a este terminal.');
        }
        
        setAvailableCampaigns(activeCampaigns);
        setStep('SELECTION');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro desconhecido');
      setStep('ERROR');
      toast.error('Erro ao carregar a pesquisa.');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = campaign?.questions?.[currentQuestionIndex];

  const handleAnswer = async (value: any) => {
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

    const nextIndex = campaign
      ? getNextQuestionIndex(campaign.questions, currentQuestionIndex, newAnswers)
      : null;
    if (nextIndex !== null) {
      setCurrentComment("");
      setCurrentQuestionIndex(nextIndex);
    } else {
      finishSurvey(newAnswers);
    }
  };

  const nextQuestion = () => {
    let finalAnswers = [...answers];

    if (currentQuestion?.type === 'Texto Aberto') {
      finalAnswers[currentQuestionIndex] = currentComment.trim();
      setAnswers(finalAnswers);
    }

    if (currentQuestion?.allowComment && currentComment.trim() !== '') {
      const val = finalAnswers[currentQuestionIndex];
      finalAnswers[currentQuestionIndex] = {
        value: val !== undefined ? val : (isMultipleChoice(currentQuestion.type) ? [] : null),
        comment: currentComment.trim()
      };
      setAnswers(finalAnswers);
    }

    const nextIndex = campaign
      ? getNextQuestionIndex(campaign.questions, currentQuestionIndex, finalAnswers)
      : null;
    if (nextIndex !== null) {
      setCurrentComment("");
      setCurrentQuestionIndex(nextIndex);
    } else {
      finishSurvey(finalAnswers);
    }
  };

  const finishSurvey = async (finalAnswers: any[]) => {
    setLoading(true);
    setCurrentComment("");
    try {
      if (!campaign || !terminal) return;

      const formattedAnswers = campaign.questions.map((q, idx) => {
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

      const collabAns = formattedAnswers.find((a: any) => a.type === 'Colaborador');
      await api.post('/public/responses', {
        campaign_id: campaign.id,
        terminal_id: terminal.id,
        answers: formattedAnswers,
        collaborator_name: collabAns?.answer || null
      });

      setStep('THANK_YOU');

      if (terminal.redirect_url && terminal.redirect_url.trim() !== '') {
        setTimeout(() => {
          let url = terminal.redirect_url as string;
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          window.location.replace(url);
        }, 3000);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      console.error(err);
      if (msg.includes('bloqueada') || msg.includes('bloqueado')) {
        toast.error('Conta bloqueada, impossível sincronizar os dados.', { duration: 8000 });
      } else {
        toast.error('Erro ao enviar respostas');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionOptions = (q: Question) => {
    const isAnswered = answers[currentQuestionIndex] !== undefined;

    if (q.type === 'SMILE 5') {
      const options = [
        { icon: Smile, color: '#16a34a', value: 'Muito satisfeito', label: 'Muito satisfeito' },
        { icon: Smile, color: '#4ade80', value: 'Satisfeito', label: 'Satisfeito' },
        { icon: Meh, color: '#facc15', value: 'Regular', label: 'Regular' },
        { icon: Frown, color: '#fb923c', value: 'Insatisfeito', label: 'Insatisfeito' },
        { icon: Frown, color: '#ef4444', value: 'Muito Insatisfeito', label: 'Muito Insatisfeito' }
      ];
      return (
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-6 w-full">
          {options.map((opt, idx) => {
            const isSelected = answers[currentQuestionIndex] === opt.value;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(opt.value)}
                className={`flex flex-col items-center gap-2 group shrink min-w-0 flex-1 w-full ${isSelected ? 'scale-105' : ''}`}
              >
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[5rem] md:max-w-[6rem] mx-auto shrink-0 rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl' : (isDarkMode ? 'border-zinc-700 bg-zinc-900 shadow-sm' : 'border-slate-100 bg-white shadow-sm hover:shadow-md')}`}>
                  <opt.icon
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: opt.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight transition-colors line-clamp-2 ${isSelected ? 'text-blue-600' : (isDarkMode ? 'text-zinc-400 group-hover:text-zinc-200' : 'text-slate-500 group-hover:text-slate-800')}`}>
                  {opt.label}
                </span>
              </motion.button>
            )})}
        </div>
      );
    }

    if (q.type === 'SMILE 4') {
      const options = [
        { icon: Smile, color: '#3b82f6', value: 'EXCELENTE', label: 'Excelente' },
        { icon: Smile, color: '#4ade80', value: 'BOM', label: 'Bom' },
        { icon: Meh, color: '#facc15', value: 'REGULAR', label: 'Regular' },
        { icon: Frown, color: '#ef4444', value: 'RUIM', label: 'Ruim' }
      ];
      return (
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-6 w-full">
          {options.map((opt, idx) => {
            const isSelected = answers[currentQuestionIndex] === opt.value;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(opt.value)}
                className={`flex flex-col items-center gap-2 group shrink min-w-0 flex-1 w-full ${isSelected ? 'scale-105' : ''}`}
              >
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[5rem] md:max-w-[7rem] mx-auto shrink-0 rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl' : (isDarkMode ? 'border-zinc-700 bg-zinc-900 shadow-sm' : 'border-slate-100 bg-white shadow-sm hover:shadow-md')}`}>
                  <opt.icon
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: opt.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight transition-colors line-clamp-2 ${isSelected ? 'text-blue-600' : (isDarkMode ? 'text-zinc-400 group-hover:text-zinc-200' : 'text-slate-500 group-hover:text-slate-800')}`}>
                  {opt.label}
                </span>
              </motion.button>
            )})}
        </div>
      );
    }

    if (q.type === 'NPS') {
      return (
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex justify-center gap-1 sm:gap-2 flex-nowrap overflow-x-hidden p-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              let color = '#ef4444';
              if (num >= 7 && num <= 8) color = '#e9b306';
              if (num >= 9) color = '#22c55d';
              const isSelected = answers[currentQuestionIndex] === num;
              return (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswer(num)}
                  className={`flex-1 max-w-[60px] aspect-square rounded-xl border-2 shadow-sm flex items-center justify-center text-lg sm:text-xl font-black transition-all min-w-0 shrink ${isSelected ? 'scale-110 shadow-lg ring-2 ring-offset-1' : (isDarkMode ? 'border-zinc-700 bg-zinc-900 text-white hover:shadow-md hover:border-transparent' : 'border-slate-100 bg-white hover:shadow-md hover:border-transparent')}`}
                  style={{ color, ...isSelected ? { borderColor: color, backgroundColor: '#f8fafc', '--tw-ring-color': color } as React.CSSProperties : {} }}
                >
                  {num}
                </motion.button>
              );
            })}
          </div>
          <div className="flex justify-between w-full px-4 mt-2">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">0 = Nada provável</span>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">10 = Muito provável</span>
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
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[6rem] md:max-w-[8rem] mx-auto shrink-0 rounded-2xl sm:rounded-[2.5rem] border-2 flex items-center justify-center transition-all shadow-sm ${
                  isFilled ? 'border-blue-500 shadow-xl shadow-blue-500/20' : (isDarkMode ? 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600' : 'border-slate-200 bg-white group-hover:border-slate-300')
                }`}>
                  <Star
                    className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 transition-all ${isFilled ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: isFilled ? opt.color : '#d1d5db' }}
                    strokeWidth={isFilled ? 2 : 1.5}
                    fill={isFilled ? opt.color : 'transparent'}
                  />
                </div>
                <span className={`text-xl sm:text-2xl md:text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{opt.value}</span>
                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest text-center transition-colors ${isFilled ? 'text-blue-500' : (isDarkMode ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-slate-400 group-hover:text-slate-600')}`}>{opt.label}</span>
              </motion.button>
            );
          })}
        </div>
      );
    }

    if (isSingleChoice(q.type) || isMultipleChoice(q.type)) {
      return (
        <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
          {q.options?.map((opt, idx) => {
            const val = opt.value ?? opt.text;
            const rawAnswer = answers[currentQuestionIndex];
            const currentAnswer = (rawAnswer && typeof rawAnswer === 'object' && !Array.isArray(rawAnswer) && 'value' in rawAnswer)
              ? rawAnswer.value
              : rawAnswer;

            const isSelected = isMultipleChoice(q.type) 
              ? (Array.isArray(currentAnswer) ? currentAnswer.includes(val) : false)
              : currentAnswer === val;
            const optColor = opt.color || '#3b82f6';
              
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(val)}
                className="flex flex-row items-center gap-4 p-5 rounded-[3rem] border-2 border-b-[6px] text-left transition-all group shadow-sm"
                style={{
                  backgroundColor: isSelected ? `${optColor}60` : `${optColor}25`,
                  borderColor: optColor,
                  borderBottomColor: optColor,
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: isSelected ? optColor : `${optColor}15` }}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                    isSelected ? 'scale-110 text-white' : ''
                  }`} style={{ color: isSelected ? undefined : optColor }}>
                    {isSelected ? '●' : '○'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-lg font-black uppercase tracking-tight block truncate ${
                    isSelected ? '' : (isDarkMode ? 'text-zinc-200' : 'text-slate-700')
                  }`} style={{ color: isSelected ? optColor : undefined }}>
                    {opt.text}
                  </span>
                </div>
                <div className="shrink-0">
                  <div className="p-1.5 rounded-full group-hover:translate-x-2 transition-transform"
                    style={{ backgroundColor: isSelected ? optColor : `${optColor}15` }}
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: isSelected ? '#ffffff' : optColor }} />
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
        <div className="flex flex-wrap justify-center gap-4 w-full max-w-4xl mx-auto">
          {q.options?.map((opt, idx) => {
            const val = opt.value ?? opt.text;
            const isSelected = answers[currentQuestionIndex] === val;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(val)}
                className="flex flex-col items-center gap-2 group w-24 sm:w-32"
              >
                <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 overflow-hidden transition-all shadow-sm ${
                  isSelected ? 'border-blue-500 shadow-md' : (isDarkMode ? 'border-zinc-700 group-hover:border-zinc-500' : 'border-slate-100 group-hover:border-slate-300')
                }`}>
                  {opt.image ? (
                    <img src={opt.image} alt={opt.text} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                      <UserCircle2 size={48} className={`${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`} />
                    </div>
                  )}
                </div>
                <span className={`text-xs sm:text-sm font-bold text-center truncate w-full ${
                  isSelected ? 'text-blue-600' : (isDarkMode ? 'text-zinc-400' : 'text-slate-600')
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
        <div className="w-full max-w-2xl mx-auto">
          <textarea 
            value={currentComment}
            onChange={(e) => setCurrentComment(e.target.value)}
            className={`w-full h-40 border-2 rounded-2xl p-6 text-lg focus:outline-none focus:border-blue-500 focus:ring-4 transition-all resize-none shadow-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-white focus:ring-blue-500/20' : 'bg-white border-slate-200 text-slate-800 focus:ring-blue-100'}`}
            placeholder="Digite sua resposta aqui..."
          />
        </div>
      );
    }

    return null;
  };

  const renderSurvey = () => {
    if (campaign && (!campaign.questions || campaign.questions.length === 0)) {
      return renderThankYou();
    }
    if (!currentQuestion) return null;
    const progress = ((currentQuestionIndex + 1) / (campaign?.questions.length || 1)) * 100;

    return (
      <div className={`min-h-screen flex flex-col font-sans ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
        <header className={`p-4 md:p-6 flex items-center justify-between border-b shadow-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            {terminal?.logo_url ? (
              <img src={terminal.logo_url} alt="Logo" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Building2 className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
            )}
            <div>
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{terminal?.company_name || 'Pesquisa'}</h2>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{campaign?.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Progresso</span>
            <span className="text-sm font-black text-blue-600">{currentQuestionIndex + 1} / {campaign?.questions.length}</span>
          </div>
        </header>

        {/* Progress Bar */}
        <div className={`h-1.5 w-full ${isDarkMode ? 'bg-zinc-900' : 'bg-slate-200'}`}>
          <motion.div 
            className="h-full bg-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <main className="flex-1 flex flex-col items-center p-6 md:p-10 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl flex flex-col items-center justify-center gap-8 md:gap-12"
            >
              <div className="text-center space-y-3 max-w-3xl">
                <span className={`inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full mb-2 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                  Pergunta {currentQuestionIndex + 1}
                </span>
                <h1 className={`text-2xl md:text-3xl lg:text-4xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {currentQuestion.text}
                </h1>
                <p className={`font-bold uppercase tracking-widest text-[11px] ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Por favor, escolha uma das opções abaixo</p>
              </div>

              <div className="w-full">
                {renderQuestionOptions(currentQuestion)}
              </div>

              {(currentQuestion.allowComment && currentQuestion.type !== 'Texto Aberto') && (
                <div className="flex justify-center mt-6 w-full max-w-2xl mx-auto">
                  <div className="w-full">
                    <label className={`block text-center text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Comentário Adicional (Opcional)</label>
                    <textarea 
                      value={currentComment}
                      onChange={(e) => setCurrentComment(e.target.value)}
                      className={`w-full border-2 rounded-xl p-4 text-base focus:outline-none focus:border-blue-500 focus:ring-4 transition-all resize-none shadow-sm h-24 ${isDarkMode ? 'bg-zinc-900 border-zinc-700 text-white focus:ring-blue-500/20' : 'bg-white border-slate-200 text-slate-800 focus:ring-blue-100'}`}
                      placeholder="Quer deixar mais algum detalhe? (opcional)"
                    />
                  </div>
                </div>
              )}

              {(isMultipleChoice(currentQuestion.type) || currentQuestion.type === 'Avaliação de 1 à 5' || (currentQuestion.type as any) === 'Texto Aberto' || (currentQuestion.allowComment && (currentQuestion.type as any) !== 'Texto Aberto')) && (
                <div className="flex justify-center mt-8 w-full max-w-2xl mx-auto">
                  <button 
                    onClick={nextQuestion}
                    disabled={currentQuestion.required ? (
                      isMultipleChoice(currentQuestion.type) 
                        ? !hasMultipleChoiceValue(answers[currentQuestionIndex])
                        : currentQuestion.type === 'Avaliação de 1 à 5' ? !answers[currentQuestionIndex]
                        : currentQuestion.type === 'Texto Aberto' ? !currentComment.trim() : !answers[currentQuestionIndex]
                    ) : false}
                    className="w-full sm:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                  >
                    {currentQuestion.type === 'Avaliação de 1 à 5' ? 'CONFIRMAR NOTA' : 'Avançar'}
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    );
  };

  const renderThankYou = () => (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-8 font-sans ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'}`}>
      <div className={`flex flex-col items-center gap-6 max-w-md w-full p-8 rounded-3xl shadow-xl border ${isDarkMode ? 'bg-zinc-900 border-zinc-800 shadow-black/30' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
        <motion.div 
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className={`w-24 h-24 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-green-500/20 border-green-500/30' : 'bg-green-100 border-green-200'}`}
        >
          <CheckCircle2 className={`w-12 h-12 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
        </motion.div>

        {terminal?.logo_url && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-48 flex items-center justify-center overflow-hidden"
          >
            <img src={terminal.logo_url} alt="Logo" className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
          </motion.div>
        )}

        <div className="space-y-3 mt-4">
          <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Obrigado!</h2>
          <p className={`font-medium text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Sua opinião é muito importante para nós e foi registrada com sucesso.</p>
        </div>
        
        {terminal?.redirect_url && terminal.redirect_url.trim() !== '' && (
          <div className="mt-8">
            <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
              <Loader2 className="w-3 h-3 animate-spin"/> Redirecionando...
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderSelection = () => (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'}`}>
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          {terminal?.logo_url ? (
            <img src={terminal.logo_url} alt="Logo" className="h-16 mx-auto object-contain mb-4" referrerPolicy="no-referrer" />
          ) : (
            <Building2 className="w-16 h-16 mx-auto text-blue-500 mb-4" />
          )}
          <h1 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {terminal?.company_name || 'Pesquisa'}
          </h1>
          <p className={`font-bold text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            Selecione uma campanha para avaliar
          </p>
        </div>

        <div className="space-y-3">
          {availableCampaigns.map((camp) => (
            <motion.button
              key={camp.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCampaign(camp);
                setStep('SURVEY');
              }}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${isDarkMode ? 'bg-zinc-900 border-zinc-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-lg'}`}
            >
              <div>
                <h3 className={`font-black text-lg ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{camp.name}</h3>
                <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                  {camp.questions?.length || 0} perguntas
                </p>
              </div>
              <ChevronRight className={`w-6 h-6 transition-colors ${isDarkMode ? 'text-zinc-600 group-hover:text-blue-400' : 'text-slate-300 group-hover:text-blue-500'}`} />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderError = () => (
    <div className={`min-h-screen flex items-center justify-center p-6 text-center font-sans ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-md space-y-4">
        <Frown size={48} className={`mx-auto ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`} />
        <h2 className="text-2xl font-black">Pesquisa Indisponível</h2>
        <p className={`${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Não foi possível carregar a pesquisa ou ela não está mais ativa no momento.</p>
        {errorMsg && (
          <p className={`text-[10px] font-mono mt-4 pt-4 border-t ${isDarkMode ? 'text-zinc-600 border-zinc-800' : 'text-slate-400 border-slate-200'}`}>
            Log: {errorMsg}
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        <p className={`mt-4 text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Carregando pesquisa...</p>
      </div>
    );
  }

  switch (step) {
    case 'SELECTION': return renderSelection();
    case 'SURVEY': return renderSurvey();
    case 'THANK_YOU': return renderThankYou();
    case 'ERROR': return renderError();
    default: return null;
  }
}
