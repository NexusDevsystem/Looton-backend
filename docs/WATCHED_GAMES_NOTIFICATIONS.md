# Sistema de Notificações de Jogos Vigiados

## Visão Geral

O sistema de notificações de jogos vigiados monitora automaticamente os jogos favoritos dos usuários e envia notificações push quando:

1. **Preço Desejado Alcançado** 🎯
   - Usuário definiu um preço alvo e o jogo atingiu esse valor

2. **Queda de Preço** 💰
   - Preço caiu 10% ou mais desde a última verificação

3. **Novo Desconto** 🔥
   - Desconto aumentou 15% ou mais (ex: de 30% → 45%)

## Arquitetura

### Backend Job (`watchedGames.job.ts`)

**Frequência**: A cada 6 horas (00:00, 06:00, 12:00, 18:00 - horário de Brasília)

**Fluxo de Execução**:

```
1. Obter usuários ativos (últimos 30 dias) com push token
2. Para cada usuário:
   a. Buscar seus jogos favoritos (favoritesCache)
   b. Para cada jogo favorito:
      - Buscar ofertas atuais via API /deals?gameId=X
      - Comparar com cache de preços anterior
      - Se houve mudança significativa, enviar notificação
      - Atualizar cache de preços
3. Salvar histórico de notificações
```

### Cache de Preços

O sistema mantém em memória um Map duplo:
```typescript
Map<userId, Map<gameId, { price: number, discount: number }>>
```

- **Primeira verificação**: Apenas cacheia os valores, sem notificar
- **Verificações seguintes**: Compara com cache anterior e detecta mudanças

### Notificações Push

Usa **Expo Push Notifications** com prioridade alta:

```typescript
{
  to: pushToken,
  title: "🎯 Preço Desejado Alcançado!",
  body: "God of War agora está por R$ 89.99!",
  data: {
    type: 'watched_game',
    gameId: '123',
    store: 'Steam',
    url: 'https://...',
    notificationType: 'desired_price_reached'
  },
  priority: 'high',
  channelId: 'watched-games'
}
```

## Tipos de Notificação

### 1. Preço Desejado Alcançado
- **Condição**: `currentPrice <= favorite.desiredPrice`
- **Título**: "🎯 Preço Desejado Alcançado!"
- **Corpo**: "{game} agora está por R$ {price}!"

### 2. Queda de Preço
- **Condição**: Preço caiu ≥ 10%
- **Título**: "💰 Preço Caiu!"
- **Corpo**: "{game} de R$ {old} → R$ {new} (-{percent}%)"

### 3. Novo Desconto
- **Condição**: Desconto aumentou ≥ 15 pontos percentuais
- **Título**: "🔥 Novo Desconto!"
- **Corpo**: "{game} agora com {discount}% OFF - R$ {price}"

## Rate Limiting

- **Entre notificações**: 200ms delay
- **Cooldown por usuário**: 24h (planejado, não implementado ainda)
- **Chunks da Expo**: Automático (max 100 por batch)

## Debug Endpoints

### 1. Testar Execução Manual
```bash
POST /debug/test-watched-games
```

Executa a verificação imediatamente e retorna:
```json
{
  "success": true,
  "message": "Verificação de jogos vigiados concluída",
  "notificationsSent": 5,
  "lastNotifications": [...]
}
```

### 2. Limpar Cache de Preços
```bash
POST /debug/clear-price-cache
```

Útil para forçar notificações na próxima execução.

### 3. Ver Histórico
```bash
GET /debug/watched-games-history
```

Retorna últimas 20 notificações enviadas.

## Mobile - Desabilitação Local

Os serviços locais foram **desabilitados** e agora apenas documentam que as notificações são remotas:

**`WatchedGamesNotificationService.ts`**:
```typescript
/**
 * ⚠️ IMPORTANTE: Notificações de jogos vigiados são agora REMOTAS
 * 
 * O backend monitora automaticamente jogos favoritos e envia push
 * notifications quando há mudanças de preço.
 * 
 * Ver: backend/src/jobs/watchedGames.job.ts
 */
```

## Configuração Necessária

### Backend

1. ✅ Job registrado em `jobs/index.ts`
2. ✅ favoritesCache exportado em `favorites.routes.ts`
3. ✅ Expo Push Notifications configurado
4. ✅ Cron rodando a cada 6h

### Mobile

1. ✅ Push token registrado no backend (`/users`)
2. ✅ deviceId persistente (Android ID)
3. ✅ Favoritos sincronizados com backend
4. ✅ Notification channel 'watched-games' criado

## Monitoramento

### Logs

```
[WatchedGamesJob] 🎮 Iniciando verificação de jogos vigiados...
[WatchedGamesJob] Verificando 15 usuários ativos...
[WatchedGamesJob] Usuário user_123: 5 favoritos
[WatchedGamesJob] ✅ Notificação enviada: God of War
[WatchedGamesJob] ✅ Concluído! Jogos verificados: 75, Notificações enviadas: 3
```

### Histórico em Memória

Últimas 100 notificações ficam armazenadas:
```typescript
{
  userId: "user_123",
  gameId: "game_456",
  gameTitle: "God of War",
  oldPrice: 199.99,
  newPrice: 89.99,
  discount: 55,
  store: "Steam",
  timestamp: "2025-01-15T12:00:00Z",
  notificationType: "price_drop"
}
```

## Diferença: Local vs Remoto

### ❌ Notificações Locais (Antigo)
- Só funcionam com app aberto
- Não persistem após reiniciar dispositivo
- Não sincronizam entre dispositivos
- Dependem de background tasks limitados

### ✅ Notificações Remotas (Atual)
- Funcionam com app fechado
- Enviadas pelo servidor de forma confiável
- Sincronizam entre todos os dispositivos do usuário
- Controle centralizado e monitoramento

## Próximos Passos

- [ ] Implementar cooldown de 24h por jogo/usuário
- [ ] Adicionar preferências de horário (não enviar à noite)
- [ ] Dashboard admin para monitorar envios
- [ ] Métricas: taxa de abertura, conversão
- [ ] Suporte a múltiplas lojas (filtrar por preferência do usuário)
- [ ] Smart grouping: agrupar múltiplas notificações em uma só

## Testes

### Teste Local

1. Adicione um jogo aos favoritos
2. Execute teste manual:
   ```bash
   curl -X POST http://localhost:3000/debug/test-watched-games
   ```
3. Verifique logs no backend
4. Confirme recebimento da notificação no mobile

### Teste de Cache

1. Limpe cache: `POST /debug/clear-price-cache`
2. Execute verificação duas vezes
3. Primeira vez: não notifica (cacheia)
4. Segunda vez: compara e notifica se houver mudança

## Troubleshooting

**Não recebendo notificações?**
- Verificar se push token está registrado: `GET /users`
- Confirmar favoritos sincronizados: `GET /favorites`
- Ver logs do job no backend
- Verificar histórico: `GET /debug/watched-games-history`

**Notificações duplicadas?**
- Cache de preços pode ter sido limpo
- Job executando múltiplas vezes
- Verificar logs de cron

**Preços não atualizando?**
- Job `updateAllStores` rodando?
- API de ofertas retornando dados?
- Verificar logs de fetch de ofertas
