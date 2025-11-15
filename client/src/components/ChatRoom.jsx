import React, { useEffect, useState, useRef } from 'react'
import { socket } from '../socket'
import Message from './Message'

export default function ChatRoom({ user }){
  const [room, setRoom] = useState(user.room || 'general')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [users, setUsers] = useState([])
  const [typing, setTyping] = useState([])
  const fileRef = useRef()
  const listRef = useRef()

  useEffect(()=>{
    socket.emit('join:room', { room }, (res)=>{
      if (res?.status === 'ok') setMessages(res.messages || [])
    })

    socket.on('message:new', (msg) => setMessages(m => [...m, msg]))
    socket.on('private:message', (msg) => setMessages(m => [...m, msg]))
    socket.on('room:notification', (n) => setMessages(m => [...m, n]))
    socket.on('users:update', (list) => setUsers(list))
    socket.on('typing', ({ from, private: isPrivate }) => setTyping(t => Array.from(new Set([...t, from]))))
    socket.on('stopTyping', ({ from }) => setTyping(t => t.filter(x=>x!==from)))
    socket.on('message:react', ({ messageId, reaction, from }) => {
      setMessages(m => m.map(msg => msg.id === messageId ? { ...msg, reactions: { ...(msg.reactions||{}), [reaction]: ((msg.reactions||{})[reaction]||0)+1 } } : msg))
    })
    socket.on('message:read', ({ messageId, by }) => {
      setMessages(m => m.map(msg => msg.id === messageId ? { ...msg, readBy: [...(msg.readBy||[]), by] } : msg))
    })

    return () => {
      socket.emit('leave:room', { room })
      socket.off('message:new')
      socket.off('private:message')
      socket.off('room:notification')
      socket.off('users:update')
      socket.off('typing')
      socket.off('stopTyping')
      socket.off('message:react')
      socket.off('message:read')
    }
  }, [room])

  useEffect(()=>{ // scroll to bottom
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  let typingTimer = useRef(null)
  const handleTyping = () => {
    socket.emit('typing', { room })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(()=> socket.emit('stopTyping', { room }), 800)
  }

  const sendMessage = async (to=null) => {
    if (!text && !fileRef.current?.files?.[0]) return
    const file = fileRef.current?.files?.[0]
    if (file) {
      const data = await new Promise((res)=>{
        const r = new FileReader(); r.onload = e=>res(e.target.result); r.readAsDataURL(file)
      })
      socket.emit('message:send', { room, text, image: data, to }, (r)=>{})
      fileRef.current.value = ''
    } else {
      socket.emit('message:send', { room, text, to }, (r)=>{})
    }
    setText('')
    socket.emit('stopTyping', { room })
  }

  const sendPrivate = (username) => {
    const pm = prompt(`Send private message to ${username}`)
    if (pm) socket.emit('message:send', { text: pm, to: username }, (r)=>{})
  }

  const reactTo = (messageId, reaction) => socket.emit('message:react', { messageId, reaction, room }, ()=>{})

  const markRead = (messageId, msg) => socket.emit('message:read', { messageId, room: msg.room, to: msg.to })

  const fetchOlder = () => {
    const first = messages[0]
    if (!first) return
    socket.emit('fetch:older', { room, before: first.id }, (res)=>{
      if (res?.status === 'ok') setMessages(m => [...res.messages, ...m])
    })
  }

  return (
    <div className="chat">
      <aside className="sidebar">
        <h3>Room: {room}</h3>
        <div className="users">
          <strong>Online</strong>
          {users.map(u => (
            <div key={u} className="user-row">
              <span>{u}</span>
              {u !== user.username && <button onClick={()=>sendPrivate(u)}>PM</button>}
            </div>
          ))}
        </div>
        <div className="controls">
          <input value={room} onChange={e=>setRoom(e.target.value)} placeholder="room name" />
          <button onClick={()=>{
            socket.emit('join:room', { room }, (res)=>{ if (res?.status==='ok') setMessages(res.messages||[]) })
          }}>Switch</button>
          <button onClick={fetchOlder}>Load older</button>
        </div>
        <div className="typing">{typing.length ? `${typing.join(', ')} typing...` : ''}</div>
      </aside>

      <main className="main">
        <div className="messages" ref={listRef}>
          {messages.map(m => (
            <Message key={m.id} msg={m} me={m.from === user.username} onReact={reactTo} onRead={()=>markRead(m.id, m)} />
          ))}
        </div>

        <div className="composer">
          <input placeholder="Type a message" value={text} onChange={e=>setText(e.target.value)} onKeyDown={handleTyping} />
          <input type="file" ref={fileRef} />
          <button onClick={()=>sendMessage()}>Send</button>
        </div>
      </main>
    </div>
  )
}


