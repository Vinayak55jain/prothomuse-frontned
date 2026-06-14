const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || 'Login failed')
  return json
}

export async function register(data) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || 'Registration failed')
  return json
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(token) {
  const res = await fetch(`${API_BASE}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch projects')
  const json = await res.json()
  return json.data ?? []
}

export async function createProject(token, data) {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to create project')
  }
  const json = await res.json()
  return json.data
}

export async function fetchOverview(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/overview`)
  if (!res.ok) throw new Error('Failed to fetch overview')
  return res.json()
}

// ── Overview (traffic summary + recent system health) ─────────────────────────

export async function fetchOverviewData(projectKey) {
  const [trafficRes, healthRes] = await Promise.all([
    fetch(`${API_BASE}/traffic?projectKey=${projectKey}&range=1h&recent_limit=10`),
    fetch(`${API_BASE}/api/system-health?projectKey=${projectKey}`),
  ])
  const traffic = trafficRes.ok ? await trafficRes.json() : null
  const health  = healthRes.ok  ? await healthRes.json()  : null
  return { traffic, health }
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function fetchLogs(projectId, startMs, endMs, limit = 50) {
  const params = new URLSearchParams({
    projectKey: projectId,
    limit: limit.toString(),
  })
  if (startMs) params.append('start', startMs.toString())
  if (endMs) params.append('end', endMs.toString())
  const res = await fetch(`${API_BASE}/api/logs/search?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch logs')
  return res.json()
}

// ── Latency ───────────────────────────────────────────────────────────────────

export async function fetchLatency(projectId) {
  const res = await fetch(`${API_BASE}/latency?projectKey=${projectId}&range=24h`)
  if (!res.ok) throw new Error('Failed to fetch latency data')
  return res.json()
}
