import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Overview from './pages/Overview'
import UserGroups from './pages/UserGroups'
import UserDetail from './pages/UserDetail'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-2xl">📊</span>
            <h1 className="text-xl font-bold text-gray-800">WayShot User Analytics</h1>
          </Link>
          {!isHome && (
            <Link to="/" className="text-sm text-gray-400 hover:text-orange-500 transition ml-2">
              ← 总览
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/groups/:groupKey" element={<UserGroups />} />
          <Route path="/user/:userId" element={<UserDetail />} />
        </Routes>
      </main>
    </div>
  )
}
