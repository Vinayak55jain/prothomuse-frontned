// src/pages/dashboard/Dashboard.jsx
import React from 'react'

export default function Dashboard({ title, subtitle, children }) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </header>
      <div className="page-body">{children}</div>
    </div>
  )
}