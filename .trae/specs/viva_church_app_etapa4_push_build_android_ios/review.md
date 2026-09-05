# REVIEW ETAPA 4/4 — PUSH / BUILD / ANDROID / iOS (VIVA CHURCH APP)
Artefato revisão independente Spec Mode sp5.
Spec referência: `.trae/specs/viva_church_app_etapa4_push_build_android_ios/spec.md` (20 ACs).

---

## 20 Acceptance Criteria Checklist

| #  | Critério de Aceite (spec.md literal)                                                  | Status | Evidência / Comentário                                                                                   |
|----|---------------------------------------------------------------------------------------|--------|----------------------------------------------------------------------------------------------------------|
| 1  | Expo Notifications instalado mobile: expo-notifications expo-application.             | OK     | T1 `apps/mobile/package.json` + `npm install` exit 0.                                                    |
| 2  | Expo Push Server SDK backend instalado: expo-server-sdk root.                         | OK     | T1 `package.json` root + `npm install` exit 0.                                                           |
| 3  | Prisma NotificationChannel enum extendido com valor `PUSH`.                           | OK     | `prisma/schema.prisma:152-156` enum IN_APP/EMAIL/PUSH. `prisma validate` exit 0.                         |
| 4  | Prisma model PushDevice (push_devices) criado + User.pushDevices[]. Migration segura create-only não destrutiva. | OK | `prisma/schema.prisma:759-775` + relation `User.pushDevices` 216-219 + `prisma/migrations/*/migration.sql` 0 DROP statements. |
| 5  | Notification 3 campos (imageUrl, deepLink, scheduledAt) nullable + index scheduledAt. | OK     | `prisma/schema.prisma:725-743` + `@@index([scheduledAt])`. Prisma validate exit 0.                       |
| 6  | API v1 `POST /api/v1/push/devices` upsert expoPushToken unique + `DELETE` marca active=false, requireLoggedIn JWT bearer zod. | OK | `src/app/api/v1/push/devices/route.ts:1-96` novo, zod body RegisterBody, readSessionOrBearer, prisma upsert. |
| 7  | Mobile service pushDevices.ts (register/unregister) + Zustand session.expoPushToken field + logout unregister. | OK | `apps/mobile/src/services/api/pushDevices.ts` + `src/stores/session.ts:13-26` campo expoPushToken + `logout()` 189-212 chama unregisterPushDevice. |
| 8  | Mobile `app/_layout.tsx` PushIntegration: perm → token → register → listener foreground/banner + resposta clique deepLink router.push. | OK | `apps/mobile/app/_layout.tsx:150-263`. 6 erros TS T10 → RESOLVIDOS. TSC exit 0. |
| 9  | App.json atualizado: perm Android POST_NOTIFICATIONS/RECEIVE_BOOT/VIBRATE/WAKE_LOCK; iOS NSUserNotificationUsageDescription + UIBackgroundModes remote-notification; expo-notifications plugin icon+color. | OK | `apps/mobile/app.json` completo review. Splash backgroundColor #06101D navy NOVO, adaptiveIcon bg NOVO. scheme vivachurch intacto. |
| 10 | eas.json expandido 3 perfis development/preview/production + env EXPO_PUBLIC_APP_ENV/API_URL por perfil + autoIncrement=true + submit production android internal draft. | OK | `apps/mobile/eas.json:1-64`. 3 perfis, env, autoIncrement em 3, submit.android track internal draft. |
| 11 | .env.example ROOT com EXPO_ACCESS_TOKEN + EXPO_PUSH_PROJECT_ID; apps/mobile/.env.example 3 blocos ambientes dev/preview/prod. | OK | `.env.example:20-22` + `apps/mobile/.env.example:1-18`.                                                  |
| 12 | Admin central `/admin/notifications` upgrade 9 campos + Canal PUSH/IN_APP radio + Imagem/Deep Link dropdown 12 telas/datetime alvo Todos/Roles/Ministérios/Células/Pessoas + 2 botões Enviar Agora / Agendar + Audit Log + backward compat default IN_APP target MEMBER. | OK | `src/app/(admin)/admin/notifications/page.tsx:1-463` rewrite. schema valida channel/PUSH/IN_APP/targetUsersOverride/imageUrl/deepLink/scheduledAt. serverAction createNotification. RBAC notifications:write intacto. |
| 13 | Server service `createNotificationCampaign` novo params channel(PUSH default IN_APP)/deepLink/imageUrl/scheduledAt/targetUsersOverride(userIds/ministryIds/cellIds). | OK | `src/server/notifications.ts` rewrite 304 lines. createNotificationCampaign signature expandida, default channel=IN_APP. |
| 14 | Server Expo Push: `sendExpoPushChunked()` (lote 100) + `sendExpoPushToUsers()`; DeviceNotRegistered → PushDevice.active=false; receipt handle. | OK | `src/server/notifications.ts` export. Helpers sendExpoPushChunked, sendExpoPushToUsers, handle receipts DeviceNotRegistered marcando active false. |
| 15 | Helpers escala lembretes: `sendScheduleReminders24h()`, `sendScheduleReminders2h()`, `sendNewScheduleNotification(mode new/changed/cancelled)` exportados. | OK | `src/server/notifications.ts` export 3 funções. Filtro ScheduleAssignment PENDING/CONFIRMED. |
| 16 | Assets placeholders 4 PNGs navy premium dark: icon.png 1024 adaptive-icon.png 1024 splash.png 1242×2436 favicon.png 64. | OK | `apps/mobile/assets/` 4 arquivos commitados. Substituíveis.                                               |
| 17 | TS validate mobile `npx tsc --noEmit` exit 0 + Prisma validate exit 0 + grep anti-hardcoded mockup/todo/fake/changeme 0 matches. | OK | Executados: tsc exit 0; prisma validate exit 0; grep 0 matches. 6 erros T10 foram todos resolvidos. |
| 18 | Expo Doctor: inspeção manual app.json/eas.json/deps compatíveis SDK 52; não executável no sandbox TRAE (.expo folder bloqueado) → documentado no Relatório Final C e README Troubleshooting 15.2. | OK (inspecionado) | Regra sandbox TRAE, usuário deve rodar `npx expo-doctor` em máquina local 1 vez antes release. |
| 19 | Android Preview APK + AAB produção config: eas.json preview=APK / production=app-bundle AAB, versionCode autoIncrement=true, package=br.com.vivasede.app, perm POST_NOTIFICATIONS. | OK (configurado) | eas.json + app.json corretos. APK não gerado sandbox TRAE, passo a passo usuário em README. |
| 20 | iOS TestFlight + App Store configs: bundleId=br.com.vivasede.app, eas.json ios simulator preview / internal / store production, infoPlist UIBackgroundModes["remote-notification"], sem credenciais inventadas, passo a passo credenciais faltantes documentado. | OK (configurado) | app.json + eas.json corretos. Nenhum token/Apple credencial commitado. README explica passo a passo. |

