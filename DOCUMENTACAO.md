 
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

## Serviços de negócio (src/app/services) — documentação ampliada

Visão geral
- Os serviços encapsulam toda a lógica de persistência e regras de negócio ligadas ao armazenamento local (IndexedDB via Dexie). Eles são injetáveis (`providedIn: 'root'`) e expõem uma API baseada em Promises. Manter a lógica de dados nos serviços facilita testes, reaproveitamento e mantém os componentes focados apenas na UI.

Contrato geral (guia)
- Preferência por Promises: o projeto atual usa Promises e `.then(...)` nos componentes. Você pode migrar para `async/await` em componentes sem alterar os serviços. Se planejar usar rxjs/Observables, encapsule a conversão dentro do serviço.
- Assinatura típica de métodos:
       - add(item: T): Promise<number>
       - getAll(): Promise<T[]>
       - getById(id: number): Promise<T | undefined>
       - update(id: number, changes: Partial<T>): Promise<number | undefined>
       - delete(id: number): Promise<void>

Padrões de tratamento de erros
- Os serviços normalmente deixam exceções fluírem (rejeitar Promise) e os componentes capturam erros para exibir mensagens (Swal.fire). Alternativa: retornar um tipo `Result<T>` com `{ ok: boolean; data?: T; error?: string }` para padronizar handling.

1) `src/app/services/db.service.ts` — (recapitulando)
- Classe que estende `Dexie` e declara `games`, `users`, `comments` com tipagem `Table<T, K>`.
- Importante: alterações no schema exigem `version(n).stores().upgrade(tx => ...)` para migrar dados.

Exemplo prático de transação (uso direto do `db`):

```ts
// transação que adiciona um jogo e um comentário atômicos
await db.transaction('rw', db.games, db.comments, async () => {
       const gameId = await db.games.add(game);
       await db.comments.add({ ...comment, gameId });
});
```

2) `src/app/services/game.service.ts` — documentação detalhada

Responsabilidades
- CRUD completo para `Game` e utilitários como `avgRating`, `ranking`, `getByCategory`, `getByUser`.

Assinaturas sugeridas

```ts
add(game: Game): Promise<number>
getAll(): Promise<Game[]>
getById(id: number): Promise<Game | undefined>
update(id: number, changes: Partial<Game>): Promise<number | undefined>
delete(id: number): Promise<void>
avgRating(game: Game): number
ranking(): Promise<Game[]>
getByCategory(category: Category): Promise<Game[]>
getByUser(userId: number | string): Promise<Game[]>
```

Exemplo de implementação (resumido):

```ts
export class GameService {
       constructor(private dbService: DbService) {}

       add(game: Game) { return db.games.add(game); }

       getAll() { return db.games.reverse().toArray(); }

       getById(id: number) { return db.games.get(id); }

       async update(id: number, changes: Partial<Game>) {
              return db.games.update(id, changes);
       }

       async delete(id: number) {
              return db.games.delete(id);
       }

       avgRating(game: Game) {
              if (!game.ratings || game.ratings.length === 0) return 0;
              const sum = game.ratings.reduce((s, r) => s + r.value, 0);
              return sum / game.ratings.length;
       }

       async ranking() {
              const all = await db.games.toArray();
              return all.sort((a, b) => this.avgRating(b) - this.avgRating(a));
       }

       async getByCategory(category: Category) {
              return db.games.where('category').equals(category).toArray();
       }

       async getByUser(userId: number | string) {
              // sem índice: filtra em memória e coerces types
              const all = await db.games.toArray();
              return all.filter(g => (g.userIds || []).some(id => Number(id) === Number(userId)));
       }
}
```

Notas técnicas e sugestões
- `getByUser` é ineficiente para grandes volumes porque `userIds` é um array interno ao objeto. Para uso intenso, normalize o relacionamento (crie `gameUserLinks` com `gameId, userId` e índice) ou mantenha um índice auxiliar.
- Sempre normalize IDs antes de comparar: `Number(...)`.
- Considere implementar um `search(term: string)` que use índices ou `where('name').startsWithIgnoreCase(term)` para consultas responsivas.

Exemplo de uso no componente (async/await):

```ts
async loadFiltered() {
       this.loading = true;
       try {
              if (this.selectedCategory) this.games = await this.gameService.getByCategory(this.selectedCategory);
              else this.games = await this.gameService.getAll();
       } finally { this.loading = false; }
}
```

Testes recomendados
- Unit: mock `db.games` e testar `avgRating`, `ranking` e `getByUser` com dados variados.
- Integration: salvar jogos com `userIds` como strings e números e verificar que `getByUser` retorna corretamente.

3) `src/app/services/user.service.ts` — documentação detalhada

Responsabilidades
- CRUD para `User` e helpers relacionados (ex.: `getByEmail`, `exists(email)` quando necessário).

Assinaturas sugeridas

```ts
add(user: User): Promise<number>
getAll(): Promise<User[]>
getById(id: number): Promise<User | undefined>
delete(id: number): Promise<void>
getByEmail(email: string): Promise<User | undefined>
```

Boas práticas
- Validar email antes de adicionar.
- Tratar exclusões com cuidado (verificar referências em `games.userIds`). Documente a política (cascade / cleanup / block) e implemente conforme a política.

Exemplo prático — impedir exclusão se referenciado (opcional):

```ts
async safeDelete(userId: number) {
       const games = await db.games.toArray();
       const linked = games.filter(g => (g.userIds||[]).some(id => Number(id) === Number(userId)));
       if (linked.length) throw new Error('Usuário vinculado a jogos');
       return db.users.delete(userId);
}
```

Testes recomendados
- Unit: `add` valida dados e chama `db.users.add`.
- Integration: cenários de exclusão com e sem referências em jogos.

4) `src/app/services/comment.service.ts` — documentação detalhada

Responsabilidades
- Adicionar/ler/excluir comentários e fornecer consultas eficientes por `gameId` (index em `DbService.stores()`).

Assinaturas sugeridas

```ts
add(comment: CommentModel): Promise<number>
getByGame(gameId: number): Promise<CommentModel[]>
delete(id: number): Promise<void>
```

Implementação típica

```ts
add(comment: CommentModel) { return db.comments.add(comment); }

getByGame(gameId: number) {
       return db.comments.where('gameId').equals(gameId).sortBy('date');
}

delete(id: number) { return db.comments.delete(id); }
```

Boas práticas
- Validar `comment.text` (mínimo de caracteres) antes de persistir.
- Para muitos comentários, implemente paginação/limit via `offset/limit` ou mantenha um índice secundário de datas.

Transações envolvendo comentários e jogos
- Ao criar um comentário e atualizar algum contador no jogo (ex.: `commentCount`), use uma transação para manter consistência:

```ts
await db.transaction('rw', db.comments, db.games, async () => {
       await db.comments.add(comment);
       const g = await db.games.get(comment.gameId);
       if (g) await db.games.update(g.id!, { commentCount: (g.commentCount||0) + 1 });
});
```

Testes recomendados
- Unit: `getByGame` retorna lista ordenada por `date`.
- Integration: adicionar comentário via UI e validar que ele aparece imediatamente após `add()`.

---

