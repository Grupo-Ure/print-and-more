import { OrderWorkspace } from './pages/OrderWorkspace'
import { ProductionPage } from './pages/ProductionPage'
import { StampStockPage } from './pages/StampStockPage'
import { TextileStockPage } from './pages/TextileStockPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReleaseNotesPage } from './pages/ReleaseNotesPage'
import { ToastContainer, ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ForcedPasswordChange } from './components/ChangePasswordDialog'
import { AppNavbar } from './components/AppNavbar'
import { useNavigation, type AppView } from './context/navigation.context'

function ActiveView({ view }: { view: AppView }) {
  switch (view) {
    case 'orders':
      return <OrderWorkspace />
    case 'production':
      return <ProductionPage />
    case 'stampStock':
      return <StampStockPage />
    case 'textileStock':
      return <TextileStockPage />
    case 'settings':
      return <SettingsPage />
    case 'profile':
      return <ProfilePage />
    case 'releaseNotes':
      return <ReleaseNotesPage />
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
