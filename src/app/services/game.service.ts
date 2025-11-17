import { Injectable } from '@angular/core';
import { DbService } from './db.service';
import { Game } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameService {
  constructor(private dbService: DbService) {}

  async add(game: Game) { return this.dbService.games.add(game); }
  async getAll() { return this.dbService.games.reverse().toArray(); }
  async getById(id: number) { return this.dbService.games.get(id); }
  async update(id: number, changes: Partial<Game>) { return this.dbService.games.update(id, changes); }
  async delete(id: number) { return this.dbService.games.delete(id); }

  avgRating(game: Game) {
    if (!game.ratings || game.ratings.length === 0) return 0;
    const sum = game.ratings.reduce((a, b) => a + (typeof b === 'number' ? b : b.value), 0);
    return +(sum / game.ratings.length).toFixed(2);
  }

  async ranking() {
    const games = await this.dbService.games.toArray();
    return games.sort((a,b)=> (this.avgRating(b) - this.avgRating(a)));
  }

  async getByCategory(category: string) {
    return this.dbService.games.where('category').equals(category).toArray();
  }

  async getByUser(userId: number) {
    // Coerce values to number to handle cases where IDs were stored as strings
    return this.dbService.games.filter(g => {
      if (!g.userIds || !g.userIds.length) return false;
      return g.userIds.some(id => Number(id) === Number(userId));
    }).toArray();
  }
}
