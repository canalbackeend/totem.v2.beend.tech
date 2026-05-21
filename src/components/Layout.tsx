import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { NPSSurvey } from './NPSSurvey';
import { Toaster } from 'sonner';

import { useTheme } from '../contexts/ThemeContext';

export const Layout = () => {
  const { theme } = useTheme();
  
  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#ecf0f1] text-slate-900'
    }`}>
      <Toaster position="top-right" duration={3000} closeButton richColors />
      <Navbar />
      <Outlet />
      <Footer />
      <NPSSurvey />
    </div>
  );
};
