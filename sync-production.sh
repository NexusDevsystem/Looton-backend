#!/bin/bash
# Script para garantir que a produção funcione exatamente como o desenvolvimento
# Execute este script no servidor de produção para atualizar as configurações

echo "Sincronizando configurações de produção com desenvolvimento..."

# 1. Faça backup do .env atual
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backup do .env original criado"
fi

# 2. Copie o arquivo de ambiente sincronizado para .env
cp .env.sync .env
echo "Arquivo .env atualizado com configurações de desenvolvimento"

# 3. Limpe os arquivos de rotação para resetar o histórico e forçar nova curadoria
rm -f .pc_rotation.json
rm -f .rotation_memory.json
echo "Arquivos de histórico de rotação removidos"

# 4. Se estiver usando Redis, limpe o cache (descomente se necessário)
# redis-cli FLUSHALL
# echo "Cache do Redis limpo"

# 5. Reinicie o serviço para aplicar as configurações
# Descomente a linha apropriada para o seu sistema:
# systemctl restart looton-backend
# pm2 restart looton-backend
# pm2 reload all

echo "Configurações de produção atualizadas para igualar desenvolvimento"
echo "Importante: Reinicie o serviço backend para aplicar as mudanças"
echo "Após o restart, aguarde o próximo ciclo de atualização (30 minutos) ou force com:"
echo "curl -X GET http://[seu-servidor]/pc-deals?refresh=1"