# 🎮 Roteiro de Apresentação - MyGameTrack

## ⏱️ Tempo Total Sugerido: 10-15 minutos

---

## 📌 PARTE 1: INTRODUÇÃO (2 minutos)

### O que dizer:

> **"Bom dia/tarde, pessoal! Eu desenvolvi uma aplicação web chamada MyGameTrack, que é um rastreador de jogos de vídeo game.**
>
> **A ideia é simples: você cadastra os jogos que está jogando, pode avaliar com estrelas, deixar comentários, ver um ranking dos seus jogos favoritos, e gerenciar usuários."**

### Mostrar na tela:
- Abra o navegador e mostre a página inicial (Home)
- Mostre o link que será deployado no GitHub Pages (se já tiver feito)

---

## 📌 PARTE 2: ARQUITETURA E TECNOLOGIAS (3 minutos)

### O que dizer:

> **"Este é um projeto 100% frontend, desenvolvido com Angular 19.**
>
> **O que significa isso? Significa que toda a aplicação roda no navegador, sem precisar de um servidor backend separado.**
>
> **As tecnologias principais são:**
> - **Angular 19** - um framework JavaScript moderno para construir interfaces
> - **TypeScript** - uma linguagem que é JavaScript com tipos, mais segura
> - **IndexedDB** - um banco de dados que fica armazenado localmente no navegador
> - **Dexie.js** - uma biblioteca que facilita o uso do IndexedDB
> - **SweetAlert2** - biblioteca de alertas para melhorar a experiência do usuário"**

### Mostrar na tela:
- Abra o VS Code
- Clique em `package.json` e mostre as dependências principais:
  ```json
  "@angular/core": "^19.2.15",
  "dexie": "^3.2.2",
  "sweetalert2": "^11.12.4"
  ```

### Deixar claro:
- ✅ Funciona totalmente offline
- ✅ Dados são salvos localmente no navegador
- ✅ Não precisa de servidor

---

## 📌 PARTE 3: ESTRUTURA DO PROJETO (2-3 minutos)

### O que dizer:

