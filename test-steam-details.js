/**
 * Teste rápido: Verifica se fetchAppDetails está retornando dados oficiais da Steam
 */

async function testSteamDetails() {
  console.log('🧪 Testando busca de detalhes da Steam...\n')
  
  // Testar com um jogo conhecido (The Witcher 3)
  const testAppId = '292030' // The Witcher 3
  
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${testAppId}&cc=BR&l=pt-BR`)
    const data = await response.json()
    const gameData = data[testAppId]?.data
    
    if (!gameData) {
      console.log('❌ Jogo não encontrado')
      return
    }
    
    console.log('📊 Dados retornados:')
    console.log('- Título:', gameData.name)
    console.log('- Idade mínima (required_age):', gameData.required_age)
    console.log('- Content Descriptors:', gameData.content_descriptors)
    console.log('- Gêneros:', gameData.genres?.map(g => g.description))
    console.log('- Categorias:', gameData.categories?.map(c => c.description))
    console.log('- Mature Content:', gameData.mature_content_description)
    
    // Verificar se seria bloqueado
    const requiredAge = gameData.required_age || 0
    const hasAdultContent = requiredAge >= 18
    
    console.log('\n🔍 Análise NSFW Shield:')
    console.log('- required_age >= 18?', hasAdultContent)
    console.log('- Deveria ser bloqueado?', hasAdultContent ? '✅ SIM' : '❌ NÃO')
    
  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

testSteamDetails()
