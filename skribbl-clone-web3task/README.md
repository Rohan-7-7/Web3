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

## Architecture

### Important architecture

The server is authoritative for room membership, turns, words, guesses, scores, and timers. Clients send user actions through Socket.IO; the server validates them and broadcasts state/events.

Drawing is synchronized as stroke events rather than repeatedly sending a canvas image.

### Scoring system

Scoring logic lives in `server/src/game/Game.ts` and `server/src/server.ts`.

#### 1. Correct guesser points

```ts
points = Math.max(10, timeLeft * 2)
```

The guesser earns **twice the number of seconds remaining**, with a minimum of **10 points**.

| Time remaining | Points earned |
|---:|---:|
| 60 seconds | 120 |
| 45 seconds | 90 |
| 30 seconds | 60 |
| 10 seconds | 20 |
| 5 seconds | 10 (minimum) |

Each player can only score once per turn — further correct guesses after their first are ignored.

#### 2. Drawer points

The drawer earns points every time another player guesses correctly:

```ts
drawerPoints = Math.max(15, Math.floor(guesserPoints * 0.6))
```

The drawer gets **60% of the guesser's points**, rounded down, with a minimum of **15 points**. Since this applies per correct guess, the drawer can score multiple times in one turn.

| Guesser points | Drawer points |
|---:|---:|
| 120 | 72 |
| 90 | 54 |
| 30 | 18 |
| 20 | 15 (minimum) |
| 10 | 15 (minimum) |

#### 3. Incorrect guesses

Incorrect guesses earn **0 points**. They're broadcast as chat messages and carry no penalty.

#### 4. Round and turn behavior

- Every player gets a drawing turn.
- Once every player has completed a turn, the round advances.
- The configured number of rounds determines when the game ends.
- Scores carry across all rounds.
- The final leaderboard sorts players by total score.

#### 5. Edge case: early turn advance

If every non-drawing player guesses correctly before time runs out, the turn advances early after a short delay instead of waiting for the full timer.

Scoring is therefore weighted toward **speed** — guessing earlier is worth more, and the drawer benefits whenever players guess successfully.

## Production deployment

This project is deployed on **Render**:

- **Live app:** https://web3-client-66d6.onrender.com

The server is deployed as a Render Web Service (WebSocket-capable, required for Socket.IO), and the client is deployed as a Render Static Site. The Frontend is also deployed on Render.
