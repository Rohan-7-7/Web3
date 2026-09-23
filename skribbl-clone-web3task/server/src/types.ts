export type Phase = "lobby" | "choosing" | "drawing" | "finished";

export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints?: number;
  isPrivate?: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
  connected: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
  eraser?: boolean;
}

export interface RoomSnapshot {
  id: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  isPrivate: boolean;
  phase: Phase;
  round: number;
  totalRounds: number;
  drawerId: string | null;
  timeLeft: number;
  strokes: Stroke[];
  wordLength: number;
  /** Map of revealed letter index → actual character, for non-drawer players */
  hintLetters: Record<number, string>;
  wordOptions: string[];
}