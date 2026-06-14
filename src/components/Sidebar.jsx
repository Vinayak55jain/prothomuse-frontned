import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

export default function Sidebar({ collapsed, withProject }) {
  const navigate = useNavigate()
  const selectedProject = useStore((s) => s.selectedProject)
  const clearSelectedProject = useStore((s) => s.clearSelectedProject)

  const handleSwitchProject = () => {
    clearSelectedProject()
    navigate('/projects')
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Project context badge */}
      {withProject && selectedProject && !collapsed && (
        <div className="sidebar-project-badge">
          <div className="sidebar-project-avatar">
            {(selectedProject.projectName || selectedProject.projectKey || '?')[0].toUpperCase()}
          </div>
          <div className="sidebar-project-info">
            <span className="sidebar-project-name">
              {selectedProject.projectName || selectedProject.projectKey}
            </span>
            <code className="sidebar-project-key">{selectedProject.projectKey}</code>
          </div>
        </div>
      )}

      <nav>
        {withProject ? (
          // Project-scoped navigation
          <ul>
            <li><NavLink to="/project/overview">📊 Overview</NavLink></li>
            <li><NavLink to="/project/traffic">🌐 Traffic</NavLink></li>
            <li><NavLink to="/project/errors">⚠ Errors</NavLink></li>
            <li><NavLink to="/project/latency">⏱ Latency</NavLink></li>
            <li><NavLink to="/project/uptime">💚 Uptime</NavLink></li>
            <li style={{ marginTop: '1rem' }}>
              <button className="sidebar-switch-btn" onClick={handleSwitchProject}>
                ← Switch Project
              </button>
            </li>
          </ul>
        ) : (
          // Projects list navigation
          <ul>
            <li><NavLink to="/projects">📂 Projects</NavLink></li>
          </ul>
        )}
      </nav>
    </aside>
  )
}
