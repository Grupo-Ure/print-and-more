import { Route, Routes } from 'react-router-dom'
import { OrderWorkspace } from './pages/OrderWorkspace'
import { StampStockPage } from './pages/StampStockPage'
import { TextileStockPage } from './pages/TextileStockPage'
import { ToastContainer, ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<OrderWorkspace />} />
        <Route path="/bestandspflege" element={<StampStockPage />} />
        <Route path="/textil-bestand" element={<TextileStockPage />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
