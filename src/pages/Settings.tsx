import React, { useState } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Globe, 
  Moon, 
  Sun, 
  Mail, 
  MessageSquare, 
  Lock, 
  Save,
  Database,
  Smartphone,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';

import { useTheme } from '../contexts/ThemeContext';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'geral' | 'notificacoes' | 'seguranca' | 'integracoes'>('geral');
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const handleSave = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
      loading: 'Salvando configurações...',
      success: 'Configurações atualizadas com sucesso!',
      error: 'Erro ao salvar alterações.',
    });
  };

  const tabs = [
    { id: 'geral', label: 'Geral', icon: Globe },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
    { id: 'integracoes', label: 'Integrações', icon: Cpu },
  ];

  return (
    <>
      <Breadcrumbs />
      <main className="max-w-[1170px] mx-auto px-6 min-[1170px]:px-0 py-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? (isDarkMode ? 'bg-white text-black' : 'bg-black text-white shadow-lg shadow-black/10') 
                    : (isDarkMode ? 'text-zinc-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-black hover:bg-slate-50')
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className={`flex-1 rounded-3xl border shadow-sm overflow-hidden flex flex-col transition-colors ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'}`}>
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <h1 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Configurações</h1>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Gerencie suas preferências de sistema</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                className="bg-[#0b82ff] text-white px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Save size={14} />
                Salvar
              </motion.button>
            </div>

            <div className="p-8">
              {activeTab === 'geral' && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Interface e Tema</h3>
                      <div className={`p-4 rounded-2xl flex items-center justify-between ${isDarkMode ? 'bg-black/50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white text-slate-800'}`}>
                            {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                          </div>
                          <div>
                            <p className={`text-[11px] font-black uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Modo Escuro</p>
                            <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Ativar tema dark</p>
                          </div>
                        </div>
                        <button 
                          onClick={toggleTheme}
                          className={`w-10 h-5 rounded-full transition-colors relative ${isDarkMode ? 'bg-[#0b82ff]' : 'bg-slate-200'}`}
                        >
                          <motion.div 
                            animate={{ x: isDarkMode ? 22 : 2 }}
                            className="absolute top-1 w-3 h-3 bg-white rounded-full"
                          />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Idioma do Painel</h3>
                      <select className={`w-full border rounded-xl py-3 px-4 text-xs font-bold outline-none transition-all appearance-none cursor-pointer ${
                        isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black'
                      }`}>
                        <option>Português (Brasil)</option>
                        <option>English (US)</option>
                        <option>Español</option>
                      </select>
                    </div>
                  </div>

                  <div className={`pt-8 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Informações da Organização</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Fuso Horário</label>
                        <select className={`w-full border rounded-xl py-3 px-4 text-xs font-bold outline-none transition-all ${
                          isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black'
                        }`}>
                          <option>(GMT-03:00) Brasília</option>
                          <option>(GMT-05:00) New York</option>
                          <option>(GMT+00:00) London</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Moeda Padrão</label>
                        <select className={`w-full border rounded-xl py-3 px-4 text-xs font-bold outline-none transition-all ${
                          isDarkMode ? 'bg-black border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black'
                        }`}>
                          <option>BRL - Real Brasileiro</option>
                          <option>USD - Dólar Americano</option>
                          <option>EUR - Euro</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'notificacoes' && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { icon: Mail, label: 'E-mail Marketing', desc: 'Receba atualizações sobre novos recursos.' },
                      { icon: Bell, label: 'Alertas de Campanha', desc: 'Notificações quando uma campanha termina.' },
                      { icon: MessageSquare, label: 'Feedback Crítico', desc: 'Avise-me quando um cliente der nota baixa.' },
                      { icon: Smartphone, label: 'Status de Terminais', desc: 'Alertas de queda de conexão em totens.' },
                    ].map((item, i) => (
                      <div key={i} className={`p-5 rounded-2xl flex items-center justify-between transition-colors ${isDarkMode ? 'bg-black/50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors ${
                            isDarkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-slate-400'
                          }`}>
                            <item.icon size={18} />
                          </div>
                          <div>
                            <p className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-tight ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{item.desc}</p>
                          </div>
                        </div>
                        <button className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-[#0b82ff]' : 'bg-black'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'seguranca' && (
                <motion.div 
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="space-y-8"
                >
                  <div className={`p-6 rounded-2xl space-y-4 transition-colors ${isDarkMode ? 'bg-black/50' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                       <Lock size={16} className="text-[#0b82ff]" />
                       <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Autenticação em Dois Fatores</h3>
                    </div>
                    <p className={`text-[10px] font-bold uppercase leading-relaxed max-w-md ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                      Adicione uma camada extra de segurança à sua conta. Um código será solicitado toda vez que você fizer login.
                    </p>
                    <button className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                      isDarkMode ? 'bg-zinc-800 text-white border border-white/5 hover:bg-zinc-700' : 'bg-white border border-slate-100 text-black hover:bg-slate-50'
                    }`}>
                      Configurar 2FA
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 border rounded-2xl transition-colors ${isDarkMode ? 'border-white/5 bg-black/30' : 'border-slate-100'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Último Login</p>
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Há 12 minutos - Brasília, BR</p>
                    </div>
                    <div className={`p-4 border rounded-2xl transition-colors ${isDarkMode ? 'border-white/5 bg-black/30' : 'border-slate-100'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Dispositivos Ativos</p>
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>3 dispositivos agora</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'integracoes' && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {[
                    { name: 'WhatsApp API', desc: 'Envio de pesquisas via chat.', status: 'Conectado', color: 'bg-green-500' },
                    { name: 'Google Analytics', desc: 'Métricas de tráfego online.', status: 'Pendente', color: 'bg-amber-500' },
                    { name: 'Zapier', desc: 'Automação de workflows.', status: 'Conectado', color: 'bg-green-500' },
                    { name: 'Salesforce', desc: 'Sincronização de leads.', status: 'Inativo', color: 'bg-slate-300' },
                  ].map((app, i) => (
                    <div key={i} className={`p-4 border rounded-2xl transition-all cursor-pointer group ${
                      isDarkMode ? 'border-white/5 hover:border-white/20 bg-black/30' : 'border-slate-100 hover:border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          isDarkMode ? 'bg-zinc-800' : 'bg-slate-50 group-hover:bg-slate-100'
                        }`}>
                           <Database size={18} className={isDarkMode ? 'text-zinc-600' : 'text-slate-400'} />
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded text-white ${app.color}`}>
                          {app.status}
                        </span>
                      </div>
                      <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{app.name}</h4>
                      <p className={`text-[10px] font-bold uppercase tracking-tight ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{app.desc}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
