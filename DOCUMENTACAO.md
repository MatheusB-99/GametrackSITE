# MyGameTrack - Documentação Técnica (detalhada)

## Visão Geral
MyGameTrack é uma SPA frontend escrita em Angular 19 com persistência local em IndexedDB (via Dexie). O objetivo é permitir cadastrar, avaliar, comentar e organizar jogos sem precisar de backend — todos os dados ficam no navegador.

Esta documentação descreve os arquivos principais, o propósito de cada um, trechos de código relevantes e como os módulos e componentes se relacionam entre si.

---

## Raiz do projeto (arquivos de configuração)

- `angular.json` — configuração do build/serve. Importante porque define quais arquivos CSS/JS globais são incluídos e as opções de build. Em nosso projeto atualmente carregamos apenas `src/styles.css` para aplicar o tema customizado.
- `package.json` — dependências e scripts. Contém `dexie`, `sweetalert2` e dependências Angular. Use `npm install` para sincronizar.
- `tsconfig.json` — opções do compilador TypeScript.

---

## `src/` — entrada da aplicação

- `src/index.html` — documento HTML que contém apenas a tag raiz `<app-root>`; é o arquivo servido pelo dev server.
- `src/main.ts` — bootstrap da aplicação em modo standalone. Exemplo:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appRoutingProviders } from './app/app.routes';

bootstrapApplication(AppComponent, {
       providers: [...appRoutingProviders]
});
```

Explicação: `bootstrapApplication` substitui o `platformBrowserDynamic().bootstrapModule(AppModule)` usado em apps baseados em NgModule; ele espera um componente raiz standalone e os `providers` necessários (no caso, o roteamento).

- `src/styles.css` — estilos globais. Contém variáveis de tema, classes para layout, hero, cards, botões, inputs e footer. O estilo centralizado garante que todos os componentes compartilhem a mesma aparência sem usar Bootstrap.

---

## `src/app/` — código da aplicação

Estrutura de alto nível:
- `app.component.ts` — componente raiz (layout): importa `HeaderComponent`, `FooterComponent` e `RouterModule` e expõe o `<router-outlet>` onde as rotas dos componentes serão renderizadas.
- `app.routes.ts` — declara as rotas e exporta `appRoutingProviders`:

```ts
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
```

Relação: `main.ts` injeta `appRoutingProviders` no bootstrap, fazendo o roteamento disponível para toda a aplicação.

---

## `src/app/services/db.service.ts` — Dexie wrapper (DbService)

O `DbService` estende `Dexie` e declara as tabelas tipadas:

```ts
export class DbService extends Dexie {
       games!: Table<Game, number>;
       users!: Table<User, number>;
       comments!: Table<CommentModel, number>;

       constructor() {
              super('MyGameTrackDB');
              this.version(1).stores({
                     games: '++id, name, category',
                     users: '++id, fullName, email',
                     comments: '++id, gameId, userId, date'
              });
       }
}

