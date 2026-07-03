import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Wifi, 
  Search, 
  Calendar, 
  ChevronDown, 
  Building2, 
  Tag, 
  Clock, 
  BarChart3,
  Filter,
  ArrowUpDown,
  X,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { format, isToday, parseISO, addYears, isAfter, subDays } from 'date-fns';

interface TrackingTerminal {
  id: string;
  qtdRegistro: number;
  responsavel: string;
  contato: string;
  plano: string;
  admissao: string;
  vencimento: string;
  campanha: string;
  terminal: string;
  dataUltimoRegistro: string | null;
  status: 'online' | 'offline';
}

export default function OnlineTracking() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [filter, setFilter] = useState('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const [loading, setLoading] = useState(true);
  const [allTerminals, setAllTerminals] = useState<any[]>([]);
  const [allResponses, setAllResponses] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [campaignsMap, setCampaignsMap] = useState<Record<string, string>>({});
  const [companiesMap, setCompaniesMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;

    const fetchBaseData = async () => {
      try {
        setLoading(true);
        
        const data = await api.get('/admin/tracking');

        // 1. Map Profiles
        let pMap: Record<string, any> = {};
        if (data.profiles) {
          data.profiles.forEach((p: any) => pMap[p.id] = p);
        }
        setProfilesMap(pMap);

        // 2. Map Companies
        let compMap: Record<string, any> = {};
        if (data.companies) {
          data.companies.forEach((c: any) => {
            if (c.empresa) compMap[c.empresa] = c;
          });
        }
        setCompaniesMap(compMap);

        // 3. Set Terminals
        if (!data.terminals || data.terminals.length === 0) {
          setLoading(false);
          return;
        }
        setAllTerminals(data.terminals);

        // 4. Map Campaigns
        const cMap: Record<string, string> = {};
        if (data.campaigns) {
          data.campaigns.forEach((c: any) => cMap[c.id] = c.name);
        }
        setCampaignsMap(cMap);

        // 5. Set Responses
        if (data.responses) {
          setAllResponses(data.responses);
        }
      } catch (err) {
        console.error('Error fetching data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBaseData();
  }, [user]);

  const trackingData = useMemo(() => {
    // Determine the start date for filtering responses visually
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let startDate: Date | null = null;
    
    if (filter === 'today') startDate = todayStart;
    if (filter === '7d') startDate = subDays(todayStart, 7);
    if (filter === '30d') startDate = subDays(todayStart, 30);
    if (filter === '90d') startDate = subDays(todayStart, 90);

    const responsesByTerminal: Record<string, any[]> = {};
    const latestInteractionByTerminal: Record<string, any> = {};

    allResponses.forEach(r => {
      const respDate = parseISO(r.created_at);
      
      // Keep track of the absolute latest response for status calculation (Online = Today)
      if (!latestInteractionByTerminal[r.terminal_id] || isAfter(respDate, parseISO(latestInteractionByTerminal[r.terminal_id].created_at))) {
        latestInteractionByTerminal[r.terminal_id] = r;
      }

      // Filter responses by period
      if (!startDate || respDate.getTime() >= startDate.getTime()) {
        if (!responsesByTerminal[r.terminal_id]) responsesByTerminal[r.terminal_id] = [];
        responsesByTerminal[r.terminal_id].push(r);
      }
    });

    const tData: TrackingTerminal[] = allTerminals.map(t => {
      const filteredResps = responsesByTerminal[t.id] || [];
      const absoluteLatest = latestInteractionByTerminal[t.id];
      const isOnline = absoluteLatest ? isToday(parseISO(absoluteLatest.created_at)) : false;
      
      let termCampaigns = t.campaigns || 'N/A';
      
      const userProfile = profilesMap[t.user_id] || {};
      const responsavel = userProfile.empresa || 'N/A';
      const contato = userProfile.responsavel || userProfile.nome || userProfile.name || 'N/A';
      
      const companyInfo = companiesMap[userProfile.empresa] || {};
      let planStatus = companyInfo.plano || userProfile.plano || 'N/A';
      
      // Normalize plan name
      if (planStatus.toUpperCase() === 'TESTE 7 DIAS') {
        planStatus = '7 DIAS';
      }

      const vencimento = companyInfo.vencimento || userProfile.vencimento || (t.created_at ? format(addYears(parseISO(t.created_at), 1), 'dd/MM/yyyy') : 'N/A');

      // Sort responses in the period to show the latest for the "Visto em" column
      filteredResps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latestInPeriod = filteredResps[0];

      return {
        id: t.id,
        qtdRegistro: filteredResps.length,
        responsavel,
        contato,
        plano: planStatus,
        admissao: t.created_at ? format(parseISO(t.created_at), 'dd/MM/yyyy') : 'N/A',
        vencimento,
        campanha: termCampaigns,
        terminal: t.name,
        dataUltimoRegistro: latestInPeriod ? format(parseISO(latestInPeriod.created_at), 'dd/MM/yyyy HH:mm') : null,
        status: (isOnline ? 'online' : 'offline') as 'online' | 'offline'
      };
    }).filter(t => {
      // If a terminal had NO interactions in the filtered period, hide it (as per user request)
      // Unless the filter is "custom" or we want all terminals? 
      // User said: "if I click today and it still shows yesterday's data, it's wrong"
      return t.qtdRegistro > 0;
    });

    // Filtering by Search Query
    let filteredData = tData;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filteredData = tData.filter(d => 
        d.terminal.toLowerCase().includes(q) || 
        d.responsavel.toLowerCase().includes(q) ||
        d.campanha.toLowerCase().includes(q)
      );
    }

    filteredData.sort((a, b) => {
      if (a.status === 'online' && b.status === 'offline') return -1;
      if (a.status === 'offline' && b.status === 'online') return 1;
      if (a.dataUltimoRegistro && b.dataUltimoRegistro) {
        return b.dataUltimoRegistro.localeCompare(a.dataUltimoRegistro);
      }
      if (a.dataUltimoRegistro) return -1;
      if (b.dataUltimoRegistro) return 1;
      return b.qtdRegistro - a.qtdRegistro;
    });

    return filteredData;
  }, [allTerminals, allResponses, filter, searchQuery, profilesMap, campaignsMap, companiesMap]);

  // Derived Stats
  const totalRegistros = trackingData.reduce((acc, current) => acc + current.qtdRegistro, 0);
  const onlineCount = trackingData.filter(t => t.status === 'online').length;
  const onlinePercentage = trackingData.length > 0 ? Math.round((onlineCount / trackingData.length) * 100) : 0;

  const getPlanStyles = (plan: string) => {
    const p = plan.toLowerCase();
    if (isDarkMode) {
      if (p.includes('anual')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      if (p.includes('mensal')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      if (p.includes('7 dias') || p.includes('teste')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      if (p.includes('livre')) return 'bg-zinc-800 text-zinc-400 border-white/5';
      if (p.includes('premium')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      if (p.includes('master')) return 'bg-red-500/10 text-red-400 border-red-500/20';
      return 'bg-zinc-800 text-zinc-400 border-white/5';
    }

    if (p.includes('anual')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (p.includes('mensal')) return 'bg-blue-50 text-blue-600 border-blue-100';
    if (p.includes('7 dias') || p.includes('teste')) return 'bg-orange-50 text-orange-600 border-orange-100';
    if (p.includes('livre')) return 'bg-slate-50 text-slate-600 border-slate-100';
    if (p.includes('premium')) return 'bg-purple-50 text-purple-600 border-purple-100';
    if (p.includes('master')) return 'bg-red-50 text-red-600 border-red-100';
    
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  // Pagination Logic
  const totalPages = Math.ceil(trackingData.length / itemsPerPage);
  const offset = (currentPage - 1) * itemsPerPage;
  const currentItems = trackingData.slice(offset, offset + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset page on filter changes
  }, [filter, searchQuery]);

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          <MenuCards />

          {/* Header & Filters */}
          <div className={`mt-8 mb-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-6 space-y-6 transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  <div className="relative">
                    <Wifi className="text-green-500" size={28} />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  Tracking de Terminais Online
                </h2>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Monitoramento em tempo real de registros e conexões</p>
              </div>
            </div>

            <div className="flex justify-between items-center relative">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex border rounded-lg p-1 transition-colors ${
                  isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-50 border-slate-100'
                }`}>
                  {[
                    { label: 'Hoje', val: 'today' },
                    { label: '7 Dias', val: '7d' },
                    { label: '30 Dias', val: '30d' },
                    { label: '90 Dias', val: '90d' },
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
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    placeholder="Pesquisar terminal..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`border rounded-lg py-2 pl-10 pr-4 text-xs font-semibold outline-none w-64 transition-all ${
                      isDarkMode 
                        ? 'bg-black border-white/5 text-white focus:border-blue-500' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className={`rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                      <div className="flex items-center gap-2">
                        Terminal / Campanha
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Empresa / Responsável</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] text-center ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Registros</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Plano</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Adm. / Vencimento</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Visto em</th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Loader2 className="animate-spin mb-4" size={32} />
                          <p className="font-black text-xs uppercase tracking-widest">Carregando dispositivos...</p>
                        </div>
                      </td>
                    </tr>
                  ) : currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Wifi size={48} className="mb-4 opacity-20" />
                          <p className="font-black text-sm uppercase tracking-widest opacity-40">Nenhum terminal encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((item, idx) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              <span className={`w-2 h-2 rounded-full ${item.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                              {item.terminal}
                            </span>
                            <span className={`text-[10px] font-bold flex items-center gap-1 mt-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                              <Tag size={10} />
                              {item.campanha}
                            </span>
                          </div>
                        </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-zinc-200' : 'text-slate-700'}`}>
                            <Building2 size={14} className="text-slate-300" />
                            {item.responsavel}
                          </span>
                          <span className={`text-[10px] font-medium ml-5 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{item.contato}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-lg font-black text-[#0b82ff]">{item.qtdRegistro}</span>
                          <span className={`text-[9px] font-black uppercase tracking-tighter ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`}>Acumulado</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${getPlanStyles(item.plano)}`}>
                          {item.plano}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col text-[11px] font-bold">
                          <div className={`flex items-center gap-1.5 ${isDarkMode ? 'text-emerald-500/80' : 'text-slate-500'}`}>
                             <Clock size={12} className={isDarkMode ? 'text-emerald-500' : 'text-[#4cc077]'} />
                             {item.admissao}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                             <Calendar size={12} />
                             {item.vencimento}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         {item.dataUltimoRegistro ? (
                           <div className="flex flex-col">
                             <span className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.dataUltimoRegistro.split(' ')[1]}</span>
                             <span className={`text-[10px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{item.dataUltimoRegistro.split(' ')[0]}</span>
                           </div>
                         ) : (
                           <span className={`text-[10px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Sem registros</span>
                         )}
                      </td>
                    </motion.tr>
                  )))}
                </tbody>
              </table>
            </div>

            {/* Pagination / Summary */}
            <div className={`p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/30 border-slate-100'
            }`}>
              <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                <BarChart3 size={16} />
                Mostrando <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{currentItems.length}</span> de <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-700'}>{trackingData.length}</span> terminais registrados
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                   key={page}
                   onClick={() => handlePageChange(page)}
                   className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                     currentPage === page 
                     ? (isDarkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-[#0b82ff] text-white shadow-md')
                     : (isDarkMode ? 'text-zinc-600 hover:bg-zinc-800' : 'text-slate-500 hover:bg-white')
                   }`}
                 >
                   {page}
                 </button>
                  ))}
                </div>
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
             <div className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
             }`}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-green-500 transition-colors ${
                isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
               }`}>
                 <Wifi size={24} />
               </div>
               <div>
                 <span className={`text-[10px] font-black uppercase tracking-[.2em] block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status Ativo</span>
                 <h4 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{onlinePercentage}% Online</h4>
               </div>
             </div>
             <div className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
             }`}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[#0b82ff] transition-colors ${
                isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
               }`}>
                 <BarChart3 size={24} />
               </div>
               <div>
                 <span className={`text-[10px] font-black uppercase tracking-[.2em] block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Volume Total</span>
                 <h4 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{totalRegistros} Registros</h4>
               </div>
             </div>
             <div className={`p-6 rounded-xl shadow-sm border flex items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
             }`}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-purple-500 transition-colors ${
                isDarkMode ? 'bg-purple-500/10' : 'bg-purple-50'
               }`}>
                 <Filter size={24} />
               </div>
               <div>
                 <span className={`text-[10px] font-black uppercase tracking-[.2em] block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Crescimento</span>
                 <h4 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>+12% vs Anterior</h4>
               </div>
             </div>
          </div>

        </div>

      </main>
    </>
  );
}
