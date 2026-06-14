import React, { useState, useCallback, useEffect, useRef } from 'react'
import useSocket from '../../hooks/useSocket'
import { fetchOverviewData } from '../../services/api'
import useStore from '../../store/useStore'
import { ResponsiveBar } from '@nivo/bar'
import './Overview.css'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatUptime(ms) {
  if (!ms) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

function cpuStatus(v)  { return v < 50 ? 'healthy' : v < 75 ? 'warning' : 'critical' }
function memStatus(v)  { return v < 65 ? 'healthy' : v < 85 ? 'warning' : 'critical' }
function diskStatus(v) { return v < 80 ? 'healthy' : v < 90 ? 'warning' : 'critical' }

function statusLabel(s) {
  if (!s) return 'critical'
  const n = s.toLowerCase()
  if (n === 'healthy' || n === 'ok') return 'healthy'
  if (n === 'warning' || n === 'degraded') return 'warning'
  return 'critical'
}

// ── AnimatedNumber ────────────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 1, suffix = '' }) {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const duration = 600
    cancelAnimationFrame(rafRef.current)
    startRef.current = null

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return <>{Number(display).toFixed(decimals)}{suffix}</>
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, status, icon, subtitle, index }) {
  return (
    <div
      className={`ov-stat-card ov-stat-card--${status || 'default'}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="ov-stat-top">
        <span className="ov-stat-icon">{icon}</span>
        {status && <span className={`ov-pulse ov-pulse--${status}`} />}
      </div>
      <div className="ov-stat-label">{label}</div>
      <div className="ov-stat-value">
        {typeof value === 'number'
          ? <AnimatedNumber value={value} decimals={unit === 'ms' || unit === '%' ? 1 : 0} />
          : value}
        {unit && <span className="ov-stat-unit">{unit}</span>}
      </div>
      {subtitle && <div className="ov-stat-sub">{subtitle}</div>}
    </div>
  )
}

// ── ResourceBar ───────────────────────────────────────────────────────────────

function ResourceBar({ label, value, status }) {
  const pct = Math.min(value ?? 0, 100)
  return (
    <div className="ov-res-row">
      <div className="ov-res-header">
        <span className="ov-res-label">{label}</span>
        <span className={`ov-res-pct ov-res-pct--${status}`}>
          <AnimatedNumber value={pct} />%
        </span>
      </div>
      <div className="ov-res-track">
        <div
          className={`ov-res-fill ov-res-fill--${status}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── method badge colours ──────────────────────────────────────────────────────

const METHOD_COLORS = {
  GET:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  POST:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  PUT:    { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  PATCH:  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  DELETE: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

// ── Overview page ─────────────────────────────────────────────────────────────

export default function Overview() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const projectName = useStore((s) => s.selectedProject?.projectName || s.selectedProject?.projectKey || 'Project')

  const [health, setHealth]     = useState(null)
  const [traffic, setTraffic]   = useState(null)
  const [recent, setRecent]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [liveTag, setLiveTag]   = useState(false)

  // ── initial + periodic fetch ────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!projectKey) return
    try {
      const { traffic: t, health: h } = await fetchOverviewData(projectKey)

      if (t) {
        setTraffic(t)
        setRecent(t.recent_requests ?? [])
      }
      if (h?.metrics?.length) {
        const latest = h.metrics[0]
        setHealth(latest)
      }
      setLastUpdated(new Date())
    } catch (e) {
      console.error('[Overview] fetch error', e)
    } finally {
      setLoading(false)
    }
  }, [projectKey])

  useEffect(() => { load() }, [load])

  // ── live WebSocket updates ──────────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    if (msg.type === 'system_health') {
      const p = msg.payload
      setHealth({
        cpu: p.cpu, memory: p.memory, disk: p.disk,
        uptime: p.uptime, status: p.status,
        latency: p.latency, processes: p.processes,
      })
      setLastUpdated(new Date())
      // flash the live indicator
      setLiveTag(true)
      setTimeout(() => setLiveTag(false), 1200)
    } else if (msg.type === 'metric') {
      setRecent((prev) => [msg.payload, ...prev.slice(0, 9)])
      load() // re-pull traffic summary
    }
  }, [load])

  useSocket(handleMessage)

  // ── chart data ──────────────────────────────────────────────────────────
  const barData = health ? [
    { resource: 'CPU',    value: health.cpu    ?? 0 },
    { resource: 'Memory', value: health.memory ?? 0 },
    { resource: 'Disk',   value: health.disk   ?? 0 },
  ] : []

  const topRoutes = traffic?.top_routes ?? []

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="ov-root">

      {/* ── page header ── */}
      <div className="ov-header">
        <div className="ov-header-left">
          <h1 className="ov-title">
            <span className="ov-title-dim">Overview /</span> {projectName}
          </h1>
          <p className="ov-subtitle">Real-time health &amp; request metrics</p>
        </div>
        <div className="ov-header-right">
          <span className={`ov-live-badge ${liveTag ? 'ov-live-badge--flash' : ''}`}>
            <span className="ov-live-dot" /> LIVE
          </span>
          {lastUpdated && (
            <span className="ov-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="ov-skeleton-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="ov-skeleton-card" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="ov-kpi-grid">
            <StatCard index={0} icon="📡" label="Total Requests"
              value={traffic?.total_requests ?? 0} unit=""
              subtitle={`Last 1 hour`} />
            <StatCard index={1} icon="✅" label="Success Rate"
              value={traffic?.success_rate ?? 100} unit="%"
              status={traffic?.success_rate >= 95 ? 'healthy' : traffic?.success_rate >= 80 ? 'warning' : 'critical'}
              subtitle={`${traffic?.total_2xx ?? 0} successful`} />
            <StatCard index={2} icon="⚡" label="Avg Latency"
              value={traffic?.avg_latency ?? 0} unit="ms"
              status={traffic?.avg_latency < 100 ? 'healthy' : traffic?.avg_latency < 300 ? 'warning' : 'critical'}
              subtitle={`p99: ${traffic?.max_latency ?? '—'}ms`} />
            <StatCard index={3} icon="🔥" label="Error Rate"
              value={traffic?.error_rate ?? 0} unit="%"
              status={traffic?.error_rate < 1 ? 'healthy' : traffic?.error_rate < 5 ? 'warning' : 'critical'}
              subtitle={`${(traffic?.total_4xx ?? 0) + (traffic?.total_5xx ?? 0)} errors`} />
            <StatCard index={4} icon="🖥️" label="CPU"
              value={health?.cpu ?? 0} unit="%"
              status={cpuStatus(health?.cpu ?? 0)}
              subtitle="Current usage" />
            <StatCard index={5} icon="🧠" label="Memory"
              value={health?.memory ?? 0} unit="%"
              status={memStatus(health?.memory ?? 0)}
              subtitle="Current usage" />
          </div>

          {/* ── middle row: resource chart + system health ── */}
          <div className="ov-mid-grid">

            {/* resource bars */}
            <div className="ov-panel ov-panel--resources">
              <div className="ov-panel-header">
                <span className="ov-panel-title">System Resources</span>
                {health && (
                  <span className={`ov-status-badge ov-status-badge--${statusLabel(health.status)}`}>
                    {health.status ?? 'unknown'}
                  </span>
                )}
              </div>
              {health ? (
                <div className="ov-resources">
                  <ResourceBar label="CPU"    value={health.cpu}    status={cpuStatus(health.cpu ?? 0)} />
                  <ResourceBar label="Memory" value={health.memory} status={memStatus(health.memory ?? 0)} />
                  <ResourceBar label="Disk"   value={health.disk}   status={diskStatus(health.disk ?? 0)} />
                  <div className="ov-res-extras">
                    <div className="ov-res-extra">
                      <span className="ov-res-extra-label">Uptime</span>
                      <span className="ov-res-extra-value">{formatUptime(health.uptime ?? health.uptimeMs)}</span>
                    </div>
                    <div className="ov-res-extra">
                      <span className="ov-res-extra-label">Processes</span>
                      <span className="ov-res-extra-value">{health.processes ?? health.goroutines ?? '—'}</span>
                    </div>
                    <div className="ov-res-extra">
                      <span className="ov-res-extra-label">Latency</span>
                      <span className="ov-res-extra-value">{health.latency ?? '—'}ms</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ov-no-data">No health data yet — waiting for agent</div>
              )}
            </div>

            {/* bar chart */}
            {barData.length > 0 && (
              <div className="ov-panel ov-panel--chart">
                <div className="ov-panel-header">
                  <span className="ov-panel-title">Resource Usage</span>
                </div>
                <div style={{ height: '220px' }}>
                  <ResponsiveBar
                    data={barData}
                    keys={['value']}
                    indexBy="resource"
                    margin={{ top: 10, right: 20, bottom: 30, left: 45 }}
                    padding={0.38}
                    borderRadius={4}
                    colors={({ data }) => {
                      const v = data.value
                      if (v >= 85) return '#f87171'
                      if (v >= 60) return '#facc15'
                      return '#ff7a1a'
                    }}
                    axisBottom={{ tickSize: 0, tickPadding: 8 }}
                    axisLeft={{
                      tickSize: 0, tickPadding: 8,
                      legend: '%', legendOffset: -36, legendPosition: 'middle',
                    }}
                    label={({ value }) => `${value.toFixed(0)}%`}
                    labelSkipHeight={14}
                    tooltip={({ indexValue, value }) => (
                      <div className="ov-chart-tooltip">
                        <strong>{indexValue}</strong>: {value.toFixed(1)}%
                      </div>
                    )}
                    theme={{
                      background: 'transparent',
                      axis: {
                        domain: { line: { stroke: 'transparent' } },
                        ticks: { text: { fill: '#a0a4b0', fontSize: 11, fontFamily: 'Inter, sans-serif' } },
                        legend: { text: { fill: '#a0a4b0', fontSize: 11, fontFamily: 'Inter, sans-serif' } },
                      },
                      grid: { line: { stroke: 'rgba(255,255,255,0.05)' } },
                      labels: { text: { fill: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' } },
                    }}
                  />
                </div>
              </div>
            )}

            {/* top routes */}
            {topRoutes.length > 0 && (
              <div className="ov-panel ov-panel--routes">
                <div className="ov-panel-header">
                  <span className="ov-panel-title">Top Routes</span>
                  <span className="ov-panel-meta">last 1h</span>
                </div>
                <div className="ov-route-list">
                  {topRoutes.slice(0, 5).map((r, i) => {
                    const pct = traffic?.total_requests > 0
                      ? (r.count / traffic.total_requests) * 100
                      : 0
                    return (
                      <div key={i} className="ov-route-row">
                        <span className="ov-route-rank">#{i + 1}</span>
                        <span className="ov-route-path">{r.route}</span>
                        <div className="ov-route-bar-wrap">
                          <div className="ov-route-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ov-route-count">{r.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── recent requests table ── */}
          {recent.length > 0 && (
            <div className="ov-panel ov-panel--table">
              <div className="ov-panel-header">
                <span className="ov-panel-title">Recent Requests</span>
                <span className="ov-panel-meta">live stream</span>
              </div>
              <div className="ov-table-wrap">
                <table className="ov-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Route</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 10).map((m, i) => {
                      const mc = METHOD_COLORS[m.method] ?? { color: '#f5f5f5', bg: 'transparent' }
                      const latency = Number(m.responseTime)
                      return (
                        <tr key={i} className="ov-table-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <td className="ov-td-muted">
                            {new Date(m.timestamp || m.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="ov-td-route">{m.route}</td>
                          <td>
                            <span className="ov-method-badge" style={{ color: mc.color, background: mc.bg }}>
                              {m.method}
                            </span>
                          </td>
                          <td>
                            <span className={`ov-status-pill ov-status-pill--${
                              m.statusCode >= 200 && m.statusCode < 300 ? 'ok'
                              : m.statusCode >= 500 ? 'error' : 'warn'
                            }`}>
                              {m.statusCode}
                            </span>
                          </td>
                          <td>
                            <span className={`ov-latency ${latency > 200 ? 'ov-latency--slow' : latency > 100 ? 'ov-latency--mid' : ''}`}>
                              {latency}ms
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── empty state when backend hasn't sent data yet ── */}
          {!health && !traffic && (
            <div className="ov-empty">
              <div className="ov-empty-icon">📡</div>
              <p className="ov-empty-title">Waiting for data</p>
              <p className="ov-empty-sub">Make sure the agent is running and sending metrics for <code>{projectKey}</code></p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
