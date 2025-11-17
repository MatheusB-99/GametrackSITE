import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { UserService } from '../../services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Game, Rating } from '../../models/game.model';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-game-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './game-form.component.html',
  styleUrls: ['./game-form.component.css']
})
export class GameFormComponent implements OnInit {
  model: Game = { name:'', description:'', startDate:'', category:'Outro', ratings:[], userIds: [] } as Game;
  editing = false;
  id?: number;
  users: User[] = [];
  categories = ['Ação','RPG','Estratégia','Esporte','Simulação','Outro'];
  rating = 0;

  categoryOpen = false;

  constructor(private gs: GameService, private us: UserService, private router: Router, private route: ActivatedRoute, private el: ElementRef) {}

  ngOnInit() {
    this.us.getAll()
      .then(users => {
        this.users = users;
      })
      .catch(err => console.error('Erro ao carregar usuários', err));

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.editing = true;
        this.id = +params['id'];
        this.gs.getById(this.id)
          .then(g => {
            if (g) this.model = g as Game;
          })
          .catch(err => console.error('Erro ao carregar jogo', err));
      }
    });
  }

  toggleCategory() {
    this.categoryOpen = !this.categoryOpen;
  }

  selectCategory(c: string, event?: Event) {
    if (event) event.stopPropagation();
    this.model.category = c as any;
    this.categoryOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.categoryOpen = false;
    }
  }

  save() {
    const saveAction = this.editing && this.id 
      ? this.gs.update(this.id, this.model)
      : this.gs.add(this.model);

    saveAction
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: this.editing ? 'Jogo atualizado!' : 'Jogo cadastrado!',
          text: this.editing 
            ? 'O jogo foi atualizado com sucesso.'
            : 'O jogo foi cadastrado com sucesso.',
          timer: 3000,
          showConfirmButton: false
        });
        this.router.navigate(['/games']);
      })
      .catch(err => {
        console.error('Erro ao salvar jogo', err);
        Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Ocorreu um erro ao salvar o jogo.'
        });
      });
  }

  clear() { 
    this.model = { name:'', description:'', startDate:'', category:'Outro', ratings:[], userIds: [] } as Game;
    this.rating = 0;
  }

  setRating(value: number) {
    this.rating = value;
  const newRating: Rating = { value: this.rating, userId: 1 };
    if (!this.model.ratings) {
      this.model.ratings = [];
    }
    this.model.ratings = [newRating];
  }
}
