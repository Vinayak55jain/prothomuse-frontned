import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Navbar.css'

export default function Navbar({ onToggleSidebar }) {
  const navigate  = useNavigate()
  const username  = localStorage.getItem('username') || 'Admin'
  const email     = localStorage.getItem('email')    || ''

  const [popupOpen, setPopupOpen]   = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [form, setForm]             = useState({ username, email })
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const popupRef                    = useRef(null)

  // ── Close popup on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopupOpen(false)
        setEditMode(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('apiKey')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
    navigate('/login', { replace: true })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    // Persist locally — extend here with an API call if needed
    localStorage.setItem('username', form.username)
    localStorage.setItem('email',    form.email)
    await new Promise(r => setTimeout(r, 400)) // simulate async
    setSaving(false)
    setSaveMsg('Saved!')
    setEditMode(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  // ── Initials avatar ───────────────────────────────────────────────────
  const initials = username
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <header className="navbar">
      <button className="hamburger" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        ☰
      </button>
      <div className="brand">Martixx</div>
      <div className="spacer" />

      {/* ── User avatar pill (click to open popup) ── */}
      <div className="user-wrapper" ref={popupRef}>
        <button
          className="user-pill"
          onClick={() => { setPopupOpen(p => !p); setEditMode(false); setSaveMsg('') }}
          aria-label="User profile"
        >
          <span className="user-avatar">{initials}</span>
          <span className="user-name">{username}</span>
        </button>

        {/* ── Profile popup ── */}
        {popupOpen && (
          <div className="user-popup">
            {/* Header */}
            <div className="popup-header">
              <div className="popup-avatar">{initials}</div>
              <div className="popup-user-info">
                <span className="popup-username">{username}</span>
                <span className="popup-email">{email || '—'}</span>
              </div>
            </div>

            <div className="popup-divider" />

            {/* Edit form */}
            {editMode ? (
              <div className="popup-form">
                <label className="popup-label">Username
                  <input
                    className="popup-input"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="Username"
                  />
                </label>
                <label className="popup-label">Email
                  <input
                    className="popup-input"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                  />
                </label>
                <div className="popup-actions">
                  <button className="popup-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="popup-cancel-btn" onClick={() => setEditMode(false)}>
                    Cancel
                  </button>
                </div>
                {saveMsg && <p className="popup-save-msg">{saveMsg}</p>}
              </div>
            ) : (
              <div className="popup-actions">
                <button className="popup-edit-btn" onClick={() => { setForm({ username, email }); setEditMode(true) }}>
                  ✏️ Update Details
                </button>
              </div>
            )}

            <div className="popup-divider" />

            <button className="popup-logout-btn" onClick={handleLogout}>
              🚪 Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
