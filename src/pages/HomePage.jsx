// src/pages/HomePage.jsx
import React from 'react'
import BlurText from '../components/reactbits/BlurText' // adjust path if needed
import './HomePage.css'

export default function HomePage() {
  return (
    <div className="home-root">
      <div className="home-gradient-bg" />

      <div className="home-content">
        <div className="home-left">
          {/* React Bits hero text */}
          <BlurText
            text="Prothomuse Health Dashboard"
            // use the props that your copied component expects
          />

          <p className="home-tagline">
            Real‑time health metrics for your services. Monitor latency, uptime,
            errors, and traffic from a single, beautiful dashboard.
          </p>

          <div className="home-cta-row">
            <a href="/login" className="btn-primary">
              Go to Dashboard
            </a>
            <a href="/register" className="btn-secondary">
              Create an account
            </a>
          </div>

          <div className="home-meta">
            <span className="pill">Live metrics</span>
            <span className="pill">Project‑level insights</span>
            <span className="pill">Powered by Prothomuse</span>
          </div>
        </div>

        <div className="home-right">
          <div className="home-preview-card">
            <div className="home-preview-header">Service Health Snapshot</div>
            <div className="home-preview-grid">
              <div className="preview-stat">
                <span className="label">Avg Latency</span>
                <span className="value">120 ms</span>
              </div>
              <div className="preview-stat">
                <span className="label">Uptime (24h)</span>
                <span className="value">99.98%</span>
              </div>
              <div className="preview-stat">
                <span className="label">Error Rate</span>
                <span className="value">0.21%</span>
              </div>
              <div className="preview-stat">
                <span className="label">Requests / min</span>
                <span className="value">8.7k</span>
              </div>
            </div>
            <div className="home-preview-footer">
              Synthetic preview – sign in to see your real data.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}