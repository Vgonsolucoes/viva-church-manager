# Viva Church App — Mobile (Android + iOS)

Aplicativo multiplataforma Expo SDK 52 (React Native + Expo Router 4, Zustand, TanStack Query).
Integração com a API Web do Viva Church Manager (Next.js / Prisma / PostgreSQL).

**Código fonte:** `apps/mobile/` no monorepo.
**Web/API (EasyPanel deploy):** `https://viva-church-manager-app.54myeq.easypanel.host/`
**Bundle ID Android + iOS:** `br.com.vivasede.app` (app.json etapa1, **não alterar**).
**Scheme Deep Link:** `vivachurch://` (Expo Router + app.json `scheme`).

---

## 1. Arquitetura Geral

```
            GitHub (main)
                │
       ┌────────┴────────┐
       │                 │
   EasyPanel         Expo / EAS
       │                 │
  Web + API      Android APK/AAB + iOS IPA
       │                 │
       └────────┬────────┘
                │
          API CENTRAL HTTPS
          (JWT Bearer v1)
                │
           PostgreSQL
```

O app **NUNCA acessa o PostgreSQL diretamente**. Toda persistência passa por rotas Next.js em `/api/v1/*` autenticadas via JWT mobile (30 dias padrão, `APP_JWT_EXPIRES_IN_DAYS`).

### Camadas internas Mobile

```
apps/mobile/
├── app/                     # Expo Router 4 (file-based routing)
│   ├── _layout.tsx          # Root: fonts, guard auth, push listeners
│   ├── login.tsx
│   ├── (tabs)/              # Home / Agenda / Escalas / Eventos / Células / Rede / Discipulado / Notificações
│   ├── igreja.tsx
│   ├── perfil/editar.tsx
│   ├── qr/scan.tsx
│   └── carteirinha.tsx
├── src/
│   ├── services/api/        # client.ts + serviços por domínio
│   ├── stores/session.ts    # Zustand: hydrate/login/logout/expoPushToken
│   ├── hooks/               # useNetwork etc
│   ├── utils/               # jwt etc
│   ├── types.ts             # schemas Zod + tipos (Me, Login*, Ministry, etc)
│   └── theme.ts             # Paleta dark premium Navy
├── assets/                  # icon.png, adaptive-icon.png, splash.png, favicon.png
├── app.json                 # BundleId / Permissões / expo-notifications plugin / Scheme
├── eas.json                 # 3 perfis (development / preview / production)
├── tsconfig.json
└── package.json
```

---

## 2. Stack Técnica

- **Expo SDK 52** (newArchEnabled=true)
- **Expo Router 4** (typedRoutes=true) + Deep Links pelo scheme `vivachurch`
- **Expo Notifications** (push) + **Expo Push Token** (registro em `/api/v1/push/devices`)
- **Expo Secure Store** (JWT do app) + AsyncStorage (cache me)
- **Expo Camera** (QR scan, leitor carteirinha e infantil)
- **Zustand** (gerência de estado sessão)
- **TanStack React Query** (cache e sincronia API v1)
- **React Native Gesture Handler + Reanimated + Safe Area + Linear Gradient**
- **Zod** em Web + Mobile (schemas de validação)
- **Prisma 7.8** (Web/API apenas) + **PostgreSQL**

---

## 3. Instalação (Clone + Dependências)

Pré-requisitos:
- Node 20+ (LTS)
- Git (GitHub Desktop integrado neste projeto)
- (Opcional, só builds locais EAS) EAS CLI: `npm i -g eas-cli`

```bash
git clone https://github.com/Vgonsolucoes/viva-church-manager.git
cd viva-church-manager
npm install                         # instala root (web + server)

cd apps/mobile
cp .env.example .env                # configure EXPO_PUBLIC_*
npm install                         # instala mobile (expo / RN)
```

---

## 4. Execução Local (Dev Expo Go / Dev Client)

```bash
# Terminal A (opcional): rodar backend local na porta 3000
#   cd viva-church-manager
#   npm run dev

# Terminal B: Expo Mobile (Expo Go OU build local via EAS)
cd apps/mobile
cp .env.example .env                # ajuste EXPO_PUBLIC_API_URL se quiser local
npm run start
# Aperte:
#   a → abrir Android emulator
#   i → abrir iOS simulator (apenas macOS)
#   w → abrir web preview (útil para UI, Push NÃO funciona na web)
#   s → trocar para Expo Go clássico se necessário
```

