# Skribbl Clone

## Stack

- Frontend: React + TypeScript/JavaScript + Vite
- Backend: Node.js + Express + Socket.IO
- Drawing: HTML5 Canvas
- State: In-memory game/room state

## Features

- Create/join rooms with a room code
- Lobby with player list and ready state
- Host starts the game
- One drawer per round
- Drawer chooses from word options
- Real-time canvas strokes using Socket.IO
- Brush, colors, size, eraser, undo, clear
- Guessing and scoring
- Round timer
- Leaderboard
- Game-over screen
- Basic chat
- Publicly deployable architecture

## Run locally

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

Open the frontend in two browser tabs and join the same room to test multiplayer.

## Environment

Client can use:

```env
VITE_SERVER_URL=http://localhost:4000
```

Server can use:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

## Important architecture

The server is authoritative for room membership, turns, words, guesses, scores, and timers. Clients send user actions through Socket.IO; the server validates them and broadcasts state/events.

Drawing is synchronized as stroke events rather than repeatedly sending a canvas image.

## Production deployment

Deploy the server to a WebSocket-capable service such as Render or Railway, and the client to Vercel/Netlify. Set `VITE_SERVER_URL` on the frontend to the deployed backend URL and configure `CLIENT_ORIGIN` on the backend.
