import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getFirstAccessibleReportPath } from '../../constants/permissions';

/** redirect /reports → أول تبويب مسموح */
export default function ReportsIndexRedirect() {
  const { user } = useApp();
  return <Navigate to={getFirstAccessibleReportPath(user?.role, user?.permissions)} replace />;
}
