import { Route, Routes } from 'react-router-dom'
import { OrderWorkspace } from './pages/OrderWorkspace'
import { StampStockPage } from './pages/StampStockPage'
import { TextileStockPage } from './pages/TextileStockPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ToastContainer, ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import { AppNavbar } from './components/AppNavbar'

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ToastContainer />
        <div className="flex h-screen flex-col overflow-hidden">
          <AppNavbar />
          <div className="min-h-0 flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<OrderWorkspace />} />
              <Route path="/stamp-stock" element={<StampStockPage />} />
              <Route path="/textile-stock" element={<TextileStockPage />} />
              <Route path="/user-management" element={<UserManagementPage />} />
            </Routes>
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
