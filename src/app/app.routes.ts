import { Routes, provideRouter } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { GameListComponent } from './components/game-list/game-list.component';
import { GameFormComponent } from './components/game-form/game-form.component';
import { GameDetailComponent } from './components/game-detail/game-detail.component';
import { RankingComponent } from './components/ranking/ranking.component';
import { UsersComponent } from './components/users/users.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'games', component: GameListComponent },
  { path: 'games/new', component: GameFormComponent },
  { path: 'games/edit/:id', component: GameFormComponent },
  { path: 'games/:id', component: GameDetailComponent },
  { path: 'ranking', component: RankingComponent },
  { path: 'users', component: UsersComponent },
  { path: '**', redirectTo: '' }
];

export const appRoutingProviders = [provideRouter(routes)];
