import { motion } from 'motion/react';
import { Plus, Search, Filter, Calendar, Users, CheckCircle2, Pencil, RotateCcw, Trash2, XCircle, Smile, Meh, Frown, Copy } from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  responses_count: number;
  perception_excelente: number;
  perception_bom: number;
  perception_regular: number;
  perception_ruim: number;
  created_at: string;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isMasterAdmin, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCampaigns = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.get('/campaigns');
      setCampaigns(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
  }, [user, location.pathname]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    try {
      await api.patch(`/campaigns/${id}`, { status: newStatus });
      toast.success(`Status alterado para ${newStatus}`);
      fetchCampaigns();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status');
    }
  };

  const [campaignToDelete, setCampaignToDelete] = useState<{id: string, name: string} | null>(null);
  const [campaignToReset, setCampaignToReset] = useState<{id: string, name: string} | null>(null);
  const [campaignToClone, setCampaignToClone] = useState<{id: string, name: string} | null>(null);

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await api.delete(`/campaigns/${campaignToDelete.id}`);
      toast.success('Campanha excluída com sucesso');
      fetchCampaigns();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir campanha');
    } finally {
      setCampaignToDelete(null);
    }
  };

  const confirmResetCampaignStats = async () => {
    if (!campaignToReset) return;
    try {
      await api.post(`/campaigns/${campaignToReset.id}/reset`, {});
      toast.success('Resultados zerados com sucesso');
      fetchCampaigns();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao zerar resultados');
    } finally {
      setCampaignToReset(null);
    }
  };

  const confirmCloneCampaign = async () => {
    if (!campaignToClone) return;
    try {
      const cloned = await api.post(`/campaigns/${campaignToClone.id}/clone`, {});
      toast.success(`Campanha "${cloned.name}" clonada com sucesso`);
      fetchCampaigns();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao clonar campanha');
    } finally {
      setCampaignToClone(null);
    }
  };


  const perceptionData = [
    { key: 'perception_excelente', label: 'Excelente', color: '#22c55d', icon: Smile },
    { key: 'perception_bom', label: 'Bom', color: '#84cc15', icon: Smile },
    { key: 'perception_regular', label: 'Regular', color: '#e9b306', icon: Meh },
    { key: 'perception_ruim', label: 'Ruim', color: '#ef4444', icon: Frown },
  ];

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 space-y-8 transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#ecf0f1] text-slate-900'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* List of Campaigns Header */}
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Lista de Campanhas</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/campanhas/nova')}
              className="bg-[#f39c13] text-white px-6 py-2.5 rounded-md font-bold text-sm tracking-wider uppercase flex items-center space-x-2 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              <Plus size={18} />
              <span>Criar Campanha</span>
            </motion.button>
          </div>

          {/* Filters & Search */}
          <div className={`mt-6 p-4 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col md:flex-row gap-4 items-center transition-colors ${
            isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'
          }`}>
            <div className="relative flex-1 w-full">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`} size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar campanhas..." 
                className={`w-full border rounded-md py-2.5 pl-10 pr-4 text-sm transition-colors focus:outline-none focus:border-blue-400 ${
                  isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button className={`flex items-center space-x-2 px-4 py-2.5 border rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isDarkMode ? 'bg-black border-white/10 text-zinc-400 hover:bg-zinc-900' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}>
                <Filter size={16} />
                <span>Filtros</span>
              </button>
            </div>
          </div>

          {/* Campaigns Table/Grid */}
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b82ff]"></div>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-10">
                <p className={`font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Nenhuma campanha encontrada.</p>
              </div>
            ) : campaigns.filter(camp => camp.name.toLowerCase().includes(searchTerm.toLowerCase())).map((camp, idx) => {
              const totalPerception = (camp.perception_excelente || 0) + (camp.perception_bom || 0) + (camp.perception_regular || 0) + (camp.perception_ruim || 0);
              const satisfactionScore = camp.responses_count > 0 
                ? Math.round(((camp.perception_excelente || 0) + (camp.perception_bom || 0) * 0.75 + (camp.perception_regular || 0) * 0.5) / (totalPerception || 1) * 100)
                : 0;

              return (
                <motion.div
                  key={camp.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ x: 5 }}
                  className={`p-5 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row justify-between items-center gap-6 border-l-4 border-l-[#f39c13] relative overflow-hidden transition-colors ${
                    isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'
                  }`}
                >
                  {camp.responses_count > 0 && (
                    <div 
                      className={`absolute top-0 right-0 px-3 py-1 text-[11px] font-black text-white uppercase tracking-tight rounded-bl-md border-b border-l ${
                        isDarkMode ? 'shadow-lg border-white/5' : 'border-transparent'
                      }`}
                      title={`SATISFAÇÃO: ${satisfactionScore}%`}
                      style={{ 
                        backgroundColor: satisfactionScore >= 85 ? '#22c55d' : 
                                         satisfactionScore >= 70 ? '#84cc15' : 
                                         satisfactionScore >= 50 ? '#e9b306' : '#ef4444' 
                      }}
                    >
                      {satisfactionScore}%
                    </div>
                  )}
                <div className="flex flex-col gap-1 flex-1 w-full relative">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{camp.type}</span>
                  </div>
                  <h4 className={`text-lg font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{camp.name}</h4>
                  <div className={`flex items-center gap-4 text-xs mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar size={14} className={isDarkMode ? 'text-zinc-600' : 'text-slate-400'} />
                      <span>{new Date(camp.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium border-l pl-4 ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                      <Users size={14} className={isDarkMode ? 'text-zinc-600' : 'text-slate-400'} />
                      <span>{camp.responses_count} participações</span>
                    </div>
                  </div>
                </div>

                {/* Perception Breakdown in Card */}
                <div className={`flex items-center gap-2 md:gap-4 border-l pl-6 w-full lg:w-auto ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  {perceptionData.map((p) => {
                    const value = camp[p.key as keyof Campaign] as number || 0;
                    return (
                      <div key={p.key} className="flex flex-col items-center gap-1 min-w-[50px]">
                        <p.icon 
                          size={24} 
                          strokeWidth={2} 
                          stroke={isDarkMode ? '#18181b' : 'white'}
                          fill={value > 0 ? p.color : (isDarkMode ? '#27272a' : '#e2e8f0')} 
                          className={value > 0 ? 'opacity-100' : 'opacity-40'}
                        />
                        <span className={`text-[10px] font-black ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>{totalPerception > 0 ? Math.round((value / totalPerception) * 100) : 0}%</span>
                        <span className={`text-[9px] font-bold uppercase tracking-tighter ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{p.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className={`flex items-center gap-6 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 ${
                  isDarkMode ? 'border-white/5' : 'border-slate-100'
                }`}>
                  <div className="flex flex-col items-center">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 leading-none ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status</span>
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => toggleStatus(camp.id, camp.status)}
                        className={`w-9 h-5 rounded-full relative cursor-pointer pt-0.5 transition-colors duration-200 ${
                          camp.status === 'Ativo' ? 'bg-green-500' : (isDarkMode ? 'bg-zinc-800' : 'bg-slate-300')
                        }`}
                      >
                        <motion.div 
                          animate={{ x: camp.status === 'Ativo' ? 18 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                      <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider min-w-[70px] justify-center ${
                        camp.status === 'Ativo' 
                          ? (isDarkMode ? 'bg-green-900/20 text-green-400 border-green-900/30' : 'bg-green-50 text-green-600 border border-green-100') 
                          : (isDarkMode ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-red-50 text-red-600 border border-red-100')
                      }`}>
                        {camp.status === 'Ativo' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{camp.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-1 border-l pl-4 py-1 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Editar"
                      onClick={() => navigate(`/campanhas/editar/${camp.id}`)}
                      className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'text-zinc-500 hover:bg-white/5 hover:text-[#f39c13]' : 'text-slate-400 hover:bg-slate-50 hover:text-[#f39c13]'}`}
                    >
                      <Pencil size={18} />
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCampaignToClone({ id: camp.id, name: camp.name })}
                      title="Clonar Campanha"
                      className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'text-zinc-500 hover:bg-white/5 hover:text-violet-500' : 'text-slate-400 hover:bg-slate-50 hover:text-violet-500'}`}
                    >
                      <Copy size={18} />
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCampaignToReset({ id: camp.id, name: camp.name })}
                      title="Resetar Resultados"
                      className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'text-zinc-500 hover:bg-white/5 hover:text-orange-500' : 'text-slate-400 hover:bg-slate-50 hover:text-orange-500'}`}
                    >
                      <RotateCcw size={18} />
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Deletar"
                      onClick={() => setCampaignToDelete({ id: camp.id, name: camp.name })}
                      className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'text-zinc-500 hover:bg-white/5 hover:text-red-500' : 'text-slate-400 hover:bg-slate-50 hover:text-red-500'}`}
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Clone Modal */}
      {campaignToClone && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-slate-900/50'}`}>
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Clonar Campanha</h3>
              <p className={isDarkMode ? 'text-zinc-400' : 'text-slate-600'}>
                Deseja clonar a campanha <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{campaignToClone.name}"</span>? 
                Uma cópia será criada com status inativo para você editar.
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setCampaignToClone(null)}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                    isDarkMode ? 'bg-black text-zinc-400 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCloneCampaign}
                  className="px-4 py-2 font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                >
                  Clonar Campanha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {campaignToDelete && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-slate-900/50'}`}>
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Apagar Campanha</h3>
              <p className={isDarkMode ? 'text-zinc-400' : 'text-slate-600'}>
                Tem certeza que deseja apagar a campanha <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{campaignToDelete.name}"</span>? 
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setCampaignToDelete(null)}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                    isDarkMode ? 'bg-black text-zinc-400 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteCampaign}
                  className="px-4 py-2 font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Apagar Campanha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {campaignToReset && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-slate-900/50'}`}>
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Zerar Resultados</h3>
              <p className={isDarkMode ? 'text-zinc-400' : 'text-slate-600'}>
                Tem certeza que deseja zerar os resultados da campanha <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{campaignToReset.name}"</span>? 
                Isso afetará os gráficos e o relatório.
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setCampaignToReset(null)}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                    isDarkMode ? 'bg-black text-zinc-400 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmResetCampaignStats}
                  className="px-4 py-2 font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                >
                  Zerar Resultados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
