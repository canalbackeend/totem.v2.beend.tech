import { motion } from 'motion/react';
import { Download, Smartphone, Wifi, Shield, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ApkDownload() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#ecf0f1]'}`}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg blur opacity-25"></div>
            <div className="relative">
              <span className="text-4xl font-logo text-white lowercase">beend.tech</span>
              <span className="block text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1">APLICATIVO PARA TERMINAIS</span>
            </div>
          </div>

          <div className={`p-8 rounded-3xl border space-y-6 ${isDarkMode ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100 shadow-lg'}`}>
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
              <Smartphone className="text-blue-500 w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h1 className={`text-2xl font-black uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Download do Aplicativo
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                Instale o app Bee-On no seu terminal Android para coletar pesquisas offline.
              </p>
            </div>

            <div className={`space-y-3 text-left ${isDarkMode ? 'text-zinc-400' : 'text-slate-600'}`}>
              {[
                { icon: Wifi, text: 'Funciona 100% offline após configuração' },
                { icon: Shield, text: 'Dados criptografados e seguros' },
                { icon: Zap, text: 'Sincronização automática quando online' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <a
              href="/bee-on.apk"
              download
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Download className="w-5 h-5" />
              Baixar APK (Bee-On)
            </a>

            <p className={`text-[10px] text-center ${isDarkMode ? 'text-zinc-700' : 'text-slate-400'}`}>
              Versão mais recente • Android 8.0+
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
