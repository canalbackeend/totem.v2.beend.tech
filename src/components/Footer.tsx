import { FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';

export const Footer = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  const handleGenerateReport = () => {
    // Dispatch a custom event to tell Dashboard to generate the report
    window.dispatchEvent(new CustomEvent('generate-report'));
  };

  return (
    <footer className="border-t border-slate-100 pt-4 pb-4 px-6">
      <div className="max-w-[1170px] mx-auto flex flex-col items-center text-center space-y-6">
        {isDashboard && (
          <div className="space-y-4">
            <p className="text-slate-500 font-medium text-xs">Clique no botão abaixo para gerar relatório</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateReport}
              className="bg-[#0b82ff] hover:bg-[#0070e0] text-white px-8 py-3 rounded-md font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-500/20 cursor-pointer flex items-center space-x-2"
            >
              <FileText size={18} />
              <span>GERAR RELATÓRIO</span>
            </motion.button>
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 w-full text-slate-400 text-sm space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="font-medium">© beend.tech 2026 - Todos os direitos reservados</p>
          </div>
          <p>
            Suporte Técnico: <span className="text-slate-600">suporte@beend.tech</span> - Tel.: <span className="text-slate-600">+55 (61) 9 9595-7461</span>
          </p>
          <p>Brasília/DF - Brasil</p>
        </div>
      </div>
    </footer>
  );
};
