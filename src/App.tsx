import { Route, Routes } from 'react-router-dom'
import { OrderWorkspace } from './pages/OrderWorkspace'
import { StampStockPage } from './pages/StampStockPage'
import { TextilBestandSeite } from './pages/TextilBestandSeite'
import { ToastContainer, ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<OrderWorkspace />} />
        <Route path="/bestandspflege" element={<StampStockPage />} />
        <Route path="/textil-bestand" element={<TextilBestandSeite />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
