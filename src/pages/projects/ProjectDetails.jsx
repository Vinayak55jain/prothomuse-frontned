import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchOverview } from '../../services/api'
import useStore from '../../store/useStore'

import Card from '../../components/Card';
import TimeRangeLogSearch from '../../components/TimeRangeLogSearch';
import LoadingSkeleton from '../../components/LoadingSkeleton';

export default function ProjectDetails() {
  const { id } = useParams()
  const selected = useStore((s) => s.selectedProject)
  const setOverview = useStore((s) => s.setOverview)
  const overview = useStore((s) => s.overview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchOverview(id).then((data) => {
      if (!mounted) return
      setOverview(data)
    }).catch((err) => setError(err.message)).finally(() => setLoading(false))
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="page"><LoadingSkeleton height="200px" /></div>
  if (error) return <div className="page error">{error}</div>

  return (
    <div className="page project-details">
      <h2>{selected?.name || 'Project'}</h2>
      <div className="cards">
        <Card title="Total requests" value={overview.totalRequests} />
        <Card title="Average latency" value={`${overview.avgLatency} ms`} />
        <Card title="Error rate" value={`${overview.errorRate}%`} />
        <Card title="Service status" value={overview.status} />
      </div>
      <TimeRangeLogSearch projectId={id} />
    </div>
  )
}
