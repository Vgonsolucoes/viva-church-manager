# Viva Church Manager

Sistema de gestao para igreja com painel administrativo web, area mobile, membros, voluntarios, cursos, eventos, acompanhamento, relatorios e modulos ministeriais.

## Ambiente local

1. Instale as dependencias:

```bash
npm install
```

2. Configure o arquivo `.env` com base no `.env.example`.

3. Gere o Prisma Client:

```bash
npx prisma generate
```

4. Rode as migrations:

```bash
npx prisma migrate deploy
```

5. Inicie o sistema:

```bash
npm run dev
```

## Deploy no Easypanel

O projeto ja esta preparado para deploy via Git com `Dockerfile` na raiz.

### Como criar o app no Easypanel

1. Crie um novo app usando a opcao de deploy por repositório Git.
2. Aponte para este repositório.
3. O Easypanel deve detectar automaticamente o `Dockerfile`.
4. Configure a porta da aplicacao como `3000`.
5. Adicione as variaveis de ambiente abaixo.

### Variaveis obrigatorias

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `APP_ENCRYPTION_KEY`

### Variaveis opcionais

- `SEED_SUPER_ADMIN_EMAIL`
- `SEED_SUPER_ADMIN_PASSWORD`
- `TEMP_MEMBER_INTAKE_ENABLED`

### Tela publica temporaria de cadastro (cadastro-temporario/membros)

Esta tela permite cadastrar membros sem autenticacao, ideal para carga inicial ou coleta direta.
Ela nao abre por padrao por seguranca. Para habilitar:

1. Defina a variavel de ambiente:
   ```env
   TEMP_MEMBER_INTAKE_ENABLED=true
   ```
2. Reinicie/redeploy a aplicacao.
3. Acesse:
   - Local: `http://localhost:3001/cadastro-temporario/membros`
   - Producao: `https://SUA-URL/cadastro-temporario/membros`
   (no Easypanel basta habilitar a variavel no servico `app` e fazer redeploy)

Quando nao for mais usar, desligue a flag para evitar acessos publicos indesejados.

Obrigatoriedades desta tela:
- Nome completo
- CPF valido (11 digitos, validade calculada)
- Pelo menos um tipo selecionado (ex.: Membro / Visitante / etc.)

### Observacoes importantes

- O container executa `npx prisma migrate deploy` antes de subir a aplicacao.
- O servidor sobe na porta `3000`.
- O `HOSTNAME` ja fica configurado como `0.0.0.0` dentro do container.
- Se usar dominio proprio, defina `NEXTAUTH_URL` com a URL final publica.

## Exemplo de configuracao de ambiente

Use o arquivo `.env.example` como referencia.

Para `APP_ENCRYPTION_KEY`, gere uma chave base64 com 32 bytes.

Exemplo em Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scripts uteis

### Avisos de Kids e Estacionamento

- Web: **Estacionamento** (`/admin/parking`) envia placa, modelo/cor, local e mensagem à equipe de projeção, com histórico e confirmação de visualização.
- Tela do operador: `/projecao` recebe os dois canais. O endereço anterior `/kids/projecao` continua disponível. Perfis Projeção e Super Administrador acompanham os dois canais; perfis Kids/Estacionamento visualizam o canal autorizado.
- Em **Ministérios**, selecione **Equipe de avisos à projeção**: Kids ou Estacionamento. Ministérios com nomes usuais são classificados pela migration; confira a configuração dos demais.
- O usuário precisa estar vinculado a um membro, associado ao ministério ativo pelo cadastro de membros, de voluntários ou como líder. Somente esse vínculo autoriza enviar, tanto na web quanto no app. Um papel administrativo isolado não libera envio. Remover o vínculo ou desativar o ministério bloqueia novas solicitações no servidor.
- No aplicativo, os atalhos **Avisos Kids** e **Estacionamento** aparecem em **Igreja** somente para a respectiva equipe. O Infantil também tem um atalho de envio para a equipe Kids. O cadastro e check-in dos próprios filhos permanecem disponíveis aos responsáveis.
- É necessário aplicar a migration `20261030180000_parking_projection`, publicar o backend e gerar/distribuir uma nova versão do aplicativo Expo. Apenas o deploy web não atualiza um APK já instalado.
- Testes de autorização e validação: `npm run test:projection`. Usam banco e sessão simulados, sem acessar dados da igreja.

### Fotos dos membros

Novas fotos de membros são armazenadas no PostgreSQL (`MemberAvatar`) e servidas
por `/uploads/avatar_*`, mantendo a URL usada pelo cadastro e pelo perfil web.
A migration `20261029180000_member_avatar_storage` deve ser aplicada antes de
executar esta versão (o Docker já executa `prisma migrate deploy` ao iniciar).
Fotos antigas continuam sendo lidas do diretório `UPLOADS_DIR` ou `public/uploads`;
esses arquivos precisam de volume persistente no Easypanel. Fotos antigas já
perdidas precisam ser enviadas novamente. Banners e fotos Kids mantêm o
armazenamento em arquivos e também precisam desse volume.

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run dev:temp-members`
- `npm run start:temp-members`
- `npm run prisma:generate`
- `npm run prisma:migrate`