### Observações

- Android Emulator local backend → `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
- iOS Simulator local backend → `EXPO_PUBLIC_API_URL=http://localhost:3000`
- Push Notifications e Scanner QR só operam em builds device físico (não no Expo web preview).

---

## 5. Ambientes (3 perfis EAS)

Váriaveis `.env` móveis **públicas** usam o prefixo `EXPO_PUBLIC_*`.
NUNCA coloque segredos (JWT server, senhas DB, Expo Access Token...) com `EXPO_PUBLIC_*`.

| Ambiente      | Perfil eas.json | EXPO_PUBLIC_APP_ENV | EXPO_PUBLIC_API_URL (padrão)                   |
| ------------- | --------------- | ------------------- | ---------------------------------------------- |
| Desenvolv.    | development     | development         | URL staging EasyPanel ou http://10.0.2.2:3000  |
| Homologação   | preview         | preview             | `https://viva-church-manager-app.54myeq.easypanel.host` |
| Produção      | production      | production          | `https://viva-church-manager-app.54myeq.easypanel.host` |

### `.env` Servidor (root .env.example)

```
# Expo Push / EAS — NÃO use EXPO_PUBLIC_* aqui (segredos do servidor)
EXPO_ACCESS_TOKEN=                    # Expo Dev Access Token → backend envia push
EXPO_PUSH_PROJECT_ID=                 # Eas ProjectId (opcional, vem do app.json/extra.eas.projectId)
```

### `.env` Mobile (`apps/mobile/.env.example`)

Veja `apps/mobile/.env.example`. Exemplo DESENVOLVIMENTO:

```
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=https://viva-church-manager-app.54myeq.easypanel.host
```

---

## 6. Expo CLI + Autenticação EAS

Para builds **Android/iOS via Expo EAS** (APK / AAB / IPA):

1. Criar conta Expo (expo.dev): `https://expo.dev/`
2. Logar com EAS CLI:
   ```bash
   cd apps/mobile
   eas whoami                       # verifica login
   eas login                        # se não logado
   ```
3. Obter token Expo Access Token (configurar servidor **se** for disparar Push do backend sem Expo Account logada):
   - Expo Dashboard → Settings → Access Tokens → Generate (cópia no `.env` root `EXPO_ACCESS_TOKEN` ou no EAS Secrets)
4. Criar / vincular projeto Expo:
   ```bash
   eas init                       # NÃO necessário se slug/name já batem
   # depois colar o projectId retornado em app.json → extra.eas.projectId
   ```

**Aviso sandbox corrente:** o `projectId` em `app.json` (expo.extra.eas.projectId) ficou em branco intencionalmente; preencha manualmente APÓS `eas init`. **NÃO inventei um valor** como solicitado.

---

## 7. Push Notifications (Arquitetura Completa)

### Fluxo Fim-a-Fim

```
Web Admin (/admin/notifications)
  │ createNotificationCampaign(channel=PUSH, deepLink=..., targetUsersOverride=...)
  ▼
Serviço src/server/notifications.ts
  │ createNotification(DB) → sendExpoPushToUsers → sendExpoPushChunked (lote 100)
  ▼
Expo Push API v2 (expo-server-sdk)
  │ usando EXPO_ACCESS_TOKEN (servidor) ou projectId do expo extra
  ▼
Android FCM / iPhone APNs
  ▼
Device App
  │ expo-notifications plugin → Expo Push Token
  │ 1. pede permissão (POST_NOTIFICATIONS Android)
  │ 2. getExpoPushTokenAsync()
  │ 3. POST /api/v1/push/devices (upsert push_devices)
  │ 4. listener: addNotificationResponseReceivedListener
  │    → router.push(data.deepLink)
  ▼
Tela correspondente (Escalas, Evento, Célula, Perfil, etc.)
```

### Tabela `push_devices` (Prisma migration segura não destrutiva)

Arquivos: `prisma/migrations/*_etapa4_push_devices_notification_push/migration.sql`
Modelo: `prisma/schema.prisma` model `PushDevice`. 1 usuário → N dispositivos (`pushDevices PushDevice[]` no User).

