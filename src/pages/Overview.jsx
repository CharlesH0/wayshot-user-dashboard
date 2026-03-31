import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { loadCachedUsers } from '../api'

const GROUPS = [
  { key: 'highValue', label: '高价值付费用户', emoji: '💎', color: 'orange', desc: '付费>5次' },
  { key: 'annual', label: '年费用户', emoji: '📅', color: 'blue', desc: '年费订阅' },
  { key: 'other', label: '其他付费用户', emoji: '👤', color: 'gray', desc: '其他付费' },
]

const REV_BUCKETS = [
  { label: '$0-5', min: 0, max: 5 },
  { label: '$5-20', min: 5, max: 20 },
  { label: '$20-50', min: 20, max: 50 },
  { label: '$50-100', min: 50, max: 100 },
  { label: '$100+', min: 100, max: Infinity },
]

const BEHAVIOR_EVENTS = [
  { key: 'photo_taken', label: '拍照', emoji: '📸' },
  { key: 'ai_framing_on', label: 'AI构图', emoji: '🎯' },
  { key: 'ai_voice_play', label: 'AI语音', emoji: '🎙️' },
  { key: 'app_activated', label: '激活', emoji: '📱' },
  { key: 'final_page_save_success', label: '保存成片', emoji: '💾' },
  { key: 'home_reimagine_click', label: 'Reimagine', emoji: '✨' },
]

function StatCard({ emoji, label, value, sub, color = 'orange', to }) {
  const colorMap = {
    orange: 'from-orange-500 to-amber-400',
    blue: 'from-blue-500 to-cyan-400',
    gray: 'from-gray-500 to-gray-400',
  }
  const content = (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition group ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{emoji}</span>
        {to && (
          <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

function BarChart({ data, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 text-right shrink-0">{d.label}</span>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                background: d.color || 'linear-gradient(90deg, #f97316, #f59e0b)',
              }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Overview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const d = await loadCachedUsers()
      setData(d)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const stats = useMemo(() => {
    if (!data) return null
    const groups = data.groups || {}
    const all = [...(groups.highValue || []), ...(groups.annual || []), ...(groups.other || [])]
    const totalUsers = all.length
    const totalRevenue = all.reduce((s, u) => s + (u.revenue || 0), 0)

    // Revenue distribution per group
    const revDist = {}
    for (const g of GROUPS) {
      const users = groups[g.key] || []
      revDist[g.key] = REV_BUCKETS.map(b => ({
        label: b.label,
        value: users.filter(u => u.revenue >= b.min && u.revenue < b.max).length,
      }))
    }

    // Overall revenue distribution
    const overallRevDist = REV_BUCKETS.map(b => ({
      label: b.label,
      value: all.filter(u => u.revenue >= b.min && u.revenue < b.max).length,
      color: b.max <= 20 ? '#94a3b8' : b.max <= 50 ? '#60a5fa' : b.max <= 100 ? '#f97316' : '#ef4444',
    }))

    // Behavior aggregation per group
    const behaviorStats = {}
    for (const g of GROUPS) {
      const users = groups[g.key] || []
      const agg = {}
      for (const ev of BEHAVIOR_EVENTS) {
        let total = 0, activeCount = 0
        for (const u of users) {
          const cnt = (u.behaviors || {})[ev.key] || 0
          total += cnt
          if (cnt > 0) activeCount++
        }
        agg[ev.key] = { total, activeCount, avgPerActive: activeCount > 0 ? Math.round(total / activeCount * 10) / 10 : 0 }
      }
      behaviorStats[g.key] = agg
    }

    // Overall behavior
    const overallBehavior = BEHAVIOR_EVENTS.map(ev => {
      let total = 0, active = 0
      for (const u of all) {
        const cnt = (u.behaviors || {})[ev.key] || 0
        total += cnt
        if (cnt > 0) active++
      }
      return { ...ev, total, active, pct: totalUsers > 0 ? Math.round(active / totalUsers * 100) : 0 }
    })

    return { groups, totalUsers, totalRevenue, revDist, overallRevDist, behaviorStats, overallBehavior }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">加载失败</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={loadData} className="mt-3 px-4 py-1.5 bg-red-100 rounded-lg text-sm hover:bg-red-200 transition cursor-pointer">重试</button>
      </div>
    )
  }

  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleString('zh-CN') : ''

  return (
    <div className="space-y-8">
      {/* Top summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">付费用户总览</h2>
          <p className="text-sm text-gray-400 mt-0.5">共 {stats.totalUsers} 付费用户 · 总收入 ${Math.round(stats.totalRevenue).toLocaleString()}</p>
        </div>
        {updatedAt && <span className="text-xs text-gray-400">更新于 {updatedAt}</span>}
      </div>

      {/* Group cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUPS.map(g => {
          const users = stats.groups[g.key] || []
          const rev = users.reduce((s, u) => s + (u.revenue || 0), 0)
          return (
            <StatCard
              key={g.key}
              emoji={g.emoji}
              label={g.label}
              value={users.length + ' 人'}
              sub={`$${Math.round(rev).toLocaleString()} 总收入 · ${g.desc}`}
              color={g.color}
              to={`/groups/${g.key}`}
            />
          )
        })}
      </div>

      {/* Revenue distribution */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">💰 付费金额分布（全部用户）</h3>
        <BarChart data={stats.overallRevDist} />
      </div>

      {/* Per-group revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUPS.map(g => (
          <div key={g.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">{g.emoji} {g.label} 付费分布</h3>
            <BarChart data={stats.revDist[g.key]} />
          </div>
        ))}
      </div>

      {/* Behavior overview */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📊 活跃行为分布（近30天）</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.overallBehavior.map(ev => (
            <div key={ev.key} className="text-center p-3 rounded-xl bg-gray-50">
              <div className="text-xl mb-1">{ev.emoji}</div>
              <div className="text-lg font-bold text-gray-800">{ev.total.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{ev.label}</div>
              <div className="text-xs text-gray-400 mt-1">{ev.active}人 · {ev.pct}%参与</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-group behavior comparison table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📈 分组行为对比（近30天）</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">行为</th>
              {GROUPS.map(g => (
                <th key={g.key} className="text-center py-2 px-3 text-gray-500 font-medium">{g.emoji} {g.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BEHAVIOR_EVENTS.map(ev => (
              <tr key={ev.key} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 px-3 text-gray-700">{ev.emoji} {ev.label}</td>
                {GROUPS.map(g => {
                  const s = stats.behaviorStats[g.key]?.[ev.key] || {}
                  return (
                    <td key={g.key} className="text-center py-2.5 px-3">
                      <div className="font-medium text-gray-800">{(s.total || 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-400">{s.activeCount || 0}人 · 人均{s.avgPerActive || 0}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
