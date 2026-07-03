import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Smile, 
  Meh, 
  Frown, 
  List, 
  Settings2,
  CheckCircle2,
  Circle,
  HelpCircle,
  Megaphone,
  ChevronRight,
  MessageSquare,
  Hash,
  CheckSquare,
  Type
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Question {
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  questions: Question[];
}

const getIconForType = (type: string) => {
  if (type?.includes('SMILE')) return Smile;
  if (type === 'NPS') return Hash;
  if (type === 'Escolha Única' || type === 'Multipla Escolha') return CheckSquare;
  if (type === 'Texto Aberto') return Type;
  if (type === 'Sim/Não') return CheckCircle2;
  return MessageSquare;
};

const getOptionsForType = (type: string, options?: string[]) => {
  if (type === 'SMILE 4') {
    return [
      { label: 'Excelente', color: '#22c55d', icon: Smile },
      { label: 'Bom', color: '#84cc15', icon: Smile },
      { label: 'Regular', color: '#e9b306', icon: Meh },
      { label: 'Ruim', color: '#ef4444', icon: Frown },
    ];
  }
  if (type === 'SMILE 5') {
    return [
      { label: 'Muito Satisfeito', color: '#22c55d', icon: Smile },
      { label: 'Satisfeito', color: '#84cc15', icon: Smile },
      { label: 'Regular', color: '#e9b306', icon: Meh },
      { label: 'Insatisfeito', color: '#f97316', icon: Frown },
      { label: 'Muito Insatisfeito', color: '#ef4444', icon: Frown },
    ];
  }
  if (type === 'NPS') {
    return [
      { label: 'Promotores', color: '#22c55d', icon: Smile },
      { label: 'Neutros', color: '#f1c40f', icon: Meh },
      { label: 'Detratores', color: '#ef4444', icon: Frown },
    ];
  }
  if (type === 'Sim/Não') {
    return [
      { label: 'Sim', color: '#22c55d', icon: CheckCircle2 },
      { label: 'Não', color: '#ef4444', icon: Circle },
    ];
  }
  if (options && options.length > 0) {
    return options.map((opt: any) => {
      // Handle both simple string arrays and object arrays from DB
      const label = typeof opt === 'string' ? opt : (opt.text || opt.label || '');
      const color = typeof opt === 'object' ? (opt.color || '#3498db') : '#3498db';
      return {
        label,
        color,
        icon: CheckSquare
      };
    });
  }
  return [];
};