Campos:
- `id (cuid PK)`
- `userId` (FK User, onDelete: Cascade)
- `expoPushToken (UNIQUE)`
- `platform, deviceName, appVersion (String?)`
- `active (Boolean default true)`
- `lastSeen, createdAt, updatedAt (DateTime)`

### Rota API Registro

- `POST /api/v1/push/devices` — upsert dispositivo (upsert por expoPushToken). Requer login (Bearer JWT mobile).
- `DELETE /api/v1/push/devices` — marca active=false para o token atual (logout).

### Service Mobile

Código: `apps/mobile/src/services/api/pushDevices.ts` (register/unregister).
Orquestração em `apps/mobile/app/_layout.tsx` componente `PushIntegration`:

1. Solicita permissão (Android 13+), ignora silenciosamente se usuário negar.
2. Obtém Expo Push Token.
3. Se sessão logada → POST /api/v1/push/devices.
4. Ao receber clique do push → `router.push(deepLink)` se vier preenchido no payload.
5. Ao `logout()` → DELETE /api/v1/push/devices + limpa `session.expoPushToken`.

### Canais Notificação

Enum Prisma `NotificationChannel` com valores: `IN_APP | EMAIL | PUSH`.
Default do server `createNotificationCampaign` permanece **`IN_APP`** (backward compat ETAPA1-3) — não quebra uso antigo.

### Lembretes Escala (Helpers Server)

Funções exportadas em `src/server/notifications.ts` (para chamar via cron/admin UI manual/painel EasyPanel cron):

- `sendScheduleReminders24h()` → 23h..25h ahead de `ScheduleAssignment` PENDING/CONFIRMED
- `sendScheduleReminders2h()`  → 1.5h..2.5h ahead
- `sendNewScheduleNotification(userId, schedule, mode)` → mode = `new | changed | cancelled`

Chame a cada X minutos via: EasyPanel → App → Cron job (endpoint se você criar wrapper ou chamar serverless).

---

## 8. Deep Links (Scheme `vivachurch://`)

- home: `vivachurch://(tabs)`
- agenda: `vivachurch://(tabs)/agenda`
- escalas: `vivachurch://(tabs)/escalas`
- eventos: `vivachurch://(tabs)/eventos`
- células: `vivachurch://(tabs)/celulas`
- rede: `vivachurch://(tabs)/rede`
- discipulado: `vivachurch://(tabs)/discipulado`
- notificações: `vivachurch://(tabs)/notificacoes`
- carteirinha: `vivachurch://carteirinha`
- igreja: `vivachurch://igreja`
- perfil editar: `vivachurch://perfil/editar`

### Notificação + Deep Link Exemplo

```json
{
  "title": "Nova Escala",
  "body": "Você foi escalado para o Culto da Família.\nDomingo às 19:00\nMinistério: Mídia\n\nToque para confirmar.",
  "data": { "deepLink": "/(tabs)/escalas" }
}
```

---

## 9. QR Code e Carteirinha / Check-in Infantil

- Tela: `qr/scan.tsx` (expo-camera + barCodeScanner).
- Rota API validação: `POST /api/v1/qr/scan` e `GET /api/v1/qr/member-card` (geração qr da carteirinha digital do membro).
- Infantil: `GET /api/v1/kids/my-children`, `POST /api/v1/kids/check-ins/{childId}/check-in` e check-out correspondente.

---

## 10. Android (APK de homologação / Preview)

Passos para buildar e distribuir APK instalável internamente para a equipe testar.

### 10.1 EAS Build (recomendado, cloud)

```bash
cd apps/mobile
# 1º build leva +- 20~35 min. Expo gera keystore interno automaticamente.
eas build -p android --profile preview
```

Quando finalizado, link aparece no terminal e no expo.dev → Builds. Baixe `.apk` e instale direto no Android (permita fontes desconhecidas).

### 10.2 Build local (opcional, sem cloud)

```bash
eas build -p android --profile preview --local
# Requer: Android SDK, JDK 17, Gradle
```

### 10.3 Instalação APK

```
adb install viva-church-preview-*.apk
# OU
envie o arquivo APK por WhatsApp / Google Drive para o time de QA.
```

### 10.4 Permissões Android Declaradas

app.json → `expo.android.permissions`:
`INTERNET, ACCESS_NETWORK_STATE, CAMERA, READ_CALENDAR, WRITE_CALENDAR, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK`

