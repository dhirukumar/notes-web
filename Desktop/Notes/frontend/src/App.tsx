
import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SignupPage from './component/signup'
import  Signin  from './component/signin'
import  Dashboard  from './component/dashboard'
function App() {
  return (
  <div>
   <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
           <Route path="/signin" element={<Signin />} />
           <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
    </BrowserRouter>
  </div>
  )
}

export default App