> **"O projeto segue uma arquitetura bem organizada. Vou mostrar a pasta 'src/app' que é o coração da aplicação:**
>
> - **components/** - são os componentes visuais (páginas e telas)
> - **services/** - é onde está a lógica de negócio
> - **models/** - são as interfaces, as estruturas dos dados
> - **services/db.service.ts** - é a configuração do banco de dados (Dexie)"**

### Mostrar na tela:
- Abra o Explorer do VS Code
- Expanda `src/app`
- Mostre cada pasta:
  - `components/` - com game-form, game-list, game-detail, ranking, users, navbar
  - `services/` - game.service.ts, user.service.ts, comment.service.ts
  - `models/` - game.model.ts, user.model.ts, comment.model.ts
  - `services/db.service.ts` - DbService (Dexie)

### Deixar claro:
> **"Essa organização é chamada de 'padrão de arquitetura', e facilita muito a manutenção do código."**

---

## 📌 PARTE 4: FLUXO DE DADOS (2 minutos)

### O que dizer:

> **"Os dados seguem este caminho na aplicação:**
> 1. **Componentes** - são as telas que o usuário vê (game-form, game-list, etc)
> 2. **Serviços** - recebem requisições dos componentes e fazem operações
> 3. **Banco de Dados** - armazena os dados localmente no IndexedDB
>
> **Exemplo prático: quando você cadastra um jogo:**
> - O componente `game-form` captura os dados do formulário
> - Passa para o `game.service.ts`
> - O serviço chama `db.games.add(game)`
> - O jogo é salvo no banco de dados local"**

### Mostrar na tela:
- Abra `src/app/services/game.service.ts`
- Mostre os métodos:
  ```typescript
  import { Injectable } from '@angular/core';
  import { DbService } from './db.service';

  @Injectable({ providedIn: 'root' })
  export class GameService {
    constructor(private dbService: DbService) {}

    add(game: Game) { return this.dbService.games.add(game); }
    getAll() { return this.dbService.games.toArray(); }
    getById(id: number) { return this.dbService.games.get(id); }
    delete(id: number) { return this.dbService.games.delete(id); }
  }
  ```

> Observação: os componentes usam Promises com `.then(...)` e diálogos com `SweetAlert2`, seguindo o estilo dos slides.

---

## 📌 PARTE 5: DEMONSTRAÇÃO PRÁTICA (5-7 minutos)

### ⚠️ IMPORTANTE: Rode o servidor antes!
```bash
npx ng serve --open
```

### O que demonstrar:

#### 5.1 - Home
> **"Aqui é a página inicial. Tem uma navegação no topo que leva para diferentes seções."**

#### 5.2 - Cadastrar Jogo (Clique em "Cadastrar Jogo")
> **"Aqui você pode cadastrar um novo jogo. Você preenche:**
> - Nome do jogo
> - Descrição
> - Data que começou a jogar
> - Data que terminou (opcional)
> - Categoria (RPG, Ação, etc)
> - Quais usuários estão jogando
> - E o mais importante: **avaliar com estrelas de 1 a 5**"**

**AÇÃO:** Cadastre um jogo exemplo (ex: "The Legend of Zelda")

#### 5.3 - Listar Jogos
> **"Agora clico em 'Listar Jogos' e vejo todos os jogos cadastrados em cards bonitinhos.**
>
> **Reparem que tem dois filtros:**
> - Filtrar por categoria
> - Filtrar por usuário
>
> **Cada jogo pode ser editado ou excluído, e você pode avaliar com estrelas aqui também."**

**AÇÃO:** 
- Clique em um jogo para ver detalhes
- Mostre os botões de editar e excluir
- Volte

#### 5.4 - Detalhes do Jogo (Clique em um jogo)
> **"Aqui você vê os detalhes completos do jogo:**
> - Nome, descrição, datas, categoria
> - **Um sistema de avaliação (1 a 5 estrelas)**
> - **E uma seção de comentários** onde você pode deixar suas impressões sobre o jogo"**

**AÇÃO:**
- Clique em uma estrela para avaliar
- Escreva um comentário e clique enviar
- Mostre o comentário aparecendo

#### 5.5 - Ranking (Clique em "Ranking")
> **"Aqui você vê um ranking dos seus jogos.**
>
> **Os jogos são ordenados de acordo com a média de estrelas que você deu.**
>
> **Então se um jogo tem 5 estrelas e outro tem 3, o de 5 vai aparecer primeiro."**

**AÇÃO:**
- Mostre a lista ordenada
- Explique que a média é calculada automaticamente

#### 5.6 - Usuários (Clique em "Usuários")
> **"Aqui você gerencia os usuários:**
> - Cadastra novo usuário (nome + email)
> - Vê a lista de usuários
> - Pode remover se quiser"**

**AÇÃO:**
- Cadastre um novo usuário
- Mostre na lista
- Explique que depois você pode lincar esse usuário a um jogo

---

## 📌 PARTE 6: FUNCIONALIDADES PRINCIPAIS (2 minutos)

### O que dizer:

> **"Resumindo, o MyGameTrack tem:**
>
> ✅ **CRUD completo** - Create (cadastrar), Read (listar), Update (editar), Delete (deletar) de jogos
>
> ✅ **Sistema de avaliações** - Você avalia jogos de 1 a 5 estrelas
>
> ✅ **Comentários** - Pode deixar suas impressões sobre o jogo
>
> ✅ **Filtros e buscas** - Filtra por categoria ou por usuário
>
> ✅ **Ranking automático** - Calcula a média de avaliações e ordena
>
> ✅ **Gerenciamento de usuários** - Cadastra e gerencia usuários
>
> ✅ **Dados persistentes** - Tudo é salvo localmente, funciona offline"**

---

## 📌 PARTE 7: DADOS LOCAIS (1-2 minutos)

### O que dizer:

> **"Uma coisa muito legal é que todos os dados são armazenados **localmente no navegador**.**
>
> **Isso significa que você pode fechar o navegador, desligar o PC, e quando abrir novamente, todos os seus dados ainda estarão lá."**

### Mostrar na tela:
- Abra o DevTools (F12)
- Vá em Storage → IndexedDB → MyGameTrackDB
- Mostre as tabelas (games, users, comments) e os dados dentro

> **"Esse é o IndexedDB, o banco de dados do navegador. É como um pequeno banco de dados SQLite, mas que fica dentro do navegador."**

---

## 📌 PARTE 8: CÓDIGO IMPORTANTE (1-2 minutos) - OPCIONAL

### Se quiser aprofundar, mostre:

#### 8.1 - Um Componente (ex: game-list)
Abra `src/app/components/game-list/game-list.component.ts`

> **"Esse componente é responsável por listar os jogos. Ele:**
> - Chama o serviço de jogos para pegar todos
> - Mostra em cards
> - Permite filtrar"**

#### 8.2 - Um Serviço (ex: game.service)
Abra `src/app/services/game.service.ts`

> **"O serviço faz a comunicação com o banco de dados. Quando um componente precisa de dados, ele pede para o serviço."**

#### 8.3 - Um Modelo (ex: game.model)
Abra `src/app/models/game.model.ts`

> **"Isso é a estrutura de um jogo. É como um template que diz: 'Um jogo tem um nome, descrição, datas, categoria, avaliações, etc.'"**

---

## 📌 PARTE 9: DEPLOYMENT (1 minuto) - SE HOUVER TEMPO

> **"Este projeto está deployado no GitHub Pages, o que significa que ele está rodando na internet.**
>
> **Você pode acessar de qualquer PC, em qualquer lugar, é só clicar no link.**
>
> **Nenhuma instalação necessária, funciona direto no navegador."**

---

## 📌 PARTE 10: CONCLUSÃO (1 minuto)

> **"Resumindo, MyGameTrack é uma aplicação web moderna que demonstra:**
>
> - ✅ Componentes Angular reutilizáveis
> - ✅ Arquitetura bem organizada (componentes, serviços, modelos)
> - ✅ Banco de dados local (IndexedDB)
> - ✅ CRUD completo
> - ✅ Filtros e buscas
> - ✅ UI responsiva e intuitiva
>
> **Tudo isso sem precisar de um servidor backend, tudo roda no navegador!**
>
> **Obrigado pela atenção! Tem alguma dúvida?"**

---

## 🎯 DICAS PARA A APRESENTAÇÃO

### ✅ Antes de começar:
- [ ] Teste a internet da sala (se for usar GitHub Pages)
- [ ] Rode `npx ng serve --open` antes de apresentar
- [ ] Deixe o VS Code aberto para mostrar o código
- [ ] Tenha o documento DOCUMENTACAO.md à mão

### ✅ Durante a apresentação:
- [ ] Fale devagar e claro
- [ ] Mostre a tela enquanto fala
- [ ] Interaja com a aplicação (cadastre, avalie, comente)
- [ ] Deixe as perguntas para o final

### ✅ Se travar ou der erro:
- [ ] Abra o DevTools (F12) para mostrar
- [ ] Mostre o erro no console (prova que você testou)
- [ ] Explique que é normal em desenvolvimento
- [ ] Recarregue a página (F5)

### ✅ Se perguntarem:
- [ ] Por que Angular? → Porque é moderno, tem bom suporte, fácil de organizar
- [ ] Por que IndexedDB? → Porque é local, offline, não precisa de servidor
- [ ] Quanto tempo levou? → Você fala quanto realmente levou 😄
- [ ] Pode fazer isso em produção? → Sim! Tem empresas usando

---

## 📱 ROTEIRO RÁPIDO (Se tiver pouco tempo)

**5 minutos:**
1. Introdução (30 seg)
2. Tecnologias (30 seg)
3. Estrutura (1 min)
4. Demo rápida (2 min)
5. Conclusão (30 seg)

---

## 🎬 SCRIPT FINAL

> **"Criei uma aplicação chamada MyGameTrack usando Angular 19. É um rastreador de jogos onde você pode cadastrar, avaliar e comentar sobre os games que está jogando. Os dados são salvos localmente no navegador usando IndexedDB, então funciona totalmente offline. A aplicação segue uma arquitetura bem organizada com componentes, serviços e modelos. Deixe eu mostrar na prática..."**

---

**Boa sorte na apresentação! 🎉**
