import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ManagerRoute() {
  const { isTerminal, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // Allowed paths for terminal managers
  const allowedPaths = ['/', '/feedbacks'];
  
  if (isTerminal && !allowedPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
