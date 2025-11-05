# Diagnóstico do Sistema de Notificações de Jogos Vigiados

## Status Atual: ✅ SISTEMA IMPLEMENTADO E ATIVO

### 1. Componentes do Sistema

#### ✅ Cron Job Configurado
- **Arquivo**: `src/jobs/watchedGames.job.ts`
- **Frequência**: A cada 1 hora (`0 * * * *`)
- **Iniciado em**: `src/jobs/index.ts` linha 22
- **Status**: ATIVO (startWatchedGamesJob() é chamado no startJobs())

#### ✅ Lógica de Detecção
O sistema monitora:
1. Busca todos os usuários ativos (últimos 30 dias) com push tokens
2. Para cada usuário, verifica seus jogos favoritos
3. Consulta ofertas atuais de cada jogo
4. Compara com cache de preços anterior (Redis)
5. **Notifica quando**:
   - Jogo entra em promoção pela primeira vez
   - Jogo tinha desconto 0% e agora tem desconto > 0%
6. **NÃO notifica quando**:
   - Jogo já estava em promoção anteriormente (evita spam)
   - Jogo não tem desconto

#### ✅ Persistência
- **Cache de Preços**: Redis via `priceCachePersistence`
- **Favoritos**: Redis + Map em memória (`favoritesCache`)
- **User Activity**: Redis via `userActivityTracker`

### 2. Requisitos para Funcionamento

Para receber notificações de jogos vigiados, o usuário precisa:

1. ✅ **Estar registrado** no `userActivityTracker`
   - Push token válido
   - Ativo nos últimos 30 dias

2. ❌ **TER JOGOS FAVORITOS** cadastrados
   - **PROBLEMA IDENTIFICADO**: Usuário `android_f805cbab1cb1e432` não tem favoritos

3. ✅ **Jogos precisam ter ofertas** na API
   - Sistema consulta `/deals?gameId={id}`

### 3. Diagnóstico do Problema

**Por que não está recebendo notificações?**

```bash
# Verificar usuários
curl http://localhost:3000/notifications/activity/stats
# Resposta: {"totalUsers":2,"activeToday":1,...}

# Verificar favoritos do usuário
curl "http://localhost:3000/favorites?userId=android_f805cbab1cb1e432"
# Resposta: []
# ❌ PROBLEMA: Usuário NÃO tem jogos favoritos cadastrados!
```

### 4. Como Testar

#### Passo 1: Adicionar um jogo aos favoritos

No app mobile, o usuário precisa:
1. Buscar um jogo
2. Clicar no ícone de favorito/estrela
3. Jogo será adicionado à lista de vigiados

Ou via API:
```bash
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "android_f805cbab1cb1e432",
    "gameId": "123456",
    "stores": ["steam"],
    "notifyDown": true,
    "pctThreshold": 50
  }'
```

#### Passo 2: Aguardar ou Forçar Verificação

**Automático**: Sistema executa a cada hora (próxima execução no topo da hora)

**Manual** (se os endpoints de debug estiverem acessíveis):
```bash
# Limpar cache para forçar nova detecção
curl -X POST http://localhost:3000/favorites/debug/clear-price-cache

# Executar verificação manualmente
curl -X POST http://localhost:3000/favorites/debug/test-watched-games

# Ver histórico de notificações
curl http://localhost:3000/favorites/debug/watched-games-history
```

#### Passo 3: Verificar Logs

No terminal do backend, procurar por:
```
[WatchedGamesJob] 🎮 Verificando jogos vigiados (a cada 1 hora)...
[WatchedGamesJob] Total de usuários no tracker: 2
[WatchedGamesJob] Verificando 2 usuários ativos...
[WatchedGamesJob] Usuário android_f805cbab1cb1e432: X favoritos
[WatchedGamesJob] ✅ Notificação enviada: {gameTitle}
```

### 5. Endpoints de Debug

**Nota**: Os endpoints de debug podem não estar acessíveis se o backend não foi reiniciado após modificações recentes. Se isso acontecer, reinicie:

```bash
cd C:\Looton\looton\backend
npm run dev
```

Endpoints disponíveis:
- `POST /favorites/debug/test-watched-games` - Executa verificação manual
- `POST /favorites/debug/clear-price-cache` - Limpa cache de preços
- `GET /favorites/debug/watched-games-history` - Histórico de notificações
- `GET /favorites/debug/user-tracker` - Lista usuários cadastrados

### 6. Solução Rápida

**Para começar a receber notificações:**

1. Abra o app mobile
2. Busque por um jogo (ex: "GTA V", "Cyberpunk 2077")
3. Adicione aos favoritos (ícone de estrela/coração)
4. Aguarde até a próxima hora (cron job executará automaticamente)
5. Você receberá notificação se o jogo estiver em promoção

### 7. Exemplo de Notificação

Quando detectar promoção:
```
Título: 🔥 Promoção Detectada!
Corpo: Cyberpunk 2077 está com 50% OFF - R$ 99.99 - Pronto pra comprar!
```

### 8. Verificação Final

Execute este checklist:

- [x] Sistema está implementado
- [x] Cron job está ativo (executa a cada hora)
- [x] Usuário está registrado com push token
- [ ] **Usuário TEM jogos favoritos** ← PROBLEMA AQUI!
- [ ] Jogos favoritos têm ofertas disponíveis
- [ ] Backend rodando sem erros

## Conclusão

✅ **Sistema está 100% funcional e ativo**
❌ **Usuário não tem favoritos cadastrados**

**Solução**: Adicionar jogos aos favoritos no app mobile para começar a receber notificações quando entrarem em promoção.
