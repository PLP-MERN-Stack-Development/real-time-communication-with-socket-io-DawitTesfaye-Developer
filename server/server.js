const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// In-memory stores (for demo only)
const users = {}; // socketId -> { username, room }
const usernameToSocket = {}; // username -> socketId
const rooms = {}; // roomName -> [messages]
const privateMessages = {}; // conversationId -> [messages]

function makeMessage({ id, from, to, room, text, image, timestamp, type }) {
  return { id: id || uuidv4(), from, to: to || null, room: room || null, text: text || null, image: image || null, timestamp: timestamp || Date.now(), type: type || 'message' };
}

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('auth', ({ username }, cb) => {
    if (!username) return cb({ status: 'error', message: 'Username required' });
    users[socket.id] = { username, room: null };
    usernameToSocket[username] = socket.id;
    // Broadcast updated online list
    io.emit('users:update', Object.values(users).map(u => u.username));
    cb({ status: 'ok', socketId: socket.id });
  });

  socket.on('join:room', ({ room }, cb) => {
    const user = users[socket.id];
    if (!user) return cb?.({ status: 'error', message: 'Not authenticated' });
    if (user.room) socket.leave(user.room);
    socket.join(room);
    user.room = room;
    rooms[room] = rooms[room] || [];
    // Notify room
    const joinMsg = makeMessage({ from: 'system', text: `${user.username} joined ${room}`, room, type: 'notification' });
    rooms[room].push(joinMsg);
    io.to(room).emit('room:notification', joinMsg);
    io.emit('users:update', Object.values(users).map(u => u.username));
    cb?.({ status: 'ok', room, messages: rooms[room].slice(-50) });
  });

  socket.on('leave:room', ({ room }, cb) => {
    const user = users[socket.id];
    if (!user) return cb?.({ status: 'error' });
    socket.leave(room);
    user.room = null;
    cb?.({ status: 'ok' });
  });

  socket.on('message:send', (payload, cb) => {
    const user = users[socket.id];
    if (!user) return cb?.({ status: 'error', message: 'Not authenticated' });
    const msg = makeMessage({ from: user.username, room: payload.room, text: payload.text, image: payload.image });
    // Save
    if (payload.to) {
      // private message
      const convoId = [user.username, payload.to].sort().join(':');
      privateMessages[convoId] = privateMessages[convoId] || [];
      privateMessages[convoId].push(msg);
      // Emit to receiver if online
      const targetSocket = usernameToSocket[payload.to];
      if (targetSocket) io.to(targetSocket).emit('private:message', msg);
      socket.emit('private:message', msg);
      cb?.({ status: 'ok', message: msg });
    } else {
      rooms[msg.room] = rooms[msg.room] || [];
      rooms[msg.room].push(msg);
      io.to(msg.room).emit('message:new', msg);
      cb?.({ status: 'ok', message: msg });
    }
  });

  socket.on('typing', ({ room, to }) => {
    const user = users[socket.id];
    if (!user) return;
    if (to) {
      const targetSocket = usernameToSocket[to];
      if (targetSocket) io.to(targetSocket).emit('typing', { from: user.username, private: true });
    } else {
      io.to(room).emit('typing', { from: user.username, private: false });
    }
  });

  socket.on('stopTyping', ({ room, to }) => {
    const user = users[socket.id];
    if (!user) return;
    if (to) {
      const targetSocket = usernameToSocket[to];
      if (targetSocket) io.to(targetSocket).emit('stopTyping', { from: user.username, private: true });
    } else {
      io.to(room).emit('stopTyping', { from: user.username, private: false });
    }
  });

  socket.on('message:react', ({ messageId, reaction, room, to }, cb) => {
    // naive in-memory reaction storage appended to message
    const user = users[socket.id];
    if (!user) return cb?.({ status: 'error' });
    let targetMsg = null;
    if (to) {
      const convoId = [user.username, to].sort().join(':');
      const msgs = privateMessages[convoId] || [];
      targetMsg = msgs.find(m => m.id === messageId);
    } else {
      const msgs = rooms[room] || [];
      targetMsg = msgs.find(m => m.id === messageId);
    }
    if (targetMsg) {
      targetMsg.reactions = targetMsg.reactions || {};
      targetMsg.reactions[reaction] = (targetMsg.reactions[reaction] || 0) + 1;
      if (to) {
        const targetSocket = usernameToSocket[to];
        if (targetSocket) io.to(targetSocket).emit('message:react', { messageId, reaction, from: user.username });
        socket.emit('message:react', { messageId, reaction, from: user.username });
      } else {
        io.to(room).emit('message:react', { messageId, reaction, from: user.username });
      }
      cb?.({ status: 'ok' });
    } else cb?.({ status: 'error', message: 'Message not found' });
  });

  socket.on('message:read', ({ messageId, room, to }) => {
    const user = users[socket.id];
    if (!user) return;
    // Emit read receipt to sender
    if (to) {
      const targetSocket = usernameToSocket[to];
      if (targetSocket) io.to(targetSocket).emit('message:read', { messageId, by: user.username });
    } else {
      const msgs = rooms[room] || [];
      const msg = msgs.find(m => m.id === messageId);
      if (msg) {
        const senderSocket = usernameToSocket[msg.from];
        if (senderSocket) io.to(senderSocket).emit('message:read', { messageId, by: user.username });
      }
    }
  });

  socket.on('fetch:older', ({ room, before }, cb) => {
    const msgs = rooms[room] || [];
    if (!before) return cb?.({ status: 'ok', messages: msgs.slice(0, 30) });
    const idx = msgs.findIndex(m => m.id === before);
    if (idx === -1) return cb?.({ status: 'ok', messages: [] });
    const older = msgs.slice(Math.max(0, idx - 30), idx);
    cb?.({ status: 'ok', messages: older });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      delete usernameToSocket[user.username];
      delete users[socket.id];
      io.emit('users:update', Object.values(users).map(u => u.username));
      console.log(user.username, 'disconnected');
    }
  });
});

app.get('/', (req, res) => res.send({ status: 'ok' }));

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
