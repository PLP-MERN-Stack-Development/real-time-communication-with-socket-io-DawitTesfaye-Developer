# Chat App Client

Run the Vite dev server:

```powershell
cd client
npm install
npm run dev
```

The client connects to the server at `http://localhost:4000` by default. To change, set `VITE_SERVER_URL` in your environment.

Features:
- Username-based auth
- Join rooms
- Global room messaging
- Typing indicators
- Private messages (PM button in user list)
- Image sharing (file input)
- Reactions and read receipts
- Load older messages (pagination demo)
