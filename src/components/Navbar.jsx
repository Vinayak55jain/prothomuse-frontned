import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Admin'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('apiKey')
    localStorage.removeItem('username')
    navigate('/login', { replace: true })
  }

  return (
    <header className="navbar">
      <button className="hamburger" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        ☰
      </button>
      <div className="brand">Martixx</div>
      <div className="spacer" />
      <div className="user">{username}</div>
      <button
        className="logout-btn"
        onClick={handleLogout}
        aria-label="Sign out"
        title="Sign out"
      >
        Sign out
      </button>
    </header>
  )
}
