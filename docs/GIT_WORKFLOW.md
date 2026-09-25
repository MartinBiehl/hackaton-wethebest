# Fluxo de Git e GitHub

Guia rápido para o trio colaborar durante o hackathon sem perder trabalho nem misturar alterações.

## Regras rápidas

- Mantenha `main` estável. Desenvolva em uma branch por tarefa, não uma branch por pessoa.
- Combine quem está trabalhando em cada parte; evite editar o mesmo arquivo ao mesmo tempo, inclusive com Codex ou Claude.
- Faça commits pequenos, envie a branch ao GitHub e integre pela Pull Request (PR) para `main`.
- Nunca envie `.env`, senhas ou chaves secretas. Use `.env.example` como modelo; não exponha chaves secretas do Supabase no frontend.

## 1. Clonar o repositório

Cada integrante executa uma vez:

```bash
git clone https://github.com/MartinBiehl/hackaton-wethebest.git
cd hackaton-wethebest
```

## 2. Começar uma tarefa

Atualize `main` e crie uma branch com um nome curto que descreva a tarefa:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/nome-da-tarefa
```

Use `fix/` para correções, por exemplo `fix/erro-login`. Cada tarefa começa em uma branch nova baseada na `main` atualizada.

## 3. Revisar, commitar e enviar

Antes de commitar, confira o que mudou e selecione apenas os arquivos da tarefa:

```bash
git status
git diff
git add caminho/do/arquivo
git diff --cached
git commit -m "feat: descrição curta"
git push -u origin feat/nome-da-tarefa
```

Depois do primeiro push dessa branch, use `git push` para enviar novos commits. Mensagens curtas podem começar com `feat:`, `fix:`, `style:`, `refactor:`, `docs:` ou `chore:`.

## 4. Abrir e integrar uma Pull Request

No GitHub, abra uma PR da sua branch para `main`. Peça a outro integrante uma revisão rápida, confirme que a alteração funciona e então faça o merge. Apague a branch após a integração, se ela não for mais necessária.

Depois do merge, sincronize sua cópia local:

```bash
git switch main
git pull --ff-only origin main
```

## 5. Atualizar sua tarefa e resolver conflitos

Se `main` receber mudanças enquanto você trabalha, incorpore-as à sua branch antes do merge da PR:

```bash
git fetch origin
git merge origin/main
```

Se houver conflito, confira `git status`, edite os arquivos marcados para manter a versão correta, remova os marcadores `<<<<<<<`, `=======` e `>>>>>>>`, e finalize:

```bash
git add caminho/do/arquivo
git commit
git push
```

Se tiver alterações locais ainda sem commit, faça commit ou guarde-as com `git stash` antes de trocar de branch ou sincronizar. Não descarte arquivos para tentar resolver um conflito sem antes confirmar com quem os alterou.

## Fluxo resumido

```text
atualizar main → criar branch da tarefa → desenvolver → revisar → commit → push
→ abrir PR para main → revisão → merge → atualizar main
```
