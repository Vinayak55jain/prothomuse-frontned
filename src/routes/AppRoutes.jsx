import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import Overview from '../pages/dashboard/Overview'
import Traffic from '../pages/dashboard/Traffic'
import Errors from '../pages/dashboard/Error'
import Latency from '../pages/dashboard/Latency'
import Uptime from '../pages/dashboard/Uptime'
import ProjectList from '../pages/projects/ProjectList'
import ErrorBoundary from '../components/ErrorBoundary'
import useStore from '../store/useStore'

// ── Guards ────────────────────────────────────────────────────────────────────

// Redirects to /login if no JWT token is stored
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

// Redirects to /projects if no project has been selected
function ProjectRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  const selectedProject = useStore((s) => s.selectedProject)
  return selectedProject ? children : <Navigate to="/projects" replace />
}

// ── Shell layout (navbar + sidebar + content area) ────────────────────────────
function AppShell({ children, withProject }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="app">
      <Navbar onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="main">
        <Sidebar collapsed={collapsed} withProject={withProject} />
        <main className={`content ${collapsed ? 'collapsed' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Routes ────────────────────────────────────────────────────────────────────

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Project selection — authenticated, no project required */}
          <Route path="/projects" element={
            <PrivateRoute>
              <AppShell withProject={false}>
                <ProjectList />
              </AppShell>
            </PrivateRoute>
          } />

          {/* Project dashboard — authenticated + project selected */}
          <Route path="/project/*" element={
            <ProjectRoute>
              <AppShell withProject={true}>
                <Routes>
                  <Route path="overview" element={<Overview />} />
                  <Route path="traffic"  element={<Traffic />} />
                  <Route path="errors"   element={<Errors />} />
                  <Route path="latency"  element={<Latency />} />
                  <Route path="uptime"   element={<Uptime />} />
                  <Route path="*"        element={<Navigate to="overview" replace />} />
                </Routes>
              </AppShell>
            </ProjectRoute>
          } />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
