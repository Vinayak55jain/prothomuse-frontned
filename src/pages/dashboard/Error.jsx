import React, { useState, useCallback, useEffect } from 'react'
import useSocket from '../../hooks/useSocket'
import { ResponsivePie } from '@nivo/pie'
import useStore from '../../store/useStore'
import './Dashboard.css'

const LIMIT_OPTIONS = [10, 25, 50, 100]

export default function Errors() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const [metrics, setMetrics] = useState([])
  const [errors, setErrors] = useState({ total: 0, error4xx: 0, error5xx: 0, error_rate: 0 })
  const [errorEntries, setErrorEntries] = useState([])
  const [range, setRange] = useState('1h')
  const [errorLimit, setErrorLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  // Fetch from backend
  const fetchErrorAnalytics = useCallback(async (rangeKey, limit) => {
    console.log(`[Frontend] 🔄 Fetching error analytics — range: ${rangeKey}, limit: ${limit}`)
    setLoading(true)
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
      const url = `${API_BASE}/errors?projectKey=${projectKey}&range=${rangeKey}&error_limit=${limit}`
      console.log(`[Frontend] 🌐 API Request: GET ${url}`)
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`[Frontend] ❌ API Request failed with status: ${res.status}`)
        throw new Error('Failed to fetch error analytics')
      }
      const data = await res.json()
      console.log(`[Frontend] ✅ API Response received:`, data)

      setErrors({
        total: (data.errors_4xx ?? 0) + (data.errors_5xx ?? 0),
        error4xx: data.errors_4xx ?? 0,
        error5xx: data.errors_5xx ?? 0,
        error_rate: data.error_rate ?? 0,
      })
      setErrorEntries(data.error_entries ?? [])
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch whenever range or limit changes
  useEffect(() => {
    fetchErrorAnalytics(range, errorLimit)
  }, [range, errorLimit, fetchErrorAnalytics])

  // Live updates via WebSocket
  const handleMessage = useCallback((message) => {
    if (message.type === 'metric') {
      setMetrics((prev) => [message.payload, ...prev.slice(0, 99)])
      // Re-fetch to keep summary accurate on new data
      fetchErrorAnalytics(range, errorLimit)
    }
  }, [range, errorLimit, fetchErrorAnalytics])

  useSocket(handleMessage)

  return (
    <div className="dashboard">
      <div style={{ gridColumn: '1 / -1' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          Error Tracking
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
          Monitor and analyze API errors in real-time
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '6px',
              padding: '0.4rem 0.8rem', cursor: 'pointer',
            }}
          >
            <option value="5m">Last 5 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
          </select>

          <select
            value={errorLimit}
            onChange={(e) => setErrorLimit(Number(e.target.value))}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '6px',
              padding: '0.4rem 0.8rem', cursor: 'pointer',
            }}
          >
            {LIMIT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>Show {opt} errors</option>
            ))}
          </select>

          {loading && (
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Loading...</span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="metric-card">
        <div className="metric-label">Total Errors</div>
        <div className="metric-value">{errors.total}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">4xx Errors</div>
        <div className="metric-value" style={{ color: '#facc15' }}>{errors.error4xx}</div>
        <div className="metric-description">Client errors</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">5xx Errors</div>
        <div className="metric-value" style={{ color: '#ff4d6a' }}>{errors.error5xx}</div>
        <div className="metric-description">Server errors</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Error Rate</div>
        <div className="metric-value">{errors.error_rate.toFixed(2)}%</div>
      </div>

      {/* Pie Chart */}
      {errors.total > 0 && (
        <div className="chart-container" style={{ gridColumn: 'span 1' }}>
          <div className="chart-title">Error Distribution</div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsivePie
              data={[
                { id: '4xx Errors', label: '4xx - Client Errors', value: errors.error4xx },
                { id: '5xx Errors', label: '5xx - Server Errors', value: errors.error5xx },
              ]}
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              colors={['#facc15', '#ff4d6a']}
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
                  <strong>{datum.label}</strong>: {datum.value} errors
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

      {/* Error Entries Table — driven by errorEntries from backend */}
      {errorEntries.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">
            Error Requests
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
              (showing {errorEntries.length})
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Route</th>
                <th>Method</th>
                <th>Status</th>
                <th>Response Time</th>
              </tr>
            </thead>
            <tbody>
              {errorEntries.map((entry, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td>{entry.route}</td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {entry.method}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${entry.status_code >= 500 ? 'error' : 'warning'}`}>
                      {entry.status_code}
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.response_time}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}