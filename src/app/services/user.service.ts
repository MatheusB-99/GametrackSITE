import { Injectable } from '@angular/core';
import { DbService } from './db.service';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private dbService: DbService) {}

  add(user: User) { return this.dbService.users.add(user); }
  getAll() { return this.dbService.users.toArray(); }
  getById(id: number) { return this.dbService.users.get(id); }
  delete(id: number) { return this.dbService.users.delete(id); }
  
  remove(id: number) { return this.dbService.users.delete(id); }
}
