import { motion, Reorder } from 'motion/react';
import { Info, Shield, HelpCircle, Plus, Trash2, GripVertical, Smile, Meh, Frown, Star, AlignLeft, UserCircle2, CheckCircle2, Image as ImageIcon, Upload } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type QuestionType = 'SMILE 5' | 'SMILE 4' | 'NPS' | 'Escolha Única' | 'Múltipla Escolha' | 'Texto Aberto' | 'Colaborador';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  allowComment: boolean;
  options: { id: string; text: string; color: string; image?: string }[];
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { id } = useParams();
  const isEdit = !!id;

  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportTime, setReportTime] = useState('08:00');
  const [type, setType] = useState('Externa');
  const [privacyText, setPrivacyText] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

  const defaultPrivacy = "Em total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), Seus dados estão protegidos, Não compartilhamos suas informações sem sua autorização.";

  useEffect(() => {
    if (isEdit && user) {
      const fetchCampaign = async () => {
        try {
          const data = await api.get(`/campaigns/${id}`);
            
          if (data) {
            setTitle(data.name || '');
            setDescription(data.description || '');
            setReportEmail(data.report_email || '');
            setReportTime(data.report_time || '08:00');
            setType(data.type || 'Externa');
            setPrivacyText(data.privacy_text || defaultPrivacy);
            if (data.questions && Array.isArray(data.questions)) {
              setQuestions(data.questions as Question[]);
            }
          }
        } catch (error) {
          console.error(error);
          toast.error('Erro ao carregar a campanha');
        }
      };
      
      fetchCampaign();
    }
  }, [id, isEdit, user]);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'SMILE 5',
      required: true,
      allowComment: false,
      options: [{ id: '1', text: 'Opção 1', color: '#3b82f6' }]
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const updatedQuestion = { ...q, ...updates };
        if (updates.type && updates.type === 'NPS' && q.type !== 'NPS') {
          updatedQuestion.text = 'De 0 à 10, você recomendaria a nossa empresa para um amigo ou familiar?';
        }
        return updatedQuestion;
      }
      return q;
    }));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: [...q.options, { id: Math.random().toString(36).substr(2, 9), text: `Opção ${q.options.length + 1}`, color: '#3b82f6' }]
        };
      }
      return q;
    }));
  };

  const updateOption = (questionId: string, optionId: string, updates: { text?: string; color?: string; image?: string }) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.map(opt => opt.id === optionId ? { ...opt, ...updates } : opt)
        };
      }
      return q;
    }));
  };

  const removeOption = (questionId: string, optionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.filter(opt => opt.id !== optionId)
        };
      }
      return q;
    }));
  };

  const handleImageUpload = async (questionId: string, optionId: string, file: File | undefined) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const loadingToast = toast.loading('Enviando imagem para o Supabase...');

      try {
        const res = await api.post('/upload', {
          image: base64,
          folder: 'colaboradores'
        });
        
        const uploadedUrl = res.url;
        updateOption(questionId, optionId, { image: uploadedUrl });
        toast.dismiss(loadingToast);
        toast.success('Imagem do colaborador carregada no Supabase!');
      } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('Error uploading collaborator image:', error);
        toast.error('Erro ao salvar imagem no Supabase.');
      }
    };
    reader.readAsDataURL(file);
  };

  const renderPreview = (type: QuestionType, options: { text: string; color: string; image?: string }[]) => {
    switch (type) {
      case 'SMILE 5':
        return (
          <div className="flex justify-between w-full max-w-xl mx-auto mt-6 px-2 gap-2">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Frown size={28} className="text-red-500 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Muito Insatisfeito</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Frown size={28} className="text-orange-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Insatisfeito</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Meh size={28} className="text-yellow-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Regular</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Smile size={28} className="text-green-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Satisfeito</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Smile size={28} className="text-green-600 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Muito Satisfeito</span>
            </div>
          </div>
        );
      case 'SMILE 4':
        return (
          <div className="flex justify-between w-full max-w-md mx-auto mt-6 px-2 gap-2">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Frown size={28} className="text-red-500 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Ruim</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Meh size={28} className="text-yellow-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Regular</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Smile size={28} className="text-green-400 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Bom</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <Smile size={28} className="text-blue-500 shrink-0" />
              <span className="text-[10px] text-slate-500 font-bold text-center leading-tight">Excelente</span>
            </div>
          </div>
        );
      case 'NPS':
        return (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
              <span>0 = Não recomendaria</span>
              <span>10 = Com certeza recomendaria</span>
            </div>
            <div className="flex gap-1 justify-between">
              {[...Array(11)].map((_, i) => {
                let bgColor = 'bg-slate-50';
                let textColor = 'text-slate-600';
                let borderColor = 'border-slate-200';

                if (i <= 6) {
                  bgColor = 'bg-red-500';
                  textColor = 'text-white';
                  borderColor = 'border-red-600';
                } else if (i <= 8) {
                  bgColor = 'bg-yellow-500';
                  textColor = 'text-white';
                  borderColor = 'border-yellow-600';
                } else {
                  bgColor = 'bg-green-500';
                  textColor = 'text-white';
                  borderColor = 'border-green-600';
                }

                return (
                  <div 
                    key={i} 
                    className={`w-8 h-8 rounded border flex items-center justify-center text-sm font-bold transition-colors ${bgColor} ${textColor} ${borderColor}`}
                  >
                    {i}
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'Escolha Única':
      case 'Múltipla Escolha':
        return (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-4 h-4 border-2 border-slate-300 ${type === 'Escolha Única' ? 'rounded-full' : 'rounded'}`} />
                <span className="text-sm text-slate-600 font-medium">{opt.text}</span>
              </div>
            ))}
          </div>
        );
      case 'Texto Aberto':
        return (
          <div className="mt-4">
            <div className="w-full h-20 bg-slate-50 border border-slate-200 rounded p-3 text-slate-300 italic text-sm">
              Digite seu feedback aqui...
            </div>
          </div>
        );
      case 'Colaborador':
        return (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {options.map((opt, i) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-white p-3 rounded border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200">
                  {opt.image ? (
                    <img src={opt.image} alt={opt.text} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserCircle2 className="text-slate-300" size={32} />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase text-center truncate w-full">{opt.text || 'Nome'}</span>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title) {
      toast.error('O título da campanha é obrigatório.');
      return;
    }
    if (questions.length === 0) {
      toast.warning('Adicione pelo menos uma pergunta à campanha.');
      return;
    }

    toast.promise(
      (async () => {
        const payload = {
          user_id: user.id,
          name: title,
          description: description,
          report_email: reportEmail,
          report_time: reportTime,
          privacy_text: privacyText,
          questions: questions,
          type: type,
        };

        if (isEdit) {
          await api.patch(`/campaigns/${id}`, payload);
        } else {
          await api.post('/campaigns', payload);
        }
      })(),
      {
        loading: isEdit ? 'Salvando alterações na campanha...' : 'Criando nova campanha...',
        success: () => {
          setTimeout(() => navigate('/campanhas'), 500);
          return isEdit ? 'Campanha atualizada!' : 'Campanha criada com sucesso!';
        },
        error: (err: any) => err.message || 'Ocorreu um erro ao processar a campanha.',
      }
    );
  };

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          
          {/* Section 1: Campaign Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
            }`}
          >
            <div className={`p-6 border-b flex items-center gap-3 transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className={`p-2 rounded transition-colors ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Info size={20} />
              </div>
              <div>
                <h2 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>1 - Informações da Campanha</h2>
                <p className={`text-xs font-medium tracking-wide transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Configure os detalhes da sua pesquisa</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className={`text-xs font-bold uppercase transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Título da Campanha *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Pesquisa de satisfação Q1 2026"
                  className={`w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                      : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                  }`}
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <label className={`text-xs font-bold uppercase transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Tipo *</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all appearance-none ${
                    isDarkMode 
                      ? 'bg-black border border-white/5 text-zinc-300 focus:border-white/20' 
                      : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                  }`}
                >
                  <option value="Interna">Interna</option>
                  <option value="Externa">Externa</option>
                  <option value="Ponto de Venda">Ponto de Venda</option>
                  <option value="NPS">NPS</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1.5">
                <label className={`text-xs font-bold uppercase transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Relatório Diário</label>
                <div className="flex gap-4">
                  <input 
                    type="email" 
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    placeholder="E-mail (ex: cliente@email.com)"
                    className={`flex-1 rounded-md px-4 py-2.5 text-sm outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                        : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                    }`}
                  />
                  <input 
                    type="time" 
                    value={reportTime}
                    onChange={(e) => setReportTime(e.target.value)}
                    className={`w-32 rounded-md px-4 py-2.5 text-sm outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                        : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                    }`}
                  />
                </div>
                <p className={`text-[10px] font-medium transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>A campanha enviará um link seguro no horário configurado com os dados do dia anterior.</p>
              </div>
              <div className="flex flex-col space-y-1.5">
                <label className={`text-xs font-bold uppercase transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Descrição</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Descrição da pesquisa"
                  rows={3}
                  className={`w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all resize-none ${
                    isDarkMode 
                      ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                      : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                  }`}
                />
              </div>
            </div>
          </motion.div>

          {/* Section 2: Privacy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`mt-8 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
            }`}
          >
            <div className={`p-6 border-b flex justify-between items-center transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded transition-colors ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-green-50 text-green-600'}`}>
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>2 - Privacidade e Coleta de Dados</h2>
                  <p className={`text-xs font-medium tracking-wide italic transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Texto de Privacidade (LGPD) - Opcional</p>
                </div>
              </div>
              <button 
                onClick={() => setPrivacyText(defaultPrivacy)}
                className={`text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors ${
                  isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                }`}
              >
                Usar o texto padrão
              </button>
            </div>
            <div className="p-6 space-y-3">
              <textarea 
                value={privacyText}
                onChange={(e) => setPrivacyText(e.target.value)}
                placeholder="Insira o texto de privacidade..."
                rows={4}
                className={`w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all resize-none ${
                  isDarkMode 
                    ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                    : 'bg-[#f8fafb] border border-slate-200 text-slate-800 focus:border-blue-400'
                }`}
              />
              <p className={`text-[10px] font-medium transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>Este texto será exibido no formulário de pesquisa para tranquilizar os respondentes sobre o uso de seus dados.</p>
            </div>
          </motion.div>

          {/* Section 3: Questions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`mt-8 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
            }`}
          >
            <div className={`p-6 border-b flex justify-between items-center transition-colors ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded transition-colors ${isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-orange-50 text-orange-600'}`}>
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h2 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>3 - Formulando perguntas</h2>
                  <p className={`text-xs font-medium tracking-wide transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Adicione perguntas com tipos diferentes</p>
                </div>
              </div>
              <button 
                onClick={addQuestion}
                className={`px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer ${
                  isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-[#4cc077] hover:bg-[#3da362] text-white'
                }`}
              >
                <Plus size={16} />
                <span>Adicionar pergunta</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {questions.length === 0 ? (
                <div className={`text-center py-10 border-2 border-dashed rounded-lg transition-colors ${
                  isDarkMode ? 'border-zinc-800' : 'border-slate-100'
                }`}>
                  <p className={`text-sm italic font-medium transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>Nenhuma pergunta adicionada ainda. Clique em "Adicionar pergunta" para começar.</p>
                </div>
              ) : (
                <Reorder.Group axis="y" values={questions} onReorder={setQuestions} className="space-y-6">
                  {questions.map((q, qIdx) => (
                    <Reorder.Item 
                      key={q.id}
                      value={q}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-8 rounded-xl border relative group shadow-sm hover:shadow-md transition-all ${
                        isDarkMode ? 'bg-black border-white/5' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDarkMode ? 'bg-blue-600' : 'bg-[#4cc077]'
                      }`} />
                      
                      <div className="flex items-start gap-4">
                        <div className={`pt-2 cursor-grab active:cursor-grabbing transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`}>
                          <GripVertical size={24} />
                        </div>
                        <div className="flex-1 space-y-8">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                              <label className={`text-[11px] font-bold uppercase tracking-widest leading-none transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Pergunta {qIdx + 1}</label>
                              <input 
                                type="text" 
                                value={q.text}
                                onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                                placeholder="Digite sua pergunta..."
                                className={`w-full rounded-lg px-5 py-3 text-sm font-bold outline-none transition-all ${
                                  isDarkMode 
                                    ? 'bg-zinc-900 border border-white/5 text-white focus:border-white/20' 
                                    : 'bg-slate-50 border border-slate-100 text-slate-700 focus:bg-white focus:border-blue-400'
                                } placeholder:text-slate-300`}
                              />
                            </div>
                            <div className="w-full md:w-72 space-y-2">
                              <label className={`text-[11px] font-bold uppercase tracking-widest leading-none transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Tipo de resposta</label>
                              <select 
                                value={q.type}
                                onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                                className={`w-full rounded-lg px-4 py-3 text-sm font-bold outline-none transition-all appearance-none cursor-pointer ${
                                  isDarkMode 
                                    ? 'bg-zinc-900 border border-white/5 text-zinc-300 focus:border-white/20' 
                                    : 'bg-slate-50 border border-slate-100 text-slate-700 focus:bg-white focus:border-blue-400'
                                }`}
                              >
                                <option value="SMILE 5">Smile 5</option>
                                <option value="SMILE 4">Smile 4</option>
                                <option value="NPS">NPS</option>
                                <option value="Escolha Única">Escolha Única</option>
                                <option value="Múltipla Escolha">Múltipla Escolha</option>
                                <option value="Texto Aberto">Texto Aberto</option>
                                <option value="Colaborador">Colaborador</option>
                              </select>
                            </div>
                          </div>

                          {/* Questions Options (Dynamic for single/multi choice/collaborator) */}
                          {(q.type === 'Escolha Única' || q.type === 'Múltipla Escolha' || q.type === 'Colaborador') && (
                            <div className="space-y-6">
                              <label className={`text-[11px] font-bold uppercase tracking-widest block leading-none transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                                {q.type === 'Colaborador' ? 'Configuração dos Colaboradores *' : 'Opções da Pergunta *'}
                              </label>
                              
                              <div className={q.type === 'Colaborador' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                                {q.options.map((opt, optIdx) => (
                                  <div key={opt.id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                                    isDarkMode 
                                      ? 'bg-zinc-900 border-white/5 hover:border-white/10' 
                                      : 'bg-slate-50 border-slate-100 hover:border-blue-200'
                                  }`}>
                                    {q.type === 'Colaborador' ? (
                                      <div className="flex-1 flex gap-4">
                                        <div className="relative shrink-0 group/upload">
                                          <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center overflow-hidden shadow-sm transition-colors ${
                                            isDarkMode ? 'bg-black border-white/5' : 'bg-white border-slate-100'
                                          }`}>
                                            {opt.image ? (
                                              <img src={opt.image} alt="Colaborador" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                              <UserCircle2 size={40} className={isDarkMode ? 'text-zinc-800' : 'text-slate-200'} />
                                            )}
                                          </div>
                                          <label className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors ${
                                            isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-500 text-white hover:bg-blue-600'
                                          }`}>
                                            <Upload size={14} />
                                            <input 
                                              type="file" 
                                              accept="image/*"
                                              className="hidden" 
                                              onChange={(e) => handleImageUpload(q.id, opt.id, e.target.files?.[0])}
                                            />
                                          </label>
                                        </div>
                                        <div className="flex-1 space-y-2 pt-1">
                                          <input 
                                            type="text" 
                                            value={opt.text}
                                            onChange={(e) => updateOption(q.id, opt.id, { text: e.target.value })}
                                            placeholder="Nome do colaborador"
                                            className={`w-full rounded-md px-3 py-2 text-xs font-bold outline-none transition-all ${
                                              isDarkMode 
                                                ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                                                : 'bg-white border border-slate-100 text-slate-700 focus:border-blue-300'
                                            } placeholder:text-slate-300`}
                                          />
                                          <p className={`text-[10px] font-medium leading-none transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>Formato: JPG, PNG • Max 1MB</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex items-center gap-3">
                                        <div className="relative flex-1">
                                          <input 
                                            type="text" 
                                            value={opt.text}
                                            onChange={(e) => updateOption(q.id, opt.id, { text: e.target.value })}
                                            placeholder={`Opção ${optIdx + 1}`}
                                            className={`w-full rounded-md px-4 py-2 pr-10 text-xs font-bold outline-none transition-all ${
                                              isDarkMode 
                                                ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                                                : 'bg-slate-50 border border-slate-100 text-slate-700 focus:bg-white focus:border-blue-400'
                                            }`}
                                          />
                                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md overflow-hidden border transition-colors ${
                                            isDarkMode ? 'border-zinc-800' : 'border-slate-200'
                                          }`}>
                                            <input 
                                              type="color" 
                                              value={opt.color}
                                              onChange={(e) => updateOption(q.id, opt.id, { color: e.target.value })}
                                              className="absolute -inset-1 w-10 h-10 border-none bg-none cursor-pointer"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <button 
                                      onClick={() => removeOption(q.id, opt.id)}
                                      className={`p-2 rounded-lg shadow-sm border transition-colors mt-0.5 ${
                                        isDarkMode 
                                          ? 'bg-black border-white/5 text-zinc-700 hover:text-red-500 hover:bg-zinc-900' 
                                          : 'bg-white border-slate-100 text-slate-300 hover:text-red-500'
                                      }`}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              
                              <button 
                                onClick={() => addOption(q.id)}
                                className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors px-1 ${
                                  isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-700'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                  <Plus size={14} />
                                </div>
                                <span>{q.type === 'Colaborador' ? 'Adicionar mais colaboradores' : 'Adicionar Nova Opção'}</span>
                              </button>
                            </div>
                          )}

                          {/* Preview Section */}
                          <div className={`pt-6 border-t transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-2 mb-4">
                              <label className={`text-[10px] font-bold uppercase tracking-widest leading-none transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Visualização Prévia</label>
                              <div className={`h-px flex-1 transition-colors ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`} />
                            </div>
                            <div className={`p-6 rounded-xl border border-dashed transition-colors ${
                              isDarkMode ? 'bg-black/40 border-zinc-800' : 'bg-slate-50/30 border-slate-100'
                            }`}>
                              {renderPreview(q.type, q.options)}
                            </div>
                          </div>

                          {/* Question Config */}
                          <div className="flex items-center gap-8 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center p-0.5 ${
                                q.required 
                                  ? (isDarkMode ? 'bg-blue-600 border-blue-600' : 'bg-blue-500 border-blue-500') 
                                  : (isDarkMode ? 'border-zinc-800' : 'border-slate-300 group-hover:border-blue-400')
                              }`}>
                                {q.required && <CheckCircle2 size={12} className="text-white" />}
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={q.required} 
                                  onChange={() => updateQuestion(q.id, { required: !q.required })}
                                />
                              </div>
                              <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Resposta obrigatória</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center p-0.5 ${
                                q.allowComment 
                                  ? (isDarkMode ? 'bg-blue-600 border-blue-600' : 'bg-blue-500 border-blue-500') 
                                  : (isDarkMode ? 'border-zinc-800' : 'border-slate-300 group-hover:border-blue-400')
                              }`}>
                                {q.allowComment && <CheckCircle2 size={12} className="text-white" />}
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={q.allowComment}
                                  onChange={() => updateQuestion(q.id, { allowComment: !q.allowComment })}
                                />
                              </div>
                              <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Permitir comentário opcional</span>
                            </label>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeQuestion(q.id)}
                          className={`p-3 rounded-xl transition-all border shadow-sm ${
                            isDarkMode 
                              ? 'bg-zinc-900 border-white/5 text-zinc-700 hover:text-white hover:bg-red-600 hover:border-red-600' 
                              : 'bg-white border-slate-100 text-slate-300 hover:text-white hover:bg-red-500 hover:border-red-600'
                          }`}
                        >
                          <Trash2 size={22} />
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="mt-12 flex justify-center items-center gap-4">
            <button 
              onClick={() => navigate('/campanhas')}
              className={`px-10 py-3 rounded-md font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                isDarkMode ? 'text-zinc-600 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cancelar
            </button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className={`px-12 py-3 rounded-md text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-all cursor-pointer flex items-center space-x-2 ${
                isDarkMode ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 'bg-[#e74b3c] hover:bg-[#c0392b] shadow-red-500/20'
              }`}
            >
              <CheckCircle2 size={18} />
              <span>{isEdit ? 'Salvar Alterações' : 'Criar Campanha'}</span>
            </motion.button>
          </div>
        </div>
      </main>
    </>
  );
}
