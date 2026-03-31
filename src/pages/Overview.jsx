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
  { key: 'user_speaks_intent_reconginized', label: '用户主动说话', emoji: '🗣️' },
  { key: 'app_activated', label: '激活', emoji: '📱' },
  { key: 'final_page_save_success', label: '保存成片', emoji: '💾' },
  { key: 'home_reimagine_click', label: 'Reimagine', emoji: '✨' },
]

const INTENT_TYPES = [
  { key: 'small_talk', label: '闲聊', emoji: '💬', color: '#f97316' },
  { key: 'none', label: '未识别', emoji: '❓', color: '#94a3b8' },
  { key: 'parameter_adjustment', label: '参数调整', emoji: '⚙️', color: '#3b82f6' },
  { key: 'composition_guidance', label: '构图指导', emoji: '📐', color: '#8b5cf6' },
  { key: 'filter_recommendation', label: '滤镜推荐', emoji: '🎨', color: '#ec4899' },
  { key: 'pose_guidance', label: '姿势指导', emoji: '🧍', color: '#10b981' },
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

    // Helper to aggregate behaviors from a field name
    function aggBehaviors(users, field) {
      const agg = {}
      for (const ev of BEHAVIOR_EVENTS) {
        let total = 0, activeCount = 0
        for (const u of users) {
          const cnt = (u[field] || {})[ev.key] || 0
          total += cnt
          if (cnt > 0) activeCount++
        }
        agg[ev.key] = { total, activeCount, avgPerActive: activeCount > 0 ? Math.round(total / activeCount * 10) / 10 : 0 }
      }
      return agg
    }

    // Behavior aggregation per group (30d + all-time)
    const behaviorStats = {}
    const behaviorStatsAll = {}
    for (const g of GROUPS) {
      const users = groups[g.key] || []
      behaviorStats[g.key] = aggBehaviors(users, 'behaviors')
      behaviorStatsAll[g.key] = aggBehaviors(users, 'behaviorsAll')
    }

    // Overall behavior (30d)
    const overallBehavior = BEHAVIOR_EVENTS.map(ev => {
      let total = 0, active = 0
      for (const u of all) {
        const cnt = (u.behaviors || {})[ev.key] || 0
        total += cnt
        if (cnt > 0) active++
      }
      return { ...ev, total, active, pct: totalUsers > 0 ? Math.round(active / totalUsers * 100) : 0 }
    })

    // Overall behavior (all-time)
    const overallBehaviorAll = BEHAVIOR_EVENTS.map(ev => {
      let total = 0, active = 0
      for (const u of all) {
        const cnt = (u.behaviorsAll || {})[ev.key] || 0
        total += cnt
        if (cnt > 0) active++
      }
      return { ...ev, total, active, pct: totalUsers > 0 ? Math.round(active / totalUsers * 100) : 0 }
    })

    // Intent aggregation (all-time + 30d)
    function aggIntents(users, field) {
      const agg = {}
      for (const it of INTENT_TYPES) {
        let total = 0, activeCount = 0
        for (const u of users) {
          const cnt = (u[field] || {})[it.key] || 0
          total += cnt
          if (cnt > 0) activeCount++
        }
        agg[it.key] = { total, activeCount }
      }
      return agg
    }

    const intentStatsAll = {}
    const intentStats30d = {}
    for (const g of GROUPS) {
      const users = groups[g.key] || []
      intentStatsAll[g.key] = aggIntents(users, 'intentsAll')
      intentStats30d[g.key] = aggIntents(users, 'intents30d')
    }

    const overallIntentsAll = INTENT_TYPES.map(it => {
      let total = 0, active = 0
      for (const u of all) {
        const cnt = (u.intentsAll || {})[it.key] || 0
        total += cnt
        if (cnt > 0) active++
      }
      return { ...it, total, active }
    })

    const overallIntents30d = INTENT_TYPES.map(it => {
      let total = 0, active = 0
      for (const u of all) {
        const cnt = (u.intents30d || {})[it.key] || 0
        total += cnt
        if (cnt > 0) active++
      }
      return { ...it, total, active }
    })

    return { groups, totalUsers, totalRevenue, revDist, overallRevDist, behaviorStats, behaviorStatsAll, overallBehavior, overallBehaviorAll, intentStatsAll, intentStats30d, overallIntentsAll, overallIntents30d }
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

      {/* Behavior overview - All time */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📊 全量行为分布（激活至今）</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.overallBehaviorAll.map(ev => (
            <div key={ev.key} className="text-center p-3 rounded-xl bg-orange-50">
              <div className="text-xl mb-1">{ev.emoji}</div>
              <div className="text-lg font-bold text-gray-800">{ev.total.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{ev.label}</div>
              <div className="text-xs text-gray-400 mt-1">{ev.active}人 · {ev.pct}%参与</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-group behavior comparison - All time */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📈 分组行为对比（全量）</h3>
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
                  const s = stats.behaviorStatsAll[g.key]?.[ev.key] || {}
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

      {/* Behavior overview - 30 days */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">📊 近30天行为分布</h3>
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

      {/* Per-group behavior comparison - 30 days */}
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

      {/* === Intent Analysis Module === */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">🗣️ 用户主动对话 · 意图分析</h2>

        {/* Intent overview - All time */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">全量意图分布（激活至今）</h3>
          {(() => {
            const totalAll = stats.overallIntentsAll.reduce((s, it) => s + it.total, 0)
            return (
              <>
                <div className="text-sm text-gray-500 mb-4">共 {totalAll.toLocaleString()} 次对话</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  {stats.overallIntentsAll.map(it => (
                    <div key={it.key} className="text-center p-3 rounded-xl" style={{ backgroundColor: it.color + '10' }}>
                      <div className="text-xl mb-1">{it.emoji}</div>
                      <div className="text-lg font-bold text-gray-800">{it.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{it.label}</div>
                      <div className="text-xs mt-1" style={{ color: it.color }}>{totalAll > 0 ? (it.total / totalAll * 100).toFixed(1) : 0}%</div>
                      <div className="text-xs text-gray-400">{it.active}人参与</div>
                    </div>
                  ))}
                </div>
                {/* Horizontal stacked bar */}
                <div className="h-6 rounded-full overflow-hidden flex">
                  {stats.overallIntentsAll.filter(it => it.total > 0).map(it => (
                    <div
                      key={it.key}
                      className="h-full transition-all relative group"
                      style={{ width: `${(it.total / totalAll * 100)}%`, backgroundColor: it.color }}
                      title={`${it.label}: ${it.total.toLocaleString()} (${(it.total / totalAll * 100).toFixed(1)}%)`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {stats.overallIntentsAll.filter(it => it.total > 0).map(it => (
                    <span key={it.key} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: it.color }} />
                      {it.label}
                    </span>
                  ))}
                </div>
              </>
            )
          })()}
        </div>

        {/* Intent per-group comparison - All time */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-x-auto mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">分组意图对比（全量）</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">意图</th>
                {GROUPS.map(g => (
                  <th key={g.key} className="text-center py-2 px-3 text-gray-500 font-medium">{g.emoji} {g.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INTENT_TYPES.map(it => (
                <tr key={it.key} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-700">{it.emoji} {it.label}</td>
                  {GROUPS.map(g => {
                    const s = stats.intentStatsAll[g.key]?.[it.key] || {}
                    return (
                      <td key={g.key} className="text-center py-2.5 px-3">
                        <div className="font-medium text-gray-800">{(s.total || 0).toLocaleString()}</div>
                        <div className="text-xs text-gray-400">{s.activeCount || 0}人</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Intent overview - 30 days */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">近30天意图分布</h3>
          {(() => {
            const total30 = stats.overallIntents30d.reduce((s, it) => s + it.total, 0)
            return (
              <>
                <div className="text-sm text-gray-500 mb-4">共 {total30.toLocaleString()} 次对话</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  {stats.overallIntents30d.map(it => (
                    <div key={it.key} className="text-center p-3 rounded-xl bg-gray-50">
                      <div className="text-xl mb-1">{it.emoji}</div>
                      <div className="text-lg font-bold text-gray-800">{it.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{it.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{total30 > 0 ? (it.total / total30 * 100).toFixed(1) : 0}% · {it.active}人</div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>

        {/* Intent per-group comparison - 30 days */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-x-auto">
          <h3 className="text-sm font-bold text-gray-700 mb-4">分组意图对比（近30天）</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">意图</th>
                {GROUPS.map(g => (
                  <th key={g.key} className="text-center py-2 px-3 text-gray-500 font-medium">{g.emoji} {g.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INTENT_TYPES.map(it => (
                <tr key={it.key} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-700">{it.emoji} {it.label}</td>
                  {GROUPS.map(g => {
                    const s = stats.intentStats30d[g.key]?.[it.key] || {}
                    return (
                      <td key={g.key} className="text-center py-2.5 px-3">
                        <div className="font-medium text-gray-800">{(s.total || 0).toLocaleString()}</div>
                        <div className="text-xs text-gray-400">{s.activeCount || 0}人</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