Observações finais sobre serviços
- Centralize lógica compartilhada (normalização de IDs, validações) em helpers reutilizáveis para evitar duplicação.
- Documente qualquer decisão de modelagem (por exemplo manter arrays em `Game.userIds` vs tabela associativa) no `DOCUMENTACAO.md` para futuros mantenedores.


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

Nesta pasta ficam as definições de tipos (interfaces / alias / tipos union) que representam o contrato de dados usados por toda a aplicação. Em TypeScript esses arquivos não geram código em runtime — eles servem para:

- documentar a forma dos objetos (shape),
- fornecer checagem estática em tempo de compilação (evitar bugs por propriedades inexistentes),
- ajudar na IDE/autocomplete (melhor experiência ao programar),
- garantir consistência entre serviços, componentes e o schema do Dexie (DbService).

Cada arquivo `*.model.ts` costuma exportar uma interface ou tipos relacionados. Abaixo explico em detalhes cada modelo presente no projeto e como ele é usado.

- `game.model.ts`
       - Conteúdo típico:

       ```ts
       export type Category = 'Ação'|'RPG'|'Estratégia'|'Esporte'|'Simulação'|'Outro';

       export interface Rating {
              value: number;
              userId: number;
       }

       export interface Game {
              id?: number;
              name: string;
              description: string;
              startDate: string;
              endDate?: string;
              category: Category;
              ratings?: Rating[];
              userIds?: number[];
       }
       ```

       - Explicação:
              - `Category` é um `union type` que restringe as categorias permitidas (ajuda a evitar valores arbitrários em `category`).
              - `Rating` descreve cada avaliação e inclui `userId` para saber quem avaliou.
              - `Game` define o shape principal: várias propriedades são opcionais (`id?`, `endDate?`, `ratings?`, `userIds?`) para permitir estados intermediários (ex.: formulário parcialmente preenchido antes de salvar).
              - `userIds` liga o jogo a usuários; foi modelado como `number[]` mas em bancos antigos pode haver strings — o serviço faz coercion (`Number(...)`) ao buscar.

       - Uso no projeto:
              - `DbService` declara a tabela `games!: Table<Game, number>` para tipagem do Dexie.
              - `GameService` manipula objetos `Game` (CRUD, cálculos de média, filtros).
              - `GameFormComponent` e `GameListComponent` usam `Game` como tipagem do `model` e das listas.

       - Observações e boas práticas:
              - Inicializar `model` com campos vazios evita `undefined` no template.
              - Se precisar adicionar campos (ex.: `coverUrl`, `platforms`), atualize também `DbService.stores()` se quiser indexar o novo campo.

- `user.model.ts`
       - Conteúdo típico:

       ```ts
       export interface User {
              id?: number;
              fullName: string;
              email: string;
              points?: number;
              medals?: string[];
       }
       ```

       - Explicação:
              - Representa um usuário do sistema. `points` e `medals` são opcionais e suportam futuras funcionalidades de gamificação.
              - `id?` é opcional no objeto antes do insert; ao salvar via Dexie a chave primária auto-increment será gerada.

       - Uso no projeto:
              - `DbService.users` é tipado com `User`.
              - `UserService` oferece CRUD e os componentes `UsersComponent` e `GameFormComponent` consomem esses dados para listar e vincular usuários.

- `comment.model.ts`
       - Conteúdo típico:

       ```ts
       export interface CommentModel {
              id?: number;
              gameId: number;
              userId: number;
              text: string;
              date: string; // ISO
       }
       ```

       - Explicação:
              - Representa um comentário associado a um jogo.
              - `gameId` é usado para indexar a tabela `comments` (`stores()` incluiu `gameId`), o que permite consultas eficientes por jogo.

       - Uso no projeto:
              - `CommentService.getByGame(gameId)` usa `db.comments.where('gameId').equals(gameId).sortBy('date')`.
              - `GameDetailComponent` consome os comentários para exibir e para adicionar novos comentários.

---

### Por que modelos são importantes (resumo técnico)

- Segurança de tipo: Ao usar interfaces, o compilador TypeScript avisa quando propriedades inválidas são acessadas ou faltam; isso reduz bugs em tempo de execução.
- Autocomplete e documentação: As IDEs (VS Code) mostram as propriedades esperadas automaticamente quando você trabalha com variáveis tipadas.
- Consistência com a camada de persistência: `DbService` usa os mesmos tipos nas declarações `Table<T, K>`, garantindo que a forma salva no IndexedDB corresponda ao que o front espera.
- Evolução do schema: Quando alterar as interfaces, pense se a mudança exige migração do banco (Dexie `version().upgrade()`); documente a alteração no `DOCUMENTACAO.md`.

### Recomendações práticas para manter os `model.ts`

1. Sempre atualizar os modelos antes de alterar `DbService.stores()` (manter tipos e schema sincronizados).
2. Se adicionar campos opcionais, considere a inicialização segura no componente (ex.: `model.ratings = model.ratings || []`).
3. Para relacionamentos N:N (por exemplo, muitos usuários vinculados a muitos jogos) pense em normalizar e criar uma tabela associativa ao invés de arrays embutidos no objeto.
4. Escreva testes unitários que validem que os serviços respeitam os tipos (por exemplo, que `GameService.add()` persiste um `Game` e que `getByUser()` retorna apenas jogos com o `userId`).

---

Atualizei a documentação acima com esse detalhamento; quer que eu acrescente exemplos de uso (snippets mostrando criação/validação de um `Game` antes de salvar) ou um checklist de mudanças necessárias caso você altere os modelos no futuro? 

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


## Detalhamento máximo por arquivo (explicação linha-a-linha e blocos importantes)

Aviso: vou focar nos arquivos que compõem a espinha dorsal da aplicação (bootstrap, roteamento, serviços, modelos e componentes principais). Para cada arquivo eu explico os blocos/linhas mais relevantes, como eles se relacionam e observações de manutenção.

### src/main.ts — bootstrap (linha-a-linha)

Trecho:
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appRoutingProviders } from './app/app.routes';

bootstrapApplication(AppComponent, {
       providers: [...appRoutingProviders]
})
       .catch(err => console.error(err));
```

Explicação detalhada:
- Linha 1: importa `bootstrapApplication` — função usada em aplicações Angular standalone para inicializar o componente raiz sem NgModule.
- Linha 2: importa `AppComponent`, o componente principal que contém o layout e o `<router-outlet>`.
- Linha 3: importa `appRoutingProviders` que exporta providers do roteador (via `provideRouter(routes)`).
- `bootstrapApplication(...)`: inicializa o app com `AppComponent` e injeta os `providers` (aqui o roteamento).
- `.catch(...)`: captura falhas de bootstrap e loga no console (útil para debugging de providers faltantes ou erros durante inicialização).

Observações:
- Qualquer provider global (por exemplo interceptors, providers de i18n, ou valores de configuração) deve ser passado aqui.

---

### src/app/app.routes.ts — rotas e providers (linha-a-linha)

Trecho:
```ts
import { Routes, provideRouter } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
// ... outros imports

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

