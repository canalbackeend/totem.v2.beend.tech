/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { ManagerRoute } from './components/ManagerRoute';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import Terminals from './pages/Terminals';
import Feedbacks from './pages/Feedbacks';
import Questions from './pages/Questions';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import FAQ from './pages/FAQ';
import PlatformSettings from './pages/PlatformSettings';
import OnlineTracking from './pages/OnlineTracking';
import Companies from './pages/Companies';
import CreateCompany from './pages/CreateCompany';
import Responses from './pages/Responses';
import Login from './pages/Login';
import Survey from './pages/Survey';
import SurveyOffline from './pages/SurveyOffline';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import { ThemeProvider } from './contexts/ThemeContext';

import SurveyWeb from './pages/SurveyWeb';
import SecureReport from './pages/SecureReport';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/survey-offline" element={<SurveyOffline />} />
          <Route path="/survey-web/:terminalId/:campaignId" element={<SurveyWeb />} />
          <Route path="/relatorio-seguro/:token?" element={<SecureReport />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="feedbacks" element={<Feedbacks />} />

              <Route element={<ManagerRoute />}>
                <Route path="campanhas" element={<Campaigns />} />
                <Route path="campanhas/nova" element={<CreateCampaign />} />
                <Route path="campanhas/editar/:id" element={<CreateCampaign />} />
                <Route path="terminais" element={<Terminals />} />
                <Route path="perguntas" element={<Questions />} />
                <Route path="respostas" element={<Responses />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="shop" element={<Shop />} />
                <Route path="faq" element={<FAQ />} />
                <Route path="configuracoes" element={<Settings />} />
              </Route>
              
              {/* Admin Only Routes */}
              <Route element={<AdminRoute />}>
                <Route path="platform-settings" element={<PlatformSettings />} />
                <Route path="tracking" element={<OnlineTracking />} />
                <Route path="empresas" element={<Companies />} />
                <Route path="empresas/novo" element={<CreateCompany />} />
                <Route path="empresas/editar/:id" element={<CreateCompany />} />
              </Route>
            </Route>
          </Route>
          
          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
