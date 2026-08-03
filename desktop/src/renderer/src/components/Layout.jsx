import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import UpdateBanner from './UpdateBanner'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-page-bg text-on-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-0 md:ml-64 flex flex-col overflow-hidden transition-all duration-300">
        <TopBar setSidebarOpen={setSidebarOpen} />
        <UpdateBanner />
        <main className="flex-1 min-h-0 overflow-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