Explicação detalhada:
- `Routes` é um array com objetos `{path, component}`. Cada entrada define qual componente será renderizado quando a URL casar.
- `games/edit/:id` e `games/:id` usam rota parametrizada — o componente acessa o `ActivatedRoute` para ler `params['id']`.
- `path: '**'` atua como fallback — em URLs desconhecidas redireciona para Home.
- `provideRouter(routes)` cria providers necessários para que o roteador funcione em aplicação standalone. Estes providers são injetados no `bootstrapApplication`.

---

### src/app/app.component.ts — componente raiz (blocos principais)

Trecho template (simplificado):
```ts
@Component({
       selector: 'app-root',
       standalone: true,
       imports: [HeaderComponent, FooterComponent, RouterModule],
       template: `
              <app-header></app-header>
              <div style="display:flex;"><div style="flex:1;"><router-outlet></router-outlet></div></div>
              <app-footer></app-footer>
       `
})
export class AppComponent {}
```

Explicação:
- `standalone: true` permite inicializar o componente sem `NgModule`.
- `imports` declara dependências usadas no template (HeaderComponent, FooterComponent e RouterModule para `router-outlet`).
- `router-outlet` é onde os componentes de rota são carregados.

---

### src/styles.css — regras globais (blocos importantes)

Pontos-chave:
- `:root` — variáveis CSS definidas (ex.: `--bg`, `--card`, `--accent`, `--text`). Alterar aqui atualiza tema global do app.
- `.container` — limita largura dos cards/paginas e aplica o background do card (importante para aparência do formulário/lista).
- `.input` — estilo padrão para `<input>`, `<select>`, e áreas de formulário; aqui definimos `background: transparent` e `color` que resultam no visual escuro com texto claro.
- Regras de fallback para `select` e `option` foram adicionadas globalmente com `!important` para contornar limitações de estilização nativa em alguns navegadores (especialmente Windows/Chrome).

Recomendação:
- Mantenha as cores em variáveis (`:root`) e evite duplicação. Para alterações temáticas, altere apenas `:root`.

---

### src/app/services/db.service.ts — Dexie wrapper (linha-a-linha / blocos)

Trecho e comentários:
```ts
@Injectable({ providedIn: 'root' })
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

Explicação passo-a-passo:
- `extends Dexie`: a classe herda a API do Dexie; ao instanciar, cria/abre o IndexedDB.
- `games!: Table<Game, number>;` — declaração de propriedade tipada; `!` indica que será inicializada pelo Dexie internamente.
- `super('MyGameTrackDB')` — nome do banco; mudar cria novo DB isolado (atenção em ambientes de produção ao versionamento).
- `this.version(1).stores({...})` — define o schema e índices (chave auto-increment `++id` e índices simples como `category`).
- Exportar `db` como instância facilita acesso direto em ferramentas ou scripts, embora a injeção via Angular seja preferida.

Migrações:
- Ao modificar `stores()` (novo índice ou nova tabela), incremente a versão e use `.upgrade(tx)` para migrar dados (ex.: normalizar `userIds`).

---

### src/app/services/game.service.ts — explicações e decisões de implementação

Principais pontos e motivos:
- Métodos CRUD delegam ao `DbService.db.games` (Dexie) retornando Promises.
- `getAll()` usa `reverse().toArray()` para retornar os jogos em ordem inversa (mais recentes primeiro) — isso assume incremento por `id`.
- `getByUser(userId)` não usa index (porque `userIds` é um array dentro do registro). Por isso a implementação faz `filter` em memória. Essa escolha simplifica o modelo, mas pode ser reestruturada para alta escala (criar tabela associativa `gameUserLinks` com índices seria ideal).

Exemplo de implementação crítica (comentada):
```ts
async getByUser(userId: number) {
       return this.dbService.games.filter(g => {
              if (!g.userIds || !g.userIds.length) return false;
              return g.userIds.some(id => Number(id) === Number(userId));
       }).toArray();
}
```

Por que `Number(...)`? Para garantir que comparações funcionem mesmo que IDs antigos tenham sido salvos como string.

---

### src/app/components/game-form/game-form.component.ts — explicação detalhada por blocos

Visão ampliada do `GameFormComponent` (formulário de criação/edição)

Objetivo
- Fornecer uma interface completa para criar e editar um `Game`. Deve suportar:
       - Inicialização do modelo para evitar undefined no template;
       - Modo criação e edição (lendo `id` das rotas quando necessário);
       - Vinculação de múltiplos usuários (`userIds`) via multi-select;
       - Seleção de categoria (com custom dropdown para preservar tema visual);
       - Validação básica no cliente e feedback com SweetAlert2;
       - Navegação pós-salvamento e tratamento de erros.

Estado e propriedades comuns
- `model: Game` — normalmente inicializado com valores vazios para evitar erros em templates:
       ```ts
       model: Game = {
              name: '',
              description: '',
              startDate: '',
              endDate: undefined,
              category: 'Outro',
              ratings: [],
              userIds: []
       } as Game;
       ```
- `categories: Category[] = ['Ação','RPG','Estratégia','Esporte','Simulação','Outro'];` — valores usados pelo dropdown.
- Flags: `loading = false`, `saving = false`, `categoryOpen = false`, `editing = false`.

Inicialização (ngOnInit)
- Carrega lista de usuários via `UserService.getAll()` para popular o `<select multiple>`.
- Lê rota (`ActivatedRoute`) e, se encontrar `id`, seta `editing = true` e busca o jogo com `GameService.getById(id)`.
- Exemplo com async/await:

```ts
async ngOnInit() {
       this.loading = true;
       this.users = await this.userService.getAll();
       const id = Number(this.route.snapshot.params['id']);
       if (!isNaN(id)) {
              this.editing = true;
              const g = await this.gameService.getById(id);
              if (g) this.model = { ...this.model, ...g };
       }
       this.loading = false;
}
```

Salvar (save) — fluxo e validações
- Valide no cliente: `name` obrigatório, datas coerentes (`endDate >= startDate` quando presente), `category` válida.
- Disparar mensagens de validação amigáveis (SweetAlert2) antes de chamar o serviço.
- Exemplo de fluxo:

```ts
async save() {
       if (!this.model.name || this.model.name.trim().length === 0) {
              return Swal.fire('Validação', 'O nome do jogo é obrigatório', 'warning');
       }
       // validação de datas (opcional)
       if (this.model.endDate && new Date(this.model.endDate) < new Date(this.model.startDate)) {
              return Swal.fire('Validação', 'Data de término não pode ser anterior ao início', 'warning');
       }

       try {
              this.saving = true;
              if (this.editing && this.model.id) {
                     await this.gameService.update(this.model.id, this.model);
                     await Swal.fire('Atualizado', 'Jogo atualizado com sucesso', 'success');
              } else {
                     await this.gameService.add(this.model);
                     await Swal.fire('Cadastrado', 'Jogo cadastrado com sucesso', 'success');
              }
              this.router.navigate(['/games']);
       } catch (err) {
              console.error('Erro ao salvar jogo', err);
              Swal.fire('Erro', 'Não foi possível salvar o jogo', 'error');
       } finally {
              this.saving = false;
       }
}
```

Limpar / reset do formulário
- Um método `clear()` que reseta `model` para os valores iniciais evita estados residuais quando o usuário cria vários jogos em sequência.

Categoria — custom dropdown x `<select>` nativo
- Motivo da customização: browsers limitam estilização do menu nativo; para manter o tema (texto branco, fundo escuro) foi implementado um dropdown custom com:
       - `categoryOpen` boolean;
       - `toggleCategory()` e `selectCategory(c)`;
       - `@HostListener('document:click')` para fechar quando clicar fora.
- O dropdown atualiza `model.category` — a lógica de persistência continua idêntica à usada por um `<select>` nativo.

Usuários vinculados (multi-select)
- O projeto usa um `<select multiple [(ngModel)]="model.userIds">` por simplicidade.
- Considerações:
       - Multi-select nativo tem UX ruim em alguns casos; se a necessidade aumentar, considerar um componente multi-select acessível (ex.: tag list com autocomplete).
       - Ao salvar, garanta que `userIds` contenha `number[]` (coercion com `Number(...)` se necessário) para manter consistência no DB.

Template — trechos importantes e boas práticas

```html
<form (ngSubmit)="save()">
       <label for="name">Nome</label>
       <input id="name" [(ngModel)]="model.name" name="name" required />

       <label>Categoria</label>
       <div class="custom-select" (click)="$event.stopPropagation(); toggleCategory()">
              <div class="selected">{{ model.category }}</div>
              <ul *ngIf="categoryOpen" class="options">
                     <li *ngFor="let c of categories" (click)="selectCategory(c)">{{ c }}</li>
              </ul>
       </div>

       <label for="users">Usuários vinculados</label>
       <select id="users" multiple [(ngModel)]="model.userIds" name="userIds">
              <option *ngFor="let u of users" [value]="u.id">{{ u.fullName }}</option>
       </select>

       <button type="submit" [disabled]="saving">Salvar</button>
       <button type="button" (click)="clear()">Limpar</button>
