import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  model: User = { fullName: '', email: '' } as User;

  constructor(private us: UserService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    return this.us.getAll()
      .then(users => { this.users = users; })
      .catch(err => console.error('Erro ao carregar usuários', err));
  }

  add() {
    if (!this.model.fullName || !this.model.email) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos obrigatórios',
        text: 'Por favor, preencha nome e email',
        confirmButtonText: 'Ok'
      });
      return;
    }
    this.us.add(this.model)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Usuário adicionado!',
          text: 'O usuário foi adicionado com sucesso.',
          timer: 2500,
          showConfirmButton: false
        });
        this.model = { fullName: '', email: '' } as User;
        this.load();
      })
      .catch(err => console.error('Erro ao adicionar usuário', err));
  }

  remove(id?: number) {
    if (!id) return;
    
    Swal.fire({
      icon: 'warning',
      title: 'Deseja remover?',
      text: 'Este usuário será removido permanentemente.',
      showCancelButton: true,
      confirmButtonText: 'Remover',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then(result => {
      if (result.isConfirmed) {
        this.us.remove(id)
          .then(() => {
            Swal.fire({
              icon: 'success',
              title: 'Removido!',
              text: 'O usuário foi removido com sucesso.',
              timer: 2500,
              showConfirmButton: false
            });
            this.load();
          })
          .catch(err => console.error('Erro ao remover usuário', err));
      }
    });
  }
}