---

## 11. Android — AAB Produção (Google Play Store)

App Bundle (AAB): formato para a Play Store; o Google otimiza depois por arquitetura.

### 11.1 Build AAB com EAS

```bash
cd apps/mobile
eas build -p android --profile production
# Saída .aab enviada automaticamente para expo.dev dashboard se tudo OK
```

### 11.2 Campos chave app.json Android produção

| Campo                  | Valor / Nota                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `package`              | `br.com.vivasede.app` (ETAPA1 definido, **não alterar após 1a loja**)  |
| `versionCode`          | `1` agora; EAS auto incrementa (eas.json `autoIncrement=true`)         |
| `version`              | `0.1.0`; altere em app.json antes de release importante                |
| Adaptive Icon          | foreground `assets/adaptive-icon.png`, bg color `#06101D`              |
| Permissões             | POST_NOTIFICATIONS etc. (já declarado)                                  |

### 11.3 Enviar para Google Play

**APENAS com AUTORIZAÇÃO EXPLÍCITA do dono do app / loja.**

```bash
eas submit -p android --profile production     # envia AAB do último build para Play Console
```
OU baixe o `.aab` e suba manualmente em **Play Console → App Bundles**.

### 11.4 Checklist Google Play (antes 1a publicação)

- [ ] Conta Google Play Console Developer (US$ 25 one-time)
- [ ] App preenchido: Descrição PT-BR, Ícone 512×512, Screenshots, Featured graphic (1024×500)
- [ ] Declaração de permissões sensíveis (Câmera, POST_NOTIFICATIONS, Calendário)
- [ ] Content Rating (Questionário Classificação Etária)
- [ ] Política Privacidade URL pública (escopo câmera/infantil/QR)
- [ ] App Signing Play ativado (recomendado: deixar Google assinar, e keystore upload separado)
- [ ] Teste fechado (Internal testing / Alpha / Beta)

---

## 12. EAS Build (perfis dev / preview / production)

Arquivo: `apps/mobile/eas.json`

| Perfil      | Android                 | iOS                         | Canal          | autoIncrement |
| ----------- | ----------------------- | --------------------------- | -------------- | ------------- |
| development | APK debug + devClient   | Simulator, Debug            | development    | sim           |
| preview     | APK internal (homolog.) | Device internal (Ad Hoc)    | preview        | sim           |
| production  | AAB (app-bundle) store  | Store (App Store Connect)   | production     | sim           |

### Comandos freqüentes

```bash
cd apps/mobile
eas build -p android --profile development   # dev client / dev team
eas build -p android --profile preview       # APK homologação instalável
eas build -p android --profile production    # AAB loja Play
eas build -p ios     --profile preview       # TestFlight / QA interno (necess. credenciais)
eas build -p ios     --profile production    # IPA loja App Store
```

---

## 13. iOS — TestFlight + App Store

### 13.1 Pré-requisitos (Apple Developer / App Store Connect)

Antes de qualquer build iOS válido, você precisa **fora do código**:

1. **Programa Apple Developer (US$ 99/ano):** https://developer.apple.com/ → inscrever time/igreja.
2. **App Store Connect:** criar app **Bundle ID exato = `br.com.vivasede.app`** (case-sensitive, **NÃO MUDAR depois**), SKU, nome App, preço (Free).
3. **EAS Login na conta Expo** + Apple credenciais na 1ª execução (ou via `EXPO_APPLE_ID`, `EXPO_APPLE_APP_SPECIFIC_PASSWORD` no CI / EAS Secrets).
4. **Push Notifications iOS:** Criar Key .p8 (Push Notifications) no Apple Developer → Keys → Enable Apple Push Notifications service (APNs), adicionar ao Expo Project Push Credentials no dashboard expo.dev → Project settings → Credentials → Push Keys.
5. **Associated Domains (universal links, opcional):** se quiser `https://vivasede.com.br/*` abrir o app (além do scheme `vivachurch://`), adicionar ao Signing Capabilities + `apple-app-site-association` no servidor.

### 13.2 iOS infoPlist (declarado app.json)

- `NSCameraUsageDescription` → QR scan
- `NSPhotoLibraryUsageDescription` → foto perfil
- `NSCalendarsUsageDescription` → adicionar escala/evento ao calendário
- `NSUserNotificationUsageDescription` → Push recebimento
- `UIBackgroundModes: ["remote-notification"]` → Push em background (atualiza badge / lança deep link)