</form>
```

Segurança e XSS
- Nunca renderize conteúdo do usuário com `innerHTML` sem sanitização. Use `innerText` ou o `DomSanitizer` do Angular quando estritamente necessário.

Edge-cases e recomendações
- Campos parcialmente preenchidos: inicialize arrays e objetos no `model` para evitar erros em `*ngFor` e bindings.
- IDs salvos como strings: ao filtrar por `userIds` certifique-se de comparar coerentemente (usar `Number(...)`).
- Uploads/cover images: se for adicionar upload de capa, considere armazenar `coverUrl` em `Game` e usar `FileReader` para preview antes do upload.

Acessibilidade
- Labels visíveis e `for`/`id` associados.
- Controle de foco: ao abrir em modo edição, coloque foco no primeiro input; após salvar, mover o foco para a lista (ou mostrar toast com `aria-live`).
- Dropdown custom: construir com papel semântico (button + listbox) se quiser suportar navegação por teclado.

Testes sugeridos
- Unit: "deve inicializar model vazio" — verificar que `model` tem propriedades esperadas.
- Unit: "save chama GameService.add quando não está em edição" — mock `gameService.add`.
- Unit: "validação de datas evita salvar" — testar lógica de validação local.
- E2E: preencher formulário, vincular usuários, salvar e verificar presença na lista.

Observações de manutenção
- Centralize o CSS do dropdown se outros componentes (ex.: game-list) precisarem do mesmo visual.
- Converter `.then()` para `async/await` facilita leitura e debugging.

---

### src/app/components/game-list/game-list.component.ts — explicação detalhada por blocos

Função: listar jogos e permitir filtragem, edição e exclusão. Blocos:

- loadAll(): chama `gs.getAll()` e em seguida `us.getAll()`; preenche `this.games` e `this.users`.
- filter(): se `selectedCategory` definido, chama `getByCategory`; se `selectedUserId` definido, chama `getByUser`; senão, recarrega tudo.
- delete(id): usa `Swal.fire` confirmação e `gs.delete(id)` em seguida recarrega a lista.
- dropdowns customizados: `categoryOpen`, `userOpen` etc. — mantêm o visual consistente com `game-form` e atualizam `selectedCategory`/`selectedUserId` e então chamam `filter()`.

Nota técnica:
- Evitamos arrow-functions no template (por exemplo `users.find(u => ...)`) porque o Angular template parser rejeita expressões complexas; por isso adicionamos o getter `selectedUserName` no componente.

---

### src/app/components/game-detail/*, ranking/*, users/* e shared/* — sumário detalhado

- `game-detail`: carrega um jogo (`getById`) e comentários (`getByGame`). `sendComment()` cria `CommentModel` com `date: new Date().toISOString()` e chama `commentService.add()`.
- `ranking`: chama `gameService.ranking()` que usa `avgRating` e retorna lista ordenada.
- `users`: fornece CRUD básico para usuários; ao excluir chama confirmação `Swal.fire`.
- `shared/header` e `shared/footer`: pequenos componentes de apresentação; `header` contém `routerLink` para navegação, não possuem lógica pesada.

---

### src/app/models/* — explicações

Introdução
- A pasta `src/app/models` contém os contratos TypeScript que descrevem a forma (shape) dos dados usados em toda a aplicação. Esses arquivos não geram código em runtime, mas são cruciais para segurança de tipo, documentação, IDE autocomplete e consistência com o schema do IndexedDB (Dexie).

Objetivos desta seção
- Explicar cada modelo existente (`Game`, `User`, `CommentModel`), mostrar exemplos práticos de uso, sugerir validações, listar implicações para migração do banco e fornecer um checklist para quando for necessário alterar os modelos.

1) `src/app/models/game.model.ts`

Definição (exemplo típico usado no projeto):

```ts
export type Category = 'Ação' | 'RPG' | 'Estratégia' | 'Esporte' | 'Simulação' | 'Outro';

export interface Rating {
       value: number; // 1..5
       userId: number;
}

