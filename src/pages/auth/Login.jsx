import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../../services/api'
import TextType from '../../components/reactbits/TextType'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await login(form.email, form.password)
      
      // Store token and user data
      if (data.data?.token) {
        localStorage.setItem('token', data.data.token)
      }
      if (data.data?.apiKey) {
        localStorage.setItem('apiKey', data.data.apiKey)
      }
      if (data.data?.username) {
        localStorage.setItem('username', data.data.username)
      }
      
      // Navigate to project selection
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <TextType text="Welcome back" />
          <h2 className="auth-title">System Login</h2>
          <p className="auth-subtitle">Authenticate to access the Uptime Dashboard</p>
        </div>

        {error && (
          <div className="auth-error">
            <span>⚠</span> {error}
          </div>
        )}

        <div className="auth-form-group">
          <label className="auth-label" htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="auth-input"
            placeholder="admin@example.com"
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
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>

        <div className="auth-footer">
          Don't have an account? 
          <Link to="/register" className="auth-link">Register here</Link>
        </div>
      </form>
    </div>
  )
}