# Arquitetura Completa de Notificações - Looton

## Visão Geral

**TODAS as notificações são agora REMOTAS (enviadas pelo backend)**

> ⚠️ Motivo: Notificações locais só funcionam quando o app está aberto. Com notificações remotas via Expo Push Notifications, os usuários recebem alertas mesmo com app fechado.

## 📱 Mobile → Apenas Recebe

### Responsabilidades
1. ✅ Registrar push token no backend
2. ✅ Manter deviceId persistente (Android ID)
3. ✅ Sincronizar favoritos com backend
4. ✅ Exibir notificações recebidas

### Código Modificado

**`src/notifications.ts`**
- Solicita permissão de notificações
- Registra push token com `userId` no endpoint `/users`
- **NÃO agenda notificações locais**

**`src/services/DailyOfferNotificationService.ts`**
```typescript
// ⚠️ DESABILITADO - Backend envia via push remoto
// Ver: backend/src/jobs/dailyOffer.job.ts
export async function scheduleDailyOfferNotification() {
  console.warn('⚠️ Notificações locais desabilitadas...')
  return null
}
```

**`src/services/WatchedGamesNotificationService.ts`**
```typescript
/**
 * ⚠️ IMPORTANTE: Notificações são agora REMOTAS
 * Backend monitora jogos favoritos automaticamente
 * Ver: backend/src/jobs/watchedGames.job.ts
 */
```

---

## 🖥️ Backend → Envia Tudo

### Jobs Ativos

#### 1. Daily Offer (Oferta do Dia) 🎮

**Arquivo**: `backend/src/jobs/dailyOffer.job.ts`

**Quando**: 2x por dia
- 12:00 (meio-dia)
- 18:00 (final da tarde)

**O que faz**:
1. Busca melhor oferta do dia (maior desconto + menor preço)
2. Filtra usuários ativos (últimos 30 dias)
3. Envia push notification para todos

**Notificação**:
```
🎮 Oferta do Dia!
God of War - 60% OFF por R$ 79.99
```

**Dados enviados**:
```json
{
  "type": "daily_offer",
  "gameId": "123",
  "store": "Steam",
  "url": "https://..."
}
```

**Logs**:
```
[DailyOfferJob] 🌅 Trigger às 12h (meio-dia) - executando...
[DailyOfferJob] Oferta selecionada: God of War - 60% OFF
[DailyOfferJob] Enviando para 150 dispositivos...
[DailyOfferJob] ✅ Concluído! Enviadas: 148, Erros: 2
```

---

#### 2. Watched Games (Jogos Vigiados) 🔔

**Arquivo**: `backend/src/jobs/watchedGames.job.ts`

**Quando**: A cada 6 horas
- 00:00, 06:00, 12:00, 18:00

**O que faz**:
1. Pega todos os usuários ativos com favoritos
2. Para cada jogo favorito:
   - Busca ofertas atuais
   - Compara com cache de preço anterior
   - Detecta mudanças significativas
   - Envia notificação se aplicável
3. Atualiza cache de preços

**Tipos de Notificação**:

**a) Preço Desejado Alcançado** 🎯
```
Condição: price <= desiredPrice
Título: "🎯 Preço Desejado Alcançado!"
Corpo: "Elden Ring agora está por R$ 89.99!"
```

**b) Queda de Preço** 💰
```
Condição: price caiu >= 10%
Título: "💰 Preço Caiu!"
Corpo: "Elden Ring de R$ 199.99 → R$ 139.99 (-30%)"
```

**c) Novo Desconto** 🔥
```
Condição: desconto aumentou >= 15%
Título: "🔥 Novo Desconto!"
Corpo: "Elden Ring agora com 55% OFF - R$ 89.99"
```

**Dados enviados**:
```json
{
  "type": "watched_game",
  "gameId": "456",
  "store": "Steam",
  "url": "https://...",
  "notificationType": "price_drop"
}
```

**Cache de Preços**:
```typescript
Map<userId, Map<gameId, { price: number, discount: number }>>
```

**Logs**:
```
[WatchedGamesJob] 🎮 Iniciando verificação de jogos vigiados...
[WatchedGamesJob] Verificando 50 usuários ativos...
[WatchedGamesJob] Usuário user_123: 8 favoritos
[WatchedGamesJob] ✅ Notificação enviada: Elden Ring
[WatchedGamesJob] ✅ Concluído! Jogos verificados: 400, Notificações enviadas: 12
```

---

#### 3. Reengagement (Retorno ao App) 🔁

**Arquivo**: `backend/src/jobs/reengagement.job.ts`

**Quando**: Diariamente às 19h

**O que faz**:
- Envia notificação para usuários inativos (7-30 dias)
- "Saudades de você! Confira as novas ofertas 🎮"

---

## 🔧 Infraestrutura

### Expo Push Notifications

**Biblioteca**: `expo-server-sdk`

**Processo**:
1. Mobile obtém token: `Notifications.getExpoPushTokenAsync()`
2. Mobile envia para backend: `POST /users { userId, pushToken }`
3. Backend armazena em memória: `userActivityTracker`
4. Jobs filtram usuários com `pushToken` válido
5. Jobs enviam via `expo.sendPushNotificationsAsync()`

**Rate Limits**:
- Max 100 notificações por chunk
- Delay de 200-500ms entre chunks
- Validação de token: `Expo.isExpoPushToken(token)`

### User Activity Tracker

**Arquivo**: `backend/src/services/user-activity.service.ts`