export interface Game {
       id?: number;
       name: string;
       description?: string;
       startDate?: string; // ISO date
       endDate?: string;   // ISO date optional
       category: Category;
       ratings?: Rating[];
       userIds?: Array<number | string>;
       coverUrl?: string; // opcional: URL para capa
}
```

Explicação campo-a-campo
- `id?`: chave primária (auto-increment pelo Dexie). Opcional no objeto antes de persistir.
- `name`: obrigatório; campo principal para exibição e pesquisa.
- `description`: texto opcional.
- `startDate` / `endDate`: armazenadas como ISO (`new Date().toISOString()` ou `'YYYY-MM-DD'`); prefira ISO para ordenar/filtrar por data.
- `category`: `union type` restringe valores e melhora autocompletar/segurança de dados.
- `ratings`: array de avaliações; cada rating contém `value` (1–5) e `userId`.
- `userIds`: usuários vinculados ao jogo; historicamente pode conter strings (por isso `number | string`).
- `coverUrl`: URL para imagem de capa (opcional, adicionável posteriormente).

Boas práticas e validações recomendadas
- Inicialize arrays/objeto no componente: `model.ratings = model.ratings || []` e `model.userIds = model.userIds || []` para evitar erros em templates.
- Validar `name` não vazio e `category` estar entre os valores permitidos.
- Validar `startDate`/`endDate` e coerência entre elas (se `endDate` existir, não deve ser anterior a `startDate`).
- Normalizar `userIds` antes de persistir: converter strings para números `userIds = userIds.map(id => Number(id))`.

Exemplo de validação leve (função utilitária):

```ts
export function validateGame(g: Partial<Game>): { valid: boolean; errors: string[] } {
       const errors: string[] = [];
       if (!g.name || !g.name.trim()) errors.push('Nome é obrigatório');
       if (g.startDate && g.endDate && new Date(g.endDate) < new Date(g.startDate)) errors.push('endDate < startDate');
       if (g.ratings && g.ratings.some(r => r.value < 1 || r.value > 5)) errors.push('rating.value fora do intervalo');
       return { valid: errors.length === 0, errors };
}
```

Uso no serviço / componente
- Ao salvar no `GameService.add()` garanta que o objeto esteja tipado `Game` e passe pela validação acima; lide com os erros e retorne mensagens amigáveis para o usuário.
- Ao buscar por usuário (`getByUser`) sempre compare coerentemente: `Number(id) === Number(userId)`.

Migração (quando alterar o modelo)
- Checklist mínimo antes de alterar `Game`:
       1. Incremente a versão no `DbService.version(newVersion)` e prepare `upgrade()` que converta registros antigos (p.ex. converter `userIds` strings para numbers, adicionar `coverUrl` com valor `null` etc.).
       2. Atualize `GameService` para lidar com o novo campo (indexação, filtros).
       3. Atualize componentes que instanciam `Game` para inicializar novos campos.
       4. Escreva um script/manual de migração testado localmente (Dexie `upgrade(tx)` é o lugar certo).

Exemplo de migração em `DbService`:

```ts
this.version(2).stores({ games: '++id, name, category' }).upgrade(tx => {
       return tx.table('games').toArray().then(all => {
              all.forEach(g => {
                     if (g.userIds && typeof g.userIds[0] === 'string') {
                            g.userIds = g.userIds.map((id: any) => Number(id));
                            tx.table('games').put(g);
                     }
              });
       });
});
```

Testes sugeridos
- Unit tests para `validateGame` com cases válidos/inválidos.
- Integração: criar jogo por UI, verificar persistência e leitura correta (especialmente `userIds` coerção).

2) `src/app/models/user.model.ts`

Definição típica:

```ts
export interface User {
       id?: number;
       fullName: string;
       email: string;
       points?: number;
       medals?: string[];
}
```

Explicação e boas práticas
- `email` deve ser validado com regex simples ou `Validators.email` em Forms.
- `id?` opcional antes de persistir; ao adicionar via Dexie a chave é gerada.
- `points` e `medals` são opcionais para funcionalidades de gamificação.

Validação exemplo:

```ts
function validateUser(u: Partial<User>) {
       const errors: string[] = [];
       if (!u.fullName || !u.fullName.trim()) errors.push('Nome é obrigatório');
       if (!u.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) errors.push('Email inválido');
       return { valid: errors.length === 0, errors };
}
```

Integridade com `Game.userIds`
- Antes de deletar um usuário, considere:
       - Alertar se o usuário está presente em `game.userIds` (consulte `db.games`);
       - Decidir entre: (A) permitir exclusão e deixar referências órfãs, (B) remover referência de `game.userIds` automaticamente (cleanup), ou (C) bloquear exclusão enquanto houver referências.

Testes sugeridos
- Unit: validar `validateUser`.
- Integration: criar usuário, vinculá-lo a jogo, deletar usuário com e sem cleanup e verificar resultados.

3) `src/app/models/comment.model.ts`

Definição típica:

```ts
export interface CommentModel {
       id?: number;
       gameId: number;
       userId: number;
       text: string;
       date: string; // ISO
}
```

Explicação e boas práticas
- `gameId` indexado em `DbService.stores()` para permitir `where('gameId').equals(gameId)` e consultas eficientes.
- `date` como ISO facilita ordenação e armazenamento consistente.
- Validar `text` (comprimento mínimo) antes de persistir.

Exemplo de validação para comentário:

```ts
function validateComment(c: Partial<CommentModel>) {
       const errors: string[] = [];
       if (!c.gameId) errors.push('gameId é obrigatório');
       if (!c.text || c.text.trim().length < 3) errors.push('Comentário muito curto');
       return { valid: errors.length === 0, errors };
}
```

Persistência e leitura
- `CommentService.getByGame(gameId)` deve usar índice: `db.comments.where('gameId').equals(gameId).sortBy('date')`.
- Considerar paginação para muitos comentários.

Checklist geral antes de alterar modelos (resumido)
1. Atualizar as interfaces em `src/app/models`.
2. Atualizar `DbService.stores()` se for necessário adicionar índice(s) ou alterar campos indexados.
3. Adicionar `version(n).upgrade(tx => {...})` em `DbService` para migrar registros antigos.
4. Atualizar `GameService`, `UserService`, `CommentService` para lidar com novos campos/formatos.
5. Atualizar componentes (inicialização do `model`, templates) para refletir novos campos.
6. Adicionar/atualizar testes unitários e de integração que cubram novos contratos.
7. Documentar a migração no `DOCUMENTACAO.md` (um changelog de schema) para rastreabilidade.

Exemplos práticos (snippets de uso)

Criar um `Game` seguro no componente antes de salvar:

```ts
const candidate: Partial<Game> = {
       name: this.model.name.trim(),
       description: this.model.description?.trim(),
       startDate: this.model.startDate,
       category: this.model.category as Category,
       userIds: (this.model.userIds || []).map(id => Number(id))
};
const { valid, errors } = validateGame(candidate);
if (!valid) { Swal.fire('Erro', errors.join('\n'), 'warning'); return; }
await this.gameService.add(candidate as Game);
```

Testes rápidos para migração local
- Antes de rodar uma migração, faça backup do IndexedDB (p.ex. exportando `db.table('games').toArray()` para um arquivo JSON).
- Rode a migração em ambiente local e verifique os dados convertidos manualmente.

Conclusão
- Manter modelos bem documentados e versionados é essencial quando se usa armazenamento local (IndexedDB). Sempre sincronize mudanças de tipos com migrações em `DbService` e com atualizações nos serviços e componentes.


---

### Arquivos de configuração úteis

- `package.json`: lista dependências (Angular, Dexie, SweetAlert2). Scripts úteis: `npm start` / `ng serve`.
- `angular.json`: configura quais arquivos CSS globais são incluídos e configura o builder do Angular.
- `tsconfig.json`: opções do compilador TypeScript.

---

### Sugestões de melhorias e pontos de atenção

- Migrar `.then(...)` para `async/await` onde fizer sentido para legibilidade.
- Se o app crescer, normalizar o modelo: usar tabela associativa para `game-user` em vez de armazenar arrays dentro do `Game` (melhora queries por usuário).
- Centralizar estilos de dropdown em um arquivo compartilhado para evitar divergências entre componentes.

---

Se quiser, agora eu:
- (A) gere um `diff` automático comparando os snippets da documentação com os arquivos atuais para garantir 100% de sincronia, ou
- (B) gere o diagrama de dependências (SVG) mostrando componentes → serviços → DB, ou
- (C) implemente uma migração Dexie `version(2).upgrade()` que normaliza `userIds` (converte strings para numbers) e atualize `DbService`.

Diga qual opção prefere que eu execute a seguir.

## File-by-file reference (completo)

Abaixo está um inventário detalhado dos arquivos mais relevantes do projeto com uma explicação das suas responsabilidades, partes críticas do código e dependências entre arquivos.

### Estrutura principal

- `src/main.ts`
       - Inicializa a aplicação com `bootstrapApplication(AppComponent, { providers: [...] })`.
       - Depende de: `src/app/app.component.ts`, `src/app/app.routes.ts`.

- `src/index.html`
       - Documento HTML estático com `<app-root>`.

- `src/styles.css`
       - Contém variáveis de tema (`:root`), classes de layout, estilos globais e regras que precisam afetar todo o app (botões, inputs, cards, selects globais com `!important` quando necessário).
       - Aplicado globalmente; altera a aparência de todos os componentes.

### Rotas e componente raiz

- `src/app/app.routes.ts`
       - Define as rotas da aplicação (`Routes`) e exporta `appRoutingProviders` via `provideRouter(routes)`.
       - Rota padrão/Home, listagem, cadastro/edição de jogos, detalhes, ranking e usuários.

- `src/app/app.component.ts`
       - Componente raiz (`standalone: true`) que importa `HeaderComponent`, `FooterComponent` e `RouterModule`.
       - Template com `<app-header>`, `<router-outlet>` e `<app-footer>`; ponto de encaixe das rotas.

### Serviços (camada de dados)

- `src/app/services/db.service.ts` (DbService)
       - Extende `Dexie` e define `games`, `users`, `comments` (tipados com `Table<T, K>`).
       - `version(1).stores({ ... })` define o schema e índices. Alterar essa versão implica migração (upgrade).
       - Exporta `db` instanciado para uso direto em scripts/testes; também é `@Injectable({providedIn:'root'})`.

- `src/app/services/game.service.ts`
       - Encapsula operações sobre `db.games`: `add`, `getAll`, `getById`, `update`, `delete`.
       - Utilitários: `avgRating(game)`, `ranking()`, `getByCategory(category)`, `getByUser(userId)`.
       - Observação: `getByUser` filtra em memória por `userIds` (sem índice) e coerce IDs com `Number(...)`.

- `src/app/services/user.service.ts`
       - Métodos simples para `users`: `add`, `getAll`, `getById`, `delete`.

- `src/app/services/comment.service.ts`
       - Métodos para `comments`: `add`, `getByGame`, `delete`.

Relação entre serviços: todos injetam/consomem `DbService` e expõem uma API Promise-based usada pelos componentes.

### Models (contratos de dados)

- `src/app/models/game.model.ts`
       - Define `Game`, `Rating` e `Category`. Importante para tipagem em `DbService` e serviços.
       - `Game.userIds` pode conter strings; serviços fazem coerção ao buscar.

- `src/app/models/user.model.ts`
       - Define `User`.

- `src/app/models/comment.model.ts`
       - Define `CommentModel`.

### Componentes (UI)

Observação: todos os componentes no projeto são `standalone: true` e importam apenas os módulos necessários (por exemplo, `FormsModule`, `CommonModule`).

- `src/app/components/home/*`
       - `home.component.ts` e `.html`: tela inicial com CTA que navega para `/games/new`.

- `src/app/components/game-form/*` (Cadastrar / Editar Jogo)
       - `game-form.component.ts`:
              - `model: Game` — objeto ligado aos inputs via `[(ngModel)]`.
              - `ngOnInit()` — carrega `users` e (se houver `id` na rota) carrega jogo para edição com `gs.getById`.
              - `save()` — decide entre `gs.add()` ou `gs.update()` e mostra `Swal` de sucesso/erro; após sucesso, navega para `/games`.
              - `clear()` — reseta `model` e rating.
              - Dropdown customizado: `categoryOpen`, `toggleCategory()`, `selectCategory()` e `@HostListener('document:click')` para fechar o menu ao clicar fora.
       - `game-form.component.html`:
              - Inputs (nome, descrição, datas) ligados a `model` via `ngModel`.
              - Categoria: custom select que exibe `model.category` e abre um menu `.options` renderizado com `*ngIf="categoryOpen"`.
              - Usuários vinculados: `<select multiple [(ngModel)]="model.userIds">` (ainda nativo multi-select).
       - `game-form.component.css`:
              - Estilos do input, custom-select, opções e estrelas de rating — carregado via `styleUrls`.

- `src/app/components/game-list/*` (Listagem / Filtros)
       - `game-list.component.ts`:
              - `loadAll()` — popula `games` e `users` usando `GameService` e `UserService`.
              - `filter()` — chama `getByCategory` ou `getByUser`, ou `loadAll()` se nenhum filtro.
              - `delete(id)` — confirmação com `Swal` antes de `gs.delete(id)`; recarrega lista.
              - `rate(game, value)` — insere uma avaliação e atualiza o registro.
              - Dropdowns customizados (categoria/usuário): propriedades `categoryOpen`, `userOpen`, métodos `toggleCategory`, `selectCategory`, `toggleUser`, `selectUser` e `@HostListener('document:click')` para fechar os menus.
              - Getter `selectedUserName` para evitar arrow functions no template.
       - `game-list.component.html`:
              - Exibe filtros (custom selects) e cards com ações (Editar, Excluir).
       - `game-list.component.css`:
              - Estilos idênticos ao `game-form` para garantir aparência consistente do dropdown (fundo escuro, texto branco, sombra, padding).

- `src/app/components/game-detail/*`
       - Carrega jogo por id e comentários (encadeando Promises). Oferece `sendComment()` para postar comentários com data ISO.

- `src/app/components/ranking/*`
       - Chama `gs.ranking()` e exibe jogos ordenados pela média das avaliações.

- `src/app/components/users/*`
       - Lista, adiciona e remove usuários utilizando `UserService`.

- `src/app/shared/components/layout/header/*` e `footer/*`
       - Componentes de apresentação importados por `AppComponent`; `header` contém `routerLink` e menus; `footer` contém informações de rodapé.

### Assets

- `src/assets/` — imagens e recursos estáticos (por exemplo, capas e imagens usadas nos cards).

### Dependências, relações e fluxo de dados resumido

- Fluxo inicial: `main.ts` → `AppComponent` (layout) → `router-outlet` → componentes renderizados conforme `app.routes.ts`.
- Serviços (Game/User/Comment) encapsulam `DbService` (Dexie). Componentes chamam serviços e reagem às Promises com `.then(...)`.
- Estilos: `src/styles.css` fornece tema global; arquivos `*.component.css` definem regras locais quando necessário.

---

Se quiser, eu posso:
- Gerar uma seção de exemplos de edição (p. ex. como alterar `DbService` para migrar schema e script de upgrade),
- Gerar um diagrama SVG mostrando dependências entre `components` ↔ `services` ↔ `db`, ou
- Fazer uma verificação automatizada que valida se os snippets/documentação batem 100% com o código atual (diffs).

Diga qual opção prefere que eu implemente em seguida.

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

Visão ampliada do `GameDetailComponent` (fluxos, estados, template e cuidados)

Objetivo do componente
- Carregar um `Game` por `id` (parâmetro de rota), exibir detalhes do jogo (nome, descrição, datas, categoria, média de avaliações) e a lista de comentários associada. Permite também adicionar um novo comentário.

Estado e propriedades típicas
- `game: Game | null = null;` — o jogo carregado; `null` indica ainda não carregado ou não encontrado.
- `comments: CommentModel[] = [];` — comentários exibidos ordenados por data.
- `loading = false;` / `commentsLoading = false;` — flags para controlar spinners/estado de espera.
- `newCommentText = ''` — conteúdo do textarea do formulário de comentário.
- `notFound = false;` — indica que o id não retornou um jogo (404 local).

Fluxo principal (exemplo com async/await para clareza)

```ts
async load(id: number) {
       try {
              this.loading = true;
              const game = await this.gameService.getById(id);
              if (!game) {
                     this.notFound = true;
                     return;
              }
              this.game = game;

              // Carrega comentários após jogo existir
              this.commentsLoading = true;
              this.comments = await this.commentService.getByGame(id) || [];
       } catch (err) {
              console.error('Erro ao carregar detalhes:', err);
              Swal.fire('Erro', 'Não foi possível carregar os detalhes do jogo', 'error');
       } finally {
              this.loading = false;
              this.commentsLoading = false;
       }
}

async sendComment() {
       if (!this.newCommentText || this.newCommentText.trim().length < 3) {
              Swal.fire('Atenção', 'O comentário precisa ter ao menos 3 caracteres', 'warning');
              return;
       }
       if (!this.game?.id) return;

       const comment: CommentModel = {
              gameId: this.game.id,
              userId: /* obter usuário atual ou usar anonimato */ 0,
              text: this.newCommentText.trim(),
              date: new Date().toISOString()
       };

       try {
              await this.commentService.add(comment);
              this.newCommentText = '';
              // Recarrega comentários (poderia usar otimistic update para melhor UX)
              this.comments = await this.commentService.getByGame(this.game.id);
              Swal.fire('Comentário enviado', '', 'success');
       } catch (err) {
              console.error('Erro ao enviar comentário', err);
              Swal.fire('Erro', 'Não foi possível enviar o comentário', 'error');
       }
}
```

Estrutura do template — trechos importantes

- Cabeçalho com título e botão voltar (usar `Router.navigateBack()` ou `router.navigate(['/games'])`).
- Card principal com informações do `game` (nome, descrição, datas, categoria, média de avaliações). Mostrar placeholders enquanto `loading` for true.
- Lista de comentários:

```html
<section aria-label="Comentários">
       <div *ngIf="commentsLoading">Carregando comentários...</div>
       <ul *ngIf="!commentsLoading && comments.length; else noComments">
              <li *ngFor="let c of comments; trackBy: trackById">
                     <strong>{{ c.userId }}</strong>
                     <time>{{ c.date | date:'short' }}</time>
                     <p [innerText]="c.text"></p>
              </li>
       </ul>
       <ng-template #noComments>Sem comentários ainda.</ng-template>
