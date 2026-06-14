let socket = null

export function connect(url, onMessage, onOpen, onClose) {
  if (socket) return socket
  socket = new WebSocket(url)
  socket.addEventListener('open', () => onOpen && onOpen())
  socket.addEventListener('message', e => onMessage && onMessage(JSON.parse(e.data)))
  socket.addEventListener('close', () => {
    onClose && onClose()
    socket = null
  })
  socket.addEventListener('error', (err) => console.error('WebSocket error', err))
  return socket
}

export function disconnect() {
  if (socket) socket.close()
  socket = null
}

export function send(obj) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(obj))
  return true
}