export const db = new DbService();
```

Função: centraliza a configuração do IndexedDB (nome do DB e índices) e expõe objetos `games`, `users` e `comments` que as demais camadas usam. É registrado como `@Injectable({providedIn:'root'})` para injeção via Angular.

---

## Serviços de negócio (src/app/services)

Todos os serviços injetam `DbService` e expõem operações CRUD que retornam Promises (usa `.then(...)` em componentes):

- `game.service.ts` — responsabilidades principais:
       - `add(game)` → `db.games.add(game)`
       - `getAll()` → `db.games.reverse().toArray()` (recupera mais recentes primeiro)
       - `getById(id)` → `db.games.get(id)`
       - `update(id, changes)` → `db.games.update(id, changes)`
       - `delete(id)` → `db.games.delete(id)`
       - `avgRating(game)` → calcula média das avaliações (cada rating tem `{value, userId}`)
       - `ranking()` → pega todos os jogos e ordena por `avgRating` decrescente
       - `getByCategory(category)` → `db.games.where('category').equals(category).toArray()`
       - `getByUser(userId)` → filtra por `game.userIds` contendo `userId` (comparação coerente com Number para evitar problemas com strings)

       Observação técnica: `getByUser` usa `filter`/`some` porque `userIds` é um array dentro do objeto `Game` (não um índice direto em Dexie). Se desejar consultas muito frequentes por usuário, modelar relacionamento com índices adicionais pode melhorar a performance.

- `user.service.ts`
       - Métodos: `add`, `getAll`, `getById`, `remove/delete`.

- `comment.service.ts`
       - `add(comment)` → `db.comments.add(comment)`
       - `getByGame(gameId)` → `db.comments.where('gameId').equals(gameId).sortBy('date')`
       - `delete(id)` → `db.comments.delete(id)`

Relação: Serviços isolam a camada de persistência e fornecem API simples para os componentes; isso deixa a UI desacoplada do Dexie/IndexedDB.

---

## Componentes principais (src/app/components)

Todos os componentes são `standalone: true` e importam os módulos que precisam (ex.: `CommonModule`, `FormsModule`). Eles usam os serviços via injeção e usam `Swal.fire(...)` para mensagens/confirm.

- `home` — componente de boas-vindas; tem CTA que chama `goToNew()` (usa `Router` para navegar programaticamente para `/games/new`). Também foi estilizado como um "hero" central.

- `game-form` — formulário para criar/editar:
       - Ao abrir verifica `route.params` para `id`; se existe, carrega jogo via `gs.getById(id)` e popula `model`.
       - `save()` decide entre `add` e `update` e exibe mensagens com SweetAlert2; depois navega para `/games`.
       - `userIds` é um `<select multiple>` ligado ao modelo para vincular usuários.

- `game-list` — lista e filtros:
       - `loadAll()` chama `gs.getAll()` e depois `us.getAll()` para popular games e users.
       - `filter()` escolhe entre `getByCategory` ou `getByUser` (verificação `selectedUserId !== null && selectedUserId !== undefined` para permitir `0` se for o caso).
       - `delete(id)` mostra confirmação SweetAlert2 antes de remover e recarrega a lista.
       - `rate(game, value)` atualiza `game.ratings` (adiciona rating) e chama `gs.update`.

- `game-detail` — exibe um jogo e seus comentários:
       - Carrega jogo + comentários encadeando Promises (`.then`)
       - `sendComment()` adiciona comentário via `cs.add()` e recarrega a lista de comentários

- `ranking` — chama `gs.ranking()` para obter jogos ordenados pela média de avaliação; observação: `ranking()` retorna um array ordenado usando `avgRating`.

- `users` — gerencia usuários (list/add/remove). Remove com confirmação via Swal.

- `shared/header` e `shared/footer` — markup de apresentação e navegação. Header contém links com `routerLink`.

---

## Models (`src/app/models`)

- `game.model.ts`
       - `Game` interface: `id?`, `name`, `description`, `startDate`, `endDate?`, `category`, `ratings?` (array de `{value, userId}`), `userIds?` (ids vinculados).
- `user.model.ts` — `User` com `id?`, `fullName`, `email`, possivelmente `points`/`medals` se desejar gamificação futura.
- `comment.model.ts` — `CommentModel` com `id?`, `gameId`, `userId`, `text`, `date` (ISO string).

Relação: os modelos definem os tipos que o `DbService` e os serviços usam para garantir consistência dos dados.

---

## Fluxo de dados - Exemplo de CRUD (Cadastrar jogo)

1. Usuário abre `GameFormComponent` e preenche campos.
2. Ao clicar em salvar, `GameFormComponent.save()` chama `GameService.add(model)`.
3. `GameService.add()` usa `db.games.add(game)` (Dexie) e retorna uma Promise.
4. Com `.then(...)` o componente mostra `Swal.fire` de sucesso e navega para a lista.

Para leitura, `GameListComponent.loadAll()` chama `GameService.getAll()` que faz `db.games.reverse().toArray()` e então popula a UI.

---

## Integrações e bibliotecas

- Dexie (`DbService`) — IndexedDB wrapper para persistência local.
- SweetAlert2 (`Swal.fire`) — mensagens, confirmações e toasts usados em flows (salvar, excluir, validação).
- Angular Router (routes via `app.routes.ts` e `provideRouter`).

---

## Boas práticas e notas técnicas

- Standalone components: o projeto foi migrado para usar `bootstrapApplication` e componentes `standalone: true`. Isso exige declarar `standalone: true` nos componentes que definem `imports`.
- Promises: componentes usam `.then(...)` para encadear chamadas ao serviço (estilo didático exigido pelos slides). Você pode migrar para `async/await` se preferir legibilidade, sem alterar a lógica.
- Tipos e coerção: `GameService.getByUser` coerces IDs with `Number(...)` to handle potential string IDs in the DB — this prevents missing results when IDs were saved as strings.
- Normalização opcional: se você quer garantir consistência, crie uma pequena rotina que lê todos os jogos e converte `userIds` para `number[]` (migration script run once).

---

## Como executar e testar (resumo)

Desenvolvimento:
```powershell
npx ng serve --open
```

Testes manuais recomendados:
- Cadastrar usuários em `Usuários`.
- Cadastrar jogos e vincular usuários (em `Cadastrar Jogo`).
- Testar filtro por usuário e categoria em `Listar Jogos`.
- Testar avaliação (rate) e verificação em `Ranking`.
- Testar comentários em `Detalhes do Jogo`.

---

## Onde modificar (guia rápido)

- Alterar esquema DB: `src/app/services/db.service.ts` (mudar `version()`/`stores()`)
- Lógica de persistência/queries: `src/app/services/*` (Game/User/Comment)
- Views e apresentação: `src/app/components/*` e `src/styles.css`
- Rotas: `src/app/app.routes.ts` — alterar paths ou componentes atribuídos

---

Se quiser, eu posso:
- Gerar um script de migração que normaliza `userIds` armazenados como string para `number[]`.
- Rodar a aplicação e executar um checklist de testes manuais para confirmar fluxos (cadastro, filtro, avaliação, comentário).
- Gerar diagrama simples (SVG/Markdown) que mostra as dependências entre components, services e DB.

Indique qual desses itens prefere que eu faça em seguida.

---

## Detalhamento por arquivo (explicação minuciosa linha-a-linha)

Esta seção explica, passo a passo, trechos de código e a função de cada arquivo principal. Para cada arquivo eu faço (1) um snippet representativo e (2) explico linha a linha ou bloco a bloco o que acontece.

### `src/main.ts`

Snippet:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appRoutingProviders } from './app/app.routes';

bootstrapApplication(AppComponent, {
       providers: [...appRoutingProviders]
});
```

Explicação:
- `import { bootstrapApplication } ...` — importa o método que inicializa apps standalone no Angular moderno.
- `import { AppComponent } ...` — traz o componente raiz (standalone) que contém o layout e o `<router-outlet>`.
- `import { appRoutingProviders } ...` — o array de providers que contém o roteamento configurado em `app.routes.ts` (via `provideRouter`).
- `bootstrapApplication(AppComponent, { providers: [...] })` — inicializa a aplicação com o componente raiz e injeta providers globais (como o Router). Isso substitui `bootstrapModule(AppModule)` usado em apps baseados em módulos.

Notas:
- Se o app precisar de interceptors, providers globais, ou injeções adicionais, eles são passados aqui no `providers`.

---

### `src/app/app.routes.ts`

Snippet (simplificado):

```ts
import { provideRouter, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
// outros imports de componentes

export const routes: Routes = [
       { path: '', component: HomeComponent },
       { path: 'games', component: GameListComponent },
       { path: 'games/new', component: GameFormComponent },
       { path: 'games/:id', component: GameDetailComponent },
       { path: '**', redirectTo: '' }
];

export const appRoutingProviders = [provideRouter(routes)];
```

Explicação:
- `provideRouter(routes)` — cria providers necessários para inicializar o router em modo standalone.
- `routes` — array que mapeia paths para componentes; o Angular renderiza o `component` correspondente no `<router-outlet>` do `AppComponent`.
- `path: '**'` — rota catch-all que redireciona para a home quando um caminho desconhecido é acessado.

Relação: `main.ts` injeta `appRoutingProviders`, logo as rotas ficam disponíveis para toda a aplicação.

---

### `src/app/app.component.ts`

Snippet (estrutura típica):

```ts
import { Component } from '@angular/core';
import { HeaderComponent } from './shared/components/layout/header/header.component';
import { FooterComponent } from './shared/components/layout/footer/footer.component';

@Component({
       selector: 'app-root',
       standalone: true,
       imports: [HeaderComponent, FooterComponent, RouterModule],
       template: `
              <app-header></app-header>
              <main class="container"><router-outlet></router-outlet></main>
              <app-footer></app-footer>
       `
})
export class AppComponent {}
```

Explicação detalhada:
- `@Component({ selector: 'app-root', ... })` — define o componente raiz. `selector` é a tag usada em `index.html`.
- `standalone: true` — permite que o componente seja inicializado sem um NgModule.
- `imports: [...]` — lista de componentes e módulos que este componente utiliza em seu template; importante em componentes standalone.
- `template` — contém o `Header`, `RouterOutlet` e `Footer`. O `RouterOutlet` é onde o Angular renderiza o componente da rota atual.

---

### `src/app/services/db.service.ts` (DbService) — explicação por bloco

Snippet:

```ts
import Dexie, { Table } from 'dexie';
import { Injectable } from '@angular/core';
import { Game } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class DbService extends Dexie {
       games!: Table<Game, number>;
       constructor() {
              super('MyGameTrackDB');
              this.version(1).stores({
                     games: '++id, name, category'
              });
       }
}

export const db = new DbService();
```

Linha a linha / bloco a bloco:
- `import Dexie, { Table } from 'dexie'` — importa a classe principal e o tipo `Table` para tipagem das tabelas.
- `@Injectable({ providedIn: 'root' })` — torna o serviço injetável globalmente (single instance).
- `export class DbService extends Dexie` — a classe herda métodos do Dexie; ao estender, fica natural acessar `this.tableName`.
- `games!: Table<Game, number>;` — define o campo `games` na classe com tipagem (onde `Game` é a interface do modelo e `number` o tipo da chave primária).
- `super('MyGameTrackDB')` — nome do DB no IndexedDB; ao alterar esse nome, cria-se outro banco isolado.
- `this.version(1).stores({...})` — define a versão do schema e os índices/colunas utilizados. Aqui `++id` indica chave auto-increment.
- `export const db = new DbService();` — embora a classe seja injetável, exportar a instância facilita usos diretos em scripts e testes.

Observações:
- Ao aumentar a versão do DB (ex.: `version(2)`), você pode usar `upgrade()` para migrar dados.

---

### `src/app/services/game.service.ts` — principais métodos e por que são assim

Trecho representativo e explicação:

```ts
add(game: Game) {
       return db.games.add(game);
}

getAll() {
       return db.games.reverse().toArray();
}

getByUser(userId: number | string) {
       return db.games.toArray().then((all) =>
              all.filter(g => (g.userIds||[]).some(id => Number(id) === Number(userId)))
       );
}
```

- `add` — delega diretamente ao Dexie `table.add()` que insere e retorna a Promise com o id inserido.
- `getAll` — `reverse()` é usado para retornar os itens mais recentes primeiro (assume ordenação por chave incremental). `toArray()` transforma o cursor em Array.
- `getByUser` — função importante para demonstrar a coerção: como `userIds` pode conter strings ou números, usamos `Number(...)` para comparar de forma segura. Primeiro pegamos todos os jogos (por falta de índice direto em `userIds`) e então filtramos em memória.

Performance note: consultas por propriedade interna de array (como `userIds`) não têm índice por padrão em Dexie; para grandes volumes, reestruture o modelo ou mantenha uma tabela associativa.

---

### `src/app/services/user.service.ts` e `comment.service.ts`

Padrão comum:

```ts
add(user: User) { return db.users.add(user); }
getAll() { return db.users.toArray(); }
```

Explicação: métodos simples que retornam Promises. Em componentes, chamamos `.then(...)` para encadear ações dependentes do resultado.

`comment.service.ts` usa `db.comments.where('gameId').equals(gameId).sortBy('date')` para retornar comentários ordenados por data — usamos `where(...).equals(...)` pois `gameId` está indexado em `stores()`.

---

### `src/app/components/game-list/game-list.component.ts` — lógica de UI e filtros

Trecho representativo:

```ts
loadAll() {
       this.gameService.getAll().then(games => {
              this.games = games;
              return this.userService.getAll();
       }).then(users => {
              this.users = users;
       });
}

filter() {
       if (this.selectedCategory) {
              this.gameService.getByCategory(this.selectedCategory).then(list => this.games = list);
       } else if (this.selectedUserId !== null && this.selectedUserId !== undefined) {
              this.gameService.getByUser(this.selectedUserId).then(list => this.games = list);
       } else {
              this.loadAll();
       }
}
```

Explicação detalhada:
- `loadAll()` — carrega jogos e, quando concluído, carrega usuários. O encadeamento `.then()` evita `await` por alinhamento com os slides.
- `filter()` — trata 3 casos: filtro por categoria, filtro por usuário e fallback para lista completa. Note a checagem explícita contra `null/undefined` para permitir valores falsy válidos como `0`.
- Ao deletar/enviar avaliação, o componente tipicamente chama o serviço e, no `.then()` do resultado, chama `this.loadAll()` para recarregar os dados mostrados.

UI notes: componentes usam `Swal.fire(...)` antes de efetuar exclusões para dar feedback visual consistente.

---

### `src/app/components/game-form/game-form.component.ts` — salvar/editar lógica

Trecho principal:

```ts
ngOnInit() {
       const id = this.route.snapshot.params['id'];
       if (id) {
              this.gameService.getById(+id).then(g => this.model = g || this.model);
       }
}

save() {
       if (this.model.id) {
              this.gameService.update(this.model.id, this.model).then(() => Swal.fire('Atualizado'));
       } else {
              this.gameService.add(this.model).then(() => Swal.fire('Cadastrado'));
       }
}
```

Explicação:
- `ngOnInit()` — obtém `id` das rotas; se existir, carrega o jogo para edição.
- `save()` — decide entre `add` e `update`; usa o retorno Promise para mostrar um alerta de sucesso e normalmente navega para lista.

Validações: o componente deve validar campos antes de salvar (nome não vazio, datas válidas). Os formulários no projeto usam `FormsModule` com `ngModel` para ligação bidirecional.

---

### `src/app/components/game-detail/game-detail.component.ts` — carregamento encadeado e comentários

Trecho:

```ts
this.gameService.getById(id).then(game => {
       this.game = game;
       return this.commentService.getByGame(id);
}).then(comments => {
       this.comments = comments;
});
```

Explicação:
- Encadeamos `getById` e `getByGame` para garantir que a UI tenha o jogo carregado antes de renderizar a seção de comentários.
- `sendComment()` cria um objeto `CommentModel` com `date: new Date().toISOString()` e chama `commentService.add(...)`.

---

### `src/app/components/home/home.component.ts` e `home.component.html`

Responsabilidade:
- Apresentar um hero com título, subtítulo e CTA.
- O CTA chama `goToNew()` que usa `Router.navigate(['/games/new'])` para direcionar o usuário ao formulário.

Porque é importante: a navegação programática evita links inúteis e permite executar tracking/analytics antes de redirecionar.

---

### `src/app/shared/components/layout/header/*` e `footer/*`

Header:
- Contém `routerLink` para navegação declarativa.
- Usa `ngFor` para construir menus dinâmicos quando necessário.

Footer:
- Simples componente de apresentação com copyright e links de contato.

Ambos são `standalone` e importados em `AppComponent`.

---

### `src/styles.css` — variáveis de tema e regras globais

Trechos e explicações:
- `:root { --bg: #0b1020; --accent: #1e90ff; ... }` — variáveis CSS para tema; altere aqui para trocar esquema de cores global.
- `.container { max-width: 980px; margin: 0 auto; padding: 1rem; }` — centraliza conteúdo.
- `.hero { display:flex; align-items:center; justify-content:center; padding: 4rem 1rem; }` — regra para o hero da home.

Regra prática: sempre coloque estilos reutilizáveis e variáveis em `src/styles.css` para evitar duplicação e inconsistência entre componentes.

---

### `src/app/models/*.ts` — contratos de dados

- `game.model.ts`:

```ts
export interface Game {
       id?: number;
       name: string;
       description?: string;
       startDate?: string;
       endDate?: string;
       category?: string;
       ratings?: Array<{ value: number; userId: number }>;
       userIds?: Array<number | string>;
}
```

Explicação:
- Tipos opcionais (`?`) permitem que um objeto parcial seja usado durante a edição antes do insert.
- `userIds` aceita `number | string` temporariamente porque dados antigos podem ter salvo strings; `GameService.getByUser` cuida da coerção ao buscar.

---

## Checklist de validação pós-edição da documentação

- [ ] Verificar caminhos citados no arquivo realmente existem no projeto.
- [ ] Confirmar snippets coincidem com o código atual (caso algum arquivo tenha mudado desde esta documentação).
- [ ] Rodar `npx ng serve` para validar que os fluxos descritos funcionam (opcional, mediante sua permissão).

---

Se quiser, eu sigo e:
- gero a rotina de migração que normaliza `userIds` (converte strings para numbers) e a incluo no `DbService` como `version(2).upgrade(...)`;
- ou faço uma revisão completa do repositório validando que os snippets acima estão 100% sincronizados com os arquivos atuais e corrijo a documentação se houver divergências.

Diga qual dos itens prefere que eu faça a seguir (normalização, rodar servidor para testes, ou checagem de snippets). 
