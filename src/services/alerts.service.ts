export async function registerUser(input: { email: string; pushToken?: string }) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  return {
    _doc: {
      email: input.email,
      pushToken: input.pushToken,
      _id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
  }
}

export async function createAlert(input: {
  userId: string
  query?: string
  gameId?: string
  maxPrice: number
  stores: string[]
  isActive?: boolean
}) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  return {
    _doc: {
      userId: input.userId,
      query: input.query,
      gameId: input.gameId,
      maxPrice: input.maxPrice,
      stores: input.stores,
      isActive: input.isActive ?? true,
      _id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
  }
}

export async function getAlertsByUser(userId: string) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  return []
}

export async function deleteAlert(id: string) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  return
}

export async function testNotify({ token, title, body }: { token: string; title: string; body: string }) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria a função sendPush real
  console.log(`Test notification: ${title} - ${body}`)
  return true
}

export async function checkAndNotify(gameId: string, offer: { priceFinal: number; discountPct: number; storeId: string }) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  return
}