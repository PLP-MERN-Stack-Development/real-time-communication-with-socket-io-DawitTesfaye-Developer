import React, { useState } from 'react'
import Login from './components/Login'
import ChatRoom from './components/ChatRoom'

export default function App(){
  const [user, setUser] = useState(null)
  return (
    <div className="app">
      {!user ? <Login onLogin={setUser} /> : <ChatRoom user={user} />}
    </div>
  )
}
