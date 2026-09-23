import type { Phase, RoomSettings, Stroke } from "../types.js";
import { Player } from "./Player.js";

const WORDS = [
  "apple", "rocket", "football", "elephant", "pizza",
  "computer", "castle", "guitar", "rainbow", "airplane",
  "mountain", "robot", "banana", "camera", "book",
  "diamond", "sunflower", "dragon", "bicycle", "penguin",
  "cookie", "umbrella", "octopus", "volcano", "lighthouse"
];

const HINT_INTERVAL_SECONDS = 15;

export class Game {
  phase: Phase = "lobby";
  round = 0;
  drawerId: string | null = null;
  currentWord = "";
  wordOptions: string[] = [];
  timeLeft = 0;
  strokes: Stroke[] = [];
  hintIndices: number[] = [];
  guessedPlayerIds = new Set<string>();
  public onRoundChange?: () => void;

  private timer?: NodeJS.Timeout;
  private hintTimer?: NodeJS.Timeout;
  private drawerIndex = 0;
  private turnInRound = 0;

  constructor(private settings: RoomSettings) {}

  updateSettings(settings: RoomSettings) {
    this.settings = settings;
  }

  start(players: Player[]) {
    this.round = 1;
    this.turnInRound = 0;
    this.drawerIndex = 0;
    this.beginTurn(players);
  }

  private beginTurn(players: Player[]) {
    this.clearTimer();
    this.clearHintTimer();
    this.guessedPlayerIds.clear();

    if (this.round > this.settings.rounds) {
      this.phase = "finished";
      this.drawerId = null;
      this.currentWord = "";
      this.wordOptions = [];
      this.onRoundChange?.();
      return;
    }

    this.phase = "choosing";
    const numPlayers = Math.max(1, players.length);
    this.drawerId = players.length > 0 ? players[this.drawerIndex % numPlayers]?.id ?? null : null;
    this.currentWord = "";
    this.hintIndices = [];
    this.wordOptions = shuffle(WORDS).slice(0, Math.min(this.settings.wordCount || 3, WORDS.length));
    this.timeLeft = this.settings.drawTime;
    this.strokes = [];

    this.onRoundChange?.();
  }

  chooseWord(word: string, players: Player[]) {
    if (this.phase !== "choosing" || !this.drawerId) return false;
    if (word !== undefined && !this.wordOptions.includes(word)) return false;

    this.currentWord = word;
    this.hintIndices = [];
    this.guessedPlayerIds.clear();
    this.phase = "drawing";
    this.startTimer(players);
    this.startHintTimer();
    this.onRoundChange?.();
    return true;
  }

  private startTimer(players: Player[]) {
    this.clearTimer();
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft <= 0) {
        this.endTurn(players);
      }
    }, 1000);
  }

  /** Reveals unrevealed letters based on host-configured hint count and draw time. */
  private startHintTimer() {
    this.clearHintTimer();
    const hintsCount = this.settings.hints !== undefined ? this.settings.hints : 2;
    if (hintsCount === 0) return; // hints disabled

    const maxHints = Math.min(hintsCount, Math.max(0, this.currentWord.length - 1));
    if (maxHints === 0) return;

    const intervalSeconds = Math.max(5, Math.floor(this.settings.drawTime / (maxHints + 1)));

    this.hintTimer = setInterval(() => {
      if (this.phase !== "drawing") { this.clearHintTimer(); return; }
      if (this.hintIndices.length >= maxHints) { this.clearHintTimer(); return; }

      // Build list of indices not yet revealed (skip spaces for multi-word)
      const unrevealed = Array.from({ length: this.currentWord.length }, (_, i) => i)
        .filter(i => this.currentWord[i] !== " " && !this.hintIndices.includes(i));

      if (unrevealed.length === 0) { this.clearHintTimer(); return; }

      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      this.hintIndices.push(pick);
    }, intervalSeconds * 1000);
  }

  hasGuessed(playerId: string): boolean {
    return this.guessedPlayerIds.has(playerId);
  }

  markGuessed(playerId: string) {
    this.guessedPlayerIds.add(playerId);
  }

  allGuessersFinished(totalGuessers: number): boolean {
    return this.guessedPlayerIds.size >= Math.max(1, totalGuessers);
  }

  correctGuess(player: Player): number {
    const points = Math.max(10, this.timeLeft * 2);
    player.score += points;
    return points;
  }

  endTurn(players: Player[]) {
    if (this.phase === "finished") return;
    this.clearTimer();
    this.clearHintTimer();

    const numPlayers = Math.max(1, players.length);
    this.turnInRound += 1;
    this.drawerIndex = (this.drawerIndex + 1) % numPlayers;

    // A round only ends when all players have completed their turns!
    if (this.turnInRound >= numPlayers) {
      this.round += 1;
      this.turnInRound = 0;
    }

    this.beginTurn(players);
  }

  endRound(players: Player[]) {
    this.endTurn(players);
  }

  addStroke(stroke: Stroke) {
    this.strokes.push(stroke);
  }

  undo() {
    this.strokes.pop();
  }

  clear() {
    this.strokes = [];
  }

  getWord() {
    return this.currentWord;
  }

  isDrawer(id: string) {
    return id === this.drawerId;
  }

  stop() {
    this.clearTimer();
    this.clearHintTimer();
  }

  private clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private clearHintTimer() {
    if (this.hintTimer) clearInterval(this.hintTimer);
    this.hintTimer = undefined;
  }
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}