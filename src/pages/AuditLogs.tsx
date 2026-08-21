import { motion } from 'motion/react';
import {
  History,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  X,
  User as UserIcon,
  MonitorSmartphone,
} from 'lucide-react';
import { MenuCards } from '../components/MenuCards';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { format, parseISO } from 'date-fns';

const PAGE_SIZE = 20;

const ACTION_META: Record<string, { label: string; badge: string }> = {
  'campaign.create': { label: 'Campanha criada', badge: 'create' },
  'campaign.update': { label: 'Campanha editada', badge: 'update' },
  'campaign.delete': { label: 'Campanha excluída', badge: 'delete' },
  'campaign.reset': { label: 'Campanha resetada', badge: 'reset' },
  'terminal.create': { label: 'Terminal criado', badge: 'create' },
  'terminal.update': { label: 'Terminal editado', badge: 'update' },
  'terminal.delete': { label: 'Terminal excluído', badge: 'delete' },
  'terminal.password_reset': { label: 'Senha de terminal alterada', badge: 'password' },
  'company.create': { label: 'Empresa criada', badge: 'create' },
  'company.update': { label: 'Empresa editada', badge: 'update' },
  'company.delete': { label: 'Empresa excluída', badge: 'delete' },
  'company.password_reset': { label: 'Senha de empresa alterada', badge: 'password' },
  'company.status': { label: 'Status da empresa alterado', badge: 'status' },
  'auth.login': { label: 'Login na plataforma', badge: 'login' },
  'terminal.login': { label: 'Login no terminal', badge: 'login' },
};

