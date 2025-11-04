# 🚀 Guia Rápido: Como Usar a Persistência

## ✅ Checklist de Implementação

### 1️⃣ **Configurar Redis** 

```bash
# Opção 1: Docker Compose (Recomendado)
cd c:\Looton\looton\backend
docker compose up -d

# Opção 2: Docker direto
docker run -d --name looton-redis -p 6379:6379 redis:latest

# Verificar se está rodando
docker ps
redis-cli ping  # Deve retornar: PONG
```

### 2️⃣ **Configurar Variáveis de Ambiente**

Arquivo: `c:\Looton\looton\backend\.env`

```env
# Habilitar Redis
USE_REDIS=true
REDIS_URL=redis://localhost:6379

# Outras configurações importantes
PORT=3000
NODE_ENV=development
```

### 3️⃣ **Iniciar o Backend**

```powershell
cd c:\Looton\looton\backend
npm run dev
```

Você verá nos logs:
```
[UserActivityTracker] 🔄 Carregando dados do Redis...
[UserActivityTracker] ✅ Carregados 0 usuários do Redis
[Favorites] 🔄 Carregando favoritos do Redis...
[Favorites] ✅ Carregados favoritos de 0 usuários do Redis
```

---

## 📱 Testando o Sistema

### **Teste 1: Registrar Usuário e Push Token**

```powershell
# PowerShell
$body = @{
    userId = "device_12345"
    pushToken = "ExponentPushToken[xxxxxxxxxxxxxx]"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/users" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
```

**Resposta Esperada:**
```json
{
  "success": true,
  "userId": "device_12345",
  "message": "Usuário registrado com sucesso"
}
```

### **Teste 2: Verificar no Redis**

```bash
redis-cli GET user_activity:device_12345
```

**Saída:**
```json
{"userId":"device_12345","pushToken":"ExponentPushToken[xxx]","lastActiveAt":"2025-11-04T...","notificationsSent":0}
```

### **Teste 3: Adicionar Favorito**

```powershell
$body = @{
    userId = "device_12345"
    gameId = "1174180"
    stores = @("steam")
    desiredPriceCents = 8999
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/favorites" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
```

### **Teste 4: Verificar Favoritos no Redis**

```bash
redis-cli GET favorites:device_12345
```

### **Teste 5: Reiniciar e Verificar Persistência**

```powershell
# 1. Parar o servidor (Ctrl+C no terminal)

# 2. Iniciar novamente
npm run dev

# 3. Verificar se dados foram carregados (ver logs)
# [UserActivityTracker] ✅ Carregados 1 usuários do Redis
# [Favorites] ✅ Carregados favoritos de 1 usuários do Redis

# 4. Buscar usuário via API
Invoke-RestMethod -Uri "http://localhost:3000/users/device_12345"
```

**Deve retornar os dados salvos!** 🎉

---

## 🔍 Comandos Úteis

### **Ver Todas as Chaves do Redis**
```bash
redis-cli KEYS "*"
```

### **Contar Usuários Registrados**
```bash
redis-cli KEYS "user_activity:*" | wc -l
```

### **Ver Dados de um Usuário Específico**
```bash
# Atividade
redis-cli GET user_activity:device_12345

# Favoritos
redis-cli GET favorites:device_12345

# Cache de preços
redis-cli KEYS "price_cache:device_12345:*"
redis-cli GET price_cache:device_12345:1174180
```

### **Limpar Todos os Dados (Cuidado!)**
```bash
redis-cli FLUSHALL
```

### **Limpar Apenas User Activities**
```bash
redis-cli --scan --pattern "user_activity:*" | xargs redis-cli DEL
```

---

## 🐛 Troubleshooting

### **Problema: Redis não conecta**

```bash
# Verificar se Redis está rodando
docker ps

# Se não estiver, iniciar
docker compose up -d

# Ver logs do Redis
docker logs looton-redis
```

### **Problema: Dados não aparecem após restart**

**Checklist:**
1. ✓ Redis está rodando?
2. ✓ `USE_REDIS=true` no .env?
3. ✓ Logs mostram "Carregando dados do Redis"?
4. ✓ Verificar dados no Redis: `redis-cli GET user_activity:SEU_USER_ID`

### **Problema: Erro de conexão no Redis**

Verificar URL no .env:
```env
# Local
REDIS_URL=redis://localhost:6379

# Docker network
REDIS_URL=redis://redis:6379

# Redis Cloud
REDIS_URL=redis://default:password@host:port
```

---

## 📊 Monitoramento em Tempo Real

### **Ver Comandos sendo Executados**
```bash
redis-cli MONITOR
```

Você verá:
```
"SET" "user_activity:device_123" "..."
"GET" "favorites:device_123"
"SCAN" "0" "MATCH" "price_cache:*" "COUNT" "100"
```

### **Ver Estatísticas**
```bash
redis-cli INFO stats
```

---

## 🎯 Endpoints Disponíveis

### **Usuários**
- `POST /users` - Registrar usuário e push token
- `GET /users/:userId` - Buscar informações do usuário
- `PATCH /users/:userId` - Atualizar push token
- `DELETE /users/:userId` - Remover usuário

### **Favoritos**
- `POST /favorites` - Adicionar favorito
- `GET /favorites?userId=xxx` - Listar favoritos
- `DELETE /favorites/:id` - Remover favorito
- `PATCH /favorites/:id` - Atualizar favorito

### **Debug**
- `GET /debug/user-tracker` - Ver todos os usuários no tracker
- `GET /debug/watched-games-history` - Histórico de notificações
- `POST /debug/clear-price-cache` - Limpar cache de preços

---

## ✅ Checklist de Produção

Antes de fazer deploy:

- [ ] Redis configurado e rodando
- [ ] `USE_REDIS=true` no ambiente de produção
- [ ] Backup automático do Redis configurado
- [ ] Monitoramento de Redis ativo
- [ ] Testar recuperação de dados após restart
- [ ] Documentar credenciais do Redis (se cloud)

---

## 🎉 Pronto!

Agora você tem um sistema de notificações **100% confiável e persistente**!

**Próximos Passos:**
1. Configurar Redis em produção (Redis Cloud, AWS ElastiCache, etc.)
2. Configurar backup automático
3. Implementar monitoramento (New Relic, Datadog, etc.)
4. Testar com usuários reais

**Dúvidas?** Consulte: `docs/PERSISTENCE_SYSTEM.md`
