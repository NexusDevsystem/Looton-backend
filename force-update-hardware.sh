#!/bin/bash
# Script para forçar atualização do feed de hardware

echo "Forçando atualização do feed de hardware..."

# Atualizar os feeds de hardware
curl -X GET "http://localhost:3000/pc-deals?refresh=1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"

echo ""
echo "Feed de hardware atualizado com sucesso!"
echo "A nova curadoria estará disponível em alguns segundos."