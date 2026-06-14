import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../services/api'
import TextType from '../../components/reactbits/TextType'
import './Auth.css'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await register(form)
      setSuccess(true)
      
      // Navigate to login after 2 seconds
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <TextType text="Join the Matrix" />
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Register to setup your uptime monitoring</p>
        </div>

        {error && (
          <div className="auth-error">
            <span>⚠</span> {error}
          </div>
        )}
        
        {success && (
          <div className="auth-error" style={{ background: 'rgba(74, 222, 128, 0.1)', borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80' }}>
            <span>✅</span> Registration successful! Redirecting to login...
          </div>
        )}

        <div className="auth-form-group">
          <label className="auth-label" htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            className="auth-input"
            placeholder="Neo"
            value={form.username}
            onChange={handleChange}
            required
            autoComplete="username"
          />
        </div>

        <div className="auth-form-group">
          <label className="auth-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="auth-input"
            placeholder="neo@matrix.com"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-form-group">
          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="auth-input"
            placeholder="Min 6 characters"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="auth-submit" disabled={loading || success}>
          {loading ? 'Registering...' : success ? 'Success!' : 'Register'}
        </button>

        <div className="auth-footer">
          Already have an account? 
          <Link to="/login" className="auth-link">Sign in here</Link>
        </div>
      </form>
    </div>
  )
}