import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { API_URL } from '../config'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { token, isAdmin } = useAuth()
  const [customers, setCustomers] = useState([])
  const [reports, setReports] = useState([])
  const [siteVisits, setSiteVisits] = useState([])
  const [products, setProducts] = useState([])
  const [employees, setEmployees] = useState([])
  const [orders, setOrders] = useState([])
  const [financeRecords, setFinanceRecords] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState({})
  const [statusPermissions, setStatusPermissions] = useState({})
  const [userStatusPermissions, setUserStatusPermissions] = useState({})
  const [userPurchasingStatusPermissions, setUserPurchasingStatusPermissions] = useState({})
  const [machines, setMachines] = useState([])
  const [ready, setReady] = useState(false)
  const [reportsReady, setReportsReady] = useState(false)
  const [visitsReady, setVisitsReady] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const authHeaders = { Authorization: `Bearer ${token}` }

  const refreshCustomers = useCallback(() => {
    fetch(`${API_URL}/customers`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => { setCustomers(data); setReady(true) })
      .catch(() => setReady(true))
  }, [token])

  useEffect(() => { refreshCustomers() }, [token])

  const syncAndRefreshCustomers = useCallback(async () => {
    try {
      await fetch(`${API_URL}/sync/customers`, { method: 'POST', headers: authHeaders });
    } catch (err) {
      console.error('Customers sync trigger failed:', err);
    } finally {
      refreshCustomers();
    }
  }, [refreshCustomers])

  const refreshReports = useCallback(() => {
    fetch(`${API_URL}/reports`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => { setReports(data); setReportsReady(true) })
      .catch(() => setReportsReady(true))
  }, [token])
  useEffect(() => { refreshReports() }, [token])

  const refreshSiteVisits = useCallback(() => {
    fetch(`${API_URL}/site-visits`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        const today = new Date().toISOString().split('T')[0]

        let mapped = (Array.isArray(data) ? data : []).map((v) => ({
          ...v,
          customerName: v.customer?.name || '',
          employeeName: v.employee?.name || '',
          status: v.status === 'Scheduled' && v.date <= today ? 'In Progress' : v.status,
        }))

        setSiteVisits(mapped)
        setVisitsReady(true)
        mapped.filter((v, i) => v.status !== data[i].status).forEach((v) => {
          fetch(`${API_URL}/site-visits/${v.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ title: v.title, customerId: v.customerId, location: v.location, employeeId: v.employeeId, date: v.date, time: v.time, status: v.status, notes: v.notes }),
          })
        })
      })
      .catch(() => setVisitsReady(true))
  }, [token])
  useEffect(() => { refreshSiteVisits() }, [token])

  const refreshProducts = useCallback(() => {
    fetch(`${API_URL}/products`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setProducts(data))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshProducts() }, [token])

  const syncAndRefreshProducts = useCallback(async () => {
    try {
      await fetch(`${API_URL}/sync/products`, { method: 'POST', headers: authHeaders });
    } catch (err) {
      console.error('Products sync trigger failed:', err);
    } finally {
      refreshProducts();
    }
  }, [refreshProducts])

  const refreshEmployees = useCallback(() => {
    fetch(`${API_URL}/employees`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setEmployees(data))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshEmployees() }, [token])

  const refreshOrders = useCallback(() => {
    fetch(`${API_URL}/orders`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setOrders(data))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshOrders() }, [token])

  const syncAndRefreshOrders = useCallback(async () => {
    try {
      await fetch(`${API_URL}/sync/orders`, { method: 'POST', headers: authHeaders });
    } catch (err) {
      console.error('Sync trigger failed:', err);
    } finally {
      refreshOrders();
    }
  }, [refreshOrders])

  const refreshFinanceRecords = useCallback(() => {
    fetch(`${API_URL}/finance`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setFinanceRecords(data))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshFinanceRecords() }, [token])

  const refreshRoles = useCallback(() => {
    fetch(`${API_URL}/roles`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setRoles(Array.isArray(data) ? data : []))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshRoles() }, [token])

  const refreshPermissions = useCallback(() => {
    fetch(`${API_URL}/permissions`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setPermissions(data || {}))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshPermissions() }, [token])

  const refreshStatusPermissions = useCallback(() => {
    fetch(`${API_URL}/status-permissions`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setStatusPermissions(data || {}))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshStatusPermissions() }, [token])

  const refreshUserStatusPermissions = useCallback(() => {
    fetch(`${API_URL}/user-status-permissions`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setUserStatusPermissions(data || {}))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshUserStatusPermissions() }, [token])

  const refreshUserPurchasingStatusPermissions = useCallback(() => {
    fetch(`${API_URL}/user-purchasing-status-permissions`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setUserPurchasingStatusPermissions(data || {}))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshUserPurchasingStatusPermissions() }, [token])

  const refreshMachines = useCallback(() => {
    fetch(`${API_URL}/machines`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => setMachines(Array.isArray(data) ? data : []))
      .catch(() => { })
  }, [token])
  useEffect(() => { refreshMachines() }, [token])

  // Auto-refresh all data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshCustomers()
      refreshReports()
      refreshSiteVisits()
      refreshProducts()
      refreshEmployees()
      refreshOrders()
      refreshFinanceRecords()
      refreshRoles()
      refreshPermissions()
      refreshStatusPermissions()
      refreshMachines()
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshCustomers, refreshReports, refreshSiteVisits, refreshProducts, refreshEmployees, refreshOrders, refreshFinanceRecords, refreshRoles, refreshPermissions, refreshStatusPermissions, refreshMachines])

  // ── Customers ──
  async function addCustomer(form) {
    const res = await fetch(`${API_URL}/customers`, { method: 'POST', headers, body: JSON.stringify(form) })
    const customer = await res.json()
    setCustomers((prev) => [customer, ...prev])
  }

  async function updateCustomer(id, form) {
    const res = await fetch(`${API_URL}/customers/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const updated = await res.json()
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)))
    setReports((prev) => prev.map((r) => r.customerId !== id ? r : { ...r, customer: { ...(r.customer || {}), name: updated.name } }))
    setSiteVisits((prev) => prev.map((v) => v.customerId !== id ? v : { ...v, customerName: updated.name, customer: { ...(v.customer || {}), name: updated.name } }))
    setOrders((prev) => prev.map((o) => o.customerId !== id ? o : { ...o, customer: { ...(o.customer || {}), name: updated.name } }))
    return updated
  }

  async function deleteCustomer(id) {
    await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE', headers: authHeaders })
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }

  // ── Reports ──
  async function addReport(form) {
    const res = await fetch(`${API_URL}/reports`, { method: 'POST', headers, body: JSON.stringify(form) })
    const report = await res.json()
    setReports((prev) => [report, ...prev])
  }

  async function updateReport(id, form) {
    const res = await fetch(`${API_URL}/reports/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const updated = await res.json()
    setReports((prev) => prev.map((r) => (r.id === id ? updated : r)))
  }

  async function deleteReport(id) {
    await fetch(`${API_URL}/reports/${id}`, { method: 'DELETE', headers: authHeaders })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  async function moveReport(id, column) {
    const res = await fetch(`${API_URL}/reports/${id}/move`, { method: 'PATCH', headers, body: JSON.stringify({ column }) })
    const updated = await res.json()
    setReports((prev) => prev.map((r) => (r.id === id ? updated : r)))
  }

  // ── Site Visits ──
  async function addSiteVisit(form) {
    const res = await fetch(`${API_URL}/site-visits`, { method: 'POST', headers, body: JSON.stringify(form) })
    const visit = await res.json()
    setSiteVisits((prev) => [{ ...visit, customerName: visit.customer?.name || form.customerName || '', employeeName: visit.employee?.name || form.employeeName || '' }, ...prev])
  }

  async function updateSiteVisit(id, form) {
    const res = await fetch(`${API_URL}/site-visits/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const updated = await res.json()
    setSiteVisits((prev) => prev.map((v) => (v.id === id ? { ...updated, customerName: updated.customer?.name || form.customerName || '', employeeName: updated.employee?.name || form.employeeName || '' } : v)))
  }

  async function deleteSiteVisit(id) {
    await fetch(`${API_URL}/site-visits/${id}`, { method: 'DELETE', headers: authHeaders })
    setSiteVisits((prev) => prev.filter((v) => v.id !== id))
  }

  // ── Products ──
  async function addProduct(form) {
    const res = await fetch(`${API_URL}/products`, { method: 'POST', headers, body: JSON.stringify(form) })
    const product = await res.json()
    setProducts((prev) => [product, ...prev])
  }

  async function updateProduct(id, form) {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const updated = await res.json()
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  async function deleteProduct(id) {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Ürün silinirken bir hata oluştu.')
    }
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  // ── Employees ──
  async function addEmployee(form) {
    const res = await fetch(`${API_URL}/employees`, { method: 'POST', headers, body: JSON.stringify(form) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to add employee')
    }
    const employee = await res.json()
    setEmployees((prev) => [employee, ...prev])
    return employee
  }

  async function updateEmployee(id, form) {
    const res = await fetch(`${API_URL}/employees/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to update employee')
    }
    const updated = await res.json()
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }

  async function deleteEmployee(id) {
    await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE', headers: authHeaders })
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  async function uploadEmployeePhoto(id, file) {
    const formData = new FormData()
    formData.append('photo', file)
    const res = await fetch(`${API_URL}/employees/${id}/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to upload photo')
    }
    const updated = await res.json()
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }

  // ── Orders ──
  async function addOrder(form) {
    const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create order')
    setOrders((prev) => [data, ...prev])

    // Arka planda sipariş Vio'ya gidip kalıcı kodunu (WEB-16 vb.) alacağı için,
    // arayüzü 2 saniye sonra tazeleyerek o güncel kodu ekrana yansıtıyoruz.
    setTimeout(async () => {
      try {
        const fetchRes = await fetch(`${API_URL}/orders/${data.id}`, { headers: authHeaders })
        if (fetchRes.ok) {
          const updatedOrder = await fetchRes.json()
          setOrders(prev => prev.map(o => o.id === data.id ? updatedOrder : o))
        }
      } catch (e) {
        console.error("Vio update fetch failed:", e)
      }
    }, 2000)
  }

  async function updateOrder(id, form) {
    const res = await fetch(`${API_URL}/orders/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update order')
    setOrders((prev) => prev.map((o) => (o.id === id ? data : o)))
  }

  async function deleteOrder(id) {
    const res = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }

  // ── Roles ──
  async function addRole(name) {
    const res = await fetch(`${API_URL}/roles`, { method: 'POST', headers, body: JSON.stringify({ name }) })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const role = await res.json()
    setRoles((prev) => [...prev, role].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function renameRole(id, name) {
    const res = await fetch(`${API_URL}/roles/${id}`, { method: 'PUT', headers, body: JSON.stringify({ name }) })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const updated = await res.json()
    setRoles((prev) => prev.map((r) => r.id === id ? updated : r).sort((a, b) => a.name.localeCompare(b.name)))
    refreshEmployees()
  }

  async function deleteRole(id) {
    const res = await fetch(`${API_URL}/roles/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setRoles((prev) => prev.filter((r) => r.id !== id))
  }

  // ── Permissions ──
  async function updateRolePermissions(role, pages) {
    const res = await fetch(`${API_URL}/permissions/${encodeURIComponent(role)}`, {
      method: 'PUT', headers, body: JSON.stringify({ pages }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setPermissions((prev) => ({ ...prev, [role]: pages }))
  }

  // ── Status Permissions ──
  async function updateRoleStatusPermissions(role, statuses) {
    const res = await fetch(`${API_URL}/status-permissions/${encodeURIComponent(role)}`, {
      method: 'PUT', headers, body: JSON.stringify({ statuses }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setStatusPermissions((prev) => ({ ...prev, [role]: statuses }))
  }

  // ── User Status Permissions ──
  async function updateUserStatusPermissions(userId, statuses) {
    const res = await fetch(`${API_URL}/user-status-permissions/${userId}`, {
      method: 'PUT', headers, body: JSON.stringify({ statuses }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setUserStatusPermissions((prev) => ({ ...prev, [userId]: statuses }))
  }

  // ── User Purchasing Status Permissions ──
  async function updateUserPurchasingStatusPermissions(userId, statuses) {
    const res = await fetch(`${API_URL}/user-purchasing-status-permissions/${userId}`, {
      method: 'PUT', headers, body: JSON.stringify({ statuses }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setUserPurchasingStatusPermissions((prev) => ({ ...prev, [userId]: statuses }))
  }

  // ── Machines ──
  async function addMachine(form) {
    const res = await fetch(`${API_URL}/machines`, { method: 'POST', headers, body: JSON.stringify(form) })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const machine = await res.json()
    setMachines((prev) => [machine, ...prev])
    return machine
  }

  async function updateMachine(id, form) {
    const res = await fetch(`${API_URL}/machines/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const machine = await res.json()
    setMachines((prev) => prev.map((m) => (m.id === id ? machine : m)))
    return machine
  }

  async function deleteMachine(id) {
    const res = await fetch(`${API_URL}/machines/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setMachines((prev) => prev.filter((m) => m.id !== id))
  }

  async function uploadMachineManual(id, file) {
    const formData = new FormData()
    formData.append('manual', file)
    const res = await fetch(`${API_URL}/machines/${id}/manual`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const machine = await res.json()
    setMachines((prev) => prev.map((m) => (m.id === id ? machine : m)))
    return machine
  }

  async function downloadMachineManual(id, filename) {
    const res = await fetch(`${API_URL}/machines/${id}/manual`, { headers: authHeaders })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'manual'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteMachineManual(id) {
    const res = await fetch(`${API_URL}/machines/${id}/manual`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const machine = await res.json()
    setMachines((prev) => prev.map((m) => (m.id === id ? machine : m)))
    return machine
  }

  async function addMaintenanceRecord(machineId, form) {
    const res = await fetch(`${API_URL}/machines/${machineId}/maintenance`, { method: 'POST', headers, body: JSON.stringify(form) })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const record = await res.json()
    setMachines((prev) => prev.map((m) => m.id === machineId
      ? { ...m, maintenanceRecords: [record, ...(m.maintenanceRecords || [])] }
      : m))
    return record
  }

  async function deleteMaintenanceRecord(machineId, recordId) {
    const res = await fetch(`${API_URL}/machines/${machineId}/maintenance/${recordId}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setMachines((prev) => prev.map((m) => m.id === machineId
      ? { ...m, maintenanceRecords: (m.maintenanceRecords || []).filter((r) => r.id !== recordId) }
      : m))
  }

  async function addMonthlyTask(machineId, { year, month, description }) {
    const res = await fetch(`${API_URL}/machines/${machineId}/monthly`, {
      method: 'POST', headers,
      body: JSON.stringify({ year, month, description }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const task = await res.json()
    setMachines((prev) => prev.map((m) => m.id === machineId
      ? { ...m, monthlyMaintenance: [...(m.monthlyMaintenance || []), task] }
      : m))
    return task
  }

  async function updateMonthlyTask(machineId, taskId, data) {
    const res = await fetch(`${API_URL}/machines/${machineId}/monthly/${taskId}`, {
      method: 'PUT', headers,
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    const task = await res.json()
    setMachines((prev) => prev.map((m) => m.id === machineId
      ? { ...m, monthlyMaintenance: (m.monthlyMaintenance || []).map((t) => t.id === taskId ? task : t) }
      : m))
    return task
  }

  async function deleteMonthlyTask(machineId, taskId) {
    const res = await fetch(`${API_URL}/machines/${machineId}/monthly/${taskId}`, { method: 'DELETE', headers: authHeaders })
    if (!res.ok) throw new Error((await res.json()).error || 'Failed')
    setMachines((prev) => prev.map((m) => m.id === machineId
      ? { ...m, monthlyMaintenance: (m.monthlyMaintenance || []).filter((t) => t.id !== taskId) }
      : m))
  }

  // ── Finance Records ──
  async function addFinanceRecord(form) {
    const res = await fetch(`${API_URL}/finance`, { method: 'POST', headers, body: JSON.stringify(form) })
    const record = await res.json()
    setFinanceRecords((prev) => [record, ...prev])
  }

  async function updateFinanceRecord(id, form) {
    const res = await fetch(`${API_URL}/finance/${id}`, { method: 'PUT', headers, body: JSON.stringify(form) })
    const updated = await res.json()
    setFinanceRecords((prev) => prev.map((r) => (r.id === id ? updated : r)))
  }

  async function deleteFinanceRecord(id) {
    await fetch(`${API_URL}/finance/${id}`, { method: 'DELETE', headers: authHeaders })
    setFinanceRecords((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <DataContext.Provider value={{
      customers, addCustomer, updateCustomer, deleteCustomer, refreshCustomers, syncAndRefreshCustomers,
      reports, addReport, updateReport, deleteReport, moveReport,
      siteVisits, addSiteVisit, updateSiteVisit, deleteSiteVisit,
      products, addProduct, updateProduct, deleteProduct, refreshProducts, syncAndRefreshProducts,
      employees, addEmployee, updateEmployee, deleteEmployee, uploadEmployeePhoto,
      orders, addOrder, updateOrder, deleteOrder, refreshOrders, syncAndRefreshOrders,
      financeRecords, addFinanceRecord, updateFinanceRecord, deleteFinanceRecord, refreshFinanceRecords,
      roles, addRole, renameRole, deleteRole,
      permissions, updateRolePermissions, refreshPermissions,
      statusPermissions, updateRoleStatusPermissions, refreshStatusPermissions,
      userStatusPermissions, updateUserStatusPermissions, refreshUserStatusPermissions,
      userPurchasingStatusPermissions, updateUserPurchasingStatusPermissions, refreshUserPurchasingStatusPermissions,
      machines, addMachine, updateMachine, deleteMachine,
      uploadMachineManual, downloadMachineManual, deleteMachineManual,
      addMaintenanceRecord, deleteMaintenanceRecord,
      addMonthlyTask, updateMonthlyTask, deleteMonthlyTask,
      isAdmin,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
