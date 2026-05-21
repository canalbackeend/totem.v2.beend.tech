import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Login() {
  const { theme } = useTheme();
  const { updateSession } = useAuth();
  const isDarkMode = theme === 'dark';
  const [isLogin, setIsLogin] = useState(true);
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !isTermsAccepted) {
      toast.error('Você precisa aceitar os Termos de Uso.', {
        description: 'É necessário concordar com nossas políticas para criar uma conta.'
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isTerminalMode) {
        const data = await api.post('/terminals/login', {
          email: formData.email,
          password: formData.password,
        });

        if (data.access_token) {
          updateSession({ 
            access_token: data.access_token, 
            user: {
              id: data.user_id,
              email: data.email,
              nome: data.name,
              empresa: data.company_name,
              terminal_id: data.id,
              logo_url: data.logo_url
            }
          });
          toast.success('Terminal logado com sucesso!', {
            description: `Painel do Terminal: ${data.name}`
          });
          navigate('/');
        }
        return;
      }

      if (isLogin) {
        const data = await api.post('/auth/login', {
          email: formData.email,
          password: formData.password,
        });

        if (data.session) {
          updateSession({ 
            access_token: data.session.access_token, 
            user: data.user 
          });
          toast.success('Bem-vindo de volta!', {
            description: 'Acessando seu painel de controle beend.tech'
          });
          navigate('/');
        }
      } else {
        const data = await api.post('/auth/register', {
          email: formData.email,
          password: formData.password,
          nome: formData.name,
          empresa: formData.company,
        });

        toast.success('Conta criada com sucesso!', {
          description: 'Sua conta foi criada e você já pode acessar o sistema.'
        });
        
        if (data.session) {
          updateSession({ 
            access_token: data.session.access_token, 
            user: data.user 
          });
          navigate('/');
        } else {
          setIsLogin(true);
          setFormData({ ...formData, password: '' });
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      let errorMsg = error.message || 'Verifique suas credenciais e tente novamente.';
      if (errorMsg.includes('Credenciais inválidas')) {
        errorMsg = 'E-mail ou senha incorretos.';
      }

      toast.error('Erro na autenticação', {
        description: errorMsg,
        duration: 8000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 selection:bg-blue-100 selection:text-blue-600 transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-50 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`} />
        <div className={`absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-30 ${isDarkMode ? 'bg-zinc-800/20' : 'bg-slate-200'}`} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full max-w-[1000px] rounded-[32px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_80px_rgba(0,0,0,0.06)] ${isDarkMode ? 'bg-zinc-900 border border-white/5 shadow-none' : 'bg-white'}`}
      >
        {/* Left Side: Branding/Info */}
        <div className={`md:w-[45%] p-8 md:p-12 flex flex-col justify-between text-white relative ${isDarkMode ? 'bg-black' : 'bg-black'}`}>
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          
          <div className="relative z-10">
            <Link to="/" className="flex flex-col group mb-12">
              <div className="flex items-start">
                <span className="text-2xl font-bold tracking-tighter text-white font-logo lowercase group-hover:scale-[1.02] transition-transform origin-left">
                  beend.tech<span className="text-[10px] mt-0.5 ml-0.5 font-sans uppercase">®</span>
                </span>
              </div>
              <div className="flex justify-between w-[120px] mt-1 px-[1px]">
                {"SMART SOLUTION".split("").map((char, i) => (
                  <span key={i} className="text-[5px] font-thin text-slate-400 uppercase leading-none">
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
              </div>
            </Link>

            <div className="space-y-6">
              <h1 className="text-3xl md:text-4xl font-black leading-[1.1] tracking-tighter">
                Evolua a forma como você entende <span className="text-[#0b82ff]">seu cliente.</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[280px]">
                Gestão inteligente de feedbacks, campanhas e satisfação em tempo real.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-12">
            <div className="flex flex-col space-y-4">
              {[
                'Dashboard em tempo real',
                'Campanhas NPS automáticas',
                'Gestão de terminais físicos',
                'Tracking online de satisfação'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-bold tracking-wider uppercase text-slate-300">
                  <CheckCircle2 size={14} className="text-[#0b82ff]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-12 pt-8 border-t border-white/10 flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-slate-800" />
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              +500 empresas usam beend.tech
            </p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className={`flex-1 p-8 md:p-16 flex flex-col justify-center ${isDarkMode ? 'bg-zinc-900' : 'bg-white'}`}>
          <div className="mb-10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className={`text-2xl font-black tracking-tight uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {isTerminalMode ? 'Login Terminal' : (isLogin ? 'Login Portal' : 'Criar Conta')}
                </h2>
                <p className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                  {isTerminalMode ? 'Acesse o painel restrito do terminal.' : (isLogin ? 'Seja bem-vindo de volta ao portal.' : 'Comece sua jornada com 7 dias grátis.')}
                </p>
              </div>
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-50'}`}>
                <ShieldCheck size={24} className="text-[#0b82ff] opacity-50" />
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => { setIsTerminalMode(false); setIsLogin(true); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isTerminalMode ? 'bg-[#0b82ff] text-white' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Usuário
              </button>
              <button 
                type="button"
                onClick={() => { setIsTerminalMode(true); setIsLogin(true); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isTerminalMode ? 'bg-orange-600 text-white' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Gerente (Terminal)
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-2"
                >
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Organização</label>
                  <div className="relative group">
                    <LogIn className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-zinc-700 group-focus-within:text-white' : 'text-slate-300 group-focus-within:text-black'}`} size={18} />
                    <input 
                      required
                      type="text" 
                      placeholder="Nome da sua empresa"
                      className={`w-full border rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-4 transition-all ${
                        isDarkMode 
                          ? 'bg-black border-white/5 text-white focus:border-blue-500 focus:ring-blue-500/5' 
                          : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black focus:ring-black/5'
                      }`}
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>E-mail</label>
              <div className="relative group">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-zinc-700 group-focus-within:text-white' : 'text-slate-300 group-focus-within:text-black'}`} size={18} />
                <input 
                  required
                  type="email" 
                  placeholder="seu@email.com"
                  className={`w-full border rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-4 transition-all ${
                    isDarkMode 
                      ? 'bg-black border-white/5 text-white focus:border-blue-500 focus:ring-blue-500/5' 
                      : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black focus:ring-black/5'
                  }`}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Senha</label>
                {isLogin && <button type="button" className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-white' : 'text-slate-300 hover:text-black'}`}>Esqueci a senha?</button>}
              </div>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-zinc-700 group-focus-within:text-white' : 'text-slate-300 group-focus-within:text-black'}`} size={18} />
                <input 
                  required
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  className={`w-full border rounded-2xl py-4 pl-12 pr-12 text-sm font-bold outline-none focus:ring-4 transition-all ${
                    isDarkMode 
                      ? 'bg-black border-white/5 text-white focus:border-blue-500 focus:ring-blue-500/5' 
                      : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-black focus:ring-black/5'
                  }`}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-zinc-700 hover:text-white' : 'text-slate-300 hover:text-black'}`}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-1 pt-2 pb-1">
                    <label className="relative flex items-center cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isTermsAccepted}
                        onChange={(e) => setIsTermsAccepted(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded-md peer-checked:bg-[#0b82ff] peer-checked:border-[#0b82ff] transition-all flex items-center justify-center group-hover:border-slate-300 peer-checked:[&_svg]:scale-100 ${
                        isDarkMode ? 'bg-black border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="4" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="w-3 h-3 text-white scale-0 transition-transform duration-200"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </label>
                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
                      Aceito os <button type="button" onClick={() => setShowTermsModal(true)} className="text-[#0b82ff] hover:underline decoration-2 underline-offset-2">Termos e Privacidade</button>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={isLoading}
              type="submit"
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] relative overflow-hidden group shadow-xl transition-all ${
                isDarkMode 
                  ? 'bg-blue-600 text-white shadow-blue-500/10 hover:shadow-blue-500/20 hover:-translate-y-0.5' 
                  : 'bg-black text-white shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5'
              } active:translate-y-0`}
            >
              <span className={`flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                {isLogin ? 'Entrar no Sistema' : 'Criar Minha Conta'}
                <ArrowRight size={16} />
              </span>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          </form>

          {!isTerminalMode && (
            <p className={`mt-8 text-center text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>
              {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-[#0b82ff] hover:text-[#0b82ff]/80 transition-colors"
              >
                {isLogin ? 'Cadastre-se Agora' : 'Faça o Login'}
              </button>
            </p>
          )}

          <div className={`mt-12 pt-8 border-t text-center ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
            <p className={`text-[9px] font-medium leading-relaxed max-w-[280px] mx-auto uppercase tracking-tighter ${isDarkMode ? 'text-zinc-700' : 'text-slate-300'}`}>
              Ambiente seguro e criptografado da beend.tech v2.0
            </p>
          </div>
        </div>
      </motion.div>

      {/* Terms and Privacy Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTermsModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col ${isDarkMode ? 'bg-[#0a0a0a] border border-white/5' : 'bg-white'}`}
            >
              <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-white/5 bg-zinc-900/50' : 'border-slate-100'}`}>
                <div>
                  <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Termos e Privacidade</h3>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-zinc-600' : 'text-slate-400'}`}>Última atualização: Maio 2026</p>
                </div>
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-black'}`}
                >
                  <ArrowRight size={20} className="rotate-180" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none">
                <div className={`space-y-6 text-sm font-medium leading-relaxed ${isDarkMode ? 'text-zinc-500' : 'text-slate-600'}`}>
                  <section>
                    <h4 className={`font-black uppercase text-xs tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>1. Coleta de Dados</h4>
                    <p>
                      A beend.tech coleta informações estritamente necessárias para a prestação dos serviços de gestão de satisfação e feedback. Isso inclui dados da empresa, responsável e métricas geradas pelas campanhas.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className={`font-black uppercase text-xs tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>2. Uso das Informações</h4>
                    <p>
                      Os dados coletados são utilizados exclusivamente para gerar relatórios, insights e gerenciar a comunicação com seus clientes finais através dos nossos terminais e plataformas digitais.
                    </p>
                  </section>

                  <section>
                    <h4 className={`font-black uppercase text-xs tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>3. Segurança e Sigilo</h4>
                    <p>
                      Implementamos protocolos de segurança de nível bancário para garantir que as informações de sua empresa e de seus clientes permaneçam confidenciais e protegidas contra acessos não autorizados.
                    </p>
                  </section>

                  <section>
                    <h4 className={`font-black uppercase text-xs tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>4. Cookies</h4>
                    <p>
                      Utilizamos cookies essenciais para manter sua sessão ativa e melhorar a velocidade de carregamento do portal, garantizando uma experiência fluída.
                    </p>
                  </section>
                </div>
              </div>

              <div className={`p-6 border-t flex justify-end ${isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}
                >
                  Entendi e Aceito
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
