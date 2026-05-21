import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const routeMap: Record<string, string> = {
  'respostas': 'Respostas',
  'feedbacks': 'Feedbacks',
  'terminais': 'Terminais',
  'perfil': 'Perfil',
  'shop': 'Loja',
  'tracking': 'Terminais Online',
  'empresas': 'Gestão de Empresas',
  'novo': 'Nova Empresa'
};

export const Breadcrumbs: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState('');
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const formatted = formatter.format(new Date());
    setCurrentDate(formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }, []);

  return (
    <div className="mt-8 pb-0">
      <div className="max-w-[1170px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center text-sm md:text-base space-y-3 md:space-y-0 px-6 min-[1170px]:px-0">
        <div className="flex items-center space-x-2 text-slate-400 overflow-x-auto w-full md:w-auto scrollbar-hide">
          <Link to="/" className="hover:text-[#0b82ff] cursor-pointer transition-colors whitespace-nowrap">Dashboard</Link>
          
          {pathnames.length > 0 ? (
            pathnames.map((value, index) => {
              const last = index === pathnames.length - 1;
              const to = `/${pathnames.slice(0, index + 1).join('/')}`;
              const label = routeMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

              return (
                <React.Fragment key={to}>
                  <span className="opacity-50">/</span>
                  {last ? (
                    <span className="text-slate-600 font-medium whitespace-nowrap">{label}</span>
                  ) : (
                    <Link to={to} className="hover:text-[#0b82ff] cursor-pointer transition-colors whitespace-nowrap">{label}</Link>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <>
              <span className="opacity-50">/</span>
              <span className="hover:text-[#0b82ff] cursor-pointer transition-colors whitespace-nowrap">Bem-vindo</span>
              <span className="opacity-50">/</span>
              <span className="text-slate-600 font-medium whitespace-nowrap">{user?.email}</span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-500 font-medium whitespace-nowrap">
          <span>{currentDate}</span>
        </div>
      </div>
    </div>
  );
};
