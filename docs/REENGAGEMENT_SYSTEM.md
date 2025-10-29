# Sistema de Notificações de Reengajamento 🔔

Sistema de notificações motivacionais estilo **Duolingo** que engaja usuários inativos, incentivando-os a voltar ao app.

## 📱 Como Funciona

### Rastreamento de Atividade
- Toda vez que o usuário abre o app, sua atividade é registrada
- Sistema mantém timestamp da última atividade
- Push token é armazenado para envio de notificações

### Detecção de Inatividade
- Job automático verifica usuários inativos a cada **12 horas**
- Considera inativo: usuário que não abriu o app há **3+ dias**
- Sistema respeita limites: **máximo 1 notificação por dia por usuário**

### Mensagens Motivacionais
O sistema possui **8 mensagens diferentes** que são escolhidas aleatoriamente:

1. 🎮 **"Sentimos sua falta!"** - Novas ofertas com até 90% OFF
2. 💎 **"Ofertas que você não pode perder!"** - Descontos históricos
3. 🏆 **"Hora de economizar!"** - Ofertas favoritas em promoção
4. 🎯 **"Promoções esperando por você!"** - Novos jogos diários
5. ⚡ **"Flash deals acontecendo agora!"** - Ofertas relâmpago
6. 🔥 **"Tá pegando fogo!"** - Maiores descontos da semana
7. 🎁 **"Presente para você!"** - Jogos AAA com preços de indie
8. 🌟 **"Está perdendo as melhores ofertas!"** - Até 95% OFF

## 🛠️ Arquitetura

### Backend

#### Service: `user-activity.service.ts`
```typescript
// Rastreia última atividade e histórico de notificações
userActivityTracker.recordActivity(userId, pushToken)
userActivityTracker.getInactiveUsers(daysInactive)
userActivityTracker.markNotificationSent(userId)
```

#### Job: `reengagement.job.ts`
- Executa a cada **12 horas**
- Busca usuários inativos (3+ dias)
- Envia notificações via Expo Push API
- Aguarda 500ms entre envios (rate limiting)
- Marca notificações enviadas para evitar spam

#### Endpoints: `/notifications/activity`
- `POST /notifications/activity` - Registrar atividade do usuário
- `GET /notifications/activity/stats` - Estatísticas de atividade
- `GET /notifications/activity/:userId` - Atividade de usuário específico

### Mobile

#### App.tsx
- Registra atividade automaticamente ao abrir o app
- Canal de notificação dedicado: `reengagement`
- Configuração de vibração e som

#### Canal de Notificação
```typescript
{
  name: 'Lembretes e Novidades',
  importance: MAX,
  sound: 'default',
  vibration: [0, 250, 250, 250],
  lightColor: '#3B82F6'
}
```

## 🧪 Como Testar

### 1. Teste Manual Imediato
```bash
cd looton/backend
node test-reengagement-send.js
```
Envia uma notificação motivacional aleatória instantaneamente.

### 2. Teste do Sistema Completo
```bash
cd looton/backend
node test-reengagement.js
```
Registra usuário e mostra estatísticas.

### 3. Verificar Estatísticas
```bash
curl http://192.168.1.216:3000/notifications/activity/stats
```

Resposta:
```json
{
  "totalUsers": 5,
  "activeToday": 2,
  "inactive3Days": 1,
  "inactive7Days": 0
}
```

### 4. Verificar Atividade de Usuário
```bash
curl http://192.168.1.216:3000/notifications/activity/USER_ID
```

## 📊 Métricas Rastreadas

- **Total de usuários**: Quantos usuários únicos
- **Ativos hoje**: Usuários que abriram o app hoje
- **Inativos 3 dias**: Elegíveis para reengajamento
- **Inativos 7 dias**: Usuários em risco de churn
- **Notificações enviadas**: Contador por usuário
- **Última notificação**: Timestamp do último envio

## ⚙️ Configurações

### Intervalo do Job
```typescript
// Executar a cada 12 horas
setInterval(() => {
  runReengagementJob();
}, 12 * 60 * 60 * 1000);
```

### Threshold de Inatividade
```typescript
// Padrão: 3 dias
const inactiveUsers = userActivityTracker.getInactiveUsers(3);
```

### Rate Limiting
```typescript
// Aguardar 500ms entre notificações
await new Promise(resolve => setTimeout(resolve, 500));
```

### Cooldown de Notificações
```typescript
// Máximo 1 notificação por dia
return daysSinceLastNotification >= 1;
```

## 🎯 Melhores Práticas

### ✅ Fazer
- Registrar atividade a cada abertura do app
- Respeitar o cooldown de 1 dia entre notificações
- Usar mensagens variadas e motivacionais
- Monitorar estatísticas de reengajamento

### ❌ Evitar
- Enviar notificações muito frequentes (spam)
- Usar sempre a mesma mensagem
- Ignorar o push token expirado
- Não rastrear eficácia das notificações

## 📈 Expansões Futuras

### Possíveis Melhorias
- **Personalização**: Mensagens baseadas em preferências do usuário
- **A/B Testing**: Testar diferentes mensagens e horários
- **Segmentação**: Diferentes estratégias para diferentes níveis de inatividade
- **Analytics**: Dashboard de métricas de reengajamento
- **Smart Timing**: Enviar notificações em horários otimizados
- **Deep Links**: Levar usuário direto para ofertas relevantes
- **Gamificação**: Streak counter, badges por atividade

## 🔧 Troubleshooting

### Notificação não aparece
1. Verificar se push token é válido
2. Confirmar canal `reengagement` configurado
3. Checar logs do backend para erros de envio

### Job não executa
1. Verificar se `startJobs()` está sendo chamado no `server.ts`
2. Confirmar que ambiente não é `test`
3. Checar logs: `[ReengagementJob]`

### Muitas notificações
1. Verificar cooldown de 1 dia está ativo
2. Confirmar que `markNotificationSent()` é chamado
3. Ajustar threshold de inatividade se necessário

## 📝 Logs

Sistema produz logs estruturados:

```
[UserActivity] Registrada atividade para user_123
[ReengagementJob] Iniciando verificação de usuários inativos...
[ReengagementJob] Encontrados 3 usuários inativos
[ReengagementJob] ✅ Notificação enviada para user_123
[UserActivity] Notificação enviada para user_123 (total: 1)
[ReengagementJob] Estatísticas: { totalUsers: 10, activeToday: 7, ... }
```

## 🚀 Deploy

Sistema está **automaticamente ativo** quando backend inicia:

```bash
npm run dev  # Desenvolvimento
npm start    # Produção
```

Job inicia automaticamente e executa em background.

### 🌐 Deploy no Render

O backend já está configurado para rodar no Render: **`https://looton-backend.onrender.com`**

- ✅ Jobs automáticos funcionam no Render
- ✅ Sistema de reengajamento ativo 24/7
- ✅ Mobile configurado para usar URL do Render via `EXPO_PUBLIC_API_URL`
- ✅ Notificações enviadas mesmo com backend no Render

**Importante**: Jobs funcionam normalmente no Render, incluindo:
- Reengajamento (a cada 12 horas)
- Currency refresh (diário)
- Cleanup (a cada 6 horas)

## 💡 Inspiração

Sistema inspirado em apps de sucesso:
- **Duolingo**: Notificações motivacionais e consistência
- **Strava**: Lembretes de atividade
- **Instagram**: Novidades e engajamento
- **WhatsApp**: Persistência gentil

---

**Status**: ✅ Sistema ativo e funcionando  
**Última atualização**: 29/10/2025  
**Versão**: 1.0.0
