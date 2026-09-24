import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import type { RoomState, Settings, Stroke } from "./types";

const avatars = ["👨🏻","👽","👩🏻","🐻","🦁","🦝","🦹🏻‍♂️","🦄","🧑🏻‍🎨","🧑🏻‍🚀","🦸🏻‍♀️","🥷🏻"];

const COLORS = [
  
  "#111827", "#6b7280", "#ffffff", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7",
  
  "#fca5a5", "#fdba74", "#fde68a", "#86efac", "#67e8f9",
  "#93c5fd", "#d8b4fe", "#f9a8d4", "#6ee7b7", "#fbbf24",
];

const defaultSettings: Settings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 60,
  wordCount: 3,
  hints: 2
};

const rangeProgress = (value: number, min: number, max: number) =>
  `${((value - min) / (max - min)) * 100}%`;

export default function App() {
  const [screen, setScreen] = useState<"home" | "lobby" | "game">("home");
  const [name, setName] = useState(() => localStorage.getItem("skribbl_name") || "");
  const [selectedAvatar, setSelectedAvatar] = useState(() => localStorage.getItem("skribbl_avatar") || "👨🏻"); 
  const [roomInput, setRoomInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<Settings>(defaultSettings);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [myWord, setMyWord] = useState("");
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [messages, setMessages] = useState<{name: string; text: string}[]>([]);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">(
    socket.connected ? "connected" : "connecting"
  );

  useEffect(() => {
    if (name) localStorage.setItem("skribbl_name", name);
  }, [name]);

  useEffect(() => {
    if (selectedAvatar) localStorage.setItem("skribbl_avatar", selectedAvatar);
  }, [selectedAvatar]);

  useEffect(() => {
    const onRoomCreated = ({ roomId }: { roomId: string; isPrivate?: boolean }) => {
      setRoomInput(roomId);
      setScreen("lobby");
    };
    const onState = (state: RoomState) => {
      setRoom(state);
      if (state.wordOptions && state.wordOptions.length > 0) {
        setWordOptions(state.wordOptions);
      }
      if (state.phase !== "lobby") setScreen("game");
      if (state.phase === "finished") setScreen("game");
    };
    const onOptions = ({ words }: { words: string[] }) => setWordOptions(words);
    const onWord = ({ word }: { word: string }) => setMyWord(word);
    const onChat = (m: {playerName: string; text: string}) =>
      setMessages(prev => [...prev.slice(-49), { name: m.playerName, text: m.text }]);
    const onError = (msg: string) => setError(msg);
    const onConnect = () => setConnectionStatus("connected");
    const onDisconnect = () => setConnectionStatus("disconnected");
    const onConnectError = () => setConnectionStatus("disconnected");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("room_created", onRoomCreated);
    socket.on("room_state", onState);
    socket.on("word_options", onOptions);
    socket.on("your_word", onWord);
    socket.on("chat_message", onChat);
    socket.on("error_message", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room_created", onRoomCreated);
      socket.off("room_state", onState);
      socket.off("word_options", onOptions);
      socket.off("your_word", onWord);
      socket.off("chat_message", onChat);
      socket.off("error_message", onError);
    };
  }, []);

  const connect = () => {
    setError("");
    setConnectionStatus("connecting");
    socket.connect();
  };

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  const createPublicRoom = () => {
    if (!name.trim()) return setError("Enter your name");
    connect();
    socket.emit("quick_join", {
      playerName: name.trim(),
      avatar: selectedAvatar,
      settings: { ...settings, isPrivate: false }
    });
  };

  const createPrivateRoom = () => {
    if (!name.trim()) return setError("Enter your name");
    connect();
    socket.emit("create_room", {
      playerName: name.trim(),
      avatar: selectedAvatar,
      settings: { ...settings, isPrivate: true },
      isPrivate: true
    });
  };

  const joinRoom = () => {
    const targetRoom = roomInput.trim();
    if (!name.trim()) return setError("Enter your name");
    if (!targetRoom) return setError("Enter private room code");
    connect();
    socket.emit("join_room", { 
      playerName: name.trim(), 
      avatar: selectedAvatar, 
      roomId: targetRoom 
    });
    setScreen("lobby");
  };

  const copyRoomCode = async (roomId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomId);
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch {
      const el = document.createElement("textarea");
      el.value = roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const leaveLobby = () => {
    socket.emit("leave_room");
    if (socket.connected) {
      setConnectionStatus("connected");
    } else {
      setConnectionStatus("connecting");
      socket.connect();
    }
    setRoom(null);
    setMessages([]);
    setMyWord("");
    setWordOptions([]);
    setError("");
    setRoomInput("");
    setScreen("home");
  };

  if (screen === "home") {
    return (
      <main className="center">
        <section className="card home">
          <h1>Sketch.io ✏️</h1>
          <h3>Draw. Guess. Score. Win.</h3>
          <p className={`connection-status ${connectionStatus}`}>
            <span aria-hidden="true" />
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
          </p>

          <div className="avatar-section">
            <h2>Choose your avatar</h2>
            <div className="avatar-grid">
              {avatars.map((avatar) => (
                <button
                  key={avatar}
                  className={`avatar ${
                    selectedAvatar === avatar ? "selected" : ""
                  }`}
                  onClick={() => setSelectedAvatar(avatar)}
                  type="button"
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div className="selected-player">
            <div className="selected-avatar">
              {selectedAvatar}
            </div>
            <input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") createPublicRoom();
              }}
              maxLength={20}
            />
          </div>

          <div className="room-create-buttons">
            <button type="button" className="btn-room btn-public" onClick={createPublicRoom}>
              Play (Public Room)
            </button>
            <button type="button" className="btn-room btn-private" onClick={createPrivateRoom}>
              Create Private Room
            </button>
          </div>

          <div className="divider">
            <span>or join private room</span>
          </div>

          <div className="row join-row">
            <input
              placeholder="Private room code"
              value={roomInput}
              onChange={e =>
                setRoomInput(e.target.value.toUpperCase())
              }
              onKeyDown={e => {
                if (e.key === "Enter") joinRoom();
              }}
              maxLength={10}
            />
            <button type="button" className="btn-join" onClick={joinRoom}>
              Join
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!room) return <main className="center">Connecting...</main>;

  if (screen === "lobby") {
    const isHost = room.hostId === socket.id;

    const openSettings = () => {
      setDraftSettings({
        maxPlayers: room.settings?.maxPlayers ?? defaultSettings.maxPlayers,
        rounds: room.settings?.rounds ?? defaultSettings.rounds,
        drawTime: room.settings?.drawTime ?? defaultSettings.drawTime,
        wordCount: room.settings?.wordCount ?? defaultSettings.wordCount,
        hints: room.settings?.hints ?? defaultSettings.hints,
      });
      setShowSettings(true);
    };

    const applySettings = () => {
      socket.emit("update_settings", { settings: draftSettings });
      setShowSettings(false);
    };

    return (
      <main className="center">
        <section className="card lobby">
          {}
          <button
            type="button"
            className="btn-lobby-back"
            onClick={leaveLobby}
            title="Leave room"
          >
            ← Back
          </button>

          
          {isHost && (
            <button
              type="button"
              className="btn-settings-icon"
              onClick={openSettings}
              title="Room settings"
            >
              ⚙️
            </button>
          )}

          <div className="lobby-header">
            {room.isPrivate ? (
              <>
                <div className="room-title-row">
                  <h1>Room: <span className="room-code-tag">{room.id}</span></h1>
                  <button
                    type="button"
                    className="btn-badge-copy"
                    onClick={() => copyRoomCode(room.id)}
                    title="Copy Room Code"
                  >
                    {copiedCode ? "✓ Copied" : "Copy Code"}
                  </button>
                </div>
                <div className="room-badges">
                  <span className="badge badge-private">Private Room</span>
                </div>
                <p className="room-hint-text">Share this code with your friends to join!</p>
              </>
            ) : (
              <>
                <div className="room-title-row">
                  <h1>Public Lobby</h1>
                </div>
                <div className="room-badges">
                  <span className="badge badge-public">Public Room</span>
                </div>
                <p className="room-hint-text">Waiting for players to join from matchmaking...</p>
              </>
            )}
          </div>

          <h2>Players ({room.players.length})</h2>
          <ul className="players-list">
            {room.players.map(p => (
              <li key={p.id} className="player-list-item">
                <span className="player-avatar-icon">{p.avatar || "👤"}</span>
                <span className="player-name-text">{p.name}</span>
                {p.id === room.hostId && <span className="host-badge" title="Room Host">Host</span>}
                {p.id === socket.id && <span className="you-badge">(You)</span>}
              </li>
            ))}
          </ul>

          <div className="lobby-actions">
            {isHost ? (
              <button
                className="btn-start"
                disabled={room.players.length < 2}
                onClick={() => socket.emit("start_game")}
                title={room.players.length < 2 ? "At least 2 players are required to start" : "Start game"}
              >
                Start Game
              </button>
            ) : (
              <div className="waiting-host">
                <span className="pulsing-dot"></span> Waiting for host to start...
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        {/* Settings Panel Modal */}
        {showSettings && (
          <div className="settings-overlay" onClick={() => setShowSettings(false)}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
              <div className="settings-panel-header">
                <h2>⚙️ Room Settings</h2>
                <button
                  type="button"
                  className="settings-close-btn"
                  onClick={() => setShowSettings(false)}
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="settings-body">
                {/* Max Players */}
                <div className="settings-row">
                  <label className="settings-label">
                    <span>👥 Max Players</span>
                    <span className="settings-value">{draftSettings.maxPlayers}</span>
                  </label>
                  <input
                    type="range"
                    className="settings-range"
                    min={2}
                    max={20}
                    value={draftSettings.maxPlayers}
                    style={{
                      background: `linear-gradient(to right, #f97316 ${rangeProgress(draftSettings.maxPlayers, 2, 20)}, #3f3f46 ${rangeProgress(draftSettings.maxPlayers, 2, 20)})`
                    }}
                    onChange={e => setDraftSettings(s => ({ ...s, maxPlayers: Number(e.target.value) }))}
                  />
                  <div className="settings-range-labels"><span>2</span><span>20</span></div>
                </div>

                {/* Rounds */}
                <div className="settings-row">
                  <label className="settings-label">
                    <span>🔄 Rounds</span>
                    <span className="settings-value">{draftSettings.rounds}</span>
                  </label>
                  <input
                    type="range"
                    className="settings-range"
                    min={2}
                    max={10}
                    value={draftSettings.rounds}
                    style={{
                      background: `linear-gradient(to right, #f97316 ${rangeProgress(draftSettings.rounds, 2, 10)}, #3f3f46 ${rangeProgress(draftSettings.rounds, 2, 10)})`
                    }}
                    onChange={e => setDraftSettings(s => ({ ...s, rounds: Number(e.target.value) }))}
                  />
                  <div className="settings-range-labels"><span>2</span><span>10</span></div>
                </div>

                {/* Draw Time */}
                <div className="settings-row">
                  <label className="settings-label">
                    <span>⏱️ Draw Time</span>
                    <span className="settings-value">{draftSettings.drawTime}s</span>
                  </label>
                  <input
                    type="range"
                    className="settings-range"
                    min={15}
                    max={240}
                    step={5}
                    value={draftSettings.drawTime}
                    style={{
                      background: `linear-gradient(to right, #f97316 ${rangeProgress(draftSettings.drawTime, 15, 240)}, #3f3f46 ${rangeProgress(draftSettings.drawTime, 15, 240)})`
                    }}
                    onChange={e => setDraftSettings(s => ({ ...s, drawTime: Number(e.target.value) }))}
                  />
                  <div className="settings-range-labels"><span>15s</span><span>240s</span></div>
                </div>

                {/* Word Count */}
                <div className="settings-row">
                  <label className="settings-label">
                    <span>📝 Word Count</span>
                    <span className="settings-value">{draftSettings.wordCount} word{draftSettings.wordCount !== 1 ? "s" : ""}</span>
                  </label>
                  <input
                    type="range"
                    className="settings-range"
                    min={1}
                    max={5}
                    value={draftSettings.wordCount}
                    style={{
                      background: `linear-gradient(to right, #f97316 ${rangeProgress(draftSettings.wordCount, 1, 5)}, #3f3f46 ${rangeProgress(draftSettings.wordCount, 1, 5)})`
                    }}
                    onChange={e => setDraftSettings(s => ({ ...s, wordCount: Number(e.target.value) }))}
                  />
                  <div className="settings-range-labels"><span>1</span><span>5</span></div>
                </div>

                {/* Hints */}
                <div className="settings-row">
                  <label className="settings-label">
                    <span>💡 Hints</span>
                    <span className="settings-value">
                      {(draftSettings.hints ?? 2) === 0 ? "Disabled" : `${draftSettings.hints} hint${draftSettings.hints !== 1 ? "s" : ""}`}
                    </span>
                  </label>
                  <input
                    type="range"
                    className="settings-range"
                    min={0}
                    max={5}
                    value={draftSettings.hints ?? 2}
                    style={{
                      background: `linear-gradient(to right, #f97316 ${rangeProgress(draftSettings.hints ?? 2, 0, 5)}, #3f3f46 ${rangeProgress(draftSettings.hints ?? 2, 0, 5)})`
                    }}
                    onChange={e => setDraftSettings(s => ({ ...s, hints: Number(e.target.value) }))}
                  />
                  <div className="settings-range-labels"><span>Off</span><span>5</span></div>
                </div>
              </div>

              <div className="settings-panel-footer">
                <button
                  type="button"
                  className="btn-settings-cancel"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-settings-apply"
                  onClick={applySettings}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <GameView
      room={room}
      myWord={myWord}
      wordOptions={wordOptions}
      messages={messages}
      onChoose={word => socket.emit("choose_word", { word })}
      onHome={leaveLobby}
    />
  );
}

function GameView({
  room, myWord, wordOptions, messages, onChoose, onHome
}: {
  room: RoomState;
  myWord: string;
  wordOptions: string[];
  messages: {name: string; text: string}[];
  onChoose: (word: string) => void;
  onHome: () => void;
}) {
  const isDrawer = room.drawerId === socket.id;
  const [guess, setGuess] = useState("");
  const [color, setColor] = useState("#111827");
  const [size, setSize] = useState(5);
  const [eraser, setEraser] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const current = useRef<Stroke | null>(null);
  const lastEmittedPoint = useRef<Stroke["points"][number] | null>(null);
  const pendingPoints = useRef<Stroke["points"]>([]);
  const animationFrame = useRef<number | null>(null);
  const liveStrokes = useRef(new Map<string, Stroke>());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineCap = "round";

    liveStrokes.current.clear();
    room.strokes.forEach(stroke => {
      if (stroke.id) {
        liveStrokes.current.set(stroke.id, {
          ...stroke,
          points: [...stroke.points]
        });
      }
    });
    redraw();

    const onData = (stroke: Stroke) => {
      if (stroke.id) {
        const existing = liveStrokes.current.get(stroke.id);
        if (existing) {
          const newPoints = stroke.points.slice(existing.points.length > 0 ? 1 : 0);
          existing.points.push(...newPoints);
        } else {
          liveStrokes.current.set(stroke.id, { ...stroke, points: [...stroke.points] });
        }
      }
      redraw();
    };
    const onClear = () => {
      liveStrokes.current.clear();
      ctx.clearRect(0, 0, rect.width, rect.height);
    };
    const onUndo = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      const lastId = [...liveStrokes.current.keys()].pop();
      if (lastId) liveStrokes.current.delete(lastId);
      redraw();
    };
    socket.on("draw_data", onData);
    socket.on("canvas_cleared", onClear);
    socket.on("canvas_undo", onUndo);
    return () => {
      socket.off("draw_data", onData);
      socket.off("canvas_cleared", onClear);
      socket.off("canvas_undo", onUndo);
    };

    function redraw() {
      ctx.clearRect(0, 0, rect.width, rect.height);
      liveStrokes.current.forEach(drawStroke);
    }

    function drawStroke(stroke: Stroke) {
      if (!stroke.points.length) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.size;
      ctx.strokeStyle = stroke.eraser ? "#ffffff" : stroke.color;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [room.round, room.strokes.length]);

  const point = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const drawLocally = (stroke: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas || !stroke.points.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.eraser ? "#ffffff" : stroke.color;
    ctx.lineCap = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
    }
    ctx.stroke();
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || room.phase !== "drawing") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotFoundError")) {
        throw error;
      }
    }
    drawing.current = true;
    const firstPoint = point(e.clientX, e.clientY);
    current.current = {
      id: crypto.randomUUID(),
      points: [firstPoint],
      color,
      size,
      eraser
    };
    lastEmittedPoint.current = firstPoint;
    pendingPoints.current = [];
    drawLocally(current.current);
    socket.emit("draw_start", current.current);
  };

  const appendPoint = (nextPoint: Stroke["points"][number]) => {
    const stroke = current.current;
    if (!drawing.current || !stroke) return;

    const previousPoint = stroke.points[stroke.points.length - 1];
    if (previousPoint.x === nextPoint.x && previousPoint.y === nextPoint.y) return;

    stroke.points.push(nextPoint);
    pendingPoints.current.push(nextPoint);
    drawLocally({ ...stroke, points: [previousPoint, nextPoint] });
    if (animationFrame.current === null) {
      animationFrame.current = requestAnimationFrame(flushMove);
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !current.current) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const events = coalesced && coalesced.length > 0 ? coalesced : [e.nativeEvent];
    events.forEach(sample => appendPoint(point(sample.clientX, sample.clientY)));
  };

  const end = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    if (e) {
      appendPoint(point(e.clientX, e.clientY));
    }
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    flushMove();
    drawing.current = false;
    if (e && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    current.current = null;
    lastEmittedPoint.current = null;
    pendingPoints.current = [];
    socket.emit("draw_end");
  };

  function flushMove() {
    animationFrame.current = null;
    const stroke = current.current;
    const from = lastEmittedPoint.current;
    const points = pendingPoints.current;
    if (!stroke || !from || points.length === 0) return;
    socket.emit("draw_move", { ...stroke, points: [from, ...points] });
    lastEmittedPoint.current = points[points.length - 1];
    pendingPoints.current = [];
  }

  const chatLocked = isDrawer && (room.phase === "drawing" || room.phase === "choosing");

  const sendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatLocked || !guess.trim()) return;
    socket.emit("guess", { text: guess });
    setGuess("");
  };

  const options = (wordOptions && wordOptions.length > 0)
    ? wordOptions
    : (room.wordOptions && room.wordOptions.length > 0)
      ? room.wordOptions
      : ["apple", "banana", "rocket"];

  const drawerName = room.players.find(p => p.id === room.drawerId)?.name || "Drawer";
  const notEnoughPlayers = room.players.length < 2;

  return (
    <main className="center">
      <header className="topbar">
        <strong>Round {room.round}/{room.totalRounds}</strong>
        <span>⏱ {room.timeLeft}s</span>
        {isDrawer ? (
          <span>Your word: <strong>{room.phase === "choosing" ? "Choose a word" : (myWord || "...")}</strong></span>
        ) : room.phase === "choosing" ? (
          <span className="drawer-choosing-text"><strong>{drawerName}</strong> is choosing a word...</span>
        ) : (
          <span className="hint-word" title="Guess this word!">
            {room.wordLength > 0
              ? Array.from({ length: room.wordLength }, (_, i) => (
                  <span
                    key={i}
                    className={`hint-letter${room.hintLetters?.[i] ? " hint-letter--revealed" : ""}`}
                  >
                    {room.hintLetters?.[i] ?? "_"}
                  </span>
                ))
              : "Guess the word!"}
            <sup className="hint-count">
              {room.wordLength > 0 ? room.wordLength : ""}
            </sup>
          </span>
        )}
      </header>

      <div className="game-grid">
        <section className="card board">
          {isDrawer && room.phase === "choosing" && (
            <div className="word-picker">
              <h2>Choose a word</h2>
              <div className="word-options-container">
                {options.map(w => (
                  <button key={w} className="word-choice-btn" onClick={() => onChoose(w)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isDrawer && room.phase === "choosing" && (
            <div className="word-picker waiting-picker">
              <h2>Waiting for {drawerName} to choose a word...</h2>
              <p className="waiting-subtitle">Get ready to guess! ✏️</p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          {isDrawer && room.phase === "drawing" && (
            <div className="toolbar">
              <div className="color-palette">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${color === c ? " swatch--active" : ""}`}
                    style={{ background: c }}
                    onClick={() => { setColor(c); setEraser(false); }}
                    title={c}
                  />
                ))}
                
                <label className="swatch swatch--custom" title="Custom colour" style={{ background: color }}>
                  <input
                    type="color"
                    value={color}
                    onChange={e => { setColor(e.target.value); setEraser(false); }}
                    style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
                  />
                  ＋
                </label>
              </div>
              <input type="range" min="2" max="30" value={size} onChange={e => setSize(Number(e.target.value))} />
              <button onClick={() => setEraser(v => !v)}>{eraser ? "Pen" : "Eraser"}</button>
              <button onClick={() => socket.emit("draw_undo")}>Undo</button>
              <button onClick={() => socket.emit("canvas_clear")}>Clear</button>
            </div>
          )}
        </section>

        <aside className="side">
          <section className="card">
            <h2>Leaderboard</h2>
            {room.players.slice().sort((a,b) => b.score-a.score).map(p =>
              <div className="player" key={p.id}>
                <span>{p.avatar || "👤"} {p.name} {p.id === room.hostId ? "👑" : ""}</span>
                <strong>{p.score}</strong>
              </div>
            )}
          </section>
          <section className="card chat">
            <h2>Chat</h2>
            <div className="messages">{messages.map((m,i) => <div key={i}><b>{m.name}:</b> {m.text}</div>)}</div>
            <form onSubmit={sendGuess}>
              <input
                value={chatLocked ? "" : guess}
                onChange={e => setGuess(e.target.value)}
                placeholder={chatLocked ? "You can't chat while drawing" : "Guess..."}
                disabled={chatLocked}
              />
            </form>
          </section>
        </aside>
      </div>

      {notEnoughPlayers && (
        <div className="overlay">
          <div className="card room-ended-card">
            <div className="room-ended-icon">⚠️</div>
            <h1>Host left</h1>
            <p>Not enough players to continue the game.</p>
            <button type="button" className="room-ended-home" onClick={onHome}>
              Home
            </button>
          </div>
        </div>
      )}

      {room.phase === "finished" && (() => {
        const sorted = room.players.slice().sort((a, b) => b.score - a.score);
        const topScore = sorted[0]?.score ?? 0;
        const winners = sorted.filter(p => p.score === topScore && topScore > 0);
        const isTie = winners.length > 1;
        const medals = ["🥇", "🥈", "🥉"];

        return (
          <div className="overlay victory-overlay">
            {/* Celebration Confetti */}
            <div className="confetti-container" aria-hidden="true">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className={`confetti-piece confetti-${(i % 6) + 1}`}
                  style={{
                    left: `${(i * 2.05) % 100}%`,
                    animationDelay: `${(i * 0.08) % 2.5}s`,
                    animationDuration: `${2.2 + (i % 4) * 0.5}s`
                  }}
                />
              ))}
            </div>

            <div className="card winner-card victory-card">
              <div className="winner-trophy-wrapper">
                <span className="trophy-sparkle left">✨</span>
                <span className="winner-trophy">🏆</span>
                <span className="trophy-sparkle right">✨</span>
              </div>

              <div className="winner-avatar-badge">
                <span>{sorted[0]?.avatar || "👑"}</span>
              </div>

              <h1 className="winner-title">
                {isTie ? "It's a Tie!" : `${sorted[0]?.name || "Player"} Wins!`}
              </h1>
              <p className="winner-subtitle">
                {isTie
                  ? `${winners.map(w => w.name).join(" & ")} tied with ${topScore} pts!`
                  : `Grand Champion with ${topScore} points! 🎉`}
              </p>

              <div className="winner-list">
                {sorted.map((p, i) => (
                  <div key={p.id} className={`winner-row${p.score === topScore && topScore > 0 ? " winner-row--first" : ""}`}>
                    <span className="winner-medal">{medals[i] ?? `#${i + 1}`}</span>
                    <span className="winner-player-avatar">{p.avatar || "👤"}</span>
                    <span className="winner-name">{p.name}</span>
                    <span className="winner-score">{p.score} pts</span>
                  </div>
                ))}
              </div>

              <button className="winner-play-again" onClick={() => window.location.reload()}>
                Play Again
              </button>
            </div>
          </div>
        );
      })()}
    </main>
  );
}