</section>

<form (ngSubmit)="sendComment()" aria-label="Adicionar comentário">
       <label for="comment">Seu comentário</label>
       <textarea id="comment" [(ngModel)]="newCommentText" name="comment" required minlength="3"></textarea>
       <button type="submit">Enviar</button>
</form>
```

Onde `trackById` é um método simples para otimizar renderização:

```ts
trackById(index: number, item: CommentModel) { return item.id; }
```

Tratamento de edge-cases e recomendações
- Jogo não encontrado: exibir mensagem amigável com link para a lista (usar `notFound` para alternar a UI).
- Comentários grandes / XSS: usar `innerText` ou sanitizar o HTML; não usar `innerHTML` com conteúdo sem sanitização.
- Submissão concorrente: desabilitar botão de enviar enquanto `commentsLoading`/`sending` for true para evitar duplicações.
- Validação: enforce mínimo de caracteres e opcionalmente filtrar conteúdo ofensivo antes de persistir.
- Paginação de comentários: para muitos comentários, implementar paginação ou lazy-loading (ex.: carregar 20 por vez).
- Erros de rede/persistência: capturar exceções e exibir mensagens de erro claras, mantendo logs no console para debugging.

Considerações de acessibilidade
- Labels explícitos para textarea e botões.
- `aria-live` para notificações assíncronas (p. ex. quando comentário enviado com sucesso)
- Foco gerenciado: após enviar, mover foco para a lista de comentários (melhora experiência para leitores de tela).

Testes sugeridos (unit + integração rápida)
- Unit: "deve carregar jogo por id" — mock `GameService.getById` e `CommentService.getByGame` e verificar que `game` e `comments` são atribuídos.
- Unit: "enviar comentário limpa o textarea" — mock `commentService.add` e verificar `newCommentText === ''` após `sendComment()`.
- E2E (manual): abrir rota `/games/:id`, adicionar comentário, verificar presença na lista.


Performance e manutenibilidade
- Use `trackBy` em `*ngFor` para listas grandes.
- Prefira `async/await` nos componentes para legibilidade; os serviços podem continuar retornando Promises.
- Separe lógica de carregamento (ex.: `loadComments()`) para permitir reuso e testes isolados.

Resumo
- O `GameDetailComponent` não é apenas um renderer de dados — ele coordena múltiplas promises, valida dados do usuário, gerencia estados de carregamento e deve tratar falhas/gracefully degradation. Implementar pequenas proteções (validação, mensagens, trackBy, acessibilidade) aumenta a robustez e a experiência do usuário.

---

### `src/app/components/game-list/game-list.component.ts` — documentação ampliada

Objetivo
- Exibir a lista de jogos, oferecer filtros (por categoria e por usuário), permitir ações rápidas (editar, excluir, avaliar) e manter a UI sincronizada com a camada de persistência (GameService).

Estado e propriedades principais
- `games: Game[] = []` — array principal exibido em cards.
- `users: User[] = []` — lista de usuários usada no filtro por usuário.
- `selectedCategory?: Category` — categoria selecionada no filtro.
- `selectedUserId?: number | null` — id do usuário selecionado no filtro.
- `loading = false`, `filtering = false` — flags para controlar spinners/estado.

Fluxos e métodos importantes
- `loadAll()` — carrega jogos e usuários, usado na inicialização e após operações que alteram o BD.
- `filter()` — aplica filtros combinados (categoria OU usuário). Importante: a app atual trata os filtros como alternativos (um por vez). Se desejar filtros combinados, a função deve compor as condições e aplicar filtro em memória ou via índices.
- `delete(id: number)` — exibe confirmação (SweetAlert2) e chama `gameService.delete(id)`. Após sucesso, recarrega lista.
- `rate(game: Game, value: number)` — adiciona/atualiza rating em `game.ratings` e chama `gameService.update(game.id, game)`.

Trecho representativo (async/await + debounce para filtro opcional)

```ts
async loadAll() {
       this.loading = true;
       try {
              this.games = await this.gameService.getAll();
              this.users = await this.userService.getAll();
       } finally {
              this.loading = false;
       }
}

