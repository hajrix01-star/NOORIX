import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PermissionGuard from './components/PermissionGuard';
import Forbidden403 from './components/Forbidden403';
import NotFound404 from './components/NotFound404';
import LoadingFallback from './components/LoadingFallback';
import { canAccessThemePreview } from './utils/themePreviewAccess';
import type { AuthSessionUser } from './types/api';

const DashboardScreen = React.lazy(() => import('./modules/Dashboard/DashboardScreen'));
const DailySalesScreen = React.lazy(() => import('./modules/Sales/DailySalesScreen'));
const PurchasesBatchScreen = React.lazy(() => import('./modules/Purchases/PurchasesBatchScreen'));
const ThemePreviewScreen = React.lazy(() => import('./modules/themePreview/ThemePreviewScreen'));
const OwnerDashboardScreen = React.lazy(() => import('./modules/Owner/OwnerDashboardScreen'));
const ReportsLayout = React.lazy(() => import('./modules/Reports/ReportsLayout'));
const ReportsIndexRedirect = React.lazy(() => import('./modules/Reports/ReportsIndexRedirect'));
const ReportsScreen = React.lazy(() => import('./modules/Reports/ReportsScreen'));
const CostAccountingAppsScreen = React.lazy(() => import('./modules/Reports/CostAccountingAppsScreen'));
const ReportsTaxScreen = React.lazy(() => import('./modules/Reports/ReportsTaxScreen'));
const HajriTaxLayout = React.lazy(() => import('./modules/HajriTax/HajriTaxLayout'));
const HajriTaxScreen = React.lazy(() => import('./modules/HajriTax/HajriTaxScreen'));
const HajriTaxQuarterOverview = React.lazy(() => import('./modules/HajriTax/HajriTaxQuarterOverview'));
const BankStatementAnalysisScreen = React.lazy(() => import('./modules/Reports/BankStatementAnalysisScreen'));
const SettingsScreen = React.lazy(() => import('./modules/Settings/SettingsScreen'));
const InvoicesListScreen = React.lazy(() => import('./modules/Invoices'));
const SuppliersScreen = React.lazy(() => import('./modules/Suppliers/SuppliersScreen'));
const TreasuryScreen = React.lazy(() => import('./modules/Treasury/TreasuryScreen'));
const HRMainScreen = React.lazy(() => import('./modules/HR/HRMainScreen'));
const EmployeeProfileScreen = React.lazy(() => import('./modules/HR/EmployeeProfileScreen'));
const ExpensesScreen = React.lazy(() => import('./modules/Expenses/ExpensesScreen'));
const AssetsRegisterScreen = React.lazy(() => import('./modules/Assets/AssetsRegisterScreen'));
const OrdersScreen = React.lazy(() => import('./modules/Orders/OrdersScreen'));
const SmartChatScreen = React.lazy(() => import('./modules/SmartChat/SmartChatScreen'));

type ProtectedAppRoutesProps = {
  user: AuthSessionUser | null;
  isUserLoading: boolean;
};

export function ProtectedAppRoutes({ user, isUserLoading }: ProtectedAppRoutesProps) {
  return (
    <PermissionGuard userRole={user?.role} userPermissions={user?.permissions} isUserLoading={isUserLoading}>
      <Routes>
        <Route path="/purchasing" element={<Navigate to="/purchases" replace />} />
        <Route
          path="/theme-preview"
          element={
            isUserLoading ? (
              <LoadingFallback />
            ) : canAccessThemePreview(user?.role) ? (
              <ThemePreviewScreen />
            ) : (
              <Forbidden403 />
            )
          }
        />
        <Route path="/403" element={<Forbidden403 />} />
        <Route path="/sales" element={<DailySalesScreen />} />
        <Route path="/sales/new" element={<DailySalesScreen />} />
        <Route path="/purchases" element={<PurchasesBatchScreen />} />
        <Route path="/owner" element={<OwnerDashboardScreen />} />
        <Route path="/chat" element={<SmartChatScreen />} />
        <Route path="/suppliers" element={<SuppliersScreen />} />
        <Route path="/expenses" element={<ExpensesScreen />} />
        <Route path="/assets" element={<AssetsRegisterScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/invoices" element={<InvoicesListScreen />} />
        <Route path="/treasury" element={<TreasuryScreen />} />
        <Route path="/hr" element={<HRMainScreen />} />
        <Route path="/hr/employee/:id" element={<EmployeeProfileScreen />} />
        <Route path="/reports" element={<ReportsLayout />}>
          <Route index element={<ReportsIndexRedirect />} />
          <Route path="general" element={<ReportsScreen />} />
          <Route path="cost-apps" element={<CostAccountingAppsScreen />} />
          <Route path="tax" element={<ReportsTaxScreen />} />
          <Route path="vat-registry" element={<Navigate to="/hajri-tax" replace />} />
          <Route path="bank-statement" element={<BankStatementAnalysisScreen />} />
        </Route>
        <Route path="/hajri-tax" element={<HajriTaxLayout />}>
          <Route index element={<HajriTaxScreen />} />
          <Route path="quarters" element={<HajriTaxQuarterOverview />} />
        </Route>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/tax" element={<Navigate to="/reports/tax" replace />} />
        <Route path="/tax/form" element={<Navigate to="/reports/tax" replace />} />
        <Route path="/tax/reports" element={<Navigate to="/reports/tax" replace />} />
        <Route path="/analytics-studio" element={<ReportsIndexRedirect />} />
        <Route path="/analytics" element={<ReportsIndexRedirect />} />
        <Route path="/dashboard-studio" element={<Navigate to="/" replace />} />
        <Route path="/" element={<DashboardScreen />} />
        <Route path="*" element={<NotFound404 />} />
      </Routes>
    </PermissionGuard>
  );
}
