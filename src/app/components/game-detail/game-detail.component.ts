import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { CommentService } from '../../services/comment.service';
import { Game } from '../../models/game.model';
import { CommentModel } from '../../models/comment.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-detail.component.html'
})
export class GameDetailComponent implements OnInit {
  game?: Game;
  comments: CommentModel[] = [];
  newComment = '';
  currentUserId = 1;

  constructor(private route: ActivatedRoute, private gs: GameService, private cs: CommentService) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.gs.getById(id)
        .then(game => {
          this.game = game;
          return this.cs.getByGame(id);
        })
        .then(comments => { this.comments = comments; })
        .catch(err => console.error('Erro ao carregar jogo/comentários', err));
    });
  }

  sendComment() {
    if (!this.game) return;
    if (!this.newComment.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Comentário vazio',
        text: 'Por favor, escreva um comentário antes de enviar.',
        confirmButtonText: 'Ok'
      });
      return;
    }
    const c: CommentModel = { gameId: this.game.id!, userId: this.currentUserId, text: this.newComment, date: new Date().toISOString() };
    this.cs.add(c)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Comentário adicionado!',
          text: 'Seu comentário foi enviado com sucesso.',
          timer: 2500,
          showConfirmButton: false
        });
        this.newComment = '';
        return this.cs.getByGame(this.game!.id!);
      })
      .then(comments => { this.comments = comments; })
      .catch(err => console.error('Erro ao adicionar comentário', err));
  }

  rate(value: number) {
    if (!this.game) return;
    const newRating = { value, userId: this.currentUserId };
    const updated = this.game.ratings ? [...this.game.ratings, newRating] : [newRating];
    this.game.ratings = updated;
    this.gs.update(this.game.id!, { ratings: updated })
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Avaliação registrada!',
          text: `Você avaliou com ${value} estrela(s).`,
          timer: 2500,
          showConfirmButton: false
        });
        return this.gs.getById(this.game!.id!);
      })
      .then(game => { this.game = game; })
      .catch(err => console.error('Erro ao registrar avaliação', err));
  }
}
