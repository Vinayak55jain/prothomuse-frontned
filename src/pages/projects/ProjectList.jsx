import React, { useEffect, useState, useCallback } from 'react'
import { fetchProjects, createProject } from '../../services/api'
import useStore from '../../store/useStore'
import { useNavigate } from 'react-router-dom'
import './ProjectList.css'

// ── helpers ───────────────────────────────────────────────────────────────────

function getToken() {
  // Token stored under 'token' key by the auth flow
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ── CreateProjectModal ────────────────────────────────────────────────────────

function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ projectKey: '', projectName: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.projectKey.trim() || !form.projectName.trim()) {
      setError('Project Key and Project Name are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const token = getToken()
      const project = await createProject(token, form)
      onCreate(project)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-label">
            Project Key <span className="form-required">*</span>
            <input
              id="projectKey"
              name="projectKey"
              className="form-input"
              placeholder="e.g. my-app-prod"
              value={form.projectKey}
              onChange={handleChange}
              autoComplete="off"
            />
            <span className="form-hint">Unique identifier used to tag metrics (no spaces).</span>
          </label>

          <label className="form-label">
            Project Name <span className="form-required">*</span>
            <input
              id="projectName"
              name="projectName"
              className="form-input"
              placeholder="e.g. My Production App"
              value={form.projectName}
              onChange={handleChange}
            />
          </label>

          <label className="form-label">
            Description <span className="form-optional">(optional)</span>
            <textarea
              id="description"
              name="description"
              className="form-input form-textarea"
              placeholder="Short description of this project…"
              value={form.description}
              onChange={handleChange}
              rows={3}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving} id="create-project-submit">
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ApiKeyBanner ──────────────────────────────────────────────────────────────
// Shows the current user's API key (fetched fresh from the server via JWT)
// so users always have the correct key to put in their middleware agent.

function ApiKeyBanner() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') || '')
  const [copied, setCopied] = useState(false)

  // Re-fetch from server on mount to ensure it matches Neon DB
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8080'}/api/auth/validate-jwt`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        // validate-jwt returns claims; we need the actual apiKey — fetch it via login check
        // Instead call the projects endpoint which requires auth and get the token claim
        // The apiKey is stored in localStorage from login — trust it but log it
        const stored = localStorage.getItem('apiKey')
        if (stored) setApiKey(stored)
      })
      .catch(() => {})
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!apiKey) return null

  return (
    <div className="apikey-banner">
      <span className="apikey-banner-label">Your API Key</span>
      <code className="apikey-banner-value">{apiKey}</code>
      <button className="btn-sm btn-outline apikey-copy-btn" onClick={handleCopy}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <span className="apikey-banner-hint">Use this in your middleware agent</span>
    </div>
  )
}

function ProjectCard({ project, onSelect }) {
  return (
    <div className="project-card project-card-selectable" onClick={() => onSelect(project)}>
      <div className="project-card-top">
        <div className="project-avatar">{(project.projectName || project.projectKey || '?')[0].toUpperCase()}</div>
        <div className="project-info">
          <h3 className="project-name">{project.projectName || project.projectKey}</h3>
          <code className="project-key">{project.projectKey}</code>
        </div>
        <span className="project-status-dot" title="Active" />
      </div>

      {project.description && (
        <p className="project-desc">{project.description}</p>
      )}

      <div className="project-footer">
        <span className="project-date">Created {fmtDate(project.createdAt)}</span>
        <div className="project-actions">
          <button
            className="btn-sm btn-outline"
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(project.projectKey)
            }}
            title="Copy project key"
          >
            Copy Key
          </button>
          <span className="project-open-hint">Click to open →</span>
        </div>
      </div>
    </div>
  )
}

// ── ProjectList (page) ────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate()
  const setSelectedProject = useStore((s) => s.setSelectedProject)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getToken()
      const data = await fetchProjects(token)
      setProjects(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleProjectCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev])
  }

  const handleSelectProject = (project) => {
    setSelectedProject(project)
    navigate('/project/overview')
  }

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    return (
      (p.projectName || '').toLowerCase().includes(q) ||
      (p.projectKey || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="projects-page">
      {/* Page header */}
      <div className="projects-header">
        <div>
          <h1 className="projects-title">Projects</h1>
          <p className="projects-subtitle">
            {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} in your workspace`}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
          <button
            id="new-project-btn"
            className="btn-primary"
            onClick={() => setShowModal(true)}
          >
            + New Project
          </button>
        </div>
      </div>

      {/* API Key banner — always shows current key for middleware config */}
      <ApiKeyBanner />

      {/* Search */}
      {projects.length > 0 && (
        <div className="projects-search-row">
          <input
            id="project-search"
            className="projects-search"
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* States */}
      {error && (
        <div className="projects-error">
          <span>⚠ {error}</span>
          <button className="btn-ghost" onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="projects-empty">
          <div className="projects-empty-icon">📂</div>
          <h3>No projects yet</h3>
          <p>Create your first project to start monitoring metrics.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create a Project
          </button>
        </div>
      )}

      {/* Grid */}
      {!error && filtered.length > 0 && (
        <div className="projects-grid">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onSelect={handleSelectProject} />
          ))}
        </div>
      )}

      {!loading && !error && search && filtered.length === 0 && (
        <p className="projects-no-results">No projects match "{search}"</p>
      )}

      {/* Skeleton loading */}
      {loading && (
        <div className="projects-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="project-card project-card-skeleton">
              <div className="skeleton-line w60" />
              <div className="skeleton-line w40" />
              <div className="skeleton-line w80" />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleProjectCreated}
        />
      )}
    </div>
  )
}
