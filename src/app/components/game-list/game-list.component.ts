import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';
import { UserService } from '../../services/user.service';
import { Game } from '../../models/game.model';
import { User } from '../../models/user.model';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game-list.component.html'
})
export class GameListComponent implements OnInit {
  games: Game[] = [];
  users: User[] = [];
  categories = ['Ação','RPG','Estratégia','Esporte','Simulação','Outro'];
  selectedCategory = '';
  selectedUserId: number|null = null;

  constructor(private gs: GameService, private us: UserService, private router: Router) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    return this.gs.getAll()
      .then(games => {
        this.games = games;
        return this.us.getAll();
      })
      .then(users => { this.users = users; })
      .catch(err => {
        console.error('Erro ao carregar jogos/usuários', err);
      });
  }

  filter() {
    if (this.selectedCategory) {
      this.gs.getByCategory(this.selectedCategory)
        .then(games => { this.games = games; })
        .catch(err => console.error('Erro ao filtrar por categoria', err));
    } else if (this.selectedUserId !== null && this.selectedUserId !== undefined) {
      this.gs.getByUser(this.selectedUserId)
        .then(games => { this.games = games; })
        .catch(err => console.error('Erro ao filtrar por usuário', err));
    } else {
      this.loadAll();
    }
  }

  delete(id?: number) {
    if (!id) return;

    Swal.fire({
      icon: 'warning',
      title: 'Deseja excluir?',
      text: 'Este jogo será removido permanentemente.',
      showCancelButton: true,
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then(result => {
      if (result.isConfirmed) {
        this.gs.delete(id)
          .then(() => {
            Swal.fire({
              icon: 'success',
              title: 'Excluído!',
              text: 'O jogo foi removido com sucesso.',
              timer: 2500,
              showConfirmButton: false
            });
            this.loadAll();
          })
          .catch(err => console.error('Erro ao excluir jogo', err));
      }
    });
  }

  edit(id?: number) { if(id) this.router.navigate(['/games/edit', id]); }
  view(id?: number) { if(id) this.router.navigate(['/games', id]); }

  rate(game: Game, value: number) {
    if (!game.id) return;
    const newRating = { value, userId: 1 };
    const updated = game.ratings ? [...game.ratings, newRating] : [newRating];
    this.gs.update(game.id, { ratings: updated })
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Avaliação registrada!',
          text: `Você avaliou com ${value} estrela(s).`,
          timer: 2500,
          showConfirmButton: false
        });
        this.loadAll();
      })
      .catch(err => console.error('Erro ao registrar avaliação', err));
  }
}