export default function Questions() {
  const { user, isAdmin, isMasterAdmin } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchCampaigns();

    // Auto-refresh when user returns to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchCampaigns();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const fetchCampaigns = async () => {
    if (!user) return;
    try {
      const data = await api.get('/campaigns');
      setCampaigns(data || []);
      if (data && data.length > 0) {
        // Try to select the first active campaign, or just the first one
        const active = data.find((c: any) => c.status === 'Ativo');
        setSelectedCampaignId(active ? active.id : data[0].id);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Campaign Selector */}
          <div className={`mt-8 p-6 rounded-md shadow-sm border transition-colors ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <Megaphone className="text-blue-500" size={20} />
                  Estrutura da Campanha
                </h2>
                <p className={`text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Visualize como as perguntas estão organizadas</p>
              </div>
              
              <select 
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className={`border text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full md:w-64 p-2.5 font-medium outline-none transition-colors ${
                  isDarkMode ? 'bg-black border-white/5 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {campaigns.map(camp => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
             <div className="mt-8 flex justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
             </div>
          ) : selectedCampaign ? (
            <div className="mt-8 grid grid-cols-1 gap-6 relative">
              {/* Vertical line connector */}
              <div className="absolute left-[31px] md:left-[35px] top-6 bottom-6 w-0.5 bg-slate-200 z-0 hidden md:block" />

              {selectedCampaign.questions?.map((q, idx) => {
                const Icon = getIconForType(q.type);
                const options = getOptionsForType(q.type, q.options);

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`relative z-10 rounded-md shadow-sm overflow-hidden border flex flex-col md:flex-row group transition-colors ${
                      isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
                    }`}
                  >
                    {/* Number Indicator */}
                    <div className={`w-16 flex items-center justify-center border-r transition-colors ${
                      isDarkMode ? 'bg-black/40 border-white/5 group-hover:bg-blue-900/20' : 'bg-slate-50 border-slate-100 group-hover:bg-blue-50'
                    }`}>
                      <span className={`text-2xl font-black italic transition-colors ${
                        isDarkMode ? 'text-zinc-800 group-hover:text-blue-900' : 'text-slate-300 group-hover:text-blue-200'
                      }`}>#{idx + 1}</span>
                    </div>
                    
                    <div className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded flex items-center gap-1.5 transition-colors ${
                              isDarkMode 
                                ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' 
                                : 'text-[#0b82ff] border-blue-100 bg-blue-50'
                            }`}>
                              <Icon size={12} />
                              {q.type}
                            </span>
                            {q.required && (
                              <span className={`text-[10px] font-black uppercase tracking-widest border px-2 py-0.5 rounded transition-colors ${
                                isDarkMode ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-red-500 border-red-100 bg-red-50'
                              }`}>Obrigatória</span>
                            )}
                          </div>
                          <h3 className={`text-lg font-bold leading-tight mt-2 transition-colors ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'}`}>{q.text}</h3>
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-400">
                          <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:text-blue-500 transition-colors">
                            <Settings2 size={18} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:text-blue-500 transition-colors">
                            <ChevronRight size={18} />
                          </motion.button>
                        </div>
                      </div>

                      {/* Options Preview */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {options.length > 0 ? options.map((opt, i) => (
                          <div key={i} className={`flex flex-col items-center p-3 rounded border space-y-2 transition-all hover:shadow-md ${
                            isDarkMode 
                              ? 'bg-black/30 border-white/5 hover:bg-black/50 hover:border-white/10' 
                              : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'
                          }`}>
                            <opt.icon 
                              size={24} 
                              strokeWidth={2.5} 
                              stroke={isDarkMode ? "#18181b" : "white"} 
                              fill={opt.color} 
                              className="drop-shadow-sm"
                            />
                            <span className={`text-[9px] font-black uppercase tracking-tighter text-center leading-none transition-colors ${
                              isDarkMode ? 'text-zinc-500' : 'text-slate-700'
                            }`}>
                              {opt.label}
                            </span>
                          </div>
                        )) : (
                          <div className={`col-span-full py-4 text-center rounded-lg border border-dashed transition-colors ${
                            isDarkMode ? 'bg-black/20 border-zinc-800' : 'bg-slate-50 border-slate-300'
                          }`}>
                             <p className={`text-xs font-medium italic ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>
                               {q.type === 'Texto Aberto' ? 'Campo de resposta livre' : 'Nenhuma opção configurada'}
                             </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {!selectedCampaign.questions || selectedCampaign.questions.length === 0 ? (
                <div className={`py-20 text-center rounded-lg border-2 border-dashed transition-colors ${
                  isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                }`}>
                  <Megaphone className={`mx-auto mb-4 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} size={48} />
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Nenhuma pergunta nesta campanha</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Adicione perguntas para começar a coletar feedbacks.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`mt-8 py-20 text-center rounded-lg border-2 border-dashed transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
            }`}>
               <Megaphone className={`mx-auto mb-4 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} size={48} />
               <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Nenhuma campanha encontrada</h3>
               <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Crie uma nova campanha para gerenciar suas perguntas.</p>
            </div>
          )}

          {/* Footer Info Section */}
          <div className={`mt-12 p-8 rounded-lg border-2 border-dashed transition-colors ${
            isDarkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/50 border-slate-200'
          }`}>
             <div className="flex flex-col md:flex-row items-center gap-8">
               <div className={`p-4 rounded-full shadow-sm transition-colors ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
                 <HelpCircle size={40} className="text-[#0b82ff]" />
               </div>
               <div className="flex-1 space-y-2 text-center md:text-left">
                 <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Precisa de ajuda com a lógica?</h4>
                 <p className={`text-sm max-w-2xl font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>As perguntas são exibidas nos terminais seguindo a ordem definida acima. Você pode gerenciar estas informações na tela de edição da campanha específica.</p>
               </div>
               <motion.button
                whileHover={{ scale: 1.05 }}
                className={`px-6 py-2 rounded text-xs font-black uppercase tracking-widest transition-colors ${
                  isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
               >
                 Abrir Central de Ajuda
               </motion.button>
             </div>
          </div>
        </div>
      </main>
    </>
  );
}
