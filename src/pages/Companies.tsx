import { motion } from 'motion/react';
import { 
  Building2, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  Edit,
  Trash2,
  Key,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';

export default function Companies() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [filter, setFilter] = useState('30d');
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/companies?page=${page}&pageSize=${pageSize}`);
      setCompanies(response.data || []);
      setTotalCount(response.count || 0);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      setErrorMsg(error.message || 'Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();

    // Auto-refresh when user returns to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchCompanies();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [page, pageSize, filter]);
  
  const [companyToResetPassword, setCompanyToResetPassword] = useState<{id: string, name: string, email: string} | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetPassword = async () => {
    if (!companyToResetPassword) return;
    
    setIsResetting(true);
    try {
      await api.post(`/companies/${companyToResetPassword.id}/reset-password`, {
        password: '123456'
      });
      
      toast.success('Senha resetada com sucesso!', {
        description: `A nova senha de acesso da empresa "${companyToResetPassword.name}" agora é 123456`
      });
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);
      toast.error('Erro ao resetar senha da empresa', {
        description: error.message || 'Tente novamente.'
      });
    } finally {
      setIsResetting(false);
      setCompanyToResetPassword(null);
    }
  };

  const [companyToDelete, setCompanyToDelete] = useState<{id: string, name: string} | null>(null);

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await api.delete(`/companies/${companyToDelete.id}`);
      toast.success('Empresa excluída com sucesso');
      fetchCompanies();
    } catch (error) {
      console.error("Erro ao excluir", error);
      toast.error('Erro ao excluir empresa');
    } finally {
      setCompanyToDelete(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Header & Actions */}
          <div className={`mt-8 mb-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-6 transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <Building2 className="text-[#0b82ff]" size={28} />
                  Gestão de Empresas
                </h2>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Visualize e gerencie todos os clientes cadastrados no portal</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                 <div className={`flex border rounded-lg p-1 transition-colors ${
                  isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-50 border-slate-100'
                 }`}>
                  {[
                    { label: '7D', val: '7d' },
                    { label: '30D', val: '30d' },
                    { label: '90D', val: '90d' },
                    { label: 'Período', val: 'custom' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      onClick={() => setFilter(btn.val)}
                      className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                        filter === btn.val 
                        ? (isDarkMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-[#0b82ff] shadow-sm')
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
                    placeholder="Buscar empresa ou CNPJ..."
                    className={`w-full border rounded-lg py-2 pl-10 pr-4 text-xs font-semibold outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-black border-white/5 text-white focus:border-blue-500' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                    }`}
                  />
                </div>

                <Link to="/empresas/novo">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg cursor-pointer transition-all ${
                      isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20' : 'bg-[#0b82ff] text-white hover:bg-blue-600 shadow-blue-500/20'
                    }`}
                  >
                    <Plus size={16} />
                    Nova Empresa
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>

          {/* Companies Table */}
          <div className={`rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                      <div className="flex items-center gap-2">
                        Empresa / Razão Social
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Responsável</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Contato</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>UF</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Cadastro</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] text-center ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>TERM</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}></th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className={`w-6 h-6 border-2 border-t-[#0b82ff] rounded-full animate-spin ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'}`}></div>
                          <p className="text-sm font-medium">Carregando empresas...</p>
                        </div>
                      </td>
                    </tr>
                  ) : errorMsg ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-red-500 text-sm font-medium">
                        {errorMsg}
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className={`w-16 h-16 border rounded-2xl flex items-center justify-center transition-colors ${
                            isDarkMode ? 'bg-black/20 border-white/5 text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-300'
                          }`}>
                            <Building2 size={32} />
                          </div>
                          <div className="space-y-1">
                            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'}`}>Nenhuma empresa encontrada</h3>
                            <p className={`text-xs font-medium ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Você ainda não possui empresas cadastradas no banco de dados.</p>
                          </div>
                          <Link to="/empresas/novo">
                            <button className={`mt-4 border px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mx-auto ${
                              isDarkMode 
                                ? 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-blue-500 hover:border-blue-500/50' 
                                : 'bg-white border-slate-200 text-slate-600 hover:text-[#0b82ff] hover:border-[#0b82ff]'
                            }`}>
                              <Plus size={14} />
                              Cadastrar Primeira Empresa
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : companies.map((item, idx) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`transition-all group ${isDarkMode ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-slate-50/50 text-slate-700'}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.empresa}</span>
                          <span className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{item.cnpj}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold">{item.responsavel}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <Mail size={12} className="text-[#0b82ff]" />
                            {item.email}
                          </div>
                          <div className={`flex items-center gap-2 text-[11px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-300'}`}>
                            <Phone size={12} />
                            {item.telefone || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                          <MapPin size={12} className={isDarkMode ? 'text-zinc-600' : 'text-slate-300'} />
                          {item.estado || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                          <Calendar size={12} />
                          {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`text-xs font-black px-3 py-1 rounded-full border transition-colors ${
                          isDarkMode ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' : 'bg-blue-50 text-[#0b82ff] border border-blue-100'
                        }`}>
                          {item.max_terminals || 1}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          item.status === 'Ativo' 
                            ? (isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600') 
                            : (isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600')
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            onClick={() => setCompanyToResetPassword({ id: item.id, name: item.empresa, email: item.email })}
                            title="Resetar Senha"
                            className={`p-1 px-2 rounded transition-all cursor-pointer flex items-center justify-center border border-transparent ${
                              isDarkMode ? 'text-zinc-600 hover:bg-amber-600 hover:text-white' : 'text-slate-400 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                            }`}
                          >
                             <Key size={16} />
                          </motion.button>
                          <Link to={`/empresas/editar/${item.id}`}>
                            <motion.button 
                              whileHover={{ scale: 1.1 }}
                              className={`p-1 px-2 rounded transition-all cursor-pointer flex items-center justify-center border border-transparent ${
                                isDarkMode ? 'text-zinc-600 hover:bg-blue-600 hover:text-white' : 'text-slate-400 hover:bg-[#0b82ff] hover:text-white hover:border-[#0b82ff]'
                              }`}
                            >
                               <Edit size={16} />
                            </motion.button>
                          </Link>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            onClick={() => setCompanyToDelete({ id: item.id, name: item.empresa })}
                            className={`p-1 px-2 rounded transition-all cursor-pointer flex items-center justify-center border border-transparent ${
                              isDarkMode ? 'text-zinc-600 hover:bg-red-600 hover:text-white' : 'text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500'
                            }`}
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className={`p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'
            }`}>
               <div className={`text-xs font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}> Mostrando <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{companies.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> a <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{Math.min(page * pageSize, totalCount)}</span> de <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{totalCount}</span> empresas cadastradas</div>
               <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded font-bold text-xs transition-colors ${
                        page === i + 1 
                          ? (isDarkMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#0b82ff] text-white shadow-sm') 
                          : (isDarkMode ? 'text-zinc-500 hover:bg-white/5' : 'hover:bg-white text-slate-500')
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Apagar Empresa</h3>
              <p className={isDarkMode ? 'text-zinc-400 mb-6' : 'text-slate-600 mb-6'}>
                Tem certeza que deseja apagar a empresa <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{companyToDelete.name}"</span>? 
                Esta ação não pode ser desfeita e pode afetar outras informações vinculadas a ela.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setCompanyToDelete(null)}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteCompany}
                  className="px-4 py-2 font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                >
                  Apagar Empresa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {companyToResetPassword && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-amber-600 ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-100'}`}>
                  <Key size={20} />
                </div>
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Resetar Senha</h3>
              </div>
              <p className={isDarkMode ? 'text-zinc-400 mb-6' : 'text-slate-600 mb-6'}>
                Tem certeza que deseja resetar a senha da empresa <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>"{companyToResetPassword.name}"</span>? 
                A senha será alterada para o padrão <span className="font-black text-[#0b82ff]">123456</span>.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  disabled={isResetting}
                  onClick={() => setCompanyToResetPassword(null)}
                  className={`px-4 py-2 font-medium rounded-lg transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  disabled={isResetting}
                  onClick={handleResetPassword}
                  className="px-6 py-2 font-black uppercase text-[10px] tracking-widest text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isResetting ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Key size={14} />
                  )}
                  Resetar para 123456
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
