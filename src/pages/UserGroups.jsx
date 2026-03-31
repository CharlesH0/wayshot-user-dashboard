import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { loadCachedUsers } from '../api'

const TABS = [
  { key: 'churned', label: '已流失付费用户', emoji: '💔' },
  { key: 'highValue', label: '高价值付费用户', emoji: '💎' },
  { key: 'annual', label: '年费用户', emoji: '📅' },
  { key: 'other', label: '其他付费用户', emoji: '👤' },
]

export default function UserGroups() {
  const [tab, setTab] = useState('churned')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const cached = await loadCachedUsers()
      setData(cached)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const groups = data?.groups || {}
  const currentUsers = groups[tab] || []
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-CN') : ''

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
              tab === t.key
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
            {groups[t.key] && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                tab === t.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {groups[t.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span>加载中...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={loadData} className="mt-3 px-4 py-1.5 bg-red-100 rounded-lg text-sm hover:bg-red-200 transition cursor-pointer">
            重试
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              共 <span className="font-bold text-gray-700">{currentUsers.length}</span> 个用户
            </span>
            {updatedAt && (
              <span className="text-xs text-gray-400">数据更新于: {updatedAt}</span>
            )}
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {currentUsers.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400">暂无数据</div>
            ) : (
              currentUsers.map(u => (
                <Link
                  key={u.id}
                  to={`/user/${encodeURIComponent(u.id)}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-orange-50 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {u.id.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-mono text-gray-700 group-hover:text-orange-600 transition">
                      {u.id.length > 40 ? u.id.slice(0, 20) + '...' + u.id.slice(-10) : u.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' :
                      u.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      u.status === 'expired' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.status}
                    </span>
                    {u.revenue > 0 && (
                      <span className="text-xs text-orange-500 font-medium">${u.revenue}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {u.payCount}次付费
                    </span>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