### 13.3 Builds iOS

```bash
cd apps/mobile
# Preview / TestFlight interno (Ad-Hoc distribution = testadores com UDID cadastrados):
eas build -p ios --profile preview

# Produção App Store Connect (TestFlight público / release loja):
eas build -p ios --profile production
```

### 13.4 Submeter para App Store Connect (TestFlight + Loja)

```bash
# envia IPA mais recente para App Store Connect (pista TestFlight por padrão)
eas submit -p ios --profile production
```

No App Store Connect:
- TestFlight → Build → preencha compliance export laws (push + criptografia)
- Invite testers group ("App Store Connect Users" para time admin / External para fiel/membros).
- Quando aprovado internamente: Submit App Review → loja.

**Importante:** iOS builds requer **macOS + Xcode APENAS se build local; EAS cloud já faz tudo em servidores macOS — não necessita Mac na sua máquina.**

### 13.5 Permissões críticas Revisão App Store (atenção)

1. Câmera: explicar no texto descritivo e também em nota do revisor ("QR de carteirinha e check-in infantil").
2. Calendário: explicar adição voluntária de escalas / eventos pessoais (opcional ao usuário, tela "Adicionar ao calendário").
3. Push: explicar que apenas enviamos escalas, eventos, células, notícias igreja; não usamos para publicidade.
4. Conteúdo religioso: preencher Category corretamente (Lifestyle → Religion / Lifestyle / Education), age rating 4+ (se infantil).

---

## 14. Segredos e Variáveis Não-Públicas

Colocar APENAS nesses locais (NÃO commit):

| Onde configuar?          | Variáveis típicas                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `.env` ROOT servidor     | `EXPO_ACCESS_TOKEN`, `EXPO_PUSH_PROJECT_ID`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `YOUTUBE_API_KEY` |
| EAS Secrets (expo.dev)   | `EXPO_TOKEN` (para CI rodar `eas build`), `EXPO_APPLE_ID`, senhas connect, keystore senhas |
| EasyPanel / Hosting env  | Todas as acima + DB e NEXTAUTH                                                       |

---

## 15. Troubleshooting

### 15.1 `tsc mobile` Erros

- Rode `cd apps/mobile && npx tsc --noEmit`. A etapa 4 validou exit 0; se aparecer erro novo provavelmente é:
  - `Dynamic imports only supported when module flag ...` → trocar `import()` por import estático no topo.
  - `api.request does not exist` → adicionado método `api.request(path, options)` em `src/services/api/client.ts`.

### 15.2 Expo não loga / sandbox Windows bloqueia `.expo`

- Aviso TRAE Sandbox restrição a `C:\Users\vinicius\.expo` ocorre apenas aqui. Em sua máquina Windows normal:
  - `eas whoami && eas login` resolve (precisa só uma vez).

### 15.3 Push não chega Android 13+

- Verificar permissão POST_NOTIFICATIONS foi aceita pelo usuário (Settings → Apps → Permissões → Notificações).
- Token ExpoPushToken vazio? → Verifique network para `https://exp.host/` (Expo Push API).
- Token registrado porém notificação 0 enviada → Verifique canal `PUSH` no Admin (IN_APP só não vai push device).

### 15.4 Build falha: `eas.json projectId empty`

- `cd apps/mobile && eas init` → cola `projectId` em `app.json → extra.eas.projectId`. Commit.

### 15.5 Bundle ID conflito Google Play / App Store

- `br.com.vivasede.app` definido ETAPA1. Após 1ª publicação em loja **NÃO ALTERE**.
- Se houver conflito na criação, o passo 11/13 deve ser ajustado manualmente **ANTES** da primeira loja (fora do código).

### 15.6 Prisma migration push_devices não aplicada no EasyPanel produção

- Rodar no servidor EasyPanel (deploy novo):
  ```bash
  npx prisma migrate deploy   # aplica migrations/ existentes sem gerar novas
  ```
- Migration foi gerada `create-only` (devidamente criada em `prisma/migrations/20260905060010_etapa4_push_devices_notification_push/migration.sql`). Não destrutiva (0 DROP).

---

## 16. Arquitetura Final Diagram (texto)

