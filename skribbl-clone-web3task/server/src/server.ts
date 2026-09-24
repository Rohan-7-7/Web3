import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { GameManager } from "./game/GameManager.js";
import { Player } from "./game/Player.js";
import type { RoomSettings, Stroke } from "./types.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*" }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*",
    methods: ["GET", "POST"]
  }
});

const manager = new GameManager();
const socketRooms = new Map<string, string>();
const announcedLeaves = new Set<string>();

app.get("/health", (_req, res) => res.json({ ok: true }));

function emitState(roomId: string) {
  const room = manager.getRoom(roomId);
  if (!room) return;
  io.to(room.id).emit("room_state", room.snapshot());
}

function emitTick(roomId: string) {
  const room = manager.getRoom(roomId);
  if (!room) return;
  const hintLetters: Record<number, string> = {};
  for (const index of room.game.hintIndices) {
    hintLetters[index] = room.game.currentWord[index] ?? "";
  }
  io.to(room.id).emit("room_tick", {
    timeLeft: room.game.timeLeft,
    turnEndsAt: room.game.turnEndsAt,
    phase: room.game.phase,
    round: room.game.round,
    drawerId: room.game.drawerId,
    hintLetters
  });
}

function emitRoundStart(room: ReturnType<GameManager["createRoom"]>) {
  io.to(room.id).emit("round_start", {
    drawerId: room.game.drawerId,
    wordOptions: room.game.wordOptions,
    drawTime: room.settings.drawTime
  });
  if (room.game.drawerId) {
    io.to(room.game.drawerId).emit("word_options", { words: room.game.wordOptions });
  }
}

