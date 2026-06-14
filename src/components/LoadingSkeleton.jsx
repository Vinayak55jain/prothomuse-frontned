import React from 'react'

export default function LoadingSkeleton({ width = '100%', height = '100px' }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: 6, background: 'linear-gradient(90deg,#2b2b2b,#252525,#2b2b2b)' }} />
  )
}