async filter() {
       this.filtering = true;
       try {
              if (this.selectedCategory) {
                     this.games = await this.gameService.getByCategory(this.selectedCategory);
              } else if (this.selectedUserId !== null && this.selectedUserId !== undefined) {
                     this.games = await this.gameService.getByUser(this.selectedUserId);
              } else {
                     await this.loadAll();
              }
       } finally {
              this.filtering = false;
       }
}
```

Template — trechos e considerações
- Filtros: dois custom selects (categoria e usuário) que abrem menus estilizados. O botão de limpar filtros deve resetar `selectedCategory` e `selectedUserId` e chamar `loadAll()`.
- Cards: usar `*ngFor="let g of games; trackBy: trackById"` com `trackById` retornando `g.id`.
- Ações: botões para editar (navega para `/games/edit/:id`), excluir (confirmação), e avaliar (pode abrir um pequeno menu de estrelas inline).

Exemplo de botão de ação com confirmação:

```ts
async delete(id: number) {
       const res = await Swal.fire({ title: 'Confirma?', showCancelButton: true });
       if (res.isConfirmed) {
              await this.gameService.delete(id);
              await this.loadAll();
       }
}
```

Performance e UX
- Para listas grandes, pagine no serviço (`db.games.offset(...).limit(...)`) ou use infinitescroll/virtual scroll.
- Debounce nas mudanças de filtro (200–300ms) evita chamadas excessivas ao Dexie quando o usuário interage rapidamente.

Casos de borda
- `userIds` inconsistentes (strings vs numbers): `getByUser` já faz coerção, mas considere normalizar os dados via migração.
- Jogos sem `id` ainda (raro): filtre antes de tentar ações que exigem `id`.

Testes sugeridos
- Unit: `filter chama gameService.getByCategory quando selectedCategory setada` (mock do serviço).
- Unit: `delete chama gameService.delete e recarrega` (mock Swal e gameService).
- E2E: aplicar filtro por usuário e verificar que os resultados correspondem.

---

### `src/app/components/ranking/ranking.component.ts` — documentação ampliada

Objetivo
- Exibir ranking de jogos ordenados pela média de avaliações (`avgRating`). Serve como visão agregada para mostrar os top N jogos.

Estado e propriedades
- `ranking: Game[] = []` — lista ordenada retornada por `gameService.ranking()`.
- `loading = false` — flag para spinner.

Fluxo principal

```ts
async loadRanking() {
       this.loading = true;
       try {
              this.ranking = await this.gameService.ranking();
       } finally {
              this.loading = false;
       }
}
```

UI e acessibilidade
- Mostrar posição (1°, 2°, 3°), nome, média (ex.: 4.5/5) e número de avaliações. Use `aria-label` nos elementos que representam a posição.
- Para desempate, mostrar também o número de ratings; documente a regra de ordenação no `GameService.ranking()` (ex.: ordenar por média e depois por número de avaliações).

Testes sugeridos
- Unit: `ranking chama gameService.ranking` e popula `ranking`.
- E2E: avaliar um jogo e verificar que sua posição no ranking muda conforme esperado (flaky; rodar em ambiente controlado).

---

### `src/app/components/users/users.component.ts` — documentação ampliada

Objetivo
- Gerenciar usuários: listar, adicionar, editar (opcional) e remover. A interface deve oferecer confirmação antes da exclusão e validação básica no cadastro (email válido, nome obrigatório).

Estado e propriedades
- `users: User[] = []` — lista de usuários.
- `editingUser: User | null = null` — usado para editar um usuário existente.
- `loading = false`, `saving = false`.

Fluxos e métodos
- `loadAll()` — `userService.getAll()`.
- `add(user)` — valida e chama `userService.add(user)`; após sucesso, recarrega lista.
- `delete(id)` — confirmação Swal antes de `userService.delete(id)`.

Template e validação
- Formulário mínimo com `name` e `email` e validação de formato de email (`pattern` ou `Validators.email` se usar Reactive Forms).
- Ao excluir, verificar se o usuário está vinculado a jogos (procure em `db.games` por `userIds`) e avisar que a exclusão não remove automaticamente referências (ou implementar cascade/clean-up se desejado).

Considerações de integridade
- Ao deletar um usuário, decida se deverá ser feita uma limpeza nas referências (`game.userIds`) — a app atual não faz automaticamente; documente essa decisão.

Testes sugeridos
- Unit: `add chama userService.add` com dados válidos.
- Unit: `delete mostra confirmação` e chama `userService.delete` após confirmação.

---

### `src/app/components/home/home.component.ts` e `home.component.html` — documentação ampliada

Objetivo
- Tela inicial (hero) com apresentação e CTA para criar novo jogo. Também pode conter estatísticas rápidas (número de jogos, top-rated) e links para seções importantes.

Estado e propriedades
- `summary` (opcional) para exibir número de jogos, usuários e recomendações.

Comportamento e fluxo
- `goToNew()` — navega para `/games/new`. Pode disparar tracking/analytics antes de navegar.

Template — trechos e boas práticas

```html
<section class="hero" role="region" aria-label="Apresentação">
       <h1>Gametrack</h1>
       <p>Gerencie seus jogos, avaliações e comentários localmente.</p>
       <button (click)="goToNew()" aria-label="Cadastrar novo jogo">Cadastrar Jogo</button>
       <div class="stats" aria-live="polite">
              <span>{{ summary.games }} jogos</span>
              <span>{{ summary.users }} usuários</span>
       </div>
