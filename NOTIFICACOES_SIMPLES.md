# 📬 Sistema de Notificações - Looton

## 🎯 Objetivo Simples

O app envia **2 tipos de notificações remotas**:

1. **Oferta do Dia** - Todos os dias às 12h e 18h
2. **Jogo Vigiado** - Quando um jogo favorito tem queda de preço ou promoção

---

## 🔧 Como Funciona

### 📱 **Mobile**
1. Usuário abre o app pela primeira vez
2. App pede permissão de notificações
3. Expo gera um **Push Token**
4. App envia o token para `POST /users`
5. **Pronto!** Usuário vai receber notificações automaticamente

### 🖥️ **Backend**
1. Recebe e salva o push token do usuário
2. Roda 2 jobs automáticos:
   - **Daily Offer Job** - 12h e 18h
   - **Watched Games Job** - A cada 6h
3. Envia notificações via Expo Push API

---

## ✅ Checklist Rápido

### **1. Configurar Backend**

```bash
# Navegar para backend
cd c:\Looton\looton\backend

# Instalar dependências (se necessário)
npm install

# Iniciar servidor
npm run dev
```

### **2. Verificar Logs**

Você deve ver:
```
Backend rodando em http://0.0.0.0:3000
[DailyOfferJob] Job de oferta do dia iniciado (executa às 12h e 18h)
[WatchedGamesJob] Job de jogos vigiados iniciado (executa a cada 6h)
```

### **3. Registrar Push Token (Mobile faz isso automaticamente)**

```javascript
// Mobile - App.tsx já faz isso
const token = await askPushPermissionFirstLaunch(projectId);
await sendPushTokenToBackend(token);
```

Backend recebe em:
```typescript
POST /users
{
  "userId": "device_12345",
  "pushToken": "ExponentPushToken[xxx...]"
}
```

---

## 📋 Jobs Ativos

### **1️⃣ Daily Offer Job** 
📁 `src/jobs/dailyOffer.job.ts`

**Quando**: 12:00 e 18:00 (todo dia)

**O que faz**:
1. Busca a melhor oferta do dia (maior desconto)
2. Pega todos os usuários ativos (últimos 30 dias)
3. Envia notificação push para todos

**Notificação**:
```
🎮 Oferta do Dia!
God of War - 60% OFF por R$ 79.99
```

---

### **2️⃣ Watched Games Job**
📁 `src/jobs/watchedGames.job.ts`

**Quando**: A cada 6 horas (00:00, 06:00, 12:00, 18:00)

**O que faz**:
1. Para cada usuário ativo
2. Verifica seus jogos favoritos
3. Compara preço atual com preço anterior
4. Se mudou significativamente → Envia notificação

**Tipos de Notificação**:
- 💰 **Preço Caiu**: Queda >= 10%
- 🔥 **Novo Desconto**: Desconto aumentou >= 15%
- 🎯 **Preço Desejado**: Atingiu o preço que o usuário queria

**Exemplo**:
```
💰 Preço Caiu!
Elden Ring de R$ 199.99 → R$ 139.99 (-30%)
```

---

## 🧪 Testando

### **Teste 1: Registrar Usuário**

```powershell
$body = @{
    userId = "test_123"
    pushToken = "ExponentPushToken[xxxxxxxxxxxxx]"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/users" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
```

### **Teste 2: Adicionar Jogo Favorito**

```powershell
$body = @{
    userId = "test_123"
    gameId = "1174180"
    stores = @("steam")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/favorites" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
```

### **Teste 3: Forçar Notificação (Debug)**

```powershell
# Testar Daily Offer manualmente
Invoke-RestMethod -Uri "http://localhost:3000/debug/test-daily-offer" -Method POST

# Ver histórico
Invoke-RestMethod -Uri "http://localhost:3000/debug/daily-offer-history"
```

---

## 📊 Endpoints Úteis

### **Usuários**
- `POST /users` - Registrar push token
- `GET /users/:userId` - Ver info do usuário

### **Favoritos**
- `POST /favorites` - Adicionar favorito
- `GET /favorites?userId=xxx` - Listar favoritos
- `DELETE /favorites/:id` - Remover favorito

### **Debug**
- `GET /debug/user-tracker` - Ver usuários registrados
- `POST /debug/test-daily-offer` - Testar oferta do dia
- `GET /debug/daily-offer-history` - Histórico de ofertas
- `GET /debug/watched-games-history` - Histórico de jogos vigiados

---

## 🔍 Verificando se Está Funcionando

### **1. Ver usuários registrados**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/debug/user-tracker"
```

### **2. Ver logs do servidor**
Procure por:
```
[DailyOfferJob] Oferta selecionada: God of War - 60% OFF
[DailyOfferJob] Enviando para 10 dispositivos...
[DailyOfferJob] ✅ Concluído! Enviadas: 10, Erros: 0
```

```
[WatchedGamesJob] Usuário test_123: 5 favoritos
[WatchedGamesJob] ✅ Notificação enviada: Elden Ring
```

---

## ⚙️ Configuração

Tudo já está configurado! Não precisa mudar nada.

Os horários são fixos:
- **Daily Offer**: 12:00 e 18:00
- **Watched Games**: A cada 6 horas

Se quiser mudar, edite:
- `src/jobs/dailyOffer.job.ts` (linha do `cron.schedule`)
- `src/jobs/watchedGames.job.ts` (linha do `cron.schedule`)

---

## 🎉 Pronto!

**É só isso!** O sistema já está funcionando:

✅ Mobile registra push token → Backend salva  
✅ Jobs rodam automaticamente → Enviam notificações  
✅ Usuários recebem notificações → Abrem o app  

**Simples assim!** 🚀
