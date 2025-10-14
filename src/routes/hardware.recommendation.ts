import { z } from 'zod';
import { TB_HARDWARE_COMPONENTS, getHardwareRecommendationsForGame } from '../services/terabyte.hardware';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

// Helper: try to fetch Steam app details and extract pc_requirements.minimum/recommended
async function fetchSteamRequirements(appId: string): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese`, {}, 10000); // 10 segundos
    const data = await resp.json();
    if (data && data[appId] && data[appId].success && data[appId].data) {
      const steamData = data[appId].data;
      if (steamData.pc_requirements) {
        // Prefer minimum requirements if present
        const pc = steamData.pc_requirements;
        if (typeof pc.minimum === 'string' && pc.minimum.trim().length > 0) return pc.minimum;
        if (typeof pc.recommended === 'string' && pc.recommended.trim().length > 0) return pc.recommended;
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// Função para obter hardware recomendado com base nos requisitos do jogo
function getHardwareRecommendations(requirements: string, gameName: string): any[] {
  // Usar a função que analisa os requisitos e retorna componentes recomendados
  return getHardwareRecommendationsForGame(requirements, gameName);
}

export default async function hardwareRecommendationRoutes(app: any) {
  // Rota para obter hardware recomendado para um jogo específico
  app.post('/games/:gameId/recommended-hardware', async (req: any, res: any) => {
    try {
      const { gameId } = req.params as { gameId: string };
      const { requirements, gameName } = req.body as { requirements?: any; gameName?: string };
      
      // Validar o parâmetro gameId
      const parsedGameId = parseInt(gameId);
      if (isNaN(parsedGameId)) {
        return res.status(400).send({ 
          error: 'ID do jogo inválido',
          message: 'O ID do jogo deve ser um número'
        });
      }
      
      // Se não tivermos requisitos no body, tentar obter a partir da Steam pelo gameId
      let recommendations = [];
      let resolvedRequirements = requirements;
      if (!resolvedRequirements) {
        const steamReq = await fetchSteamRequirements(String(gameId));
        if (steamReq) resolvedRequirements = steamReq;
      }

      if (resolvedRequirements) {
        // Obter recomendações de hardware com base nos requisitos da Steam ou enviados
        recommendations = getHardwareRecommendations(resolvedRequirements, gameName || `Jogo ${gameId}`);
      } else {
        // Retornar uma seleção aleatória de componentes populares
        const shuffled = [...TB_HARDWARE_COMPONENTS].sort(() => 0.5 - Math.random());
        recommendations = shuffled.slice(0, 6);
      }
      
      // Try to enrich recommendations with full product data from TB_HARDWARE_COMPONENTS
      const enriched = recommendations.map((r: any) => {
        // If it's already a full TB component, return as-is
        if (r.url || r.imageUrl) return r

        // Try to find by id first
        let found = TB_HARDWARE_COMPONENTS.find(c => c.id === r.id)
        if (!found) {
          // fallback: match by name substring and category
          const name = (r.name || '').toLowerCase()
          found = TB_HARDWARE_COMPONENTS.find(c => (c.name || '').toLowerCase().includes(name) || (r.category && c.category === r.category))
        }

        return found ? found : r
      })

      return res.send({
        gameAppId: parsedGameId,
        gameName: gameName || `Jogo ${gameId}`,
        recommendedHardware: enriched
      });
    } catch (error) {
      console.error('Erro ao obter hardware recomendado:', error);
      return res.status(500).send({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro ao obter as recomendações de hardware'
      });
    }
  });
  
  // Rota para obter hardware recomendado diretamente pelo ID do jogo
  app.get('/games/:gameId/recommended-hardware', async (req: any, res: any) => {
    try {
      const { gameId } = req.params as { gameId: string };
      
      // Validar o parâmetro gameId
      const parsedGameId = parseInt(gameId);
      if (isNaN(parsedGameId)) {
        return res.status(400).send({ 
          error: 'ID do jogo inválido',
          message: 'O ID do jogo deve ser um número'
        });
      }
      
      // Tentar usar requisitos da Steam antes de devolver itens aleatórios
      let recommendations = [];
      const steamReq = await fetchSteamRequirements(String(gameId));
      if (steamReq) {
        recommendations = getHardwareRecommendations(steamReq, `Jogo ${gameId}`);
      }

      if (!recommendations || recommendations.length === 0) {
        const shuffled = [...TB_HARDWARE_COMPONENTS].sort(() => 0.5 - Math.random());
        recommendations = shuffled.slice(0, 6);
      }
      
      return res.send({
        gameAppId: parsedGameId,
        gameName: `Jogo ${gameId}`,
        recommendedHardware: recommendations
      });
    } catch (error) {
      console.error('Erro ao obter hardware recomendado:', error);
      return res.status(500).send({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro ao obter as recomendações de hardware'
      });
    }
  });
}