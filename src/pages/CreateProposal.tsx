import { motion } from 'motion/react';
import { 
  FileText, 
  Save, 
  ArrowLeft,
  Upload,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Package,
  Image as ImageIcon,
  PenTool,
  Plus,
  Trash2,
  Loader2,
  Send,
  Eye
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { api } from '../lib/api';

const maskCEP = (value: string) => {
  return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 14);
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
};

const maskCurrency = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits);
  return (cents / 100).toFixed(2).replace('.', ',');
};

const parseCurrency = (value: string) => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

export default function CreateProposal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [sending, setSending] = useState(false);

  const today = new Date();
  const validity = new Date(today);
  validity.setDate(validity.getDate() + 10);

  const [formData, setFormData] = useState({
    client_name: '',
    contact_person: '',
    email: '',
    phone: '',
    cep: '',
    address: '',
    proposal_date: today.toISOString().split('T')[0],
    validity_date: validity.toISOString().split('T')[0],
    greeting: '',
    general_description: '',
    implementation_reqs: '',
    technical_support: '',
    warranty: '',
    resources_text: '',
    payment_terms: '',
    final_considerations: '',
    plan_type: 'Mensal',
    monthly_value: '',
    plan_description: '',
    items: [] as { name: string; qty: number; unit_price: number; total: number }[],
    shipping_cost: '',
    images: [] as string[],
    image_library: [] as string[],
    responsible_name: '',
    responsible_phone: ''
  });

  const [newItemImage, setNewItemImage] = useState('');

  useEffect(() => {
    if (id) {
      const fetchProposal = async () => {
        try {
          const data = await api.get(`/proposals/${id}`);
          if (data) {
            const resources = Array.isArray(data.resources) ? data.resources.join('\n') : '';
            setFormData({
              client_name: data.client_name || '',
              contact_person: data.contact_person || '',
              email: data.email || '',
              phone: data.phone || '',
              cep: data.cep || '',
              address: data.address || '',
              proposal_date: data.proposal_date || today.toISOString().split('T')[0],
              validity_date: data.validity_date || validity.toISOString().split('T')[0],
              greeting: data.greeting || '',
              general_description: data.general_description || '',
              implementation_reqs: data.implementation_reqs || '',
              technical_support: data.technical_support || '',
              warranty: data.warranty || '',
              resources_text: resources,
              payment_terms: data.payment_terms || '',
              final_considerations: data.final_considerations || '',
              plan_type: data.plan_type || 'Mensal',
              monthly_value: data.monthly_value ? String(data.monthly_value).replace('.', ',') : '',
              plan_description: data.plan_description || '',
              items: data.items || [],
              shipping_cost: data.shipping_cost ? String(data.shipping_cost).replace('.', ',') : '',
              images: data.images || [],
              image_library: data.image_library || [],
              responsible_name: data.responsible_name || '',
              responsible_phone: data.responsible_phone || ''
            });
          }
        } catch (error) {
          console.error("Erro ao buscar proposta:", error);
          toast.error("Erro ao carregar os dados da proposta.");
        } finally {
          setFetching(false);
        }
      };
      fetchProposal();
    }
  }, [id]);

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
          address: data.logradouro ? `${data.logradouro}, ${data.bairro || ''} - ${data.localidade || ''}/${data.uf || ''}` : prev.address
        }));
        toast.info('Endereço localizado!');
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setLoadingCEP(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'cep') {
      processedValue = maskCEP(value);
      if (processedValue.replace(/\D/g, '').length === 8) fetchAddressByCEP(processedValue);
    }
    if (name === 'phone' || name === 'responsible_phone') processedValue = maskPhone(value);
    if (name === 'monthly_value' || name === 'shipping_cost') processedValue = maskCurrency(value);
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', qty: 1, unit_price: 0, total: 0 }]
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'qty' || field === 'unit_price') {
        const qty = field === 'qty' ? (typeof value === 'string' ? parseFloat(value) || 0 : value) : newItems[index].qty;
        const unitPrice = field === 'unit_price' ? (typeof value === 'string' ? parseCurrency(value) : value) : newItems[index].unit_price;
        newItems[index].total = qty * unitPrice;
      }
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const loadingToast = toast.loading('Enviando imagem...');
      try {
        const res = await api.post('/upload', { image: base64, folder: 'proposals' });
        const url = res.url;
        if (slot !== undefined) {
          const newImages = [...formData.images];
          newImages[slot] = url;
          setFormData(prev => ({ ...prev, images: newImages }));
        } else {
          setFormData(prev => ({ ...prev, image_library: [...prev.image_library, url] }));
        }
        toast.dismiss(loadingToast);
        toast.success('Imagem enviada!');
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Erro ao enviar imagem.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (status?: string) => {
    if (!formData.client_name) {
      toast.error('Preencha o nome do cliente.');
      return;
    }
    const resources = formData.resources_text.split('\n').filter(r => r.trim());
    const payload = { ...formData, resources };
    if (status) payload.status = status;

    toast.promise(
      (async () => {
        if (id) {
          return api.patch(`/proposals/${id}`, payload);
        } else {
          return api.post('/proposals', payload);
        }
      })(),
      {
        loading: 'Salvando proposta...',
        success: (data: any) => {
          if (status === 'Enviada') {
            setTimeout(() => handleSend(data.id), 500);
          } else {
            setTimeout(() => navigate('/propostas'), 500);
          }
          return id ? 'Proposta atualizada!' : 'Proposta criada com sucesso!';
        },
        error: (err: any) => err.message || 'Erro ao salvar proposta.'
      }
    );
  };

  const handleSend = async (proposalId?: string) => {
    const pid = proposalId || id;
    if (!pid) return;
    if (!formData.email) {
      toast.error('Informe o e-mail do cliente para enviar.');
      return;
    }
    setSending(true);
    try {
      await api.post(`/proposals/${pid}/send`, {});
      toast.success('Proposta enviada por e-mail!');
      navigate('/propostas');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar proposta.');
    } finally {
      setSending(false);
    }
  };

  const subtotal = formData.items.reduce((sum, i) => sum + i.total, 0);
  const shipping = parseCurrency(formData.shipping_cost);
  const totalGeral = subtotal + shipping;

  const plans = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Avulso'];

  if (fetching) {
    return (
      <>
        <Breadcrumbs />
        <main className={`flex-1 p-6 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
      </>
    );
  }

  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className={`p-5 border-b flex items-center gap-3 transition-colors ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
        <Icon size={20} />
      </div>
      <h3 className={`text-sm font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
    </div>
  );

  const InputField = ({ label, name, type = 'text', placeholder, colSpan = 1 }: any) => (
    <div className={`space-y-1.5 ${colSpan === 2 ? 'md:col-span-2' : ''}`}>
      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{label}</label>
      <input name={name} type={type} value={(formData as any)[name] || ''} onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${
          isDarkMode ? 'bg-black border border-white/5 text-white focus:border-amber-500/50' : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-amber-500'
        }`} />
    </div>
  );

  const TextAreaField = ({ label, name, placeholder, rows = 3 }: any) => (
    <div className="space-y-1.5">
      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{label}</label>
      <textarea name={name} value={(formData as any)[name] || ''} onChange={handleInputChange}
        placeholder={placeholder} rows={rows}
        className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all resize-none ${
          isDarkMode ? 'bg-black border border-white/5 text-white focus:border-amber-500/50' : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-amber-500'
        }`} />
    </div>
  );

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link to="/propostas">
                <motion.button whileHover={{ scale: 1.1, x: -5 }}
                  className={`p-3 rounded-xl shadow-sm border transition-colors cursor-pointer ${isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-white' : 'bg-white border-slate-100 text-slate-400 hover:text-slate-800'}`}>
                  <ArrowLeft size={20} />
                </motion.button>
              </Link>
              <div>
                <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{id ? 'Editar Proposta' : 'Nova Proposta'}</h2>
                <p className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>{id ? 'Altere os dados da proposta' : 'Preencha os campos para criar uma nova proposta comercial'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
                className={`rounded-xl shadow-sm border overflow-hidden transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                
                {/* Dados do Cliente */}
                <SectionHeader icon={User} title="Dados do Cliente" />
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <InputField label="Nome da Empresa / Cliente *" name="client_name" placeholder="Razo social ou nome fantasia" colSpan={2} />
                  <InputField label="Pessoa de Contato" name="contact_person" placeholder="Nome do responsvel" />
                  <InputField label="Telefone" name="phone" placeholder="(00) 00000-0000" />
                  <InputField label="E-mail" name="email" type="email" placeholder="cliente@empresa.com" colSpan={2} />
                  <div className="space-y-1.5 relative">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>CEP</label>
                    <input name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00.000-000"
                      className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${loadingCEP ? (isDarkMode ? 'border-blue-500' : 'border-blue-500') : (isDarkMode ? 'border-white/5' : 'border-slate-100')} ${isDarkMode ? 'bg-black border text-white focus:border-amber-500/50' : 'bg-slate-50 border text-slate-700 focus:border-amber-500'}`} />
                    {loadingCEP && <span className="absolute right-3 top-9 text-[10px] text-blue-500 font-bold animate-pulse">Buscando...</span>}
                  </div>
                  <InputField label="Data da Proposta" name="proposal_date" type="date" />
                  <InputField label="Endereço" name="address" placeholder="Endereço completo" colSpan={2} />
                  <InputField label="Validade" name="validity_date" type="date" />
                </div>

                {/* Conteúdo */}
                <SectionHeader icon={FileText} title="Conteúdo da Proposta" />
                <div className="p-6 space-y-4">
                  <InputField label="Saudação Personalizada" name="greeting" placeholder="Prezado(a) [Contato]," colSpan={2} />
                  <TextAreaField label="Descrição Geral" name="general_description" placeholder="Descreva a solução oferecida..." rows={4} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextAreaField label="Requisitos de Implementação" name="implementation_reqs" placeholder="• Instalação..." rows={4} />
                    <TextAreaField label="Suporte Técnico" name="technical_support" placeholder="Descreva o suporte..." rows={4} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextAreaField label="Garantia" name="warranty" placeholder="Descreva a garantia..." rows={3} />
                    <TextAreaField label="Forma de Pagamento" name="payment_terms" placeholder="Condições de pagamento..." rows={3} />
                  </div>
                  <TextAreaField label="Recursos do Sistema (um por linha)" name="resources_text" placeholder="Painel de análise em tempo real&#10;Relatórios automáticos por e-mail&#10;Terminais com modo offline" rows={5} />
                  <TextAreaField label="Considerações Finais" name="final_considerations" placeholder="Observações adicionais..." rows={3} />
                </div>

                {/* Valores e Plano */}
                <SectionHeader icon={CreditCard} title="Valores e Plano" />
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Tipo de Plano</label>
                      <select name="plan_type" value={formData.plan_type} onChange={handleInputChange}
                        className={`w-full rounded p-3 text-sm font-semibold outline-none transition-all ${isDarkMode ? 'bg-black border border-white/5 text-white focus:border-amber-500/50' : 'bg-slate-50 border border-slate-100 text-slate-700 focus:border-amber-500'}`}>
                        {plans.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <InputField label="Valor Mensal (R$)" name="monthly_value" placeholder="0,00" />
                  </div>
                  <TextAreaField label="Descrição do Plano" name="plan_description" placeholder="Detalhes do plano..." rows={2} />

                  {/* Itens/Produtos */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        <Package size={14} /> Itens / Produtos
                      </h4>
                      <button type="button" onClick={addItem}
                        className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${isDarkMode ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                        <Plus size={12} /> Adicionar Item
                      </button>
                    </div>

                    {formData.items.length > 0 && (
                      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={isDarkMode ? 'bg-black/40' : 'bg-slate-50'}>
                              <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest text-left ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Item</th>
                              <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest w-16 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Qtd</th>
                              <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest w-28 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Unitário</th>
                              <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest w-28 text-right ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Total</th>
                              <th className={`w-10 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}></th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {formData.items.map((item, idx) => (
                              <tr key={idx} className={isDarkMode ? 'bg-zinc-900' : 'bg-white'}>
                                <td className="px-3 py-2">
                                  <input value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                    placeholder="Nome do item"
                                    className={`w-full rounded px-2 py-1.5 text-xs font-semibold outline-none ${isDarkMode ? 'bg-black border border-white/5 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="1" value={item.qty} onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                                    className={`w-full rounded px-2 py-1.5 text-xs font-semibold outline-none text-center ${isDarkMode ? 'bg-black border border-white/5 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`} />
                                </td>
                                <td className="px-3 py-2">
                                  <input value={item.unit_price ? String(item.unit_price).replace('.', ',') : ''}
                                    onChange={(e) => updateItem(idx, 'unit_price', parseCurrency(e.target.value))}
                                    placeholder="0,00"
                                    className={`w-full rounded px-2 py-1.5 text-xs font-semibold outline-none ${isDarkMode ? 'bg-black border border-white/5 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`} />
                                </td>
                                <td className={`px-3 py-2 text-right text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  R$ {item.total.toFixed(2).replace('.', ',')}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button type="button" onClick={() => removeItem(idx)}
                                    className={`p-1 rounded transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={isDarkMode ? 'bg-black/30' : 'bg-slate-50'}>
                              <td colSpan={3} className={`px-3 py-2 text-right text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Subtotal:</td>
                              <td className={`px-3 py-2 text-right text-xs font-black ${isDarkMode ? 'text-zinc-300' : 'text-slate-700'}`}>R$ {subtotal.toFixed(2).replace('.', ',')}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <InputField label="Frete Adicional (R$)" name="shipping_cost" placeholder="0,00" />
                      <div className={`flex items-end p-4 rounded-lg border transition-colors ${isDarkMode ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="w-full">
                          <span className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Total Geral</span>
                          <span className={`text-2xl font-black ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                            R$ {totalGeral.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Imagens */}
                <SectionHeader icon={ImageIcon} title="Imagens da Proposta" />
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4].map(slot => (
                      <div key={slot} className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-colors ${
                        formData.images[slot]
                          ? (isDarkMode ? 'border-amber-500/30 bg-black' : 'border-amber-300 bg-slate-50')
                          : (isDarkMode ? 'border-zinc-800 hover:border-amber-500/50' : 'border-slate-200 hover:border-amber-400')
                      }`}>
                        {formData.images[slot] ? (
                          <>
                            <img src={formData.images[slot]} alt={`Imagem ${slot + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => { const n = [...formData.images]; n[slot] = ''; setFormData(p => ({ ...p, images: n })); }}
                              className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white">
                              <Trash2 size={10} />
                            </button>
                          </>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center gap-1 p-2 text-center">
                            <ImageIcon size={16} className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'} />
                            <span className={`text-[8px] font-black uppercase ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>Img {slot + 1}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, slot)} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Biblioteca */}
                  <div>
                    <h4 className={`text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                      <Upload size={12} /> Biblioteca de Imagens
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {formData.image_library.map((img, idx) => (
                        <div key={idx} className={`w-20 h-20 rounded-lg border overflow-hidden relative group ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                          <img src={img} alt={`Lib ${idx}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setFormData(p => ({ ...p, image_library: p.image_library.filter((_, i) => i !== idx) }))}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDarkMode ? 'border-zinc-800 hover:border-amber-500/50 text-zinc-700' : 'border-slate-200 hover:border-amber-400 text-slate-300'
                      }`}>
                        <Plus size={16} />
                        <span className={`text-[8px] font-black uppercase mt-1 ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e)} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Assinatura */}
                <SectionHeader icon={PenTool} title="Assinatura" />
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <InputField label="Nome do Responsável" name="responsible_name" placeholder="Nome completo" />
                  <InputField label="Telefone de Contato" name="responsible_phone" placeholder="(00) 00000-0000" />
                </div>

                {/* Actions */}
                <div className={`p-6 border-t flex flex-col sm:flex-row justify-end items-center gap-3 transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50/80 border-slate-100'}`}>
                  <Link to="/propostas" className={`px-6 py-3 font-bold uppercase tracking-widest text-[10px] transition-colors ${isDarkMode ? 'text-zinc-600 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                    Cancelar
                  </Link>
                  <motion.button type="button" onClick={() => handleSubmit()}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl cursor-pointer transition-all ${isDarkMode ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-slate-700 text-white hover:bg-slate-800'}`}>
                    <Save size={16} /> Salvar Rascunho
                  </motion.button>
                  <motion.button type="button" onClick={() => handleSubmit('Enviada')} disabled={sending}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-xl cursor-pointer transition-all bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Salvar e Enviar
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className={`p-6 rounded-xl shadow-sm border space-y-4 transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Resumo da Proposta</h4>
                <div className={`space-y-3 text-sm ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  <div className="flex justify-between">
                    <span>Cliente:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formData.client_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plano:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formData.plan_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Itens:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{formData.items.length}</span>
                  </div>
                  <div className={`border-t pt-3 mt-3 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex justify-between">
                      <span className="font-bold">Subtotal:</span>
                      <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    {shipping > 0 && (
                      <div className="flex justify-between mt-1">
                        <span>Frete:</span>
                        <span>R$ {shipping.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-2 pt-2 border-t border-amber-500/20">
                      <span className={`font-black text-base ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Total:</span>
                      <span className={`font-black text-base ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>R$ {totalGeral.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>
                {id && (
                  <Link to={`/propostas/visualizar/${id}`} target="_blank"
                    className={`w-full py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${isDarkMode ? 'border-white/5 text-zinc-400 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    <Eye size={14} /> Visualizar Proposta
                  </Link>
                )}
              </div>

              <div className={`p-6 rounded-xl shadow-sm border space-y-4 transition-colors ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'}`}>
                <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Dicas</h4>
                <ul className={`text-xs space-y-2 ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Preencha todos os campos para uma proposta mais profissional</li>
                  <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Use a biblioteca de imagens para reutilizar fotos entre propostas</li>
                  <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Os itens calculam automaticamente o total</li>
                  <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Salve como rascunho antes de enviar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
