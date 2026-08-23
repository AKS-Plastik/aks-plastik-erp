import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider, useData } from './context/DataContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import Customers from './pages/Customers'
import Reports from './pages/Reports'
import Account from './pages/Account'
import Products from './pages/Products'
import Employees from './pages/Employees'
import Orders from './pages/Orders'
import Finance from './pages/Finance'
import Production from './pages/Production'
import Logistics from './pages/Logistics'
import Settings from './pages/Settings'
import Maintenance from './pages/Maintenance'
import Attendance from './pages/Attendance'
import Purchasing from './pages/Purchasing'

function InnerRoutes() {
  const { isAdmin, user: currentUser } = useAuth()
  const { permissions } = useData()

  const dept = currentUser?.department
  const canSee = (page) => isAdmin || (permissions[dept] || []).includes(page)

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="account" element={<Account />} />
        <Route path="dashboard" element={<Dashboard />} />
        {canSee('customers')   && <Route path="customers"   element={<Customers />} />}
        {canSee('products')    && <Route path="products"    element={<Products />} />}
        {canSee('orders')      && <Route path="orders"      element={<Orders />} />}
        {canSee('work-orders') && <Route path="work-orders" element={<WorkOrders />} />}
        {canSee('reports')     && <Route path="reports"     element={<Reports />} />}
        {canSee('production')  && <Route path="production"  element={<Production />} />}
        {canSee('logistics')   && <Route path="logistics"   element={<Logistics />} />}
        {canSee('maintenance') && <Route path="maintenance" element={<Maintenance />} />}
        <Route path="attendance" element={<Attendance />} />
        {canSee('purchasing') && <Route path="purchasing" element={<Purchasing />} />}
        {isAdmin && <Route path="finance" element={<Finance />} />}
        {isAdmin && <Route path="employees" element={<Employees />} />}
{isAdmin && <Route path="settings" element={<Settings />} />}
      </Route>
    </Routes>
  )
}

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <DataProvider>
      <InnerRoutes />
    </DataProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

function LoginGuard() {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return <Login />
}
