import React, { useState, useCallback, useEffect, useMemo } from 'react'
import useSocket from '../../hooks/useSocket'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import useStore from '../../store/useStore'
import './Dashboard.css'

const RANGE_OPTIONS = ['5m', '1h', '24h']

export default function Uptime() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const [summary, setSummary]   = useState(null)
  const [timeseries, setTimeseries] = useState(null)
  const [range, setRange]       = useState('1h')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [, setTick]             = useState(0)

  // ── Fetch ────────────────────────────────────────────────────────────
  const fetchUptime = useCallback(async (rangeKey) => {
    if (!projectKey) return;
    console.log(`[Uptime] ▶ fetchUptime — range=${rangeKey}`)
    setLoading(true)
    setError(null)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
      const [resSummary, resTimeseries] = await Promise.all([
        fetch(`${API_BASE}/uptime?projectKey=${projectKey}&range=${rangeKey}&history_limit=1`),
        fetch(`${API_BASE}/uptime/timeseries?projectKey=${projectKey}&range=${rangeKey}`)
      ])
      
      if (!resSummary.ok) throw new Error(`HTTP ${resSummary.status}`)
      if (!resTimeseries.ok) throw new Error(`HTTP ${resTimeseries.status}`)
      
      const data = await resSummary.json()
      const tsData = await resTimeseries.json()
      
      setSummary(data)
      setTimeseries(tsData)
    } catch (err) {
      console.error('[Uptime] ❌ Fetch error:', err)
      setError('Failed to load uptime data')
    } finally {
      setLoading(false)
    }
  }, [projectKey])

  useEffect(() => {
    fetchUptime(range)
  }, [range, fetchUptime])

  // ── WebSocket ────────────────────────────────────────────────────────
  const handleMessage = useCallback((message) => {
    if (message.type === 'system_health') {
      console.log('[Uptime] 🔄 WS system_health received — re-fetching...')
      fetchUptime(range)
    }
  }, [range, fetchUptime])

  useSocket(handleMessage)

  // ── Uptime ticker — just forces a re-render every second ────────────
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Derived values ───────────────────────────────────────────────────
  const latest          = summary?.latest          ?? null
  const history         = summary?.history         ?? []
  const availabilityPct = summary?.availability_pct ?? 100

  // Compute uptime from the DB-anchored started_at timestamp.
  // This means refresh 1000 times — the counter stays correct every time.
  const startedAtMs = summary?.uptime_started_at ? new Date(summary.uptime_started_at).getTime() : null
  const uptimeMs    = startedAtMs ? Date.now() - startedAtMs : (latest?.uptimeMs ?? 0)

  const formatUptime = (ms) => {
    const s    = Math.floor(ms / 1000)
    const days = Math.floor(s / 86400)
    const hrs  = Math.floor((s % 86400) / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    return `${days}d ${hrs}h ${mins}m ${secs}s`
  }

  // Format a timestamp (ms or s) into a readable time label
  const formatTimeLabel = (ts) => {
    // detect seconds vs milliseconds
    const ms = ts < 1e11 ? ts * 1000 : ts
    const d  = new Date(ms)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // ── Line chart data — x = time label, y = value ──────────────────────
  const lineChartData = useMemo(() => {
    const buckets = timeseries?.buckets ?? []
    if (!buckets.length) return []

    return [
      {
        id: 'CPU',
        color: '#ff7a1a',
        data: buckets.map(b => ({
          x: formatTimeLabel(b.timestamp),
          y: parseFloat(b.avg_cpu.toFixed(2)),
        })),
      },
      {
        id: 'Memory',
        color: '#3b82f6',
        data: buckets.map(b => ({
          x: formatTimeLabel(b.timestamp),
          y: parseFloat(b.avg_memory.toFixed(2)),
        })),
      },
      {
        id: 'Disk',
        color: '#a78bfa',
        data: buckets.map(b => ({
          x: formatTimeLabel(b.timestamp),
          y: parseFloat(b.avg_disk.toFixed(2)),
        })),
      },
    ]
  }, [timeseries])

  // ── Pie chart data ───────────────────────────────────────────────────
  const pieChartData = useMemo(() => {
    const healthy   = parseFloat(availabilityPct.toFixed(2))
    const unhealthy = parseFloat((100 - availabilityPct).toFixed(2))
    return [
      { id: 'Healthy', label: 'Healthy', value: healthy   },
      { id: 'Warning', label: 'Warning', value: unhealthy },
    ].filter(d => d.value > 0)
  }, [availabilityPct])

  // How many x-axis tick labels to show so they don't overlap
  const tickValues = useMemo(() => {
    if (!lineChartData.length || !lineChartData[0].data.length) return []
    const pts   = lineChartData[0].data
    const every = Math.max(1, Math.floor(pts.length / 8)) // show ~8 labels
    return pts
      .filter((_, i) => i % every === 0 || i === pts.length - 1)
      .map(p => p.x)
  }, [lineChartData])

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
          {error   && <span style={{ fontSize: '0.85rem', color: '#ff4d6a'    }}>{error}</span>}
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

      {/* Availability Pie */}
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

      {/* CPU / Memory / Disk Line Chart */}
      <div className="chart-container" style={{ gridColumn: lineChartData.length ? 'span 1' : '1 / -1' }}>
        <div className="chart-title">
          CPU, Memory & Disk Over Time
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
            ({history.length} data points)
          </span>
        </div>

        {lineChartData.length > 0 && lineChartData[0].data.length > 0 ? (
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveLine
              data={lineChartData}
              margin={{ top: 20, right: 110, bottom: 60, left: 55 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 0, max: 100, stacked: false }}
              curve="monotoneX"
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: -35,
                tickValues: tickValues,
                legend: 'Time',
                legendOffset: 55,
                legendPosition: 'middle',
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Usage %',
                legendOffset: -45,
                legendPosition: 'middle',
                format: v => `${v}%`,
              }}
              colors={{ datum: 'color' }}
              lineWidth={2}
              pointSize={3}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={1}
              pointBorderColor={{ from: 'serieColor' }}
              enableArea={true}
              areaOpacity={0.07}
              useMesh={true}
              legends={[
                {
                  anchor: 'bottom-right',
                  direction: 'column',
                  justify: false,
                  translateX: 100,
                  translateY: 0,
                  itemsSpacing: 0,
                  itemDirection: 'left-to-right',
                  itemWidth: 80,
                  itemHeight: 20,
                  itemOpacity: 0.85,
                  symbolSize: 10,
                  symbolShape: 'circle',
                  itemTextColor: 'var(--muted)',
                  effects: [{ on: 'hover', style: { itemOpacity: 1 } }],
                },
              ]}
              tooltip={({ point }) => (
                <div style={{
                  background: 'var(--bg-elevated)', padding: '10px',
                  borderRadius: '4px', border: '1px solid var(--accent)', color: 'var(--text)',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ marginBottom: '4px', color: 'var(--muted)' }}>{point.data.x}</div>
                  <strong style={{ color: point.serieColor }}>{point.serieId}</strong>
                  {': '}{Number(point.data.y).toFixed(1)}%
                </div>
              )}
              theme={{
                axis: {
                  domain: { line: { stroke: 'rgba(255,255,255,0.1)' } },
                  legend: { text: { fill: 'var(--muted)', fontSize: 12 } },
                  ticks: {
                    line: { stroke: 'rgba(255,255,255,0.1)' },
                    text: { fill: 'var(--muted)', fontSize: 10 },
                  },
                },
                grid:    { line: { stroke: 'rgba(255,255,255,0.05)' } },
                tooltip: { container: { background: 'var(--bg-elevated)' } },
              }}
            />
          </div>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            {loading ? 'Loading chart data...' : 'No history data available for this range'}
          </div>
        )}
      </div>

      {/* Service Metrics Table */}
      {latest && (
        <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-title">Current Service Metrics</div>
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
                  text:  latest.cpu < 50 ? 'Healthy'  : latest.cpu < 75 ? 'Warning'  : 'Critical',
                },
                {
                  label: 'Memory Usage',
                  value: `${latest.memory?.toFixed(1)}%`,
                  badge: latest.memory < 65 ? 'success' : latest.memory < 85 ? 'warning' : 'error',
                  text:  latest.memory < 65 ? 'Healthy'  : latest.memory < 85 ? 'Warning'  : 'Critical',
                },
                {
                  label: 'Disk Usage',
                  value: `${latest.disk?.toFixed(1)}%`,
                  badge: latest.disk < 80 ? 'success' : latest.disk < 90 ? 'warning' : 'error',
                  text:  latest.disk < 80 ? 'Healthy'  : latest.disk < 90 ? 'Warning'  : 'Critical',
                },
                {
                  label: 'Goroutines',
                  value: latest.goroutines,
                  badge: 'success',
                  text:  'Running',
                },
              ].map((row, idx) => (
                <tr key={idx}>
                  <td>{row.label}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.value}</td>
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