import React, { useState, useCallback, useEffect, useMemo } from 'react'
import useSocket from '../../hooks/useSocket'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import useStore from '../../store/useStore'
import './Dashboard.css'

const RANGE_OPTIONS = ['5m', '1h', '24h']

export default function Uptime() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const [summary, setSummary] = useState(null)
  const [range, setRange] = useState('1h')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tickSecs, setTickSecs] = useState(0)  // local uptime ticker

  // ── Fetch from backend ───────────────────────────────────────────────
  const fetchUptime = useCallback(async (rangeKey) => {
    console.log(`[Uptime] ▶ Fetching — range=${rangeKey}`)
    setLoading(true)
    setError(null)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
      let limit = 30
      if (rangeKey === '1h') limit = 360  // up to 360 points (1 per 10s)
      if (rangeKey === '24h') limit = 1440 // up to 1440 points (1 per min if aggregated, or just grab last 1440)

      const res = await fetch(
        `${API_BASE}/uptime?projectKey=${projectKey}&range=${rangeKey}&history_limit=${limit}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[Uptime] ✅ Response received:', data)
      setSummary(data)
    } catch (err) {
      console.error('[Uptime] ❌ Fetch error:', err)
      setError('Failed to load uptime data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUptime(range)
  }, [range, fetchUptime])

  // ── WebSocket live updates ───────────────────────────────────────────
  const handleMessage = useCallback((message) => {
    if (message.type === 'system_health') {
      console.log('[Uptime] 🔄 WebSocket system_health received, re-fetching...')
      fetchUptime(range)
    }
  }, [range, fetchUptime])

  useSocket(handleMessage)

  // ── Local uptime ticker (increments every second) ────────────────────
  useEffect(() => {
    const timer = setInterval(() => setTickSecs(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Derived values ───────────────────────────────────────────────────
  const latest = summary?.latest ?? null
  const history = summary?.history ?? []
  const availabilityPct = summary?.availability_pct ?? 100

  const uptimeMs = latest ? latest.uptimeMs + tickSecs * 1000 : 0

  const formatUptime = (ms) => {
    const totalSecs = Math.floor(ms / 1000)
    const days = Math.floor(totalSecs / 86400)
    const hours = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    return `${days}d ${hours}h ${mins}m ${secs}s`
  }

  // Line chart — reverse history so oldest is left
  const lineChartData = useMemo(() => {
    const ordered = [...history].reverse()
    
    const formatTime = (ts) => {
      if (!ts) return ''
      const d = new Date(ts)
      if (range === '5m') return d.toLocaleTimeString([], { hour12: false })
      if (range === '1h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    return [
      {
        id: 'CPU',
        color: '#ff7a1a',
        data: ordered.map((d) => ({ x: formatTime(d.timestamp || d.createdAt), y: parseFloat(d.cpu.toFixed(1)) })),
      },
      {
        id: 'Memory',
        color: '#3b82f6',
        data: ordered.map((d) => ({ x: formatTime(d.timestamp || d.createdAt), y: parseFloat(d.memory.toFixed(1)) })),
      },
      {
        id: 'Disk',
        color: '#a78bfa',
        data: ordered.map((d) => ({ x: formatTime(d.timestamp || d.createdAt), y: parseFloat(d.disk.toFixed(1)) })),
      },
    ]
  }, [history, range])

  // Pie chart — healthy vs warning share
  const pieChartData = useMemo(() => {
    if (!latest) return []
    const healthy = availabilityPct
    const unhealthy = 100 - availabilityPct
    return [
      { id: 'Healthy', label: 'Healthy', value: parseFloat(healthy.toFixed(2)) },
      { id: 'Warning', label: 'Warning', value: parseFloat(unhealthy.toFixed(2)) },
    ].filter(d => d.value > 0)
  }, [latest, availabilityPct])

  return (
    <div className="dashboard">

      {/* Header + Controls */}
      <div style={{ gridColumn: '1 / -1' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          Uptime & Availability
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
          System uptime and service availability metrics
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <select
            value={range}
            onChange={(e) => {
              console.log(`[Uptime] 🕐 Range changed → ${e.target.value}`)
              setRange(e.target.value)
            }}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '6px',
              padding: '0.4rem 0.8rem', cursor: 'pointer',
            }}
          >
            {RANGE_OPTIONS.map(r => (
              <option key={r} value={r}>Last {r}</option>
            ))}
          </select>

          {loading && <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Loading...</span>}
          {error && <span style={{ fontSize: '0.85rem', color: '#ff4d6a' }}>{error}</span>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-card">
        <div className="metric-label">Current Uptime</div>
        <div className="metric-value" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>
          {latest ? formatUptime(uptimeMs) : '—'}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Availability ({range})</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{availabilityPct.toFixed(2)}</span>
          <span className="metric-unit">%</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className={`status-indicator ${latest?.status === 'healthy' ? 'healthy' : 'warning'}`} />
          <span style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>
            {latest?.status ?? '—'}
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Active Goroutines</div>
        <div className="metric-value">{latest?.goroutines ?? '—'}</div>
      </div>

      {/* Health Distribution Pie */}
      {pieChartData.length > 0 && (
        <div className="chart-container" style={{ gridColumn: 'span 1' }}>
          <div className="chart-title">Availability Distribution</div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsivePie
              data={pieChartData}
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={['#4ade80', '#facc15']}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="var(--muted)"
              arcLinkLabelsThickness={2}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
              tooltip={({ datum }) => (
                <div style={{
                  background: 'var(--bg-elevated)', padding: '10px',
                  borderRadius: '4px', border: '1px solid var(--accent)', color: 'var(--text)',
                }}>
                  <strong>{datum.label}</strong>: {datum.value.toFixed(1)}%
                </div>
              )}
              theme={{
                labels: { text: { fill: 'var(--text)' } },
                tooltip: { container: { background: 'var(--bg-elevated)', color: 'var(--text)' } },
              }}
            />
          </div>
        </div>
      )}

      {/* CPU / Memory / Disk Trend */}
      {lineChartData[0]?.data.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">CPU, Memory & Disk Trends (Last {history.length} updates)</div>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveLine
              data={lineChartData}
              margin={{ top: 10, right: 30, bottom: 80, left: 50 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 0, max: 100 }}
              curve="cardinal"
              axisBottom={{
                tickSize: 5, tickPadding: 5, tickRotation: -45,
                legend: 'Time', legendOffset: 65, legendPosition: 'middle',
              }}
              axisLeft={{
                tickSize: 5, tickPadding: 5, tickRotation: 0,
                legend: 'Usage %', legendOffset: -40, legendPosition: 'middle',
              }}
              colors={{ datum: 'color' }}
              pointSize={5}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              useMesh={true}
              tooltip={({ point }) => (
                <div style={{
                  background: 'var(--bg-elevated)', padding: '10px',
                  borderRadius: '4px', border: '1px solid var(--accent)', color: 'var(--text)',
                }}>
                  <strong>{point.serieId}</strong>: {Number(point.data.y).toFixed(1)}%
                </div>
              )}
              theme={{
                axis: {
                  domain: { line: { stroke: 'rgba(255,255,255,0.1)' } },
                  legend: { text: { fill: 'var(--muted)' } },
                  ticks: { line: { stroke: 'rgba(255,255,255,0.1)' }, text: { fill: 'var(--muted)' } },
                },
                grid: { line: { stroke: 'rgba(255,255,255,0.05)' } },
                tooltip: { container: { background: 'var(--bg-elevated)' } },
              }}
            />
          </div>
        </div>
      )}

      {/* Service Metrics Table */}
      {latest && (
        <div className="chart-container">
          <div className="chart-title">Service Metrics</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'CPU Usage',
                  value: `${latest.cpu?.toFixed(1)}%`,
                  badge: latest.cpu < 50 ? 'success' : latest.cpu < 75 ? 'warning' : 'error',
                  text: latest.cpu < 50 ? 'Healthy' : latest.cpu < 75 ? 'Warning' : 'Critical',
                },
                {
                  label: 'Memory Usage',
                  value: `${latest.memory?.toFixed(1)}%`,
                  badge: latest.memory < 65 ? 'success' : latest.memory < 85 ? 'warning' : 'error',
                  text: latest.memory < 65 ? 'Healthy' : latest.memory < 85 ? 'Warning' : 'Critical',
                },
                {
                  label: 'Disk Usage',
                  value: `${latest.disk?.toFixed(1)}%`,
                  badge: latest.disk < 80 ? 'success' : latest.disk < 90 ? 'warning' : 'error',
                  text: latest.disk < 80 ? 'Healthy' : latest.disk < 90 ? 'Warning' : 'Critical',
                },
                {
                  label: 'Goroutines',
                  value: latest.goroutines,
                  badge: 'success',
                  text: 'Running',
                },
              ].map((row, idx) => (
                <tr key={idx}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                  <td><span className={`status-badge ${row.badge}`}>{row.text}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}