const BADGE_STYLES: Record<string, { light: string; dark: string }> = {
  create: { light: 'bg-emerald-50 text-emerald-600 border-emerald-100', dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  update: { light: 'bg-blue-50 text-blue-600 border-blue-100', dark: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delete: { light: 'bg-red-50 text-red-600 border-red-100', dark: 'bg-red-500/10 text-red-400 border-red-500/20' },
  reset: { light: 'bg-orange-50 text-orange-600 border-orange-100', dark: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  password: { light: 'bg-amber-50 text-amber-600 border-amber-100', dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  status: { light: 'bg-purple-50 text-purple-600 border-purple-100', dark: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  login: { light: 'bg-indigo-50 text-indigo-600 border-indigo-100', dark: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
};

const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

interface AuditEntry {
  id: string;
  actor_type: string;
  actor_label: string;
  company_email: string | null;
  company_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: any;
  ip: string | null;
  success: boolean;
  created_at: string;
}

function describeDetails(entry: AuditEntry): string {
  const d = entry.details || {};
  if (d.reason) return String(d.reason);
  if (d.changed) {
    const keys = Object.keys(d.changed);
    return keys.length > 0 ? `Campos: ${keys.join(', ')}` : '';
  }
  if (d.status) return `Status: ${d.status}`;
  return '';
}

export default function AuditLogs() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companies, setCompanies] = useState<{ email: string; name: string }[]>([]);

  const totalPagesMemo = useMemo(() => totalPages, [totalPages]);

  const buildQuery = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('pageSize', String(PAGE_SIZE));
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (actionFilter) params.set('action', actionFilter);
    if (companyFilter.trim()) params.set('company', companyFilter.trim());
    if (successFilter) params.set('success', successFilter);
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    return params.toString();
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, companyFilter, successFilter, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    const fetchCompanies = async () => {
      try {
        const data = await api.get('/admin/logs/companies');
        if (!cancelled) setCompanies(data.companies || []);
      } catch (err) {
        console.error('Erro ao carregar empresas do filtro', err);
      }
    };
    fetchCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/admin/logs?${buildQuery(page)}`);
        if (cancelled) return;
        setEntries(data.data || []);
        setCount(data.count || 0);
        setTotalPages(Math.max(1, Math.ceil((data.count || 0) / PAGE_SIZE)));
      } catch (err) {
        console.error('Erro ao carregar logs', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, actionFilter, companyFilter, successFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setCompanyFilter('');
    setSuccessFilter('');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters = searchQuery || actionFilter || companyFilter || successFilter || startDate || endDate;

  const fieldClass = `w-full border rounded-md px-2 py-2 text-sm outline-none h-10 transition-colors ${
    isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-[#f8fafb] border-slate-200 text-slate-600 focus:border-slate-400'
  }`;

  const selectClass = `${fieldClass} appearance-none cursor-pointer`;

  const labelClass = `text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`;

  const getBadge = (action: string) => {
    const meta = ACTION_META[action];
    const badge = BADGE_STYLES[meta?.badge || 'update'];
    return {
      label: meta?.label || action,
      className: `inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
        isDarkMode ? badge.dark : badge.light
      }`,
    };
  };

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
                  <History className="text-[#0b82ff]" size={28} />
                  Logs de Auditoria
                </h2>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Histórico das ações das empresas: campanhas, terminais, resets e logins
                </p>
              </div>
            </div>

            <div className="flex flex-wrap lg:grid lg:grid-cols-6 items-end gap-4">
              <div className="flex flex-col space-y-1.5 min-w-[180px] flex-1 lg:flex-none">
                <label className={labelClass}>Buscar:</label>
                <input
                  placeholder="Quem fez ou entidade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[160px] flex-1 lg:flex-none">
                <label className={labelClass}>Empresa:</label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todas as empresas</option>
                  {companies.map((c) => (
                    <option key={c.email} value={c.email}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[160px] flex-1 lg:flex-none">
                <label className={labelClass}>Ação:</label>
                <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
                  <option value="">Todas as ações</option>
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[150px] flex-1 lg:flex-none">
                <label className={labelClass}>Status:</label>
                <select value={successFilter} onChange={(e) => setSuccessFilter(e.target.value)} className={selectClass}>
                  <option value="">Sucesso / Falha</option>
                  <option value="true">Somente sucesso</option>
                  <option value="false">Somente falhas</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[140px] flex-1 lg:flex-none">
                <label className={labelClass}>Data Inicial:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="flex flex-col space-y-1.5 min-w-[140px] flex-1 lg:flex-none">
                <label className={labelClass}>Data Final:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={fieldClass}
                />
              </div>

              {hasFilters && (
                <div className="flex flex-col space-y-1.5 min-w-[120px] flex-1 lg:flex-none">
                  <label className={`hidden lg:block text-[10px] font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'} tracking-widest opacity-0`}>Ações:</label>
                  <button
                    onClick={clearFilters}
                    className={`flex items-center justify-center gap-1.5 h-10 px-4 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors cursor-pointer ${
                      isDarkMode
                        ? 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                        : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <X size={14} /> Limpar
                  </button>
                </div>
              )}
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
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Data / Hora</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Empresa</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Quem</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Ação</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Entidade</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>IP</th>
                    <th className={`px-6 py-4 text-[11px] font-black uppercase tracking-[.2em] text-center ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Loader2 className="animate-spin mb-4" size={32} />
                          <p className="font-black text-xs uppercase tracking-widest">Carregando logs...</p>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <History size={48} className="mb-4 opacity-20" />
                          <p className="font-black text-sm uppercase tracking-widest opacity-40">Nenhum registro encontrado</p>
                          {hasFilters && (
                            <button onClick={clearFilters} className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#0b82ff] cursor-pointer">
                              Limpar filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => {
                      const badge = getBadge(entry.action);
                      const detail = describeDetails(entry);
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                          className={`transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {entry.created_at ? format(parseISO(entry.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                              </span>
                              <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>BRT</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-200' : 'text-slate-700'}`}>
                              {entry.company_name || entry.company_email || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-zinc-200' : 'text-slate-700'}`}>
                                {entry.actor_type === 'terminal'
                                  ? <MonitorSmartphone size={13} className="text-orange-500" />
                                  : <UserIcon size={13} className="text-slate-400" />}
                                {entry.actor_label}
                              </span>
                              <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                                {entry.actor_type === 'terminal' ? 'Kiosk' : 'Plataforma'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={badge.className}>{badge.label}</span>
                            {detail && (
                              <div className={`mt-1 text-[10px] font-semibold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{detail}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                              {entry.entity_name || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                              {entry.ip || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
                              entry.success
                                ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                                : (isDarkMode ? 'text-red-400' : 'text-red-600')
                            }`}>
                              <ShieldCheck size={13} />
                              {entry.success ? 'OK' : 'Falha'}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 transition-colors ${
              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/30 border-slate-100'
            }`}>
              <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                <Filter size={16} />
                {count} registro{count === 1 ? '' : 's'} no total
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={`text-xs font-bold px-3 ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Página {page} de {totalPagesMemo}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPagesMemo, page + 1))}
                  disabled={page >= totalPagesMemo}
                  className={`p-2 border rounded disabled:opacity-50 transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700' : 'border-slate-200 text-slate-400 hover:bg-white'
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className={`mt-6 flex items-center gap-2 text-[11px] font-semibold ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
            <Clock size={14} />
            Logs com mais de 90 dias são removidos automaticamente. Senhas nunca são registradas.
          </div>
        </div>
      </main>
    </>
  );
}
