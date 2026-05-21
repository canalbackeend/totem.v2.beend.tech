import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Plus,
  Eye, 
  Key, 
  QrCode, 
  Pencil, 
  Trash2, 
  Copy, 
  Link as LinkIcon,
  X,
  ExternalLink,
  Download,
  RefreshCw,
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface Terminal {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo' | 'online' | 'offline';
  campaigns: string;
  password: string | null;
  email: string | null;
  redirect_url: string | null;
  last_ping: string | null;
  created_at: string;
}

export default function Terminals() {
  const { user, isMasterAdmin, isAdmin, profile } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [maxTerminals, setMaxTerminals] = useState(-1);

  const [modalType, setModalType] = useState<'qrcode' | 'credentials' | 'create' | 'edit' | 'delete' | 'reset-password' | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [formData, setFormData] = useState<{name: string, campaigns: string[], redirect_url: string}>({ name: '', campaigns: [], redirect_url: '' });
  const [terminalPassword, setTerminalPassword] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const fetchTerminalsAndCampaigns = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const terminalsData = await api.get('/terminals');
      setTerminals(terminalsData || []);

      const campaignsData = await api.get('/campaigns');
      setCampaignsList(campaignsData || []);

      const isMaster = isMasterAdmin || isAdmin;
      setMaxTerminals(isMaster ? -1 : (profile?.max_terminals || 1));

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminalsAndCampaigns();

    // Auto-refresh when user returns to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchTerminalsAndCampaigns();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    try {
      await api.patch(`/terminals/${id}`, { status: newStatus });
      toast.success(`Status alterado para ${newStatus}`);
      fetchTerminalsAndCampaigns();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status');
    }
  };

  const deleteTerminal = async () => {
    if (!selectedTerminal) return;
    try {
      await api.delete(`/terminals/${selectedTerminal.id}`);
      toast.success('Terminal excluído com sucesso');
      fetchTerminalsAndCampaigns();
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir terminal');
    }
  };

  const handleEdit = async () => {
    if (!selectedTerminal) return;
    if (!formData.name || formData.campaigns.length === 0) {
      toast.error('Preencha os campos obrigatórios (Nome e Associadas)');
      return;
    }
    
    toast.promise(
      api.patch(`/terminals/${selectedTerminal.id}`, {
        name: formData.name,
        campaigns: formData.campaigns.join(','),
        redirect_url: formData.redirect_url
      }),
      {
        loading: 'Atualizando terminal...',
        success: (data: any) => {
          closeModal();
          fetchTerminalsAndCampaigns();
          return 'Terminal atualizado com sucesso!';
        },
        error: 'Erro ao atualizar terminal'
      }
    );
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!formData.name || formData.campaigns.length === 0) {
      toast.error('Preencha os campos obrigatórios (Nome e Associadas)');
      return;
    }

    if (!isMasterAdmin && maxTerminals > 0 && terminals.length >= maxTerminals) {
      toast.error('Limite de terminais atingido.', {
        description: `Seu plano atual permite apenas ${maxTerminals} terminal(is). Entre em contato com o suporte para aumentar seu limite.`
      });
      return;
    }
    
    // Generate auto credentials
    const randomId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const autoEmail = `ter-${new Date().getFullYear().toString().slice(-2)}-${randomId}@be.end`;
    const autoPassword = 'term123';

    toast.promise(
      api.post('/terminals', {
        name: formData.name,
        campaigns: formData.campaigns.join(','),
        redirect_url: formData.redirect_url,
        email: autoEmail,
        password: autoPassword,
        status: 'Ativo'
      }),
      {
        loading: 'Criando terminal...',
        success: (data: any) => {
          setTerminalPassword(data.password || autoPassword);
          closeModal();
          fetchTerminalsAndCampaigns();
          setTimeout(() => openModal('credentials', { ...data, password: data.password } as Terminal), 300);
          return 'Terminal criado com sucesso!';
        },
        error: 'Erro ao criar terminal'
      }
    );
  };

  const openModal = (type: 'qrcode' | 'credentials' | 'create' | 'edit' | 'delete' | 'reset-password', terminal: Terminal | null = null) => {
    if (type === 'create' && campaignsList.length === 0) {
      toast.error('É necessário ter pelo menos uma campanha para criar um terminal.');
      return;
    }
    
    setSelectedTerminal(terminal);
    setModalType(type);
    if (type === 'create') {
      setFormData({ name: '', campaigns: [], redirect_url: '' });
      setTerminalPassword(null);
    }
    if (type === 'edit' && terminal) {
      setFormData({ 
        name: terminal.name, 
        campaigns: terminal.campaigns ? terminal.campaigns.split(',').map(c => c.trim()) : [], 
        redirect_url: terminal.redirect_url || '' 
      });
    }
    if (type === 'reset-password' && terminal) {
      setTerminalPassword(null);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedTerminal(null);
    setTerminalPassword(null);
  };

  const resetPassword = async () => {
    if (!selectedTerminal) return;
    toast.promise(
      api.post(`/terminals/${selectedTerminal.id}/reset-password`, {}),
      {
        loading: 'Gerando nova senha...',
        success: (data: any) => {
          setTerminalPassword(data.password);
          fetchTerminalsAndCampaigns();
          return 'Senha redefinida com sucesso!';
        },
        error: 'Erro ao redefinir senha'
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
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
              <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Terminais</h2>
              <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Gerencie os terminais conectados às suas campanhas</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openModal('create')}
              className={`px-6 py-2.5 rounded-md font-bold text-sm tracking-wider uppercase flex items-center space-x-2 shadow-lg cursor-pointer transition-colors ${
                isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10' : 'bg-[#767676] text-white shadow-slate-500/20'
              }`}
            >
              <Plus size={18} />
              <span>Criar Terminais</span>
            </motion.button>
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
                placeholder="Pesquisar terminais..." 
                className={`w-full rounded-md py-2.5 pl-10 pr-4 text-sm outline-none transition-colors ${
                  isDarkMode 
                    ? 'bg-black border border-white/5 text-white focus:border-white/20' 
                    : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-slate-400'
                }`}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button className={`flex items-center space-x-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border ${
                isDarkMode 
                  ? 'bg-zinc-800 border-white/5 text-zinc-300 hover:bg-zinc-700' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}>
                <Filter size={16} />
                <span>Filtros</span>
              </button>
            </div>
          </div>

          {/* Terminals List */}
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className={`p-12 rounded-md border flex flex-col items-center justify-center space-y-4 transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
              }`}>
                <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${isDarkMode ? 'border-zinc-800 border-t-blue-500' : 'border-blue-500'}`}></div>
                <p className={`font-bold uppercase tracking-widest text-xs ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Carregando Terminais...</p>
              </div>
            ) : terminals.filter(term => 
              term.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              (term.campaigns && term.campaigns.toLowerCase().includes(searchTerm.toLowerCase()))
            ).length === 0 ? (
              <div className={`p-12 rounded-md border flex flex-col items-center justify-center text-center space-y-4 transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-600' : 'bg-white border-slate-100 text-slate-400'
              }`}>
                <Monitor size={48} strokeWidth={1} />
                <p className="font-bold uppercase tracking-widest text-xs">Nenhum terminal encontrado</p>
              </div>
            ) : (
              terminals.filter(term => 
                term.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (term.campaigns && term.campaigns.toLowerCase().includes(searchTerm.toLowerCase()))
              ).map((term, idx) => (
                <motion.div
                  key={term.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-5 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 transition-all ${
                    isDarkMode 
                      ? 'bg-zinc-900 border border-white/5 border-l-blue-600' 
                      : 'bg-white border border-slate-100 border-l-[#767676]'
                  }`}
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Monitor size={16} className={isDarkMode ? 'text-zinc-600' : 'text-slate-400'} />
                      <h4 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{term.name}</h4>
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mt-2">
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Campanhas Vinculadas</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(term.campaigns || "").split(',').map((camp, cIdx) => (
                            <span key={cIdx} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isDarkMode 
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {camp.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className={`flex flex-col border-l-0 md:border-l md:pl-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Senha Padrão</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Key size={12} className={isDarkMode ? 'text-zinc-600' : 'text-slate-400'} />
                          <span className={`text-sm font-mono font-bold transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>••••••••</span>
                        </div>
                      </div>

                      <div className={`flex flex-col border-l-0 md:border-l md:pl-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Última Sincronização</span>
                        <span className={`text-xs font-medium mt-1 transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>{term.last_ping ? new Date(term.last_ping).toLocaleString() : 'Nunca'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Status Toggle */}
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-bold uppercase tracking-widest mb-2 leading-none ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status</span>
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => toggleStatus(term.id, term.status)}
                          className={`w-10 h-5 rounded-full relative cursor-pointer pt-0.5 transition-colors duration-200 ${
                            term.status === 'Ativo' ? 'bg-green-500' : (isDarkMode ? 'bg-zinc-800' : 'bg-slate-300')
                          }`}
                        >
                          <motion.div 
                            animate={{ x: term.status === 'Ativo' ? 22 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className={`flex items-center gap-2 border-l pl-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Visualizar"
                        onClick={() => {
                          const termCampaigns = (term.campaigns || "").split(',').map(c => c.trim());
                          const activeCamps = campaignsList.filter(c => termCampaigns.includes(c.name));
                          if (activeCamps.length > 0) {
                            window.open(`${window.location.origin}/survey-web/${term.id}/${activeCamps[0].id}`, '_blank');
                          } else {
                            toast.error('Nenhuma campanha vinculada encontrada.');
                          }
                        }}
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-blue-500 hover:bg-white/5' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'}`}
                      >
                        <Eye size={18} />
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal('credentials', term)}
                        title="Copiar Credenciais"
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-amber-500 hover:bg-white/5' : 'text-slate-400 hover:text-[#f39c13] hover:bg-slate-50'}`}
                      >
                        <Key size={18} />
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal('qrcode', term)}
                        title="QR Code + Link"
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-blue-400 hover:bg-white/5' : 'text-slate-400 hover:text-purple-500 hover:bg-slate-50'}`}
                      >
                        <QrCode size={18} />
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal('edit', term)}
                        title="Editar"
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-emerald-500 hover:bg-white/5' : 'text-slate-400 hover:text-green-500 hover:bg-slate-50'}`}
                      >
                        <Pencil size={18} />
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal('reset-password', term)}
                        title="Redefinir Senha"
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-purple-500 hover:bg-white/5' : 'text-slate-400 hover:text-purple-500 hover:bg-slate-50'}`}
                      >
                        <RefreshCw size={18} />
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal('delete', term)}
                        title="Deletar"
                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-red-500 hover:bg-white/5' : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'}`}
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modalType && (modalType === 'create' || selectedTerminal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`rounded-2xl shadow-2xl w-full ${modalType === 'create' || modalType === 'edit' ? 'max-w-lg' : 'max-w-md'} overflow-hidden relative z-10 border transition-colors ${
                isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-100'
              }`}
            >
              <div className={`p-6 border-b flex justify-between items-center transition-colors ${
                isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-3">
                  {modalType === 'qrcode' ? <QrCode size={20} className="text-blue-500" /> : modalType === 'create' ? <Monitor size={20} className="text-[#0b82ff]" /> : modalType === 'edit' ? <Pencil size={20} className="text-emerald-500" /> : modalType === 'delete' ? <Trash2 size={20} className="text-red-500" /> : modalType === 'reset-password' ? <RefreshCw size={20} className="text-purple-500" /> : <Key size={20} className="text-amber-500" />}
                  <h3 className={`font-bold uppercase tracking-tight transition-colors ${
                    modalType === 'delete' ? 'text-red-500' : (isDarkMode ? 'text-white' : 'text-slate-800')
                  }`}>
                    {modalType === 'qrcode' ? 'Acesso ao Terminal' : modalType === 'create' ? 'Novo Terminal' : modalType === 'edit' ? 'Editar Terminal' : modalType === 'delete' ? 'Confirmar Exclusão' : modalType === 'reset-password' ? 'Redefinir Senha' : 'Credenciais do Terminal'}
                  </h3>
                </div>
                <button 
                  onClick={closeModal} 
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-200'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={modalType === 'create' || modalType === 'edit' ? '' : 'p-8'}>
                {modalType === 'create' || modalType === 'edit' ? (
                  <>
                    <div className="p-6 space-y-6">
                      <div className="space-y-4">
                        <div>
                          <label className={`block text-[11px] font-black tracking-wider uppercase mb-2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Nome do Terminal *</label>
                          <input 
                            type="text" 
                            name="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Terminal Loja 1" 
                            className={`w-full rounded-lg p-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all ${
                              isDarkMode 
                                ? 'bg-black border border-white/5 text-white focus:border-white/20 focus:ring-white/10' 
                                : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-[#0b82ff] focus:ring-[#0b82ff]'
                            }`}
                          />
                        </div>

                        <div>
                          <label className={`block text-[11px] font-black tracking-wider uppercase mb-2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>Associadas *</label>
                          <div className={`space-y-1 rounded-lg p-3 max-h-40 overflow-y-auto border transition-colors ${
                            isDarkMode ? 'bg-black border-white/5' : 'bg-slate-50 border-slate-200'
                          }`}>
                            {campaignsList.map(camp => (
                              <label key={camp.id} className={`flex items-center gap-2 cursor-pointer text-sm transition-colors ${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}>
                                <input 
                                  type="checkbox"
                                  checked={formData.campaigns.includes(camp.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) setFormData({...formData, campaigns: [...formData.campaigns, camp.name]});
                                    else setFormData({...formData, campaigns: formData.campaigns.filter(c => c !== camp.name)});
                                  }}
                                  className="rounded text-[#0b82ff] focus:ring-[#0b82ff]"
                                />
                                {camp.name}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className={`block text-[11px] font-black tracking-wider uppercase mb-2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-500'}`}>URL de Redirecionamento (Opcional)</label>
                          <input 
                            type="url" 
                            name="redirect_url"
                            value={formData.redirect_url}
                            onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                            placeholder="https://www.exemplo.com" 
                            className={`w-full rounded-lg p-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all ${
                              isDarkMode 
                                ? 'bg-black border border-white/5 text-white focus:border-white/20 focus:ring-white/10' 
                                : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-[#0b82ff] focus:ring-[#0b82ff]'
                            }`}
                          />
                        </div>
                      </div>

                      {modalType === 'create' && (
                        <div className={`border rounded-xl p-4 transition-colors ${
                          isDarkMode ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/50 border-blue-100'
                        }`}>
                          <div className="flex gap-3">
                            <div className="text-[#0b82ff] shrink-0">
                              <Monitor size={18} />
                            </div>
                            <div>
                              <h4 className={`text-xs font-black uppercase tracking-wide mb-2 ${isDarkMode ? 'text-blue-400' : 'text-slate-800'}`}>Credenciais Automáticas</h4>
                              <ul className={`text-xs font-medium space-y-1.5 list-disc pl-4 transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-600'}`}>
                                <li><span className={`font-bold transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Email:</span> Será gerado automaticamente (ex: ter-26-001@be.end)</li>
                                <li><span className={`font-bold transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Senha padrão:</span> term123</li>
                              </ul>
                              <p className={`text-[10px] font-medium mt-3 italic transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-500'}`}>
                                * As credenciais serão exibidas após a criação do terminal
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`p-6 border-t flex justify-end gap-3 transition-colors ${
                      isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <button 
                        onClick={closeModal}
                        className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                          isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={modalType === 'create' ? handleCreate : handleEdit}
                        className={`px-6 py-2.5 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transition-colors ${
                          isDarkMode 
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10' 
                            : 'bg-[#0b82ff] hover:bg-blue-600 shadow-blue-500/20'
                        }`}
                      >
                        {modalType === 'create' ? 'Criar Terminal' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </>
                ) : modalType === 'delete' && selectedTerminal ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 size={32} className="text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h4 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Deseja excluir este terminal?</h4>
                      <p className={`text-sm transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                        O terminal <span className={`font-bold transition-colors ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>"{selectedTerminal.name}"</span> será removido permanentemente. Esta ação não poderá ser desfeita.
                      </p>
                    </div>
                    <div className="flex justify-center gap-3 w-full">
                      <button 
                        onClick={closeModal}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
                          isDarkMode ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={deleteTerminal}
                        className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                      >
                        Sim, Excluir
                      </button>
                    </div>
                  </div>
                ) : modalType === 'qrcode' && selectedTerminal ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="space-y-6 w-full text-left">
                      <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                        Escaneie ou compartilhe o link público das campanhas vinculadas a este terminal.
                      </p>
                      
                      {(() => {
                         const termCampaigns = (selectedTerminal.campaigns || "").split(',').map(c => c.trim());
                         const activeCamps = campaignsList.filter(c => termCampaigns.includes(c.name));
                         
                         if (activeCamps.length === 0) {
                            return <p className="text-sm font-bold text-red-500">Nenhuma campanha encontrada neste terminal.</p>;
                         }
 
                         return (
                           <div className="space-y-8">
                             {activeCamps.map(camp => {
                               const surveyLink = `${window.location.origin}/survey-web/${selectedTerminal.id}/${camp.id}`;
                               return (
                                 <div key={camp.id} className="space-y-4">
                                   <div className="flex items-center justify-between">
                                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>{camp.name}</span>
                                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full">Terminal Web</span>
                                   </div>

                                   <div className={`p-6 rounded-2xl flex flex-col items-center gap-6 border transition-colors ${
                                     isDarkMode ? 'bg-black border-white/5' : 'bg-slate-50 border-slate-100'
                                   }`}>
                                      <div className={`p-4 rounded-2xl bg-white shadow-xl ${isDarkMode ? 'shadow-black/40' : 'shadow-slate-200/50'}`}>
                                        <QRCodeSVG 
                                          id={`qr-${camp.id}`}
                                          value={surveyLink} 
                                          size={160}
                                          level="H"
                                          includeMargin={false}
                                        />
                                      </div>

                                      <div className="w-full space-y-4">
                                        <div className={`rounded-lg p-3 flex items-center justify-between group border transition-colors ${
                                          isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-200'
                                        }`}>
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            <LinkIcon size={14} className="text-slate-400 shrink-0" />
                                            <span className={`text-[10px] font-bold truncate transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-600'}`}>{surveyLink}</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0 pl-2">
                                            <button 
                                              onClick={() => copyToClipboard(surveyLink)}
                                              className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-zinc-600 hover:bg-white/5 hover:text-blue-400' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-500'}`}
                                            >
                                              <Copy size={16} />
                                            </button>
                                            <a 
                                              href={surveyLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-zinc-600 hover:bg-white/5 hover:text-emerald-400' : 'text-slate-400 hover:bg-slate-100 hover:text-green-500'}`}
                                            >
                                              <ExternalLink size={16} />
                                            </a>
                                          </div>
                                        </div>

                                        <button 
                                          onClick={() => {
                                            const svg = document.getElementById(`qr-${camp.id}`);
                                            if (svg) {
                                              const svgData = new XMLSerializer().serializeToString(svg);
                                              const canvas = document.createElement("canvas");
                                              const ctx = canvas.getContext("2d");
                                              const img = new Image();
                                              img.onload = () => {
                                                canvas.width = 400;
                                                canvas.height = 400;
                                                if (ctx) {
                                                  ctx.fillStyle = "white";
                                                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                  ctx.drawImage(img, 20, 20, 360, 360);
                                                  const pngFile = canvas.toDataURL("image/png");
                                                  const downloadLink = document.createElement("a");
                                                  downloadLink.download = `QR_Terminal_${selectedTerminal.name}_${camp.name}.png`;
                                                  downloadLink.href = pngFile;
                                                  downloadLink.click();
                                                  toast.success('QR Code baixado com sucesso!');
                                                }
                                              };
                                              img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
                                            }
                                          }}
                                          className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                            isDarkMode 
                                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                              : 'bg-white text-slate-800 border-2 border-slate-100 hover:border-blue-500 hover:text-blue-500'
                                          }`}
                                        >
                                          <Download size={14} strokeWidth={3} />
                                          <span>Baixar QR Code</span>
                                        </button>
                                      </div>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         );
                       })()}
                    </div>
                  </div>
                ) : modalType === 'reset-password' && selectedTerminal ? (
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-100">
                      <RefreshCw size={32} className="text-purple-500" />
                    </div>
                    <div className="space-y-2">
                      <h4 className={`text-lg font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Redefinir Senha do Terminal</h4>
                      <p className={`text-sm transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                        Uma nova senha será gerada para o terminal <span className={`font-bold transition-colors ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>"{selectedTerminal.name}"</span>.
                      </p>
                    </div>

                    {terminalPassword ? (
                      <div className={`w-full p-4 rounded-xl border space-y-3 transition-colors ${
                        isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Nova Senha</span>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-lg font-mono font-bold transition-colors ${isDarkMode ? 'text-amber-500' : 'text-[#f39c13]'}`}>{terminalPassword}</span>
                            <button onClick={() => copyToClipboard(terminalPassword)} className={`transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-blue-400' : 'text-slate-400 hover:text-blue-500'}`}>
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={resetPassword}
                        className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
                          isDarkMode 
                            ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/20' 
                            : 'bg-purple-500 text-white hover:bg-purple-600 shadow-purple-500/30'
                        }`}
                      >
                        Gerar Nova Senha
                      </button>
                    )}

                    <button 
                      onClick={closeModal}
                      className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
                        isDarkMode 
                          ? 'text-zinc-500 hover:bg-white/5' 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Fechar
                    </button>
                  </div>
                ) : selectedTerminal ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border space-y-3 transition-colors ${
                        isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Email do Terminal</span>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{selectedTerminal.email}</span>
                            <button onClick={() => copyToClipboard(selectedTerminal?.email || '')} className={`transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-blue-400' : 'text-slate-400 hover:text-blue-500'}`}>
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        <div className={`h-px transition-colors ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`} />
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Senha de Acesso</span>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-sm font-mono font-bold transition-colors ${isDarkMode ? 'text-amber-500' : 'text-[#f39c13]'}`}>{terminalPassword || selectedTerminal.password}</span>
                            <button onClick={() => copyToClipboard(terminalPassword || selectedTerminal?.password || '')} className={`transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-blue-400' : 'text-slate-400 hover:text-blue-500'}`}>
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className={`text-[10px] font-medium text-center italic transition-colors ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>
                        * Estas credenciais são necessárias para autenticar o terminal físico na primeira conexão.
                      </p>
                    </div>
                    <button 
                      onClick={closeModal}
                      className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
                        isDarkMode 
                          ? 'bg-zinc-800 text-white hover:bg-zinc-700 shadow-black/20 border border-white/5' 
                          : 'bg-slate-800 text-white hover:bg-slate-700 shadow-slate-900/10'
                      }`}
                    >
                      Ok, entendi
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
