import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Plus, 
  Filter,
  Edit,
  Trash2,
  Eye,
  Copy,
  Send,
  Download,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';

export default function Proposals() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [filter, setFilter] = useState('all');
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const [proposalToSend, setProposalToSend] = useState<{id: string, name: string, email: string} | null>(null);
  const [proposalToDelete, setProposalToDelete] = useState<{id: string, name: string} | null>(null);
  const [isSending, setIsSending] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      let url = `/proposals?page=${page}&pageSize=${pageSize}`;
      if (filter !== 'all') url += `&status=${filter}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      
      const response = await api.get(url);
      setProposals(response.data || []);
      setTotalCount(response.count || 0);
    } catch (error: any) {
      console.error("Error fetching proposals:", error);
      setErrorMsg(error.message || 'Erro ao carregar propostas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [page, pageSize, filter]);

  const handleSendEmail = async () => {
    if (!proposalToSend) return;
    setIsSending(true);
    try {
      await api.post(`/proposals/${proposalToSend.id}/send`, {});
      toast.success('Proposta enviada com sucesso!', {
        description: `Enviada para ${proposalToSend.email}`
      });
      fetchProposals();
    } catch (error: any) {
      toast.error('Erro ao enviar proposta', {
        description: error.message || 'Tente novamente.'
      });
    } finally {
      setIsSending(false);
      setProposalToSend(null);
    }
  };

  const handleClone = async (proposal: any) => {
    try {
      await api.post(`/proposals/${proposal.id}/clone`, {});
      toast.success('Proposta clonada com sucesso!');
      fetchProposals();
    } catch (error: any) {
      toast.error('Erro ao clonar proposta');
    }
  };

  const handleDelete = async () => {
    if (!proposalToDelete) return;
    try {
      await api.delete(`/proposals/${proposalToDelete.id}`);
      toast.success('Proposta excluída com sucesso');
      fetchProposals();
    } catch (error) {
      toast.error('Erro ao excluir proposta');
    } finally {
      setProposalToDelete(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Rascunho': return isDarkMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Enviada': return isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200';
      case 'Aprovada': return isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-600 border-green-200';
      case 'Recusada': return isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200';
      default: return isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600';
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Header */}
          <div className={`mt-8 mb-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-6 transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <FileText className="text-amber-500" size={28} />
                  Propostas Comerciais
                </h2>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Crie, gerencie e envie propostas para seus clientes</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                <div className={`flex border rounded-lg p-1 transition-colors ${
                  isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-50 border-slate-100'
                }`}>
                  {[
                    { label: 'Todas', val: 'all' },
                    { label: 'Rascunho', val: 'Rascunho' },
                    { label: 'Enviada', val: 'Enviada' },
                    { label: 'Aprovada', val: 'Aprovada' },
                    { label: 'Recusada', val: 'Recusada' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => { setFilter(btn.val); setPage(1); }}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                        filter === btn.val 
                        ? (isDarkMode ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm')
                        : (isDarkMode ? 'text-zinc-600 hover:text-zinc-400' : 'text-slate-400 hover:text-slate-600')
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar proposta ou cliente..."
                    className={`w-full border rounded-lg py-2 pl-10 pr-4 text-xs font-semibold outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-black border-white/5 text-white focus:border-amber-500' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-amber-500'
                    }`}
                  />
                </div>

                <Link to="/propostas/nova">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg cursor-pointer transition-all ${
                      isDarkMode ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                    }`}
                  >
                    <Plus size={16} />
                    Nova Proposta
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={`rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Nmero</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Cliente</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Data</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] text-right ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Valor Total</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}></th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className={`w-6 h-6 border-2 border-t-amber-500 rounded-full animate-spin ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'}`}></div>
                          <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Carregando propostas...</p>
                        </div>
                      </td>
                    </tr>
                  ) : errorMsg ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-red-500 text-sm font-medium">{errorMsg}</td>
                    </tr>
                  ) : proposals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className={`w-16 h-16 border rounded-2xl flex items-center justify-center transition-colors ${
                            isDarkMode ? 'bg-black/20 border-white/5 text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-300'
                          }`}>
                            <FileText size={32} />
                          </div>
                          <div className="space-y-1">
                            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'}`}>Nenhuma proposta encontrada</h3>
                            <p className={`text-xs font-medium ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Crie sua primeira proposta comercial.</p>
                          </div>
                          <Link to="/propostas/nova">
                            <button className={`mt-4 border px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mx-auto ${
                              isDarkMode 
                                ? 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-amber-500 hover:border-amber-500/50' 
                                : 'bg-white border-slate-200 text-slate-600 hover:text-amber-500 hover:border-amber-500'
                            }`}>
                              <Plus size={14} />
                              Criar Primeira Proposta
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : proposals.map((item, idx) => {
                    const items = (item.items || []) as any[];
                    const subtotal = items.reduce((sum: number, i: any) => sum + (parseFloat(i.total) || 0), 0);
                    const totalGeral = subtotal + (item.shipping_cost || 0);

                    return (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`transition-all group ${isDarkMode ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-slate-50/50 text-slate-700'}`}
                    >
                      <td className="px-6 py-5">
                        <span className={`text-sm font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{item.proposal_number}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.client_name}</span>
                          {item.contact_person && (
                            <span className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{item.contact_person}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                          {new Date(item.proposal_date).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {formatCurrency(totalGeral)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/propostas/visualizar/${item.id}`}>
                            <motion.button whileHover={{ scale: 1.15 }} title="Visualizar"
                              className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-blue-500/20 hover:text-blue-400' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-500'}`}>
                              <Eye size={15} />
                            </motion.button>
                          </Link>
                          <Link to={`/propostas/editar/${item.id}`}>
                            <motion.button whileHover={{ scale: 1.15 }} title="Editar"
                              className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-emerald-500/20 hover:text-emerald-400' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}>
                              <Edit size={15} />
                            </motion.button>
                          </Link>
                          <motion.button whileHover={{ scale: 1.15 }} title="Clonar"
                            onClick={() => handleClone(item)}
                            className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-purple-500/20 hover:text-purple-400' : 'text-slate-400 hover:bg-purple-50 hover:text-purple-500'}`}>
                            <Copy size={15} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.15 }} title="Enviar por Email"
                            onClick={() => setProposalToSend({ id: item.id, name: item.client_name, email: item.email })}
                            className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-amber-500/20 hover:text-amber-400' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-500'}`}>
                            <Send size={15} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.15 }} title="Baixar PDF"
                            onClick={() => window.open(`/propostas/visualizar/${item.id}?download=true`, '_blank')}
                            className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-red-500/20 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                            <Download size={15} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.15 }} title="Deletar"
                            onClick={() => setProposalToDelete({ id: item.id, name: item.client_name })}
                            className={`p-1.5 rounded transition-all ${isDarkMode ? 'text-zinc-600 hover:bg-red-600/20 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                            <Trash2 size={15} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  )})}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'
            }`}>
              <div className={`text-xs font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                Mostrando <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{proposals.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> a <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{Math.min(page * pageSize, totalCount)}</span> de <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{totalCount}</span> propostas
              </div>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}>
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded font-bold text-xs transition-colors ${
                        page === i + 1 
                          ? (isDarkMode ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm') 
                          : (isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'hover:bg-white text-slate-500')
                      }`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Send Email Modal */}
      <AnimatePresence>
        {proposalToSend && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <Send size={20} className="text-amber-500" />
                  <h3 className={`font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Enviar Proposta</h3>
                </div>
                <button onClick={() => setProposalToSend(null)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-200'}`}>
                  <X size={20} />
                </button>
              </div>
              <div className="p-8">
                <p className={`text-sm mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Enviar proposta para <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{proposalToSend.name}"</span>?
                </p>
                <p className={`text-xs font-mono ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{proposalToSend.email}</p>
              </div>
              <div className={`p-6 border-t flex justify-end gap-3 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <button onClick={() => setProposalToSend(null)}
                  className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'}`}>
                  Cancelar
                </button>
                <button onClick={handleSendEmail} disabled={isSending}
                  className="px-6 py-2.5 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 flex items-center gap-2">
                  {isSending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} /> Enviar</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {proposalToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} className="text-red-500" />
                </div>
                <h4 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Excluir Proposta?</h4>
                <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  A proposta <span className={`font-bold ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>"{proposalToDelete.name}"</span> ser removida permanentemente.
                </p>
              </div>
              <div className={`p-6 border-t flex justify-end gap-3 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <button onClick={() => setProposalToDelete(null)}
                  className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Cancelar
                </button>
                <button onClick={handleDelete}
                  className="px-6 py-2.5 text-white rounded-lg text-xs font-black uppercase tracking-widest bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
