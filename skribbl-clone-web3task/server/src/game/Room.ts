import type { RoomSettings, RoomSnapshot, Stroke } from "../types.js";
import { Game } from "./Game.js";
import { Player } from "./Player.js";

export class Room {
  readonly id: string;
  hostId: string;
  settings: RoomSettings;
  readonly isPrivate: boolean;
  readonly players = new Map<string, Player>();
  readonly game: Game;
  public onGameChange?: () => void;

  constructor(id: string, host: Player, settings: RoomSettings, isPrivate: boolean = false) {
    this.id = id;
    this.hostId = host.id;
    this.settings = settings;
    this.isPrivate = isPrivate;
    this.players.set(host.id, host);
    this.game = new Game(settings);
    this.game.onRoundChange = () => {
      this.onGameChange?.();
    };
  }

  updateSettings(newSettings: Partial<RoomSettings>) {
    if (this.game.phase !== "lobby") {
      throw new Error("Settings can only be changed while in the lobby");
    }

    const maxPlayers = newSettings.maxPlayers !== undefined
      ? Math.max(Math.max(2, this.players.size), Math.min(20, Number(newSettings.maxPlayers)))
      : this.settings.maxPlayers;

    const rounds = newSettings.rounds !== undefined
      ? Math.max(2, Math.min(10, Number(newSettings.rounds)))
      : this.settings.rounds;

    const drawTime = newSettings.drawTime !== undefined
      ? Math.max(15, Math.min(240, Number(newSettings.drawTime)))
      : this.settings.drawTime;

    const wordCount = newSettings.wordCount !== undefined
      ? Math.max(1, Math.min(5, Number(newSettings.wordCount)))
      : this.settings.wordCount;

    const hints = newSettings.hints !== undefined
      ? Math.max(0, Math.min(5, Number(newSettings.hints)))
      : (this.settings.hints ?? 2);

    this.settings = {
      ...this.settings,
      maxPlayers,
      rounds,
      drawTime,
      wordCount,
      hints
    };

    this.game.updateSettings(this.settings);
  }

  addPlayer(player: Player) {
    if (this.players.size >= this.settings.maxPlayers) {
      throw new Error("Room is full");
    }
    this.players.set(player.id, player);
  }

  removePlayer(id: string) {
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = this.players.keys().next().value ?? "";
    }
  }

  getPlayers() {
    return [...this.players.values()];
  }

  start() {
    const players = this.getPlayers();
    players.forEach(p => p.ready = true);
    this.game.start(players);
  }

  nextTurn() {
    this.game.endTurn(this.getPlayers());
  }

  nextRound() {
    this.nextTurn();
  }

  snapshot(): RoomSnapshot {
    const hintLetters: Record<number, string> = {};
    for (const idx of this.game.hintIndices) {
      hintLetters[idx] = this.game.currentWord[idx] ?? "";
    }
    return {
      id: this.id,
      hostId: this.hostId,
      players: this.getPlayers().map(p => p.snapshot()),
      settings: this.settings,
      isPrivate: this.isPrivate,
      phase: this.game.phase,
      round: this.game.round,
      totalRounds: this.settings.rounds,
      drawerId: this.game.drawerId,
      timeLeft: this.game.timeLeft,
      strokes: this.game.strokes,
      wordLength: this.game.currentWord.length,
      hintLetters,
      wordOptions: this.game.phase === "choosing" ? [...this.game.wordOptions] : []
    };
  }

  addStroke(stroke: Stroke) {
    this.game.addStroke(stroke);
  }
}