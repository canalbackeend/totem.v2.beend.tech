import { motion } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  CreditCard, 
  Calendar, 
  ShieldCheck, 
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const [formData, setFormData] = useState({
    nome: '',
    responsavel: '',
    empresa: '',
    endereco: '',
    complemento: '',
    cep: '',
    cnpj: '',
    email: '',
    telefone: '',
    estado: '',
    cidade: '',
    plano: '',
    vencimento: '',
    max_terminals: 0,
    created_at: ''
  });

  const [loading, setLoading] = useState(true);

  const [passwords, setPasswords] = useState({
    new: '',
    confirm: ''
  });

  const [logo, setLogo] = useState<string | null>(null);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadProfile(user.id);
    }
  }, [user]);

  const loadProfile = async (userId: string) => {
    try {
      setLoading(true);
      const data = await api.get('/auth/me');
      const profile = data.user;
        
      if (profile) {
        setFormData({
          nome: profile.nome || '',
          responsavel: profile.responsavel || '',
          empresa: profile.empresa || '',
          endereco: profile.endereco || '',
          complemento: profile.complemento || '',
          cep: profile.cep || '',
          cnpj: profile.cnpj || '',
          email: profile.email || '',
          telefone: profile.telefone || '',
          estado: profile.estado || '',
          cidade: profile.cidade || '',
          plano: profile.plano || '',
          vencimento: profile.vencimento || '',
          max_terminals: profile.max_terminals || 0,
          created_at: profile.created_at || ''
        });
        if (profile.logo_url) {
          setLogo(profile.logo_url);
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  // Masks
  const maskCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
      .slice(0, 16);
  };

  const maskCep = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let maskedValue = value;

    if (name === 'cnpj') maskedValue = maskCnpj(value);
    if (name === 'telefone') maskedValue = maskPhone(value);
    if (name === 'cep') maskedValue = maskCep(value);

    setFormData(prev => ({ ...prev, [name]: maskedValue }));
  };

  // CEP Lookup
  useEffect(() => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const fetchCep = async () => {
        setIsSearchingCep(true);
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await response.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              endereco: data.logradouro || prev.endereco,
              cidade: data.localidade || prev.cidade,
              estado: data.uf || prev.estado
            }));
          }
        } catch (error) {
          console.error("Erro ao buscar CEP:", error);
        } finally {
          setIsSearchingCep(false);
        }
      };
      fetchCep();
    }
  }, [formData.cep]);

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const loadingToast = toast.loading('Enviando imagem para o Supabase...');

      try {
        const res = await api.post('/upload', {
          image: base64,
          folder: 'profiles'
        });
        
        const uploadedUrl = res.url;
        setLogo(uploadedUrl);

        await api.patch(`/profiles/${user.id}`, {
          logo_url: uploadedUrl
        });
        await refreshProfile();
        toast.dismiss(loadingToast);
        toast.success('Imagem de perfil atualizada no Supabase com sucesso!');
      } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('Error uploading logo:', error);
        toast.error('Erro ao salvar imagem no Supabase.');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfileChanges = async () => {
    if (!user) return;
    
    toast.promise(
      (async () => {
        // Update profile data
        const updates = {
          nome: formData.nome,
          responsavel: formData.responsavel,
          empresa: formData.empresa,
          endereco: formData.endereco,
          complemento: formData.complemento,
          cep: formData.cep,
          cnpj: formData.cnpj,
          telefone: formData.telefone,
          estado: formData.estado,
          cidade: formData.cidade,
          logo_url: logo,
        };
        
        await api.patch(`/profiles/${user.id}`, updates);
        await refreshProfile();
      })(),
      {
        loading: 'Salvando alterações...',
        success: 'Perfil atualizado com sucesso!',
        error: 'Erro ao atualizar perfil.',
      }
    );
  };

  const updatePassword = async () => {
    if (!passwords.new || !passwords.confirm) {
      toast.error('Preencha os campos de senha.');
      return;
    }
    if (passwords.new.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }

    toast.promise(
      (async () => {
        await api.patch(`/profiles/${user.id}`, {
          password: passwords.new
        });
        setPasswords({ new: '', confirm: '' });
        await refreshProfile();
      })(),
      {
        loading: 'Atualizando senha...',
        success: 'Senha alterada com sucesso!',
        error: 'Erro ao alterar senha. Verifique se a senha atende aos requisitos.',
      }
    );
  };

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isDarkMode ? 'border-zinc-800 border-t-white' : 'border-slate-200 border-t-[#0b82ff]'}`} />
      </div>
    );
  }

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#ecf0f1] text-slate-900'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Perfil Corporativo</h2>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Gerencie as informações da sua conta e empresa</p>
            </div>
            <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full border shadow-sm ${
              isDarkMode ? 'text-zinc-500 bg-white/5 border-white/5' : 'text-slate-400 bg-white/50 border-slate-200'
            }`}>
               <ShieldCheck size={14} className="text-[#0b82ff]" />
               Ambiente Seguro SSL
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Editable Fields */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${
                  isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
                }`}
              >
                <div className={`p-6 border-b flex justify-between items-center ${
                  isDarkMode ? 'border-white/5 bg-black/30' : 'border-slate-100 bg-slate-50/50'
                }`}>
                  <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    <Building2 size={18} className="text-[#0b82ff]" />
                    Dados Cadastrais
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={saveProfileChanges}
                    className={`px-5 py-2 rounded font-black text-[10px] tracking-widest uppercase flex items-center gap-2 shadow-lg cursor-pointer transition-colors ${
                      isDarkMode ? 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-500' : 'bg-[#0b82ff] text-white shadow-blue-500/20'
                    }`}
                  >
                    <Save size={14} />
                    Salvar Alterações
                  </motion.button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Nome Completo</label>
                    <input 
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Responsável</label>
                    <input 
                      name="responsavel"
                      value={formData.responsavel}
                      onChange={handleInputChange}
                      placeholder="Nome do responsável técnico/financeiro"
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1 ${isDarkMode ? 'text-blue-400' : 'text-[#0b82ff]'}`}>
                      Empresa / Razão Social
                      <span className={`text-[8px] px-1 rounded ${isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-[#0b82ff]'}`}>Verificado</span>
                    </label>
                    <input 
                      name="empresa"
                      value={formData.empresa}
                      onChange={handleInputChange}
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>CNPJ</label>
                    <input 
                      name="cnpj"
                      value={formData.cnpj}
                      onChange={handleInputChange}
                      placeholder="00.000.000/0000-00"
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center justify-between ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      CEP
                      {isSearchingCep && <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="inline-block"><AlertCircle size={10} /></motion.span>}
                    </label>
                    <input 
                      name="cep"
                      value={formData.cep}
                      onChange={handleInputChange}
                      placeholder="00000-000"
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Endereço</label>
                    <div className="relative">
                      <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} size={16} />
                      <input 
                        name="endereco"
                        value={formData.endereco}
                        onChange={handleInputChange}
                        className={`w-full border rounded p-3 pl-10 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                          isDarkMode ? 'bg-black border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Complemento</label>
                    <input 
                      name="complemento"
                      value={formData.complemento}
                      onChange={handleInputChange}
                      placeholder="Apto, Bloco, Sala, etc."
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Cidade</label>
                    <input 
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Estado (UF)</label>
                    <input 
                      name="estado"
                      value={formData.estado}
                      onChange={handleInputChange}
                      maxLength={2}
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      E-mail Login
                      <Lock size={10} className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'} />
                    </label>
                    <div className="relative">
                      <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} size={16} />
                      <input 
                        name="email"
                        value={formData.email}
                        readOnly
                        className={`w-full border rounded p-3 pl-10 text-sm font-semibold cursor-not-allowed outline-none ${
                           isDarkMode ? 'bg-zinc-800 border-white/5 text-zinc-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Telefone / WhatsApp</label>
                    <div className="relative">
                      <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} size={16} />
                      <input 
                        name="telefone"
                        value={formData.telefone}
                        onChange={handleInputChange}
                        placeholder="(00) 0 0000-0000"
                        className={`w-full border rounded p-3 pl-10 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                          isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`} 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Password Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${
                  isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
                }`}
              >
                <div className={`p-6 border-b ${
                  isDarkMode ? 'border-white/5 bg-black/30' : 'border-slate-100 bg-slate-50/30'
                }`}>
                  <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    <Lock size={18} className="text-[#0b82ff]" />
                    Alterar Senha
                  </h3>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                   <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Nova Senha</label>
                    <input 
                      type="password"
                      value={passwords.new}
                      onChange={(e) => setPasswords(p => ({...p, new: e.target.value}))}
                      placeholder="Digite a nova senha"
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>
                   <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Confirme a Nova Senha</label>
                    <input 
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords(p => ({...p, confirm: e.target.value}))}
                      placeholder="Confirme a nova senha"
                      className={`w-full border rounded p-3 text-sm font-semibold transition-all focus:outline-none focus:border-[#0b82ff] ${
                        isDarkMode ? 'bg-black border-white/10 text-white placeholder:text-zinc-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`} 
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={updatePassword}
                      className={`px-8 py-3 rounded font-black text-[11px] tracking-[0.2em] uppercase shadow-lg cursor-pointer transition-colors ${
                        isDarkMode ? 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-500' : 'bg-[#0b82ff] text-white shadow-blue-500/20'
                      }`}
                    >
                      Salvar Mudança
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-4 space-y-6"
            >
              {/* Logo Upload Card */}
              <div className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center text-center transition-colors ${
                isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
              }`}>
                <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Logomarca da Empresa</h3>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-48 h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
                    isDarkMode 
                      ? 'bg-black border-white/10 hover:border-[#0b82ff] hover:bg-blue-900/10' 
                      : 'bg-slate-50 border-slate-200 hover:border-[#0b82ff] hover:bg-blue-50'
                  }`}
                >
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <>
                      <Upload size={32} className={`mb-4 group-hover:text-[#0b82ff] group-hover:scale-110 transition-all ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`} />
                      <span className={`text-[10px] font-bold px-6 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Clique ou arraste para carregar uma imagem</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>

              {/* Plan Details Card */}
              <div className={`rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${
                isDarkMode ? 'bg-zinc-900 border border-white/5' : 'bg-white'
              }`}>
                <div className={`p-6 text-white relative ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-800'}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#0b82ff]/10 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Plano Atual</span>
                    <span className="bg-green-500 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-tighter shadow-xl">Premium Active</span>
                  </div>
                  <h4 className="text-3xl font-black tracking-tight flex items-center gap-2">
                    {formData.plano || 'Nenhum'}
                    <ChevronRight size={24} className="text-[#0b82ff]" />
                  </h4>
                  <div className={`flex items-center gap-2 mt-4 text-[11px] font-bold tracking-wide ${isDarkMode ? 'text-zinc-400' : 'text-slate-300'}`}>
                    <CreditCard size={14} className="text-[#0b82ff]" />
                    {formData.plano ? 'Modo Corporativo Pago' : 'Plano Gratuito / Teste'}
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#0b82ff]'}`}>
                        <Building2 size={16} />
                      </div>
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Terminais</span>
                    </div>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Até {formData.max_terminals || 0} terminais</span>
                  </div>

                  <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'}`}>
                        <CheckCircle2 size={16} />
                      </div>
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Admissão</span>
                    </div>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {formData.created_at ? new Date(formData.created_at).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-500'}`}>
                        <Calendar size={16} />
                      </div>
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Vencimento</span>
                    </div>
                    <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formData.vencimento || '-'}</span>
                  </div>

                  <div className={`pt-4 flex items-center gap-3 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                    <AlertCircle size={16} className="shrink-0" />
                    <p className="text-[10px] font-medium leading-tight">Para upgrades ou alteração de planos [Mensal, Anual, Livre], entre em contato com nosso suporte comercial.</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </main>
    </>
  );
}

