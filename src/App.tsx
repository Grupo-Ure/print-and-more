import { Route, Routes } from 'react-router-dom'
import { OrderWorkspace } from './pages/OrderWorkspace'
import { BestandspflegeSeite } from './pages/BestandspflegeSeite'
import { TextilBestandSeite } from './pages/TextilBestandSeite'
import { ToastContainer, ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<OrderWorkspace />} />
        <Route path="/bestandspflege" element={<BestandspflegeSeite />} />
        <Route path="/textil-bestand" element={<TextilBestandSeite />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
