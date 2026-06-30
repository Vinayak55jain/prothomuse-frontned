import React, { useState, useCallback, useMemo } from 'react'
import useSocket from '../../hooks/useSocket'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveLine } from '@nivo/line'
import useStore from '../../store/useStore'
import './Dashboard.css'

const RANGE_OPTIONS = ['5m', '1h', '24h']
const LIMIT_OPTIONS = [10, 20, 50, 100]

export default function Traffic() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const [summary, setSummary] = useState(null)
  const [timeseries, setTimeseries] = useState(null)
  const [range, setRange] = useState('1h')
  const [recentLimit, setRecentLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTraffic = useCallback(async (rangeKey, limit) => {
    if (!projectKey) return;
    setLoading(true)
    setError(null)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
      const [resSummary, resTimeseries] = await Promise.all([
        fetch(`${API_BASE}/traffic?projectKey=${projectKey}&range=${rangeKey}&recent_limit=${limit}`),
        fetch(`${API_BASE}/traffic/timeseries?projectKey=${projectKey}&range=${rangeKey}`)
      ])
      
      if (!resSummary.ok) throw new Error(`HTTP ${resSummary.status}`)
      if (!resTimeseries.ok) throw new Error(`HTTP ${resTimeseries.status}`)
      
      const data = await resSummary.json()
      const tsData = await resTimeseries.json()
      
      setSummary(data)
      setTimeseries(tsData)
    } catch (err) {
      console.error('[Traffic] ❌ Fetch error:', err)
      setError('Failed to load traffic data')
    } finally {
      setLoading(false)
    }
  }, [projectKey])

  React.useEffect(() => {
    fetchTraffic(range, recentLimit)
  }, [range, recentLimit, fetchTraffic])

  const handleMessage = useCallback((message) => {
    if (message.type === 'metric') {
      console.log('[FLOW - Frontend] WebSocket metric received, re-fetching traffic data...')
      fetchTraffic(range, recentLimit)
    }
  }, [range, recentLimit, fetchTraffic])

  useSocket(handleMessage)

  // Data for visualizations
  // Derived chart data from backend response
  const methodDistribution = summary?.method_distribution?.map(m => ({
    method: m.method,
    count: m.count,
  })) ?? []

  const statusDistribution = summary ? [
    { id: '2xx Success',   label: '2xx Success',       value: summary.total_2xx },
    { id: '4xx Client',    label: '4xx Client Errors', value: summary.total_4xx },
    { id: '5xx Server',    label: '5xx Server Errors', value: summary.total_5xx },
  ].filter(d => d.value > 0) : []

  const topRoutes    = summary?.top_routes      ?? []
  const recentReqs   = summary?.recent_requests ?? []
  const totalReqs    = summary?.total_requests  ?? 0
  const successRate  = summary?.success_rate    ?? 0
  const errorRate    = summary?.error_rate      ?? 0
  const avgLatency   = summary?.avg_latency     ?? 0
  const maxLatency   = summary?.max_latency     ?? 0
  const minLatency   = summary?.min_latency     ?? 0

  const formatTimeLabel = (ts) => {
    const ms = ts < 1e11 ? ts * 1000 : ts
    const d  = new Date(ms)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const lineChartData = useMemo(() => {
    const buckets = timeseries?.buckets ?? []
    if (!buckets.length) return []

    return [
      {
        id: 'Requests',
        color: '#3b82f6',
        data: buckets.map(b => ({
          x: formatTimeLabel(b.timestamp),
          y: b.requests,
        })),
      },
      {
        id: 'Errors',
        color: '#ff4d6a',
        data: buckets.map(b => ({
          x: formatTimeLabel(b.timestamp),
          y: b.errors,
        })),
      },
    ]
  }, [timeseries])

  const tickValues = useMemo(() => {
    if (!lineChartData.length || !lineChartData[0].data.length) return []
    const pts   = lineChartData[0].data
    const every = Math.max(1, Math.floor(pts.length / 8))
    return pts.filter((_, i) => i % every === 0 || i === pts.length - 1).map(p => p.x)
  }, [lineChartData])

  return (
    <div className="dashboard">
      {/* Header + Controls */}
      <div style={{ gridColumn: '1 / -1' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          Traffic & Requests
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
          Real-time API request monitoring and performance analytics
        </p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Range selector */}
          <select
            value={range}
            onChange={(e) => {
              console.log(`[Traffic] 🕐 Range changed → ${e.target.value}`)
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

          {/* Recent limit selector */}
          <select
            value={recentLimit}
            onChange={(e) => {
              console.log(`[Traffic] 📋 Recent limit changed → ${e.target.value}`)
              setRecentLimit(Number(e.target.value))
            }}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '6px',
              padding: '0.4rem 0.8rem', cursor: 'pointer',
            }}
          >
            {LIMIT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>Show {opt} recent</option>
            ))}
          </select>

          {loading && <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Loading...</span>}
          {error   && <span style={{ fontSize: '0.85rem', color: '#ff4d6a'    }}>{error}</span>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: 'linear-gradient(180deg, var(--accent) 0%, transparent 100%)' }} />
        <div className="metric-label">Total Requests</div>
        <div className="metric-value">{totalReqs}</div>
      </div>

      <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: 'linear-gradient(180deg, #4ade80 0%, transparent 100%)' }}></div>
        <div className="metric-label">Success Rate</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value" style={{ color: '#4ade80' }}>{successRate.toFixed(1)}</span>
          <span className="metric-unit">%</span>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <div className="progress-bar" style={{ height: '4px' }}>
            <div className="progress-fill" style={{ width: `${successRate}%`, background: '#4ade80' }}></div>
          </div>
        </div>
      </div>

      <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: 'linear-gradient(180deg, #ff4d6a 0%, transparent 100%)' }}></div>
        <div className="metric-label">Error Rate</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value" style={{ color: errorRate > 5 ? '#ff4d6a' : '#facc15' }}>{errorRate.toFixed(1)}</span>
          <span className="metric-unit">%</span>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <div className="progress-bar" style={{ height: '4px' }}>
            <div className="progress-fill" style={{ width: `${errorRate}%`, background: errorRate > 5 ? '#ff4d6a' : '#facc15' }}></div>
          </div>
        </div>
      </div>

      <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: 'linear-gradient(180deg, var(--accent) 0%, transparent 100%)' }}></div>
        <div className="metric-label">Avg Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{avgLatency}</span>
          <span className="metric-unit">ms</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          Min: {minLatency}ms
        </div>
      </div>

      <div className="metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: 'linear-gradient(180deg, #ff7a1a 0%, transparent 100%)' }}></div>
        <div className="metric-label">Peak Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value" style={{ color: '#ff7a1a' }}>{maxLatency}</span>
          <span className="metric-unit">ms</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          Lowest response time
        </div>
      </div>

      {/* Traffic over time Line Chart */}
      <div className="chart-container" style={{ gridColumn: lineChartData.length ? 'span 2' : '1 / -1' }}>
        <div className="chart-title">
          Traffic Over Time
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
            ({timeseries?.buckets?.length ?? 0} data points)
          </span>
        </div>

        {lineChartData.length > 0 && lineChartData[0].data.length > 0 ? (
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveLine
              data={lineChartData}
              margin={{ top: 20, right: 110, bottom: 60, left: 55 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
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
                legend: 'Count',
                legendOffset: -45,
                legendPosition: 'middle',
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
                  {': '}{point.data.y}
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

      {/* Request Method Distribution Chart */}
      {methodDistribution.length > 0 && (
        <div className="chart-container" style={{ gridColumn: 'span 1' }}>
          <div className="chart-title">Requests by Method</div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveBar
              data={methodDistribution}
              keys={['count']}
              indexBy="method"
              margin={{ top: 20, right: 30, bottom: 30, left: 50 }}
              padding={0.4}
              colors={({ index }) => ['#4ade80', '#3b82f6', '#facc15', '#ff4d6a'][index]}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Requests',
                legendOffset: -40,
                legendPosition: 'middle',
              }}
              label={({ value }) => value > 0 ? value : ''}
              labelSkipWidth={12}
              labelSkipHeight={12}
              tooltip={({ indexValue, value }) => (
                <div style={{
                  background: 'var(--bg-elevated)',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent)',
                  color: 'var(--text)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}>
                  <strong>{indexValue}</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>{value} requests</div>
                </div>
              )}
              theme={{
                axis: {
                  domain: { line: { stroke: 'rgba(255, 255, 255, 0.1)' } },
                  legend: { text: { fill: 'var(--muted)', fontSize: '12px' } },
                  ticks: { line: { stroke: 'rgba(255, 255, 255, 0.1)' }, text: { fill: 'var(--muted)', fontSize: '12px' } },
                },
                grid: { line: { stroke: 'rgba(255, 255, 255, 0.05)' } },
              }}
            />
          </div>
        </div>
      )}

      {/* Status Code Distribution Pie Chart */}
      {statusDistribution.length > 0 && (
        <div className="chart-container" style={{ gridColumn: 'span 1' }}>
          <div className="chart-title">Response Status Distribution</div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsivePie
              data={statusDistribution}
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              colors={['#4ade80', '#facc15', '#ff4d6a']}
              borderWidth={1}
              borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="var(--muted)"
              arcLinkLabelsThickness={2}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
              tooltip={({ datum }) => (
                <div style={{
                  background: 'var(--bg-elevated)',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent)',
                  color: 'var(--text)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}>
                  <strong>{datum.label}</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>{datum.value} ({((datum.value / stats.totalRequests) * 100).toFixed(1)}%)</div>
                </div>
              )}
              theme={{
                labels: { text: { fill: 'var(--text)', fontSize: '12px' } },
                tooltip: { container: { background: 'var(--bg-elevated)', color: 'var(--text)' } },
              }}
            />
          </div>
        </div>
      )}

      {/* Top Routes */}
      {topRoutes.length > 0 && (
        <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-title">Top Routes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {topRoutes.map((route, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 122, 26, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1rem',
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  {idx + 1}. {route.route}
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {route.count}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  {totalReqs > 0 ? ((route.count / totalReqs) * 100).toFixed(1) : 0}% of traffic
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Requests Table */}
      {recentReqs.length > 0 && (
        <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-title">
            Recent Requests
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
              (showing {recentReqs.length})
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Route</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {recentReqs.map((metric, idx) => {
                  const latency   = Number(metric.responseTime)
                  const perfClass = latency < 50 ? 'success' : latency < 100 ? 'warning' : 'error'
                  const methodColor = {
                    GET:    { color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
                    POST:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                    PUT:    { color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
                    DELETE: { color: '#ff4d6a', bg: 'rgba(255,77,106,0.1)' },
                  }[metric.method] ?? { color: 'var(--text)', bg: 'transparent' }

                  return (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {new Date(metric.timestamp || metric.createdAt).toLocaleTimeString()}
                      </td>
                      <td style={{ fontSize: '0.9rem' }}>{metric.route}</td>
                      <td>
                        <span style={{
                          fontWeight: 600, fontSize: '0.85rem',
                          color: methodColor.color, background: methodColor.bg,
                          padding: '4px 8px', borderRadius: '4px',
                        }}>
                          {metric.method}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${
                          metric.statusCode >= 200 && metric.statusCode < 300 ? 'success'
                          : metric.statusCode >= 400 ? 'error' : 'warning'
                        }`}>
                          {metric.statusCode}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {metric.responseTime}ms
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          <div style={{
                            width: '60px',
                            height: '4px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min((latency / 150) * 100, 100)}%`,
                              height: '100%',
                              background: perfClass === 'success' ? '#4ade80' : perfClass === 'warning' ? '#facc15' : '#ff4d6a',
                            }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {perfClass === 'success' ? 'Fast' : perfClass === 'warning' ? 'Slow' : 'Very Slow'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}