```
                GitHub (main)
                    │
          ┌─────────┴──────────┐
          │                    │
      EasyPanel             Expo / EAS
      (Next.js Web + API)    │ APK, AAB, IPA, Submit lojas
          │                    │
          │  HTTPS /api/v1/* + JWT Bearer
          └──────────┬─────────┘
                     │
                Prisma 7
                     │
               PostgreSQL 16
```

Mobile NÃO acessa PostgreSQL, NÃO tem Prisma, NÃO tem servidor próprio. 100% cliente HTTPS → API central.

---

## 17. Permissões / RBAC Central Notificações Web

- Notificações route: página `/admin/notifications` acessível apenas roles com permissão `notifications:write` (Super Admin, Pastores, Secretaria, Líderes, etc — configurado em `src/server/rbac.ts`).
- Leitura notificações minhas (dashboard admin) por qualquer user logado (RoleKey MEMBER+).
- **Audit Log:** `CREATE Notification` + `MARK_READ NotificationDelivery` logados em `AuditLog` (ator, entidade, after snapshot).

### Opções nova notificação (Admin Central Push)

Formulário à direita, coluna em xl:grid-cols-3:
- Canal: **In-App** | **Push (Mobile)**
- Título, Mensagem
- Imagem (URL opcional)
- Destino interno Deep Link (Início, Agenda, Escalas, Eventos, Células, Rede, Discipulado, Carteirinha, Igreja, Perfil/Editar, Notificações)
- Data/Hora agendar (vazio = enviar imediatamente)
- Alvo: Todos / Por perfis roles / Por ministério / Por célula / Por pessoa
- Tipos de membro (extra opcional: MEMBER, VISITOR, NEW_MEMBER, LEADER, VOLUNTEER, DISCIPLER)
- Botões: **Enviar agora** (submit padrão) / **Agendar / Salvar** (submit variant secondary).

---

## 18. Checklist Final QA (24 itens antes homologação)

### Sessão e auth
- [ ] Login email/senha válido gera JWT e me cacheado
- [ ] Logout apaga SecureStore + AsyncStorage + active=false push device
- [ ] JWT expirado retorna 401 e limpa sessão global (não loop)

### Conteúdo
- [ ] Home / Agenda / Escalas carregam
- [ ] Escala: confirmar, recusar, substituição
- [ ] Eventos, Células, Discipulado, Rede
- [ ] Carteirinha QR gera + leitura QR scan valida
- [ ] Infantil check-in / check-out crianças do responsável logado
- [ ] Perfil editar (nome, foto, endereço, telefone)

### Push & Deep
- [ ] Permissão Push Android 13 / iOS solicitada 1ª vez
- [ ] ExpoPushToken registrado em push_devices (ver tabela)
- [ ] Admin Central Push (Canal=PUSH) → chega no device em < 30s
- [ ] Tap push → abre deep link correto
- [ ] Lembrete escala 24h e 2h via manual (rodar helpers)

### Offline & Redes
- [ ] Offline → tela informativa / falhas amigáveis (não quebra app)
- [ ] Re-online → queries refetch

### Builds
- [ ] APK preview instala sem warning (Android 11+)
- [ ] AAB production Google Play aceito
- [ ] iOS TestFlight instala (iPad + iPhone tamanhos)

---

## 19. Publicação Não Autorizada

**NÃO publique no Google Play / App Store sem o aval explícito do dono do produto / igreja.**
Documentação cobre preparo, não execução de loja.

---

## 20. Pendências conhecidas (documentadas intencionalmente)

1. **`extra.eas.projectId` em app.json** → preencha após `eas init` (valor não inventado).
2. **Credenciais Expo / Apple / Google Play** → configurar em contas oficiais; não armazenar no git.
3. **Job Cron lembretes 24h/2h** → configurar no EasyPanel (Cron Job) ou Serverless; helpers já prontos.
4. **Expo Doctor** não rodou no sandbox TRAE (bloqueio à pasta .expo); validar na máquina do dev com `npx expo-doctor` 1x antes release.
5. **Apple Push Key (.p8)** ainda não anexada ao Expo; vincular quando conta Apple Developer disponível.
6. **Keystore Android**: EAS cloud cria upload keystore automaticamente na 1ª build; após 1ª Play Store NÃO PERCA. Faça backup (exp.dev → credentials → backup keystore file + senhas).
