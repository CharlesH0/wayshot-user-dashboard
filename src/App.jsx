import { Routes, Route, Link } from 'react-router-dom'
import UserGroups from './pages/UserGroups'
import UserDetail from './pages/UserDetail'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-2xl">📊</span>
            <h1 className="text-xl font-bold text-gray-800">WayShot User Analytics</h1>
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<UserGroups />} />
          <Route path="/user/:userId" element={<UserDetail />} />
        </Routes>
      </main>
    </div>
  )
}
