import { steamAdapter } from '../adapters/steam.adapter.js'
import { upsertOffersAndNotify } from '../services/offers.service.js'

export async function runUpdateAllStores() {
  console.log('🔄 Iniciando atualização de todas as lojas...')
  try {
    const steam = await steamAdapter.fetchTrending()
    console.log(`📊 ${steam.length} ofertas obtidas da Steam`)
    
    if (steam.length === 0) {
      console.warn('⚠️ Nenhuma oferta obtida da Steam!')
      return
    }
    
    await upsertOffersAndNotify(steam)
    console.log('✅ Atualização de todas as lojas concluída')
  } catch (error) {
    console.error('❌ Erro durante atualização de lojas:', error)
  }
}
