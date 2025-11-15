import React, { useState } from 'react'
import { socket } from '../socket'

export default function Login({ onLogin }){
  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('general')
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    if (!username) return alert('Enter a username')
    setLoading(true)
    socket.connect()
    socket.emit('auth', { username }, (res) => {
      setLoading(false)
      if (res?.status === 'ok') onLogin({ username, socketId: res.socketId, room })
      else alert(res?.message || 'Auth failed')
    })
  }
  return (
    <div className="login">
      <h2>Join Chat</h2>
      <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
      <input placeholder="Room" value={room} onChange={e=>setRoom(e.target.value)} />
      <button onClick={handleLogin} disabled={loading}>{loading ? 'Joining...' : 'Join'}</button>
      <p className="muted">Tip: use different usernames in multiple tabs to demo private messages.</p>
    </div>
  )
}