io.on("connection", socket => {
  socket.on("create_room", ({ playerName, avatar, settings, isPrivate }: { playerName: string; avatar?: string; settings: RoomSettings; isPrivate?: boolean }) => {
    try {
      const privateFlag = isPrivate ?? settings?.isPrivate ?? false;
      const room = manager.createRoom(playerName.trim(), settings, socket.id, avatar || "👨🏻", privateFlag);
      room.onGameChange = () => {
        emitRoundStart(room);
        emitState(room.id);
      };
      socket.join(room.id);
      socketRooms.set(socket.id, room.id);
      socket.emit("room_created", { roomId: room.id, isPrivate: room.isPrivate });
      emitState(room.id);
    } catch (error) {
      socket.emit("error_message", (error as Error).message);
    }
  });

  socket.on("quick_join", ({ playerName, avatar, settings }: { playerName: string; avatar?: string; settings?: RoomSettings }) => {
    try {
      const currentRoomId = socketRooms.get(socket.id);
      if (currentRoomId) {
        leaveCurrentRoom(socket);
      }

      const name = playerName.trim();
      const existing = manager.findPublicRoom(new Set(io.sockets.sockets.keys()));
      if (existing) {
        existing.onGameChange = () => {
          emitRoundStart(existing);
          emitState(existing.id);
        };
        existing.addPlayer(new Player(socket.id, name, avatar || "👨🏻"));
        socket.join(existing.id);
        socketRooms.set(socket.id, existing.id);
        io.to(existing.id).emit("chat_message", {
          playerId: "system",
          playerName: "System",
          text: `${name} joined the room`
        });
        socket.emit("room_created", { roomId: existing.id, isPrivate: false });
        emitState(existing.id);
      } else {
        const defaultSettings: RoomSettings = {
          maxPlayers: 8,
          rounds: 3,
          drawTime: 60,
          wordCount: 3,
          isPrivate: false
        };
        const room = manager.createRoom(name, settings || defaultSettings, socket.id, avatar || "👨🏻", false);
        room.onGameChange = () => {
          emitRoundStart(room);
          emitState(room.id);
        };
        socket.join(room.id);
        socketRooms.set(socket.id, room.id);
        socket.emit("room_created", { roomId: room.id, isPrivate: false });
        emitState(room.id);
      }
    } catch (error) {
      socket.emit("error_message", (error as Error).message);
    }
  });

  socket.on("join_room", ({ roomId, playerName, avatar }: { roomId: string; playerName: string; avatar?: string }) => {
    const room = manager.getRoom(roomId);
    if (!room) return socket.emit("error_message", "Room not found");
    if (!room.isPrivate) return socket.emit("error_message", "Room codes are only for private rooms. Click Play to join public games.");

    try {
      room.onGameChange = () => {
        emitRoundStart(room);
        emitState(room.id);
      };
      room.addPlayer(new Player(socket.id, playerName.trim(), avatar || "👨🏻"));
      socket.join(room.id);
      socketRooms.set(socket.id, room.id);
      io.to(room.id).emit("chat_message", {
        playerId: "system",
        playerName: "System",
        text: `${playerName} joined the room`
      });
      emitState(room.id);
    } catch (error) {
      socket.emit("error_message", (error as Error).message);
    }
  });

  socket.on("update_settings", ({ settings }: { settings: Partial<RoomSettings> }) => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room) return;
    if (room.hostId !== socket.id) {
      return socket.emit("error_message", "Only the host can modify room settings");
    }

    try {
      room.updateSettings(settings);
      io.to(room.id).emit("chat_message", {
        playerId: "system",
        playerName: "System",
        text: `Room settings updated by host`
      });
      emitState(room.id);
    } catch (error) {
      socket.emit("error_message", (error as Error).message);
    }
  });

  socket.on("start_game", () => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || room.hostId !== socket.id) return;
    if (room.players.size < 2) {
      return socket.emit("error_message", "At least 2 players are required to start the game");
    }
    room.start();
    emitRoundStart(room);
    emitState(room.id);
  });

  socket.on("choose_word", ({ word }: { word: string }) => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || !room.game.isDrawer(socket.id)) return;

    if (room.game.chooseWord(word, room.getPlayers())) {
      io.to(room.id).emit("round_started", {
        drawerId: room.game.drawerId,
        wordLength: word.length,
        drawTime: room.settings.drawTime
      });
      io.to(socket.id).emit("your_word", { word });
      emitState(room.id);
    }
  });

  socket.on("draw_start", (stroke: Stroke) => handleStroke(socket.id, stroke));
  socket.on("draw_move", (stroke: Stroke) => handleStroke(socket.id, stroke));

  socket.on("draw_end", () => {
    const roomId = socketRooms.get(socket.id);
    if (roomId) io.to(roomId).emit("draw_end");
  });

  socket.on("canvas_clear", () => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || !room.game.isDrawer(socket.id)) return;
    room.game.clear();
    io.to(room.id).emit("canvas_cleared");
  });

  socket.on("draw_undo", () => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || !room.game.isDrawer(socket.id)) return;
    room.game.undo();
    io.to(room.id).emit("canvas_undo");
  });

  socket.on("guess", ({ text }: { text: string }) => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || room.game.phase !== "drawing") return;

    const player = room.players.get(socket.id);
    if (!player || room.game.isDrawer(socket.id)) return;

    
    if (room.game.hasGuessed(player.id)) return;

    const normalized = text.trim().toLowerCase();
    const word = room.game.getWord().trim().toLowerCase();
    const correct = normalized === word;

    if (correct) {
      room.game.markGuessed(player.id);
      const points = room.game.correctGuess(player);

      
      if (room.game.drawerId) {
        const drawer = room.players.get(room.game.drawerId);
        if (drawer) {
          drawer.score += Math.max(15, Math.floor(points * 0.6));
        }
      }

      io.to(room.id).emit("guess_result", {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points
      });

      io.to(room.id).emit("chat_message", {
        playerId: "system",
        playerName: "System",
        text: `🎉 ${player.name} guessed the word!`
      });

      emitState(room.id);

      
      const guessers = room.getPlayers().filter(p => p.id !== room.game.drawerId);
      const allFinished = room.game.allGuessersFinished(guessers.length);

      if (allFinished) {
        io.to(room.id).emit("chat_message", {
          playerId: "system",
          playerName: "System",
          text: `✨ Everyone guessed it! The word was "${word}"!`
        });

        
        setTimeout(() => {
          if (room.game.phase === "drawing") {
            room.nextTurn();
            emitRoundStart(room);
            emitState(room.id);
          }
        }, 1500);
      } else {
        
        if (room.game.timeLeft > 12) {
          room.game.timeLeft = 12;
          emitState(room.id);
        }
      }
    } else {
      
      io.to(room.id).emit("chat_message", {
        playerId: player.id,
        playerName: player.name,
        text: text.trim()
      });
    }
  });

  socket.on("chat", ({ text }: { text: string }) => {
    const roomId = socketRooms.get(socket.id);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    const player = room?.players.get(socket.id);
    if (!room || !player || !text.trim()) return;
    if (room.game.isDrawer(socket.id) && (room.game.phase === "drawing" || room.game.phase === "choosing")) return;

    io.to(room.id).emit("chat_message", {
      playerId: player.id,
      playerName: player.name,
      text: text.trim()
    });
  });

  socket.on("leave_room", () => leaveCurrentRoom(socket));

  socket.on("disconnect", () => leaveCurrentRoom(socket));

  function leaveCurrentRoom(sock: typeof socket) {
    const roomId = socketRooms.get(sock.id);
    if (!roomId) return;
    const room = manager.getRoom(roomId);
    sock.leave(roomId);
    socketRooms.delete(sock.id);
    if (!room) return;

    const player = room.players.get(sock.id);
    room.removePlayer(sock.id);
    const leaveKey = `${room.id}:${sock.id}`;
    if (player && !announcedLeaves.has(leaveKey)) {
      announcedLeaves.add(leaveKey);
      io.to(room.id).emit("chat_message", {
        playerId: "system",
        playerName: "System",
        text: `${player.name} left the room`
      });
    }
    emitState(room.id);
    manager.deleteIfEmpty(room.id);
    if (!room.players.size) {
      for (const key of announcedLeaves) {
        if (key.startsWith(`${room.id}:`)) announcedLeaves.delete(key);
      }
    }
  }

  function handleStroke(socketId: string, stroke: Stroke) {
    const roomId = socketRooms.get(socketId);
    const room = roomId ? manager.getRoom(roomId) : undefined;
    if (!room || !room.game.isDrawer(socketId) || room.game.phase !== "drawing") return;
    room.addStroke(stroke);
    io.to(room.id).except(socketId).emit("draw_data", stroke);
  }
});


setInterval(() => {
  for (const roomId of new Set(socketRooms.values())) {
    const room = manager.getRoom(roomId);
    if (!room) continue;
    emitTick(room.id);
  }
}, 1000);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
});