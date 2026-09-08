import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import { WalletProvider } from './lib/wallet'
import { ToastProvider } from './lib/toast'
import { I18nProvider, useI18n } from './lib/i18n'
import Nav from './components/Nav'
import SignIn from './screens/SignIn'
import Home from './screens/Home'
import Wallet from './screens/Wallet'
import Pay from './screens/Pay'
import Give from './screens/Give'
import Chats from './screens/Chats'
import Learn from './screens/Learn'
import Prayer from './screens/Prayer'
import Mosques from './screens/Mosques'
import Businesses from './screens/Businesses'
import Profile from './screens/Profile'

const tabRoutes = ['/', '/wallet', '/pay', '/give', '/chats']

function Shell() {
  const { pathname } = useLocation()
  const { sid, loading } = useAuth()
  const { dir } = useI18n()
  const showNav = tabRoutes.includes(pathname)

  // Sign-in is the only public route. Everything else requires an HCS-U7 session.
  if (!sid && pathname !== '/signin') {
    if (loading) return <div className="app" style={{ background: 'var(--primary)' }} />
    return <Navigate to="/signin" replace />
  }
  if (sid && pathname === '/signin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="app" dir={dir}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/" element={<Home />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/give" element={<Give />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/prayer" element={<Prayer />} />
        <Route path="/mosques" element={<Mosques />} />
        <Route path="/businesses" element={<Businesses />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {showNav && <Nav />}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <WalletProvider>
            <ToastProvider>
              <BrowserRouter>
                <Shell />
              </BrowserRouter>
            </ToastProvider>
          </WalletProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