Armazena em memória:
```typescript
Map<userId, {
  userId: string
  pushToken: string | null
  lastActiveAt: Date
}>
```

**Métodos**:
- `trackActivity(userId, pushToken?)` - Atualiza última atividade
- `getAllUsers()` - Retorna todos os usuários
- Usado para filtrar usuários ativos (30 dias)

### Favorites Cache

**Arquivo**: `backend/src/routes/favorites.routes.ts`

```typescript
export const favoritesCache = new Map<string, any[]>()
```

Estrutura de um favorito:
```typescript
{
  gameId: string
  userId: string
  title?: string
  stores?: string[]
  desiredPrice?: number
  notifyUp?: boolean
  notifyDown?: boolean
  pctThreshold?: number
  createdAt: Date
}
```

---

## 🧪 Testes e Debug

### Endpoints de Debug

#### 1. Testar Daily Offer
```bash
# Não há endpoint - verificar logs no horário programado
# Ou modificar cron temporariamente para '*/1 * * * *' (a cada minuto)
```

#### 2. Testar Watched Games
```bash
POST http://localhost:3000/debug/test-watched-games
```

Resposta:
```json
{
  "success": true,
  "message": "Verificação de jogos vigiados concluída",
  "notificationsSent": 3,
  "lastNotifications": [...]
}
```

#### 3. Limpar Cache de Preços
```bash
POST http://localhost:3000/debug/clear-price-cache
```

Força notificações na próxima execução (útil para testes)

#### 4. Ver Histórico
```bash
GET http://localhost:3000/debug/watched-games-history
```

Retorna últimas 20 notificações enviadas

---

## 📊 Monitoramento

### Logs a Observar

**Daily Offer**:
```
[DailyOfferJob] Iniciando envio de Oferta do Dia...
[DailyOfferJob] Oferta selecionada: {title} - {discount}% OFF
[DailyOfferJob] Enviando para {count} dispositivos...
[DailyOfferJob] Concluído! Enviadas: X, Erros: Y
```

**Watched Games**:
```
[WatchedGamesJob] Iniciando verificação de jogos vigiados...
[WatchedGamesJob] Verificando {count} usuários ativos...
[WatchedGamesJob] Usuário {userId}: {count} favoritos
[WatchedGamesJob] Notificação enviada: {gameTitle}
[WatchedGamesJob] Concluído! Jogos verificados: X, Notificações enviadas: Y
```

### Erros Comuns

**Token inválido**:
```
[WatchedGamesJob] Token inválido: ExponentPushToken[...]
```
→ Usuário precisa reabrir o app para renovar token

**Erro ao enviar**:
```
[DailyOfferJob] Erro no ticket 5: DeviceNotRegistered
```
→ Usuário desinstalou o app, remover do tracker

**Sem ofertas**:
```
[DailyOfferJob] Nenhuma oferta disponível hoje.
```
→ Job `updateAllStores` não rodou ou API falhou

---

## 🚀 Deployment Checklist

### Backend
- ✅ Jobs registrados em `jobs/index.ts`
- ✅ Timezone configurado: `America/Sao_Paulo`
- ✅ Expo Push habilitado (env não necessário)
- ✅ favoritesCache exportado
- ✅ User activity tracker ativo

### Mobile
- ✅ Push token sendo registrado
- ✅ deviceId persistente (Android ID)
- ✅ Favoritos sincronizando com backend
- ✅ Notificações locais desabilitadas
- ✅ Channels criados: `daily-offers`, `watched-games`

### Testes
- [ ] Adicionar jogo aos favoritos
- [ ] Executar teste manual de watched games
- [ ] Confirmar recebimento no mobile (app fechado)
- [ ] Verificar logs do backend
- [ ] Testar com múltiplos usuários

---

## 📈 Próximas Melhorias

### Funcionalidades
- [ ] Cooldown de 24h por jogo/usuário (evitar spam)
- [ ] Preferências de horário (não enviar à noite)
- [ ] Agrupamento inteligente (batch de notificações)
- [ ] Suporte a múltiplas lojas por usuário

### Monitoramento
- [ ] Dashboard admin para ver estatísticas
- [ ] Métricas: taxa de abertura, conversão
- [ ] Logs persistentes (banco ou arquivo)
- [ ] Alertas de falha (muitos erros)

### Performance
- [ ] Cache Redis para preços (persistência)
- [ ] Fila de prioridade (preço desejado > queda > desconto)
- [ ] Otimização de queries (batch de jogos)
- [ ] Rate limiting por usuário

---

## 📚 Documentação Relacionada

- [WATCHED_GAMES_NOTIFICATIONS.md](./WATCHED_GAMES_NOTIFICATIONS.md) - Detalhes técnicos do job de jogos vigiados
- [REENGAGEMENT_SYSTEM.md](./REENGAGEMENT_SYSTEM.md) - Sistema de retenção de usuários
- [Mobile PUSH_NOTIFICATIONS.md](../../mobile/PUSH_NOTIFICATIONS.md) - Setup no mobile

---

## ✅ Resumo

| Tipo | Frequência | Status | Local | Prioridade |
|------|-----------|--------|-------|-----------|
| Daily Offer | 2x/dia (12h, 18h) | ✅ Ativo | Backend | Alta |
| Watched Games | 6h (00, 06, 12, 18) | ✅ Ativo | Backend | Alta |
| Reengagement | 1x/dia (19h) | ✅ Ativo | Backend | Média |
| Local Notifications | - | ❌ Desabilitado | Mobile | N/A |

**Resultado**: Sistema 100% remoto, confiável e escalável! 🚀
