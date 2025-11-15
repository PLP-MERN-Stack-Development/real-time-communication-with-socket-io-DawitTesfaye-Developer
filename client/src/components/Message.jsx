import React from 'react'

export default function Message({ msg, me, onReact, onRead }){
  return (
    <div className={`message ${me ? 'me' : ''}`}> 
      <div className="meta">
        <strong>{msg.from}</strong>
        <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      {msg.type === 'notification' ? (
        <div className="notification">{msg.text}</div>
      ) : (
        <div className="body">
          {msg.text && <div className="text">{msg.text}</div>}
          {msg.image && <img src={msg.image} alt="attachment" style={{ maxWidth: '240px' }} />}
          <div className="meta2">
            <div className="reactions">
              <button onClick={()=>onReact(msg.id, '👍')}>👍</button>
              <button onClick={()=>onReact(msg.id, '❤️')}>❤️</button>
              <button onClick={()=>onReact(msg.id, '😂')}>😂</button>
            </div>
            <div className="read">
              {msg.readBy ? `Read by: ${msg.readBy.join(', ')}` : <button onClick={onRead}>Mark read</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
