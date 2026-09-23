export interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
  connected: boolean;
}

export interface Settings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints?: number;
  isPrivate?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id?: string;
  points: Point[];
  color: string;
  size: number;
  eraser?: boolean;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  isPrivate?: boolean;
  phase: "lobby" | "choosing" | "drawing" | "finished";
  round: number;
  totalRounds: number;
  drawerId: string | null;
  timeLeft: number;
  strokes: Stroke[];
  wordLength: number;
  /** index → revealed character */
  hintLetters: Record<number, string>;
  wordOptions?: string[];
}