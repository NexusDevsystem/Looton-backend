# 🧪 Teste de Notificações - GUIA RÁPIDO

## 📱 Como Testar Notificações no Android

### **Passo 1: Obter o Push Token do App**

No mobile, o push token é gerado automaticamente quando você abre o app. Para ver o token:

1. Abra o app Looton no seu Android
2. O token aparece no console do app
3. Copie o token que parece: `ExponentPushToken[xxxxxxxxxxxxxx]`

**OU use o endpoint para registrar:**

```powershell
# Registrar usuário e obter confirmação
Invoke-RestMethod -Uri "http://192.168.1.216:3000/users" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"userId":"meu_celular","pushToken":"SEU_TOKEN_AQUI"}'
```

---

### **Passo 2: Enviar Notificação de Teste**

**OPÇÃO 1 - Simples (só precisa do token):**

```powershell
Invoke-RestMethod -Uri "http://192.168.1.216:3000/test-notification-simple" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"token":"SEU_TOKEN_AQUI"}'
```

**OPÇÃO 2 - Personalizada:**

```powershell
$body = @{
    pushToken = "SEU_TOKEN_AQUI"
    title = "🎮 Teste Looton"
    body = "Esta é uma notificação de teste!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://192.168.1.216:3000/test-notification" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

### **Passo 3: Ver a Notificação no Android**

✅ A notificação deve aparecer na barra de notificações do Android!

---

## 🔥 Exemplo Completo (Copy & Paste)

```powershell
# Substitua XXXXX pelo seu token real
$token = "ExponentPushToken[XXXXXXXXXXXXXXXXXXXXX]"

# Enviar notificação
Invoke-RestMethod -Uri "http://192.168.1.216:3000/test-notification-simple" `
    -Method POST `
    -ContentType "application/json" `
    -Body "{`"token`":`"$token`"}"
```

---

## 🐛 Troubleshooting

### **Notificação não aparece?**

1. ✓ Permissão de notificações concedida no app?
2. ✓ Token está correto? (começa com `ExponentPushToken[`)
3. ✓ App está em desenvolvimento? (use `expo start`)
4. ✓ Celular está na mesma rede?

### **Ver logs do servidor:**

O servidor mostra se a notificação foi enviada:
```
📤 Enviando notificação de teste...
✅ Notificação enviada com sucesso!
```

### **Token de exemplo (FAKE - não funciona):**

```
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```

Você precisa do token REAL do seu celular!

---

## 📋 Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/test-notification` | POST | Envia notificação personalizada |
| `/test-notification-simple` | POST | Envia notificação rápida (só token) |
| `/test-notification-info` | GET | Informações sobre como testar |

---

## ✅ Pronto!

Agora é só copiar seu token do app e testar! 🎉
