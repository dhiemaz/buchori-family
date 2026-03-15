import { useState } from 'react'
import { FamilyProvider } from './context/FamilyContext'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import MemberForm from './components/MemberForm'
import WelcomeScreen from './components/WelcomeScreen'

export default function App() {
  const [entered, setEntered] = useState(false)

  if (!entered) {
    return <WelcomeScreen onEnter={() => setEntered(true)} />
  }

  return (
    <FamilyProvider>
      <div className="app">
        <Header onExit={() => setEntered(false)} />
        <Dashboard />
        <MemberForm />
      </div>
    </FamilyProvider>
  )
}
