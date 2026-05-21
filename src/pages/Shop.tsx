import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  CheckCircle2, 
  ArrowRight,
  Monitor,
  Smartphone,
  ShieldCheck,
  Zap,
  Plus,
  Trash2,
  Edit2,
  Upload,
  X,
  Image as ImageIcon,
  Save,
  Loader2
} from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  featured_image: string;
  images: string[];
  features: string[];
  color: string;
}

export default function Shop() {
  const { user, isMasterAdmin } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    images: ['', '', '', ''],
    features: ['', '', ''],
    color: '#0b82ff'
  });

  // UI State for each card (main image index)
  const [mainImageIndices, setMainImageIndices] = useState<Record<string, number>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.get('/products');
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (index: number, file: File | undefined) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const loadingToast = toast.loading('Enviando imagem do produto para o Supabase...');

      try {
        const res = await api.post('/upload', {
          image: base64,
          folder: 'shop'
        });
        
        const uploadedUrl = res.url;
        const newImages = [...formData.images];
        newImages[index] = uploadedUrl;
        setFormData({ ...formData, images: newImages });
        toast.dismiss(loadingToast);
        toast.success('Imagem carregada no Supabase!');
      } catch (error: any) {
        toast.dismiss(loadingToast);
        console.error('Error uploading product image:', error);
        toast.error('Erro ao salvar imagem no Supabase.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Você precisa estar logado para salvar');
      return;
    }

    if (!formData.name || !formData.price) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }

    if (formData.images.filter(img => img).length < 4) {
      toast.error('Adicione pelo menos 4 imagens');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        featured_image: formData.images[0],
        images: formData.images,
        features: formData.features.filter(f => f.trim() !== ''),
        color: formData.color,
      };

      if (editingId) {
        await api.patch(`/products/${editingId}`, payload);
        toast.success('Produto atualizado!');
      } else {
        await api.post('/products', payload);
        toast.success('Produto criado com sucesso!');
      }

      setShowForm(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      toast.error('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      images: ['', '', '', ''],
      features: ['', '', ''],
      color: '#0b82ff'
    });
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      images: product.images,
      features: product.features,
      color: product.color
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await api.delete(`/products/${id}`);
      toast.success('Produto excluído com sucesso');
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Erro ao excluir produto');
    }
  };

  const setCardMainImage = (productId: string, index: number) => {
    setMainImageIndices(prev => ({ ...prev, [productId]: index }));
  };

  return (
    <>
      <Breadcrumbs />
      <main className={`flex-1 p-6 min-[1170px]:px-0 space-y-8 transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
        <div className="max-w-[1170px] mx-auto w-full">
          {/* Header */}
          <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className={isDarkMode ? 'text-2xl font-bold text-white tracking-tight flex items-center gap-2' : 'text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2'}>
                <ShoppingBag className="text-[#0b82ff]" size={28} />
                Gerenciador da Loja
              </h2>
              <p className={`text-sm font-medium tracking-tight ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Crie e edite seus equipamentos de forma profissional</p>
            </div>
            {isMasterAdmin && (
              <button 
                onClick={() => { resetForm(); setShowForm(!showForm); }}
                className="bg-[#0b82ff] hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
              >
                {showForm ? <X size={18} /> : <Plus size={18} />}
                {showForm ? 'Cancelar' : 'Novo Produto'}
              </button>
            )}
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-8 rounded-2xl shadow-xl overflow-hidden border transition-colors ${
                  isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
                }`}
              >
                <form onSubmit={handleSave} className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Media */}
                    <div className="space-y-6">
                      <label className={`text-xs font-black uppercase tracking-[.2em] block ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                        Imagens do Produto (Mín. 4)
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {formData.images.map((img, idx) => (
                           <div key={idx} className={`relative group aspect-square rounded-2xl overflow-hidden border-2 border-dashed transition-all ${
                            isDarkMode 
                              ? 'bg-black/50 border-white/5 hover:border-[#0b82ff]' 
                              : 'bg-slate-50 border-slate-200 hover:border-[#0b82ff]'
                          }`}>
                            {img ? (
                              <>
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newImgs = [...formData.images];
                                    newImgs[idx] = '';
                                    setFormData({ ...formData, images: newImgs });
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                               <label className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                                isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                              }`}>
                                <Upload size={24} className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'} />
                                <span className={`text-[10px] font-black mt-2 uppercase ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Subir</span>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(idx, e.target.files?.[0])}
                                />
                              </label>
                            )}
                          </div>
                        ))}
                        {/* Option to add more than 4 */}
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, images: [...formData.images, ''] })}
                          className={`aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center transition-all ${
                            isDarkMode 
                              ? 'border-white/5 text-zinc-700 hover:text-[#0b82ff] hover:border-[#0b82ff]' 
                              : 'border-slate-200 text-slate-300 hover:text-[#0b82ff] hover:border-[#0b82ff]'
                          }`}
                        >
                          <Plus size={32} />
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Título do Produto</label>
                          <input 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={`w-full border-none rounded-xl px-4 py-3 text-sm font-bold outline-none ring-offset-0 focus:ring-2 transition-all ${
                              isDarkMode 
                                ? 'bg-black text-white focus:ring-white/10 placeholder:text-zinc-700' 
                                : 'bg-slate-50 text-slate-700 focus:ring-blue-100 placeholder:text-slate-300'
                            }`}
                            placeholder="Ex: Terminal Totem..."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Preço</label>
                          <input 
                            type="text" 
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className={`w-full border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 transition-all ${
                              isDarkMode 
                                ? 'bg-black text-white focus:ring-white/10 placeholder:text-zinc-700' 
                                : 'bg-slate-50 text-slate-700 focus:ring-blue-100 placeholder:text-slate-300'
                            }`}
                            placeholder="R$ 0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Descrição</label>
                        <textarea 
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                           className={`w-full border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 transition-all min-h-[100px] resize-none ${
                            isDarkMode 
                              ? 'bg-black text-white focus:ring-white/10 placeholder:text-zinc-700' 
                              : 'bg-slate-50 text-slate-700 focus:ring-blue-100 placeholder:text-slate-300'
                          }`}
                          placeholder="Fale um pouco sobre o equipamento..."
                        />
                      </div>

                      <div className="space-y-2">
                         <label className={`text-[10px] font-black uppercase tracking-widest block ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Recursos (Topicos)</label>
                        <div className="space-y-2">
                          {formData.features.map((feature, i) => (
                            <div key={i} className="flex gap-2">
                              <input 
                                type="text" 
                                value={feature}
                                onChange={(e) => {
                                  const newFeatures = [...formData.features];
                                  newFeatures[i] = e.target.value;
                                  setFormData({ ...formData, features: newFeatures });
                                }}
                                className={`flex-1 border-none rounded-lg px-4 py-2 text-xs font-bold outline-none focus:ring-2 transition-all ${
                                  isDarkMode 
                                    ? 'bg-black text-white focus:ring-white/10 placeholder:text-zinc-700' 
                                    : 'bg-slate-50 text-slate-600 focus:ring-blue-100'
                                }`}
                                placeholder={`Recurso ${i + 1}`}
                              />
                            </div>
                          ))}
                          <button 
                            type="button" 
                            onClick={() => setFormData({ ...formData, features: [...formData.features, ''] })}
                            className="text-[10px] font-black text-[#0b82ff] uppercase tracking-widest flex items-center gap-1 mt-2"
                          >
                            <Plus size={14} /> Adicionar Recurso
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button 
                          type="button" 
                          onClick={resetForm}
                          className={`px-6 py-3 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}
                        >
                          Limpar
                        </button>
                        <button 
                          type="submit" 
                          disabled={saving}
                          className={`px-10 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 disabled:opacity-50 transition-all ${
                            isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 hover:bg-black text-white'
                          }`}
                        >
                          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                          {editingId ? 'Salvar Alterações' : 'Publicar Produto'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p className="font-black text-xs uppercase tracking-widest">Carregando loja...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p className="font-black text-sm uppercase tracking-widest opacity-40">Nenhum produto cadastrado</p>
                {isMasterAdmin && (
                  <button 
                    onClick={() => setShowForm(true)}
                    className="mt-4 text-[#0b82ff] text-xs font-black uppercase tracking-widest hover:underline"
                  >
                    Começar Agora
                  </button>
                )}
              </div>
            ) : (
              products.map((product, idx) => {
                const currentImgIdx = mainImageIndices[product.id] ?? 0;
                const imagesCount = product.images.filter(img => img).length;
                
                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                     className={`rounded-3xl overflow-hidden shadow-2xl border transition-all group flex flex-col ${
                      isDarkMode ? 'bg-[#121212] border-white/5 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
                    }`}
                  >
                    {/* Main Image View */}
                    <div className={`aspect-[4/5] w-full relative overflow-hidden transition-colors ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>
                      <AnimatePresence mode="wait">
                        <motion.img 
                          key={currentImgIdx}
                          src={product.images[currentImgIdx] || product.featured_image} 
                          alt={product.name} 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          onClick={() => setZoomImage(product.images[currentImgIdx] || product.featured_image)}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-zoom-in"
                          referrerPolicy="no-referrer"
                        />
                      </AnimatePresence>
                      
                      {/* Thumbnails Overlay (Absolute Positioned) */}
                      <div className={`absolute bottom-6 left-6 right-6 flex justify-center gap-2 p-3 backdrop-blur-md rounded-2xl border transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ${
                        isDarkMode ? 'bg-black/50 border-white/10' : 'bg-white/20 border-white/30'
                      }`}>
                        {product.images.filter(img => img).map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setCardMainImage(product.id, i)}
                            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${currentImgIdx === i ? (isDarkMode ? 'border-white scale-110 shadow-lg shadow-black' : 'border-white scale-110 shadow-lg') : 'border-transparent opacity-60 hover:opacity-100'}`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>

                      {/* Admin Controls Overlay */}
                      {isMasterAdmin && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(product)}
                            className={`p-2.5 rounded-xl shadow-lg transition-all ${
                              isDarkMode ? 'bg-zinc-800 text-white hover:bg-[#0b82ff]' : 'bg-white text-slate-800 hover:bg-blue-50 hover:text-[#0b82ff]'
                            }`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className={`p-2.5 rounded-xl shadow-lg transition-all ${
                              isDarkMode ? 'bg-zinc-800 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-white text-red-500 hover:bg-red-50 transition-all'
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      {/* Floating Category/Label */}
                      <div className="absolute top-5 left-5">
                        <span 
                          className="text-[10px] font-black text-white px-3 py-1.5 rounded-full uppercase tracking-[.2em] shadow-xl backdrop-blur-md"
                          style={{ backgroundColor: `${product.color}cc` }}
                        >
                          {product.price.includes('Plano') ? 'Plano' : 'Hardware'}
                        </span>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-8 flex-1 flex flex-col">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <h3 className={`text-xl font-black tracking-tight leading-tight group-hover:text-[#0b82ff] transition-colors ${
                            isDarkMode ? 'text-white' : 'text-slate-800'
                          }`}>{product.name}</h3>
                          <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>{imagesCount} Ângulos Disponíveis</p>
                        </div>
                        
                        <p className={`text-xs font-medium leading-relaxed line-clamp-3 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{product.description}</p>
                        
                        <div className="grid grid-cols-1 gap-2 py-4">
                          {product.features.map((feature, i) => (
                             <div key={i} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-tight ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                              <CheckCircle2 size={14} className="text-[#4cc077] shrink-0" />
                              <span className="truncate">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-4">
                        <div className={`flex items-center justify-between border-t pt-6 transition-colors ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Valor do Investimento</span>
                            <span className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{product.price}</span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1, x: 5 }}
                            whileTap={{ scale: 0.9 }}
                             className={`p-3 rounded-2xl transition-all border ${
                              isDarkMode ? 'bg-zinc-800 text-white border-white/5 hover:text-[#0b82ff]' : 'bg-slate-50 text-slate-800 border-slate-100 hover:bg-blue-50 hover:text-[#0b82ff]'
                            }`}
                          >
                            <ArrowRight size={20} />
                          </motion.button>
                        </div>
                        
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                           className={`w-full py-4 rounded-2xl text-[12px] font-black uppercase tracking-[.2em] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-white hover:bg-black shadow-xl shadow-slate-200'
                          }`}
                        >
                          Adicionar ao Pedido
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Trust Badges - Lower Section */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, text: "Segurança Total", sub: "Garantia estendida" },
              { icon: Zap, text: "Ativação Instantânea", sub: "Setup imediato" },
              { icon: Monitor, text: "Suporte Premium", sub: "Fale com humanos" },
              { icon: Smartphone, text: "Eco-Hardware", sub: "Baixo consumo" }
            ].map((badge, i) => (
              <div key={i} className={`p-6 rounded-3xl flex flex-col items-center text-center gap-3 border transition-all hover:shadow-xl hover:scale-105 ${
                isDarkMode ? 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900' : 'bg-white/50 border-slate-100 hover:bg-white'
              }`}>
                <div className={`w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center text-[#0b82ff] border transition-colors ${
                  isDarkMode ? 'bg-black border-white/5' : 'bg-white border-slate-50'
                }`}>
                  <badge.icon size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{badge.text}</h4>
                  <p className={`text-[10px] font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer CTA */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-20 bg-gradient-to-br from-[#0b82ff] to-[#0055ff] rounded-[3rem] p-16 relative overflow-hidden text-white text-center"
          >
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
             <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
               <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">Expandindo sua Rede?</h3>
               <p className="text-blue-50 font-medium text-lg opacity-90 leading-relaxed">Condições especiais para compras em lote e parcerias comerciais. Vamos construir o futuro do feedback juntos.</p>
               <motion.button
                 whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
                 whileTap={{ scale: 0.95 }}
                 className="mt-4 bg-white text-[#0b82ff] px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl flex items-center gap-3 mx-auto"
               >
                 Consultar Atacado
                 <ArrowRight size={18} />
               </motion.button>
             </div>
          </motion.div>
        </div>
      </main>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomImage(null)}
            className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X size={24} />
            </motion.button>
            <motion.img
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              src={zoomImage}
              alt="Zoom"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