---

## Notas Revisão Independente (sp5)

- Nenhum segredo commitado (DATABASE_URL, EXPO_ACCESS_TOKEN, credenciais Apple/Google).
- Nenhum EXPO_PUBLIC_* contém segredo — apenas URL e ambiente.
- `extra.eas.projectId` ficou intencionalmente vazio em app.json como solicitado; preencher após `eas init`.
- Migrations Prisma 0 DROP — criação segura não destrutiva (não há perda de dados em produção).
- Backward compat ETAPA1/2/3 mantido: createNotificationCampaign sem channel = IN_APP, admin form antigo = IN_APP target MEMBER.
- 10 commits atômicos conventional commits (feat/chore/docs) push origin main 1ff4496..afa0197 verificados.
- Nenhum arquivo .env / node_modules / build artefato commitado; .gitignore intacto.
- Nenhuma modificação em Prisma/Next.js/Admin/Serviços existentes ETAPA0-3 fora dos 4 arquivos server/route/admin/schema especificados.
- Deep Links scheme vivachurch não alterado; router.push compatível Expo Router 4.
- README-MOBILE.md cobre stack, instalação, ambientes, Expo CLI, Push, QR, APK, AAB, TestFlight, App Store, Segredos, Troubleshooting, Arquitetura final, RBAC e 24-checklist QA.

---

## Pendências documentadas (Faltam para build real & lojas)

1. **`eas projectId` vazio em app.json** → rodar `cd apps/mobile && eas init` e colar valor em extra.eas.projectId.
2. **Login Expo Account em máquina local** → `eas login` (fora sandbox TRAE).
3. **Build APK preview real Android** → `eas build -p android --profile preview` (15-35 min cloud build).
4. **Credenciais Apple Developer (pago)** → conta US$ 99/ano, Keys .p8 Push Notifications, App ID `br.com.vivasede.app`, App Store Connect.
5. **Credenciais Google Play (pago)** → conta Play Console US$ 25 one-time, App Listing e Asset Store (screenshots, ícones 512, política privacidade URL).
6. **Keystore backup Android** → EAS gera upload keystore automaticamente; após 1ª loja baixar backup (exp.dev → Credentials).
7. **Job Cron lembretes 24h/2h escalas** → configurar no EasyPanel Cron ou similar; helpers prontos `sendScheduleReminders*()`.
8. **Expo Doctor na máquina do dev** → `cd apps/mobile ; npx expo-doctor` para garantir SDK 52 saudável antes 1ª loja.
