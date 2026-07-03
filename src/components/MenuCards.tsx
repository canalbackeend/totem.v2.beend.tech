import { Megaphone, HelpCircle, Users, Star, Monitor, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';

export const baseMenuCards = [
  { label: 'CAMPANHAS', value: 0, color: '#f39c13', icon: Megaphone, path: '/campanhas' },
  { label: 'PERGUNTAS', value: 0, color: '#2b80b9', icon: HelpCircle, path: '/perguntas' },
  { label: 'FEEDBACKS', value: 0, color: '#e74b3c', icon: Star, path: '/feedbacks' },
  { label: 'TERMINAIS', value: 0, color: '#767676', icon: Monitor, path: '/terminais', limit: '0 / - terminais' },
];

export const MenuCards = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isTerminal } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [menuCards, setMenuCards] = useState(baseMenuCards);

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      try {
        const stats = await api.get('/dashboard/stats');

        const newCards = [...baseMenuCards];
        
        if (stats.hasCollaborators) {
          // Insert after perguntas
          newCards.splice(2, 0, { label: 'COLAB.', value: 0, color: '#4cc077', icon: Users, path: '/respostas' });
        }

        setMenuCards(newCards.map(card => {
          if (card.label === 'TERMINAIS') {
            const limitText = stats.maxTerminals === -1
              ? 'Ilimitado'
              : `${stats.terminals} / ${stats.maxTerminals} terminais`;
            return {
              ...card,
              value: stats.terminals,
              limit: limitText,
              isBlocked: stats.userStatus !== 'Ativo'
            };
          }
          if (card.label === 'CAMPANHAS') {
            return {
              ...card,
              value: stats.campaigns,
            };
          }
          if (card.label === 'PERGUNTAS') {
            return {
              ...card,
              value: stats.questions,
            };
          }
          if (card.label === 'COLAB.') {
            return {
              ...card,
              value: stats.collaborators,
            };
          }
          if (card.label === 'FEEDBACKS') {
            return {
              ...card,
              value: stats.feedbacks,
            };
          }
          return card;
        }));
      } catch (err) {
        console.error('Error fetching dashboard counts:', err);
      }
    };

    fetchCounts();
  }, [user, location.pathname]);

  const handleCardClick = (card: any) => {
    if (isTerminal && card.label !== 'FEEDBACKS') {
      toast.error('Acesso restrito', {
        description: 'Você não tem permissão para editar ou visualizar esta área.'
      });
      return;
    }
    if (card.path) navigate(card.path);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${menuCards.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
      {menuCards.map((card, index) => (
        <motion.div
  
          key={card.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -5, scale: 1.02 }}
          transition={{ 
            duration: 0.1,
            delay: index * 0.05,
            scale: { duration: 0.1 },
            y: { duration: 0.1 }
          }}
          onClick={() => handleCardClick(card)}
          className={`rounded-lg p-5 flex flex-col justify-between h-32 shadow-[0_10px_30px_rgba(0,0,0,0.04)] cursor-pointer group border-b-0 hover:border-b-[5px] relative overflow-hidden transition-colors ${
            isDarkMode ? 'bg-zinc-900' : 'bg-white'
          } ${isTerminal && card.label !== 'FEEDBACKS' ? 'opacity-50' : ''}`}
          style={{ borderBottomColor: card.color }}
        >
          {isTerminal && card.label !== 'FEEDBACKS' && (
             <div className="absolute top-2 right-2">
               <Shield size={12} className="text-zinc-500 opacity-50" />
             </div>
          )}
          <div className="flex justify-between items-start">
            <span 
              className="text-base font-normal tracking-wider transition-opacity uppercase opacity-80 group-hover:opacity-100"
              style={{ color: card.color }}
            >
              {card.label}
            </span>
            <span className={`text-2xl font-bold transition-colors ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {card.value}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <card.icon size={32} style={{ color: card.color }} strokeWidth={1.5} />
            {card.limit && (
              <span 
                className="text-xs font-black text-white uppercase tracking-tight px-2 py-1 rounded-md leading-none"
                style={{ backgroundColor: card.color }}
              >
                {card.limit}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
