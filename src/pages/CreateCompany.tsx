import { motion } from 'motion/react';
import { 
  Building2, 
  Save, 
  ArrowLeft,
  Upload,
  Info,
  ShieldCheck,
  Check,
  CreditCard,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { api } from '../lib/api';

// Helper masks
const maskCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 14);
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15);
};

const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 9);
};

export default function CreateCompany() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [fetchingCompany, setFetchingCompany] = useState(!!id);
  const [formData, setFormData] = useState({
    responsavel: '',
    empresa: '',
    cnpj: '',
    email: '',
    telefone: '',
    cep: '',
    endereco: '',
    complemento: '',
    cidade: '',
    estado: '',
    plano: 'Mensal',
    vencimento: '',
    max_terminals: 1,
    logo_url: ''
  });

  useEffect(() => {
    if (id) {
      const fetchCompany = async () => {
        try {
          const data = await api.get(`/companies/${id}`);
          if (data) Object.keys(formData).forEach(key => setFormData(prev => ({ ...prev, [key]: data[key] || prev[key as keyof typeof formData] })));
        } catch (error) {
          console.error("Erro ao buscar empresa:", error);
          toast.error("Erro ao carregar os dados da empresa.");
        } finally {
          setFetchingCompany(false);
        }
      };
      fetchCompany();
    }
  }, [id]);

  const calculateVencimento = (plano: string) => {
    const today = new Date();
    if (plano === 'Anual') {
      today.setFullYear(today.getFullYear() + 1);
      return today.toLocaleDateString('pt-BR');
    }
    if (plano === 'Mensal') {
      today.setMonth(today.getMonth() + 1);
      return today.toLocaleDateString('pt-BR');
    }
    if (plano === 'Teste 7 dias') {
      today.setDate(today.getDate() + 7);
      return today.toLocaleDateString('pt-BR');
    }
    return 'N/A';
  };

  useEffect(() => {
    setFormData(prev => ({ ...prev, vencimento: calculateVencimento(prev.plano) }));
  }, [formData.plano]);

  const fetchAddressByCEP = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return;

    setLoadingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
          complemento: data.complemento || prev.complemento
        }));
        toast.info('Endereço localizado!', {
          description: `CEP ${cep} corresponde a ${data.localidade} - ${data.uf}`
        });
      } else {
        toast.error('CEP não encontrado.');
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error('Erro ao buscar informações de endereço.');
    } finally {
      setLoadingCEP(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    if (name === 'cnpj') processedValue = maskCNPJ(value);
    if (name === 'telefone') processedValue = maskPhone(value);
    if (name === 'cep') {
      processedValue = maskCEP(value);
      if (processedValue.replace(/\D/g, '').length === 8) {
        fetchAddressByCEP(processedValue);
      }
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const loadingToast = toast.loading('Enviando imagem para o Supabase...');

      try {
        const res = await api.post('/upload', {
          image: base64,
          folder: 'profiles'
        });
        
        const uploadedUrl = res.url;
        setFormData(prev => ({ ...prev, logo_url: uploadedUrl }));
        toast.dismiss(loadingToast);
        toast.success('Logomarca carregada e salva no Supabase!');
      } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('Error uploading logo:', error);
        toast.error('Erro ao salvar imagem no Supabase.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.empresa || !formData.cnpj || !formData.responsavel) {
      toast.error('Preencha os campos obrigatórios.', {
        description: 'Empresa, CNPJ e Responsável são necessários.'
      });
      return;
    }

    toast.promise(
      (async () => {
        const payload: any = {
          empresa: formData.empresa,
          responsavel: formData.responsavel,
          cnpj: formData.cnpj,
          email: formData.email,
          telefone: formData.telefone,
          cep: formData.cep,
          endereco: formData.endereco,
          complemento: formData.complemento,
          cidade: formData.cidade,
          estado: formData.estado,
          plano: formData.plano,
          vencimento: formData.vencimento,
          max_terminals: formData.max_terminals,
          logo_url: formData.logo_url,
          status: 'Ativo'
        };
        
        if (id) {
          const updatedData = await api.patch(`/companies/${id}`, payload);
          return updatedData;
        } else {
          payload.password = '123456'; // Default password for new companies
          const newData = await api.post('/companies', payload);
          return newData;
        }
      })(),
      {
        loading: id ? 'Atualizando empresa...' : 'Processando cadastro da empresa...',
        success: () => {
          setTimeout(() => navigate('/empresas'), 500);
          return id ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!';
        },
        error: (err: any) => {
          console.error('Registration error:', err);
          return err.message || (id ? 'Erro ao atualizar empresa.' : 'Erro ao cadastrar empresa.');
        },
      }
    );
  };

  const plans = ['Teste 7 dias', 'Mensal', 'Anual', 'Livre'];

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <Link to="/empresas">
                    <motion.button
                        whileHover={{ scale: 1.1, x: -5 }}
                        className={`p-3 rounded-xl shadow-sm border transition-colors cursor-pointer ${
                          isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-white' : 'bg-white border-slate-100 text-slate-400 hover:text-slate-800'
                        }`}
                    >
                        <ArrowLeft size={20} />
                    </motion.button>
                </Link>
                <div>
                   <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{id ? 'Editar Empresa' : 'Nova Empresa'}</h2>
                   <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>{id ? 'Altere os dados da empresa cadastrada' : 'Preencha os campos abaixo para cadastrar um novo cliente'}</p>
                </div>
            </div>
          </div>

          {fetchingCompany ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-[#0b82ff] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-2 space-y-6">
                <form onSubmit={handleSubmit} className={`rounded-xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                    <div className={`p-6 border-b flex items-center justify-between transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-[#0b82ff]'}`}>
                                <Building2 size={24} />
                            </div>
                            <h3 className={`text-sm font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Informações Cadastrais</h3>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border flex items-center gap-2 transition-colors ${
                          isDarkMode ? 'bg-black border-white/5 text-zinc-500' : 'bg-white border-slate-100 text-slate-400'
                        }`}>
                             <Check size={12} className="text-green-500" />
                             Status Base: Ativo
                        </span>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-1.5 md:col-span-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Responsável Técnico/Financeiro</label>
                           <input 
                             name="responsavel"
                             value={formData.responsavel}
                             onChange={handleInputChange}
                             placeholder="Nome completo do responsável"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Razão Social / Nome da Empresa</label>
                           <input 
                             name="empresa"
                             value={formData.empresa}
                             onChange={handleInputChange}
                             placeholder="Nome fantasia ou razão social completa"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>CNPJ</label>
                           <input 
                             name="cnpj"
                             value={formData.cnpj}
                             onChange={handleInputChange}
                             placeholder="00.000.000/0000-00"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Telefone / WhatsApp</label>
                           <input 
                             name="telefone"
                             value={formData.telefone}
                             onChange={handleInputChange}
                             placeholder="(00) 00000-0000"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Limite de Terminais</label>
                           <input 
                             name="max_terminals"
                             type="number"
                             min="1"
                             value={formData.max_terminals}
                             onChange={(e) => setFormData(prev => ({ ...prev, max_terminals: parseInt(e.target.value) || 0 }))}
                             placeholder="Ex: 5"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>E-mail para Faturamento/Acesso</label>
                           <input 
                             name="email"
                             type="email"
                             value={formData.email}
                             onChange={handleInputChange}
                             placeholder="exemplo@empresa.com"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        {/* Plan Selection */}
                        <div className={`md:col-span-2 pt-4 pb-2 border-b transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                            <h4 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${isDarkMode ? 'text-blue-400' : 'text-[#0b82ff]'}`}>
                                <CreditCard size={14} /> Selecione o Plano
                            </h4>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {plans.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, plano: p }))}
                                    className={`py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                                        formData.plano === p 
                                        ? (isDarkMode ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-[#0b82ff] border-[#0b82ff] text-white shadow-md')
                                        : (isDarkMode ? 'bg-black border-white/5 text-zinc-500 hover:border-white/10' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200')
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {formData.plano !== 'Livre' && (
                            <div className={`md:col-span-2 p-4 rounded-lg flex items-center justify-between border transition-colors ${
                              isDarkMode ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/50 border-blue-100'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <CalendarIcon size={18} className={isDarkMode ? 'text-blue-400' : 'text-[#0b82ff]'} />
                                    <div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest block leading-none mb-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Vencimento do Plano</span>
                                        <span className={`text-sm font-black transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formData.vencimento}</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-colors ${
                                  isDarkMode ? 'bg-black border-blue-500/20 text-blue-400' : 'bg-white border-blue-100 text-blue-500'
                                }`}>
                                    Pagamento via Boleto/Pix
                                </span>
                            </div>
                        )}

                        <div className={`md:col-span-2 pt-4 pb-2 border-b transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                            <h4 className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-blue-400' : 'text-[#0b82ff]'}`}>Endereço de Cobrança / Instalação</h4>
                        </div>

                        <div className="space-y-1.5 relative">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex justify-between transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                             CEP
                             {loadingCEP && <span className="animate-pulse text-blue-500">Buscando...</span>}
                           </label>
                           <input 
                             name="cep"
                             value={formData.cep}
                             onChange={handleInputChange}
                             placeholder="00.000-000"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? `bg-black border text-white focus:border-blue-500/50 ${loadingCEP ? 'border-blue-500' : 'border-white/5'}` 
                                 : `bg-slate-50 border text-slate-700 focus:border-[#0b82ff] ${loadingCEP ? 'border-[#0b82ff]' : 'border-slate-100'}`
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5 flex-1">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Cidade</label>
                           <input 
                             name="cidade"
                             value={formData.cidade}
                             onChange={handleInputChange}
                             placeholder="Nome da cidade"
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Logradouro / Endereço</label>
                           <input 
                             name="endereco"
                             value={formData.endereco}
                             onChange={handleInputChange}
                             placeholder="Rua, Avenida, Quadra, etc."
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Complemento</label>
                           <input 
                             name="complemento"
                             value={formData.complemento}
                             onChange={handleInputChange}
                             placeholder="Apto, Sala, Bloco..."
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>UF / Estado</label>
                           <input 
                             name="estado"
                             value={formData.estado}
                             onChange={handleInputChange}
                             placeholder="Ex: DF, SP, RJ..."
                             maxLength={2}
                             className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
                               isDarkMode 
                                 ? 'bg-black border border-white/5 text-white focus:border-blue-500/50' 
                                 : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-[#0b82ff]'
                             }`} 
                           />
                        </div>
                    </div>

                    {/* Form Footer Actions */}
                    <div className={`p-8 border-t flex flex-col sm:flex-row justify-end items-center gap-4 transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50/80 border-slate-100'}`}>
                        <Link to="/empresas" className={`w-full sm:w-auto text-center px-8 py-3 font-bold uppercase tracking-widest text-[10px] transition-colors ${
                          isDarkMode ? 'text-zinc-600 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                        }`}>
                            Cancelar
                        </Link>
                        <motion.button 
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full sm:w-auto text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl cursor-pointer transition-all ${
                              isDarkMode ? 'bg-blue-600 shadow-blue-900/20 hover:bg-blue-500' : 'bg-[#0b82ff] shadow-blue-500/20'
                            }`}
                        >
                            <Save size={18} />
                            {id ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR EMPRESA'}
                        </motion.button>
                    </div>
                </form>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
                <div className={`p-8 rounded-xl shadow-sm border space-y-6 transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                    <div className={`w-16 h-16 border rounded-2xl flex items-center justify-center mx-auto overflow-hidden relative group transition-colors ${
                      isDarkMode ? 'bg-black border-white/5 text-zinc-800' : 'bg-slate-50 border-slate-100 text-slate-300'
                    }`}>
                        {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                            <Upload size={32} />
                        )}
                    </div>
                    <div className="text-center space-y-2">
                        <h4 className={`text-sm font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Logo da Empresa</h4>
                        <p className={`text-xs font-medium leading-relaxed transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Arraste uma imagem ou clique para fazer upload. Formatos aceitos: PNG, JPG.</p>
                    </div>
                    <label className={`w-full border-2 border-dashed py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex justify-center block ${
                      isDarkMode ? 'border-zinc-800 text-zinc-700 hover:border-blue-500 hover:text-blue-400' : 'border-slate-100 text-slate-400 hover:border-[#0b82ff] hover:text-[#0b82ff]'
                    }`}>
                        Selecionar Arquivo
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                </div>

                <div className={`p-8 rounded-xl shadow-lg transition-all space-y-4 ${
                  isDarkMode ? 'bg-zinc-800 shadow-black/40 text-white border border-white/5' : 'bg-[#0b82ff] shadow-blue-500/20 text-white'
                }`}>
                    <ShieldCheck size={32} className="opacity-50" />
                    <div className="space-y-2">
                        <h4 className="text-sm font-black uppercase tracking-widest">Verificação de Dados</h4>
                        <p className={`text-xs font-medium leading-relaxed transition-colors ${isDarkMode ? 'text-zinc-300' : 'opacity-80'}`}>Todos os novos cadastros passam por uma validação automática de CNPJ e dados fiscais antes da ativação completa do plano.</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <Info size={14} />
                        Processo Seguro
                    </div>
                </div>
            </div>
          </div>
          )}

        </div>
      </main>
    </>
  );
}
