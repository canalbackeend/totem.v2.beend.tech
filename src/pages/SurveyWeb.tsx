import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Frown,
  Meh,
  Smile,
  Timer,
  Loader2,
  Building2,
  UserCircle2
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
  text: string;
  type: 'SMILE 5' | 'SMILE 4' | 'NPS' | 'Escolha Única' | 'Múltipla Escolha' | 'Texto Aberto' | 'Colaborador';
  options?: { text: string; color?: string; image?: string; value: any }[];
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
  const [loading, setLoading] = useState(true);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [step, setStep] = useState<'LOADING' | 'SURVEY' | 'THANK_YOU' | 'ERROR'>('LOADING');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentComment, setCurrentComment] = useState("");

  useEffect(() => {
    fetchData();
  }, [terminalId, campaignId]);

  const fetchData = async () => {
    if (!terminalId || !campaignId) {
      setStep('ERROR');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch Terminal
      const termData = await api.get(`/survey/terminal/${terminalId}`);
      if (!termData) {
         throw new Error('Terminal não encontrado.');
      }

      setTerminal(termData);

      // Fetch Campaign
      const campData = await api.get(`/survey/campaign/${campaignId}`);
      if (!campData) {
        throw new Error('Campanha não encontrada.');
      }
      
      if (campData.status !== 'Ativo') {
        throw new Error('Esta campanha não está mais ativa.');
      }
      
      setCampaign(campData);
      setStep('SURVEY');
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

    const nextIndex = currentQuestionIndex + 1;
    if (campaign && nextIndex < campaign.questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentComment("");
    } else {
      finishSurvey(newAnswers);
    }
  };

  const nextQuestion = () => {
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
    if (campaign && nextIndex < campaign.questions.length) {
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
          answer: val || null,
          ...(cmt ? { comment: cmt } : {})
        };
      });

      await api.post('/responses', {
        campaign_id: campaign.id,
        terminal_id: terminal.id,
        answers: formattedAnswers
      });

      const lastAnswerRaw = finalAnswers[finalAnswers.length - 1];
      const lastAnswer = (lastAnswerRaw && typeof lastAnswerRaw === 'object' && !Array.isArray(lastAnswerRaw) && 'value' in lastAnswerRaw)
         ? lastAnswerRaw.value
         : lastAnswerRaw;

      let updateData: any = {
        responses_count: (campaign.responses_count || 0) + 1
      };

      if (typeof lastAnswer === 'string' || typeof lastAnswer === 'number') {
        const val = typeof lastAnswer === 'string' ? lastAnswer.toUpperCase() : lastAnswer;
        if (val === 'MUITO SATISFEITO' || val === 'EXCELENTE' || val === 'MUITO BOM' || (typeof val === 'number' && val >= 9)) {
          updateData.perception_excelente = ((campaign as any).perception_excelente || 0) + 1;
        } else if (val === 'SATISFEITO' || val === 'BOM' || (typeof val === 'number' && val >= 7 && val <= 8)) {
          updateData.perception_bom = ((campaign as any).perception_bom || 0) + 1;
        } else if (val === 'REGULAR' || (typeof val === 'number' && val >= 5 && val <= 6)) {
           updateData.perception_regular = ((campaign as any).perception_regular || 0) + 1;
        } else if (val === 'RUIM' || val === 'PÉSSIMO' || val === 'INSATISFEITO' || val === 'MUITO INSATISFEITO' || (typeof val === 'number' && val <= 4)) {
          updateData.perception_ruim = ((campaign as any).perception_ruim || 0) + 1;
        }
      }

      try {
        await api.patch(`/campaigns/${campaign.id}`, updateData);
      } catch (e) {
        console.warn('Skipped inline campaign PATCH update, backend handled it:', e);
      }

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
      console.error(err);
      toast.error('Erro ao enviar respostas');
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionOptions = (q: Question) => {
    const isAnswered = answers[currentQuestionIndex] !== undefined;

    if (q.type === 'SMILE 5') {
      const options = [
        { icon: Frown, color: '#ef4444', value: 'Muito Insatisfeito', label: 'Muito Insatisfeito' },
        { icon: Frown, color: '#fb923c', value: 'Insatisfeito', label: 'Insatisfeito' },
        { icon: Meh, color: '#facc15', value: 'Regular', label: 'Regular' },
        { icon: Smile, color: '#4ade80', value: 'Satisfeito', label: 'Satisfeito' },
        { icon: Smile, color: '#16a34a', value: 'Muito Satisfeito', label: 'Muito Satisfeito' }
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
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[5rem] md:max-w-[6rem] mx-auto shrink-0 rounded-2xl bg-white border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                  <opt.icon
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: opt.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight transition-colors line-clamp-2 ${isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'}`}>
                  {opt.label}
                </span>
              </motion.button>
            )})}
        </div>
      );
    }

    if (q.type === 'SMILE 4') {
      const options = [
        { icon: Frown, color: '#ef4444', value: 'Ruim', label: 'Ruim' },
        { icon: Meh, color: '#facc15', value: 'Regular', label: 'Regular' },
        { icon: Smile, color: '#4ade80', value: 'Bom', label: 'Bom' },
        { icon: Smile, color: '#3b82f6', value: 'Excelente', label: 'Excelente' }
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
                <div className={`w-full aspect-square max-w-[4rem] sm:max-w-[5rem] md:max-w-[7rem] mx-auto shrink-0 rounded-2xl bg-white border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 shadow-xl' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>
                  <opt.icon
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={{ color: opt.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight transition-colors line-clamp-2 ${isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'}`}>
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
                  className={`flex-1 max-w-[60px] aspect-square rounded-xl border-2 shadow-sm flex items-center justify-center text-lg sm:text-xl font-black transition-all min-w-0 shrink ${isSelected ? 'scale-110 shadow-lg ring-2 ring-offset-1' : 'border-slate-100 bg-white hover:shadow-md hover:border-transparent'}`}
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

    if (isSingleChoice(q.type) || isMultipleChoice(q.type)) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mx-auto">
          {q.options?.map((opt, idx) => {
            const val = opt.value ?? opt.text;
            const rawAnswer = answers[currentQuestionIndex];
            const currentAnswer = (rawAnswer && typeof rawAnswer === 'object' && !Array.isArray(rawAnswer) && 'value' in rawAnswer)
              ? rawAnswer.value
              : rawAnswer;

            const isSelected = isMultipleChoice(q.type) 
              ? (Array.isArray(currentAnswer) ? currentAnswer.includes(val) : false)
              : currentAnswer === val;
              
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(val)}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                  isSelected 
                    ? 'bg-blue-50 border-blue-500 shadow-md' 
                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-md border-2 flex shrink-0 items-center justify-center transition-colors ${
                  isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-200 text-transparent'
                }`}>
                  <CheckCircle2 size={16} />
                </div>
                <span className={`text-md font-bold text-left w-full ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
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
                  isSelected ? 'border-blue-500 shadow-md' : 'border-slate-100 group-hover:border-slate-300'
                }`}>
                  {opt.image ? (
                    <img src={opt.image} alt={opt.text} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <UserCircle2 size={48} className="text-slate-400" />
                    </div>
                  )}
                </div>
                <span className={`text-xs sm:text-sm font-bold text-center truncate w-full ${
                  isSelected ? 'text-blue-600' : 'text-slate-600'
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
            className="w-full h-40 bg-white border-2 border-slate-200 text-slate-800 rounded-2xl p-6 text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none shadow-sm"
            placeholder="Digite sua resposta aqui..."
          />
        </div>
      );
    }

    return null;
  };

  const renderSurvey = () => {
    if (!currentQuestion) return null;
    const progress = ((currentQuestionIndex) / (campaign?.questions.length || 1)) * 100;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
        <header className="p-4 md:p-6 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3">
            {terminal?.logo_url ? (
              <img src={terminal.logo_url} alt="Logo" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="text-blue-600 w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{terminal?.company_name || 'Pesquisa'}</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{campaign?.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progresso</span>
            <span className="text-sm font-black text-blue-600">{currentQuestionIndex + 1} / {campaign?.questions.length}</span>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-200">
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
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-full mb-2">
                  Pergunta {currentQuestionIndex + 1}
                </span>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 leading-tight">
                  {currentQuestion.text}
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px]">Por favor, escolha uma das opções abaixo</p>
              </div>

              <div className="w-full">
                {renderQuestionOptions(currentQuestion)}
              </div>

              {(currentQuestion.allowComment && currentQuestion.type !== 'Texto Aberto') && (
                <div className="flex justify-center mt-6 w-full max-w-2xl mx-auto">
                  <div className="w-full">
                    <label className="block text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Comentário Adicional (Opcional)</label>
                    <textarea 
                      value={currentComment}
                      onChange={(e) => setCurrentComment(e.target.value)}
                      className="w-full bg-white border-2 border-slate-200 text-slate-800 rounded-xl p-4 text-base focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none shadow-sm h-24"
                      placeholder="Quer deixar mais algum detalhe? (opcional)"
                    />
                  </div>
                </div>
              )}

              {(isMultipleChoice(currentQuestion.type) || (currentQuestion.type as any) === 'Texto Aberto' || (currentQuestion.allowComment && (currentQuestion.type as any) !== 'Texto Aberto')) && (
                <div className="flex justify-center mt-8 w-full max-w-2xl mx-auto">
                  <button 
                    onClick={nextQuestion}
                    disabled={currentQuestion.required ? (
                      isMultipleChoice(currentQuestion.type) 
                        ? !hasMultipleChoiceValue(answers[currentQuestionIndex])
                        : currentQuestion.type === 'Texto Aberto' ? !currentComment.trim() : !answers[currentQuestionIndex]
                    ) : false}
                    className="w-full sm:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                  >
                    Avançar
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-8 text-slate-800 font-sans">
      <div className="flex flex-col items-center gap-6 max-w-md w-full p-8 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <motion.div 
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center border border-green-200"
        >
          <CheckCircle2 className="w-12 h-12 text-green-600" />
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
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Obrigado!</h2>
          <p className="text-slate-500 font-medium text-sm">Sua opinião é muito importante para nós e foi registrada com sucesso.</p>
        </div>
        
        {terminal?.redirect_url && terminal.redirect_url.trim() !== '' && (
          <div className="mt-8">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin"/> Redirecionando...
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderError = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-slate-800 font-sans">
      <div className="max-w-md space-y-4">
        <Frown size={48} className="mx-auto text-slate-400" />
        <h2 className="text-2xl font-black">Pesquisa Indisponível</h2>
        <p className="text-slate-500">Não foi possível carregar a pesquisa ou ela não está mais ativa no momento.</p>
        {errorMsg && (
          <p className="text-[10px] text-slate-400 font-mono mt-4 pt-4 border-t border-slate-200">
            Log: {errorMsg}
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Carregando pesquisa...</p>
      </div>
    );
  }

  switch (step) {
    case 'SURVEY': return renderSurvey();
    case 'THANK_YOU': return renderThankYou();
    case 'ERROR': return renderError();
    default: return null;
  }
}
