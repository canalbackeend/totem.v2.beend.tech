import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export const NPSSurvey: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    checkGlobalCampaign();
  }, [user]);

  const checkGlobalCampaign = async () => {
    try {
      // Direct query for the global campaign using the new API
      const campaign = await api.get('/campaigns/global');

      if (campaign) {
        setCampaignId(campaign.id);
        setCampaignData(campaign);
      } else {
        setCampaignId(null);
      }
    } catch (err) {
      console.error('Error in checkGlobalCampaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || score === null) return;

    try {
      // 1. Prepare responses array
      const mainQuestion = campaignData?.questions?.find((q: any) => q.type === 'NPS') || campaignData?.questions?.[0];
      
      const answers = [
        {
          question: mainQuestion?.text || 'Qual sua nota para beend.tech?',
          answer: score,
          comment: comment.trim() || undefined
        }
      ];

      // 2. Insert into responses via API
      await api.post('/responses', {
        campaign_id: campaignId,
        user_id: user?.id,
        answers: answers
      });

      const sentiment = score >= 9 ? 'success' : (score >= 7 ? 'info' : 'warning');
      const message = score >= 9 
        ? 'Ficamos felizes com sua nota!' 
        : 'Agradecemos sua sinceridade.';

      toast[sentiment === 'warning' ? 'error' : sentiment](message, {
        description: 'Seu feedback foi registrado e será analisado pela nossa equipe.'
      });

      setIsSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        // Reset after closing
        setTimeout(() => {
          setIsSubmitted(false);
          setScore(null);
          setComment('');
        }, 500);
      }, 2000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      toast.error('Erro ao enviar feedback');
    }
  };

  // Only show if a global campaign is active and data is loaded
  if (loading || !campaignId) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:bg-slate-800 transition-colors cursor-pointer group"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="msg"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="relative"
            >
              <MessageSquare size={24} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#0b82ff] rounded-full border-2 border-black animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Survey Modal/Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`absolute bottom-20 right-0 w-[350px] md:w-[400px] rounded-2xl shadow-2xl border overflow-hidden transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
            }`}
          >
            {isSubmitted ? (
              <div className="p-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-green-50 text-green-500'
                  }`}
                >
                  <CheckCircle2 size={32} />
                </motion.div>
                <div className="space-y-2">
                  <h3 className={`text-lg font-black uppercase tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Obrigado pelo seu feedback!</h3>
                  <p className={`text-sm font-medium leading-relaxed transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                    Sua opinião é fundamental para evoluirmos a beend.tech e entregarmos soluções cada vez mais inteligentes.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col">
                {/* Header */}
                <div className={`p-6 border-b transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                  <h3 className="text-xs font-black text-[#0b82ff] uppercase tracking-[0.2em] mb-1">Pesquisa de Satisfação</h3>
                  <p className={`text-sm font-bold leading-tight transition-colors ${isDarkMode ? 'text-zinc-300' : 'text-slate-800'}`}>
                    {campaignData?.questions?.find((q: any) => q.type === 'NPS')?.text || (
                      <>De 0 a 10, o quanto você recomendaria a <span className={`font-logo lowercase transition-colors ${isDarkMode ? 'text-white' : 'text-black'}`}>beend.tech</span> para um amigo?</>
                    )}
                  </p>
                </div>

                {/* Score Selector */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-11 gap-1">
                    {[...Array(11)].map((_, i) => {
                      const isSelected = score === i;
                      
                      // Color mapping logic
                      let colorClass = '';
                      if (i <= 6) {
                        colorClass = isSelected 
                          ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' 
                          : isDarkMode 
                            ? 'bg-black border-white/5 text-red-500 hover:bg-red-500/10 hover:border-red-500/30'
                            : 'bg-white border-slate-100 text-red-500 hover:bg-red-50 hover:border-red-200';
                      } else if (i <= 8) {
                        colorClass = isSelected 
                          ? 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-500/20' 
                          : isDarkMode
                            ? 'bg-black border-white/5 text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-500/30'
                            : 'bg-white border-slate-100 text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200';
                      } else {
                        colorClass = isSelected 
                          ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20' 
                          : isDarkMode
                            ? 'bg-black border-white/5 text-green-600 hover:bg-green-500/10 hover:border-green-500/30'
                            : 'bg-white border-slate-100 text-green-600 hover:bg-green-50 hover:border-green-200';
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setScore(i)}
                          className={`h-8 md:h-10 flex items-center justify-center rounded-md text-[10px] md:text-xs font-black transition-all border ${colorClass}`}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>
                  <div className={`flex justify-between text-[8px] font-black uppercase tracking-widest px-1 transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`}>
                    <span>Nada provável</span>
                    <span>Extremamente provável</span>
                  </div>

                  {/* Comment Area */}
                  {score !== null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <label className={`text-[10px] font-black uppercase tracking-widest block ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                        Conte-nos o motivo da sua nota (opcional)
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Em que podemos melhorar?"
                        className={`w-full rounded-xl p-4 text-sm font-medium outline-none transition-all min-h-[100px] resize-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                            : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-black'
                        }`}
                      />
                    </motion.div>
                  )}

                  {/* Send Button */}
                  <button
                    disabled={score === null}
                    type="submit"
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all ${
                      score !== null
                        ? isDarkMode 
                          ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/10 cursor-pointer'
                          : 'bg-black text-white hover:bg-slate-800 shadow-lg shadow-slate-200 cursor-pointer'
                        : isDarkMode
                          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Send size={14} />
                    Enviar Feedback
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
