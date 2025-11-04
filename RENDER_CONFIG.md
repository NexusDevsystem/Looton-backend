# ☁️ Configuração de Ambiente para RENDER (Produção)

## 🔧 Variáveis de Ambiente - Dashboard do Render

Acesse: https://dashboard.render.com → **looton-backend** → **Environment**

### **Adicione TODAS estas variáveis:**

```properties
# Ambiente
NODE_ENV=production

# Servidor
PORT=3000
API_BASE_URL=https://looton-backend.onrender.com

# MongoDB
MONGODB_URI=mongodb+srv://Nexus:uOdIaWUzyehn1Sms@nexusteam.mayhjak.mongodb.net/
MONGODB_DBNAME=Looton

# Redis Cloud
USE_REDIS=true
REDIS_URL=redis://default:hgBDtFAaI4pyqWQX6Zm8PkpEwIaRjD7T@redis-10576.c99.us-east-1-4.ec2.redns.redis-cloud.com:10576
REDIS_REQUIRE_NOEVICTION=false

# API Config
CURRENCY_BASE=BRL
CURRENCY_REFRESH_CRON=0 3 * * *
DEALS_REFRESH_CRON=*/20 * * * *
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
USE_MOCK_ADAPTERS=false

# Ofertas e Limpeza
OFFERS_EXPIRATION_DAYS=7
OFFERS_CLEANUP_CRON=0 */6 * * *

# PC Hardware
PC_USE_KEYWORD_FILTER=false
PC_CUR_MIN_DISCOUNT=0

# Terabyte
TBT_SEARCH_URL=https://www.terabyteshop.com.br/busca?str={q}&pagina=1
TBT_SEARCH_MAX_PAGES=3
TBT_CATEGORY_URL=https://www.terabyteshop.com.br/c/pc-gamer/componentes
TBT_CATEGORY_URL_2=https://www.terabyteshop.com.br/c/pc-gamer/perifericos
TBT_MAX_PAGES=2

# Epic Games
EPIC_FREE_BASE=https://store-site-backend-static.ak.epicgames.com
EPIC_GQL_BASE=https://storefront.graphql.epicgames.com
EPIC_CACHE_TTL=600

# Curadoria
CURATION_CC=BR
CURATION_LANG=portuguese
CURATION_WINDOW_HOURS=24
CURATION_MIN_DISCOUNT=20
CURATION_ROTATION_COOLDOWN_HOURS=72
CURATION_FEED_SIZE=30
CURATION_CRON=*/30 * * * *
ROTATION_FILE=.rotation_memory.json
CACHE_TTL_SECONDS=900

# PC Hardware Curadoria
PC_CUR_MIN_DISCOUNT=5
PC_CUR_ROTATION_COOLDOWN_HOURS=72
```

---

## 📝 IMPORTANTE - CHECKLIST:

### **✅ Obrigatórias (CRÍTICAS):**
- [x] `NODE_ENV=production`
- [x] `API_BASE_URL=https://looton-backend.onrender.com`
- [x] `REDIS_URL` (Redis Cloud)
- [x] `MONGODB_URI`
- [x] `USE_REDIS=true`

### **✅ Recomendadas:**
- [x] `PORT=3000`
- [x] `MONGODB_DBNAME=Looton`
- [x] `USE_MOCK_ADAPTERS=false`

### **✅ Opcionais (mas recomendadas):**
- [x] Todas as outras (para funcionalidade completa)

---

## 🎯 Como Adicionar no Render:

1. **Acesse:** https://dashboard.render.com
2. **Entre em:** looton-backend
3. **Clique em:** Environment (menu lateral)
4. **Adicione cada variável:**
   - Key: `NODE_ENV`
   - Value: `production`
   - Clique em "Add Environment Variable"
5. **Repita** para todas as variáveis acima
6. **Salve e Redeploy**

---

## 🔄 Após Adicionar as Variáveis:

### **No Dashboard do Render:**
1. Clique em **"Manual Deploy"** → **"Deploy latest commit"**
2. Ou faça um commit e push (deploy automático)

### **Verificar se funcionou:**
```bash
# Testar endpoint de saúde
curl https://looton-backend.onrender.com/deals?limit=1

# Deve retornar ofertas JSON
```

---

## ⚠️ ATENÇÃO - Variáveis Sensíveis:

**Estas variáveis contém credenciais. NÃO commitar no Git!**

- ✅ `REDIS_URL` - Senha do Redis Cloud
- ✅ `MONGODB_URI` - Senha do MongoDB

Estas devem estar **APENAS** no Render Dashboard!

---

## 🐛 Troubleshooting:

### **Jobs de notificação não funcionam?**
- Verificar se `API_BASE_URL` está correto
- Logs do Render: Dashboard → Logs

### **Redis não conecta?**
- Verificar `REDIS_URL` completa
- Verificar `USE_REDIS=true`

### **Ofertas não aparecem?**
- Verificar `USE_MOCK_ADAPTERS=false`
- Verificar conexão com MongoDB

---

## ✅ Verificação Final:

**Depois de configurar, teste:**

1. **API funciona:**
   ```
   https://looton-backend.onrender.com/deals
   ```

2. **Jobs rodando:**
   - Verificar logs do Render
   - Deve aparecer: "[DailyOfferJob] Job iniciado"

3. **Notificações:**
   - Aguardar 12h, 16:10h ou 18h
   - Ou testar: `/test-notification`

---

**PRONTO!** Backend configurado para produção no Render! 🚀
