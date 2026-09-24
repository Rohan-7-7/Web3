import type { RoomSettings } from "../types.js";
import { Player } from "./Player.js";
import { Room } from "./Room.js";

export class GameManager {
  private rooms = new Map<string, Room>();

  createRoom(playerName: string, settings: RoomSettings, socketId: string, avatar: string = "👨🏻", isPrivate: boolean = false) {
    let id = randomCode();
    while (this.rooms.has(id)) id = randomCode();

    const player = new Player(socketId, playerName, avatar);
    const room = new Room(id, player, settings, isPrivate);
    this.rooms.set(id, room);
    return room;
  }

  findPublicRoom(activeSocketIds: ReadonlySet<string>): Room | undefined {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (!activeSocketIds.has(player.id)) {
          room.removePlayer(player.id);
        }
      }
      if (!room.isPrivate && room.game.phase === "lobby" && room.players.size < room.settings.maxPlayers) {
        return room;
      }
    }
    return undefined;
  }

  getRoom(id: string) {
    return this.rooms.get(id.toUpperCase());
  }

  deleteIfEmpty(id: string) {
    const room = this.getRoom(id);
    if (room && room.players.size === 0) {
      room.game.stop();
      this.rooms.delete(room.id);
    }
  }
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}