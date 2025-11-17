import { Injectable } from '@angular/core';
import { DbService } from './db.service';
import { CommentModel } from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  constructor(private dbService: DbService) {}

  add(comment: CommentModel) { return this.dbService.comments.add(comment); }
  getByGame(gameId: number) { return this.dbService.comments.where('gameId').equals(gameId).sortBy('date'); }
  delete(id: number) { return this.dbService.comments.delete(id); }
}
