import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Save, 
  Megaphone, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  MessageSquare,
  Globe
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { MenuCards } from '../components/MenuCards';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  type: string;
  questions: any[];
}

const PlatformSettings: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>('none');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch all campaigns
      const camps = await api.get('/campaigns');
      
      // Filter for campaigns that have at least one question of type 'NPS'
      const filteredCamps = (camps || []).filter((camp: any) => 
        camp.type === 'NPS' || (Array.isArray(camp.questions) && camp.questions.some((q: any) => q.type === 'NPS'))
      );
      setCampaigns(filteredCamps);

      // 2. Fetch current setting
      const setting = await api.get('/platform-settings/global_nps_campaign_id');
      
      if (setting && setting.value) {
        if (setting.value.id) {
          setSelectedId(setting.value.id);
        } else if (typeof setting.value === 'string') {
          setSelectedId(setting.value);
        }
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // 1. Update platform settings (backend handles campaign sync now)
      await api.patch('/platform-settings/global_nps_campaign_id', { 
        value: { id: selectedId }
      });
      
      toast.success('Configurações salvas com sucesso');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
      <Breadcrumbs />
      <main className="max-w-[1170px] mx-auto p-6 min-[1170px]:px-0 space-y-8">
        <MenuCards />

        <div className={`rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors border ${
          isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
        }`}>
          {/* Header */}
          <div className={`p-8 border-b transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Globe size={24} />
              </div>
              <div>
                <h1 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Gerenciador de Feedback Global</h1>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Configure a campanha NPS que aparecerá para todos os usuários logados</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-10">
            {/* Setting Section */}
            <div className="max-w-2xl space-y-6">
              <div className="space-y-2">
                <label className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                  <Megaphone size={14} className="text-blue-500" />
                  Campanha NPS Ativa
                </label>
                <div className="relative">
                  <select
                    disabled={loading}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className={`w-full rounded-xl px-5 py-4 text-sm font-bold outline-none ring-offset-0 focus:ring-2 transition-all appearance-none cursor-pointer ${
                      isDarkMode 
                        ? 'bg-black border border-white/5 text-white focus:ring-white/10 focus:bg-black' 
                        : 'bg-slate-50 border border-slate-200 text-slate-700 focus:ring-blue-500 focus:bg-white'
                    }`}
                  >
                    <option value="none">Nenhuma campanha selecionada (Desativado)</option>
                    {campaigns.map(camp => (
                      <option key={camp.id} value={camp.id}>{camp.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Settings size={18} />
                  </div>
                </div>
                <p className={`text-xs font-medium ml-1 italic ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>
                  * Apenas campanhas do tipo 'NPS' são listadas aqui.
                </p>
              </div>

              {/* Status Preview */}
              <div className={`border rounded-xl p-6 flex gap-4 transition-colors ${
                isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'
              }`}>
                <AlertCircle className="text-blue-500 shrink-0" size={20} />
                <div className="space-y-1">
                  <p className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-blue-400' : 'text-blue-900'}`}>Impacto no Portal</p>
                  <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-blue-300/50' : 'text-blue-700/70'}`}>
                    Ao selecionar e salvar uma campanha, um botão flutuante aparecerá automaticamente no canto inferior direito de todas as páginas do portal para todos os usuários cadastrados.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={`pt-6 border-t flex justify-end transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving || loading}
                className={`px-10 py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-black text-white hover:bg-slate-800'
                }`}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Salvar Configurações
              </motion.button>
            </div>
          </div>
        </div>

        {/* Requirements Card */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className={`p-8 rounded-xl border shadow-sm space-y-4 transition-colors ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <CheckCircle2 size={18} className="text-green-500" />
              Requisitos da Campanha
            </h3>
            <ul className="space-y-3">
              {[
                "Deve ser exclusivamente do tipo 'NPS'",
                "Recomendado permitir comentários (opcional)",
                "Status deve estar 'Ativo'",
                "Não interfere nas campanhas já rodando nos terminais"
              ].map((req, i) => (
                <li key={i} className={`text-xs font-medium flex items-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-zinc-700' : 'bg-slate-300'}`} />
                  {req}
                </li>
              ))}
            </ul>
          </div>

          <div className={`p-8 rounded-xl border shadow-sm space-y-4 transition-colors ${
            isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <Globe size={18} className="text-orange-500" />
              Visibilidade Global
            </h3>
            <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              O objetivo desta função é permitir coletar o NPS de satisfação dos próprios administradores das empresas e usuários do sistema, ajudando na melhoria contínua da plataforma beend.tech.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-black/50' : 'bg-slate-50'}`}>
                <Hash size={16} className={isDarkMode ? 'text-zinc-700' : 'text-slate-400'} />
              </div>
              <div className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-black/50' : 'bg-slate-50'}`}>
                <MessageSquare size={16} className={isDarkMode ? 'text-zinc-700' : 'text-slate-400'} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlatformSettings;
