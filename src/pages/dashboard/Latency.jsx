import React, { useState, useEffect } from 'react'
import { fetchLatency } from '../../services/api'
import useStore from '../../store/useStore'
import './Dashboard.css'

export default function Latency() {
  const projectKey = useStore((s) => s.selectedProject?.projectKey || '')
  const [latencyData, setLatencyData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadLatencyData = async () => {
      try {
        setLoading(true)
        const data = await fetchLatency(projectKey)
        setLatencyData(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (projectKey) loadLatencyData()
  }, [projectKey])

  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p>Loading latency data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444' }}>Error loading latency data: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div style={{ gridColumn: '1 / -1' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          Latency Analysis
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
          Request latency percentiles and distribution
        </p>
      </div>

      <div className="metric-card">
        <div className="metric-label">P50 Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{latencyData?.p50 || '—'}</span>
          <span className="metric-unit">ms</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">P95 Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{latencyData?.p95 || '—'}</span>
          <span className="metric-unit">ms</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">P99 Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{latencyData?.p99 || '—'}</span>
          <span className="metric-unit">ms</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Average Latency</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{latencyData?.avg || '—'}</span>
          <span className="metric-unit">ms</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Total Requests</div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span className="metric-value">{latencyData?.count || '—'}</span>
          <span className="metric-unit">req</span>
        </div>
      </div>

      <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
        <div className="chart-title">Latency Summary — {projectKey} (Last 24 hours)</div>
        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--accent)' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
            This dashboard shows aggregated latency statistics from the prothomuse server.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '4px' }}>
              <strong>P50:</strong> {latencyData?.p50}ms (50th percentile)
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '4px' }}>
              <strong>P95:</strong> {latencyData?.p95}ms (95th percentile)
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '4px' }}>
              <strong>P99:</strong> {latencyData?.p99}ms (99th percentile)
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '4px' }}>
              <strong>Average:</strong> {latencyData?.avg}ms
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}