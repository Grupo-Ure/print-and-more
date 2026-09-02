import { OrderWorkspace } from './pages/OrderWorkspace'
import { StampStockPage } from './pages/StampStockPage'
import { TextileStockPage } from './pages/TextileStockPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ProfilePage } from './pages/ProfilePage'
import { ToastContainer, ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ForcedPasswordChange } from './components/ChangePasswordDialog'
import { AppNavbar } from './components/AppNavbar'
import { useNavigation, type AppView } from './context/navigation.context'

function ActiveView({ view }: { view: AppView }) {
  switch (view) {
    case 'orders':
      return <OrderWorkspace />
    case 'stampStock':
      return <StampStockPage />
    case 'textileStock':
      return <TextileStockPage />
    case 'userManagement':
      return <UserManagementPage />
    case 'profile':
      return <ProfilePage />
  }
}

function App() {
  const { view } = useNavigation()
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ToastContainer />
        <ForcedPasswordChange />
        <div className="flex h-screen flex-col overflow-hidden">
          <AppNavbar />
          <div className="min-h-0 flex-1 overflow-auto">
            <ActiveView view={view} />
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
