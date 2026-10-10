import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { SalesPage } from '../features/sales/SalesPage'
import { CustomersPage } from '../features/customers/CustomersPage'
import { UdhaarPage } from '../features/udhaar/UdhaarPage'
import { InsightsPage } from '../features/insights/InsightsPage'
import { SettingsPage } from '../features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'udhaar', element: <UdhaarPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
