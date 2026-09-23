import type { Player as PlayerData } from "../types.js";

export class Player {
  readonly id: string;
  name: string;
  avatar: string;
  score = 0;
  ready = false;
  connected = true;

  constructor(id: string, name: string, avatar: string = "👨🏻") {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
  }

  snapshot(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      score: this.score,
      ready: this.ready,
      connected: this.connected
    };
  }
}