</section>
```

Acessibilidade
- Botões com `aria-label`; hero com `role=region` e `aria-label`; estatísticas com `aria-live` para atualizações dinâmicas.

Testes sugeridos
- E2E: clicar no CTA e verificar a rota `/games/new`.

---

### `src/app/shared/components/layout/header/*` — documentação ampliada

Objetivo
- Fornecer navegação consistente globalmente, estado de menu responsivo e indicators de rota ativa.

Estrutura e propriedades
- Normalmente contém `navLinks = [{path:'', label:'Home'}, {path:'/games', label:'Jogos'}, ...]` e usa `routerLinkActive` para estilo ativo.

Comportamento
- Em telas pequenas, esconder links em um menu hambúrguer (`aria-expanded`, `aria-controls`).
- Se houver dados do usuário (login), mostrar avatar/contas; neste projeto não há auth, então o header é estático.

Acessibilidade
- O menu hambúrguer deve ser um `button` com `aria-expanded` e controlar um `nav` com `role="navigation"`.
- Links devem ter texto claro e `title` quando necessário.

Testes sugeridos
- Unit: `routerLinkActive aplica classe active` para a rota atual (usar RouterTestingModule).

---

### `src/app/shared/components/layout/footer/*` — documentação ampliada

Objetivo
- Rodapé simples com informações de copyright, links úteis e créditos.

Conteúdo e acessibilidade
- Incluir links com `rel="noopener noreferrer"` quando abrirem em nova aba.
- Estruturar em listas (`<ul>`) para leitura por leitores de tela.

Testes sugeridos
- Unit: verificar que o footer rendeiza o texto e links esperados.

---

### Observações finais sobre componentes

- Centralize padrões (ex.: classes de botão, estilos de dropdown) em `src/styles.css` para evitar divergências.
- Prefira componentes pequenos e testáveis (ex.: separar o dropdown customizado em `shared/components/custom-select` se reusado).
- Documente contratos (inputs/outputs) de componentes compartilhados para facilitar reuso.

---

### `src/app/components/home/home.component.ts` e `home.component.html`


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

