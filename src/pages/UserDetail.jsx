import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchUserEvents, fetchMultiDailyCounts, fetchUserProperties } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const PAY_EVENTS = new Set([
  'rc_initial_purchase_event', 'rc_trial_converted_event',
  'rc_renewal_event', 'rc_non_subscription_purchase_event'
])

const PAY_LABELS = {
  rc_initial_purchase_event: '首次购买',
  rc_trial_converted_event: '试用转付费',
  rc_renewal_event: '续费',
  rc_non_subscription_purchase_event: '一次性购买',
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function timeOnly(ts) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function UserDetail() {
  const { userId } = useParams()
  const decodedId = decodeURIComponent(userId)
  const [events, setEvents] = useState([])
  const [props, setProps] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)

  useEffect(() => { loadData() }, [decodedId, days])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [evts, userProps, allDailyData] = await Promise.all([
        fetchUserEvents(decodedId),
        fetchUserProperties(decodedId),
        fetchMultiDailyCounts(decodedId, [
          'photo_taken', 'final_page_save_success', 'home_reimagine_click',
          'rc_initial_purchase_event', 'rc_trial_converted_event',
          'rc_renewal_event', 'rc_non_subscription_purchase_event'
        ], days),
      ])
      setEvents(evts)
      setProps(userProps)
      setChartData(processChartData(allDailyData))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function processChartData(rows) {
    const dayMap = {}
    for (const [day, event, count] of rows) {
      if (!dayMap[day]) dayMap[day] = { day }
      if (PAY_EVENTS.has(event)) {
        dayMap[day]['付费'] = (dayMap[day]['付费'] || 0) + count
      } else if (event === 'photo_taken') {
        dayMap[day]['拍照'] = count
      } else if (event === 'final_page_save_success') {
        dayMap[day]['保存'] = count
      } else if (event === 'home_reimagine_click') {
        dayMap[day]['首页上传'] = count
      }
    }
    return Object.values(dayMap)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(d => ({ day: d.day, 拍照: d['拍照'] || 0, 保存: d['保存'] || 0, 首页上传: d['首页上传'] || 0, 付费: d['付费'] || 0 }))
  }

  // All events grouped by date — unified timeline
  const activityByDate = useMemo(() => {
    const dateMap = {}
    for (const e of events) {
      const [event, time, filterName, productId, revenue] = e
      const dateKey = formatDate(time)
      if (!dateMap[dateKey]) dateMap[dateKey] = {
        date: dateKey, photos: 0, saves: 0, uploads: 0,
        payments: [], totalEvents: 0, firstTime: time, lastTime: time,
        hasFilter: 0, noFilter: 0
      }
      const d = dateMap[dateKey]
      d.totalEvents++
      if (event === 'photo_taken') {
        d.photos++
        if (filterName && filterName !== 'Original') d.hasFilter++
        else d.noFilter++
      } else if (event === 'final_page_save_success') {
        d.saves++
      } else if (event === 'home_reimagine_click') {
        d.uploads++
      } else if (PAY_EVENTS.has(event)) {
        d.payments.push({ label: PAY_LABELS[event] || event, revenue: parseFloat(revenue) || 0, productId: productId || '' })
      }
      if (new Date(time) < new Date(d.firstTime)) d.firstTime = time
      if (new Date(time) > new Date(d.lastTime)) d.lastTime = time
    }
    const dates = Object.values(dateMap).sort((a, b) => new Date(b.date) - new Date(a.date))
    let peakIdx = 0, peakCount = 0
    dates.forEach((d, i) => { if (d.totalEvents > peakCount) { peakCount = d.totalEvents; peakIdx = i } })
    if (dates.length > 0) dates[peakIdx].isPeak = true
    return dates
  }, [events])

  // Summary stats
  const totalRevenue = useMemo(() => {
    let sum = 0
    for (const e of events) if (PAY_EVENTS.has(e[0])) sum += (parseFloat(e[4]) || 0)
    return sum
  }, [events])
  const payCount = useMemo(() => events.filter(e => PAY_EVENTS.has(e[0])).length, [events])
  const firstSeen = events.length > 0 ? formatDate(events[events.length - 1][1]) : '-'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span>加载用户数据...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">加载失败</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={loadData} className="mt-3 px-4 py-1.5 bg-red-100 rounded-lg text-sm hover:bg-red-200 cursor-pointer">重试</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-500 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        返回列表
      </Link>

      {/* User Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center text-white text-xl font-bold shadow">
            {decodedId.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-gray-500 truncate">{decodedId}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                props?.status === 'active' ? 'bg-green-100 text-green-700' :
                props?.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-500'
              }`}>{props?.status || 'unknown'}</span>
              {props?.utm && <span className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-600">{props.utm}</span>}
              {props?.domain && <span className="px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-600">{props.domain}</span>}
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-orange-500">${totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">累计付费</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{payCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">付费次数</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-600">{firstSeen}</p>
              <p className="text-xs text-gray-400 mt-0.5">首次记录</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Activity Timeline (all events by date) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            📅 行为时间线
            <span className="text-xs text-gray-400 font-normal">共 {activityByDate.length} 天有活动</span>
          </h3>
        </div>
        <div className="p-5 space-y-1 max-h-[600px] overflow-y-auto">
          {activityByDate.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">暂无活动记录</p>
          ) : (
            activityByDate.map(d => (
              <div key={d.date} className={`py-3 px-4 rounded-lg transition ${d.isPeak ? 'bg-red-50 border-2 border-dashed border-red-300' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {d.isPeak && <span>🔥</span>}
                    <span className="text-sm font-semibold text-gray-700">{d.date}</span>
                    <span className="text-xs text-gray-400">
                      {timeOnly(d.firstTime)} — {timeOnly(d.lastTime)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{d.totalEvents} 事件</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                  {d.photos > 0 && (
                    <span className="text-blue-600">
                      📸 拍照 {d.photos}张
                      {d.hasFilter > 0 && <span className="text-blue-400 ml-1">({d.hasFilter}张用滤镜)</span>}
                    </span>
                  )}
                  {d.uploads > 0 && <span className="text-purple-600">🖼️ 上传 {d.uploads}张</span>}
                  {d.saves > 0 && <span className="text-green-600">💾 保存 {d.saves}张</span>}
                  {d.payments.map((pay, pi) => (
                    <span key={pi} className="text-orange-600 font-medium">
                      💰 {pay.label} ${pay.revenue.toFixed(2)}
                      {pay.productId && <span className="text-orange-400 font-normal ml-1">({pay.productId})</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Combined Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">📊 行为趋势</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">时间范围：</span>
            {[7, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-sm transition cursor-pointer ${
                  days === d ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{d}天</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="拍照" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="保存" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="首页上传" stroke="#a855f7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="付费" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
