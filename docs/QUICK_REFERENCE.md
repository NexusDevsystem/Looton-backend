# 🎮 Looton - Sistema de Notificações - Guia Rápido

## 📱 TODAS as Notificações são REMOTAS (Backend)

### ✅ Sistemas Ativos

| Sistema | Frequência | Arquivo |
|---------|-----------|---------|
| **Daily Offer** | 12h e 18h | `jobs/dailyOffer.job.ts` |
| **Watched Games** | A cada 6h | `jobs/watchedGames.job.ts` |
| **Reengagement** | 1x/dia (19h) | `jobs/reengagement.job.ts` |

---

## 🔔 Watched Games - Notificações

### Quando Notifica?

1. **🎯 Preço Desejado** - `price <= desiredPrice`
2. **💰 Queda de Preço** - Preço caiu ≥10%
3. **🔥 Novo Desconto** - Desconto aumentou ≥15%

### Como Funciona?

```
Job (6h) → Busca favoritos → Compara preços → Mudança? → Envia push
```

---

## 🧪 Debug Endpoints

```bash
# Testar imediatamente
curl -X POST http://localhost:3000/debug/test-watched-games

# Ver histórico
curl http://localhost:3000/debug/watched-games-history

# Limpar cache (forçar notificações)
curl -X POST http://localhost:3000/debug/clear-price-cache
```

---

## 📊 Monitorar Logs

```bash
# Watched Games
[WatchedGamesJob] 🎮 Iniciando verificação...
[WatchedGamesJob] Verificando 50 usuários ativos...
[WatchedGamesJob] ✅ Notificação enviada: God of War
[WatchedGamesJob] ✅ Concluído! Jogos verificados: 400, Notificações enviadas: 12

# Daily Offer
[DailyOfferJob] 🌅 Trigger às 12h (meio-dia) - executando...
[DailyOfferJob] Oferta selecionada: Elden Ring - 60% OFF
[DailyOfferJob] ✅ Concluído! Enviadas: 148, Erros: 2
```

---

## 🐛 Troubleshooting

**Não recebe notificações?**
1. Verificar push token: `GET /users`
2. Verificar favoritos: `GET /favorites`
3. Ver logs do backend
4. Testar manual: `POST /debug/test-watched-games`

**Job não rodando?**
- Verificar se backend iniciou: buscar no log `[WatchedGamesJob] ✅ Job iniciado`
- Horários: 00:00, 06:00, 12:00, 18:00 (horário de Brasília)

---

## 📖 Documentação Completa

- `NOTIFICATION_ARCHITECTURE.md` - Visão geral completa
- `WATCHED_GAMES_NOTIFICATIONS.md` - Detalhes técnicos
- `WATCHED_GAMES_IMPLEMENTATION_SUMMARY.md` - O que foi implementado

---

## ✅ Checklist Rápido

### Backend
- [x] Jobs registrados
- [x] favoritesCache exportado
- [x] Expo Push configurado
- [x] Debug endpoints criados

### Mobile
- [x] Push token registrado
- [x] deviceId persistente
- [x] Favoritos sincronizando
- [x] Notificações locais desabilitadas

### Testes
- [ ] Adicionar jogo aos favoritos
- [ ] Executar teste manual
- [ ] Confirmar recebimento (app fechado)
- [ ] Verificar histórico

---

**Sistema pronto para uso! 🚀**
