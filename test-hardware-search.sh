#!/bin/bash
# Script para testar a busca de hardware por GPU e CPU

echo "🔍 Testando busca de hardware por GPU e CPU..."

# Teste para GPU
echo ""
echo "Teste 1: Buscando por 'GPU'"
curl -X GET "http://localhost:3000/pc-deals?q=gpu&limit=10" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || echo "Erro: jq não encontrado, exibindo resposta bruta:"

# Teste para CPU
echo ""
echo "Teste 2: Buscando por 'CPU'"
curl -X GET "http://localhost:3000/pc-deals?q=cpu&limit=10" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || echo "Erro: jq não encontrado, exibindo resposta bruta:"

# Teste para processador
echo ""
echo "Teste 3: Buscando por 'processador'"
curl -X GET "http://localhost:3000/pc-deals?q=processador&limit=10" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || echo "Erro: jq não encontrado, exibindo resposta bruta:"

# Teste para placa de video
echo ""
echo "Teste 4: Buscando por 'placa de video'"
curl -X GET "http://localhost:3000/pc-deals?q=placa de video&limit=10" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" | jq '.' 2>/dev/null || echo "Erro: jq não encontrado, exibindo resposta bruta:"

echo ""
echo "✅ Testes de busca concluídos"