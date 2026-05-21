import { Bell, Settings, User, LogOut, HelpCircle, ShoppingCart, Shield, Wifi, Building2, Globe, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

import { useTheme } from '../contexts/ThemeContext';

export const Navbar = () => {
  const { signOut, user, profile, isAdmin, isTerminal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Até logo!', {
        description: 'Sua sessão foi encerrada com segurança.'
      });
    } catch (error) {
      toast.error('Erro ao sair');
    }
  };
  return (
    <nav className={`z-20 transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900 border-b border-white/5 shadow-none' : 'bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]'}`}>
      <div className="max-w-[1170px] mx-auto py-4 flex justify-between items-center px-6 min-[1170px]:px-0">
        <Link to="/" className="flex flex-col group">
          <span className={`text-2xl md:text-3xl font-bold tracking-tighter font-logo lowercase flex items-start leading-none transition-transform group-hover:scale-[1.02] origin-left ${isDarkMode ? 'text-white' : 'text-black'}`}>
            beend.tech<span className="text-[10px] md:text-[12px] mt-0.5 ml-0.5 font-sans uppercase">®</span>
          </span>
          
          <div className="flex justify-between w-full mt-1 px-[1px]">
            {"SMART SOLUTION".split("").map((char, i) => (
              <span 
                key={i} 
                className={`text-[6px] md:text-[8px] font-thin uppercase leading-none ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </div>
        </Link>

        {isTerminal && (
          <div className="flex items-center gap-3 bg-orange-500/10 px-4 py-2 rounded-xl border border-orange-500/20">
            <Shield size={16} className="text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Acesso Restrito Gerente</span>
            <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
          </div>
        )}

        <div className={`flex items-center space-x-5 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
          {/* Admin Tools */}
          {isAdmin && !isTerminal && (
            <div className={`flex items-center space-x-5 pr-5 border-r mr-2 h-full ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <Link to="/empresas" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title="Gestão de Empresas"
                  className={`${isDarkMode ? 'text-zinc-500 hover:text-white' : 'text-slate-400 hover:text-[#0b82ff]'} transition-colors cursor-pointer flex items-center`}
                >
                  <Building2 size={20} />
                </motion.button>
              </Link>
              <Link to="/platform-settings" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title="Configurar Feedback Global"
                  className={`${isDarkMode ? 'text-zinc-500 hover:text-white' : 'text-slate-400 hover:text-[#0b82ff]'} transition-colors cursor-pointer flex items-center relative`}
                >
                  <Globe size={20} />
                  <span className={`absolute -top-1 -right-2 ${isDarkMode ? 'bg-white text-[#0b82ff]' : 'bg-[#0b82ff] text-white'} text-[6px] font-black uppercase tracking-tighter px-1 py-0.5 rounded leading-none shadow-sm`}>Config</span>
                </motion.button>
              </Link>

              <Link to="/tracking" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title="Terminais Online"
                  className={`${isDarkMode ? 'text-zinc-500 hover:text-green-500' : 'text-slate-400 hover:text-green-500'} transition-colors cursor-pointer relative flex items-center`}
                >
                  <Wifi size={20} />
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border ${isDarkMode ? 'border-zinc-900' : 'border-white'}`} />
                </motion.button>
              </Link>
            </div>
          )}

          {!isTerminal && (
            <>
              <Link to="/shop" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title="Loja"
                  className={`transition-colors cursor-pointer relative flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
                >
                  <ShoppingCart size={20} />
                  <span className={`absolute -top-1 -right-1 bg-[#e74b3c] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 ${isDarkMode ? 'border-zinc-900' : 'border-white'}`}>
                    0
                  </span>
                </motion.button>
              </Link>

              <motion.button 
                whileHover={{ scale: 1.1 }} 
                whileTap={{ scale: 0.95 }} 
                title="Lembretes"
                className={`transition-colors cursor-pointer relative flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
              >
                <Bell size={20} />
                <span className={`absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 ${isDarkMode ? 'border-zinc-900' : 'border-white'}`}>
                  3
                </span>
              </motion.button>
              
              <Link to="/perfil" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title={isAdmin ? `Master Admin: ${user?.email}` : (profile?.nome || "Perfil")}
                  className={`transition-colors cursor-pointer flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'} ${isAdmin ? 'text-[#0b82ff]' : ''}`}
                >
                  <User size={20} />
                </motion.button>
              </Link>
              
              <Link to="/configuracoes" className="flex items-center">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  whileTap={{ scale: 0.95 }} 
                  title="Configurações"
                  className={`transition-colors cursor-pointer flex items-center relative ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
                >
                  <Settings size={20} />
                  <span className={`absolute -top-1.5 -right-2 ${isDarkMode ? 'bg-white text-[#0b82ff]' : 'bg-black text-white'} text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded leading-none shadow-sm`}>Beta</span>
                </motion.button>
              </Link>
            </>
          )}

          <motion.button 
            onClick={() => toggleTheme()}
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.95 }} 
            title="Alternar Tema"
            className={`transition-colors cursor-pointer flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>

          {!isTerminal && (
            <Link to="/faq" className="flex items-center">
              <motion.button 
                whileHover={{ scale: 1.1 }} 
                whileTap={{ scale: 0.95 }} 
                title="FAQ / Documentação"
                className={`transition-colors cursor-pointer flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
              >
                <HelpCircle size={20} />
              </motion.button>
            </Link>
          )}
          
          <motion.button 
            onClick={handleLogout}
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.95 }} 
            title="Sair"
            className={`transition-colors cursor-pointer flex items-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-800'}`}
          >
            <LogOut size={20} />
          </motion.button>
        </div>
      </div>
    </nav>
  );
};
