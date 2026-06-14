import { useEffect } from 'react'
import { connect, disconnect } from '../services/socket'

export default function useSocket(onMessage, url = (import.meta.env.VITE_WS_URL || 'ws://localhost:8080/stream')) {
  useEffect(() => {
    const s = connect(url, onMessage, () => console.log('socket open'), () => console.log('socket closed'))
    return () => disconnect(s)
  }, [onMessage, url])
}
