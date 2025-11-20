import axios from 'axios'
import crypto from 'crypto'
import { logger } from '../../utils/logger.js'
import type { PcOffer } from './types.js'

// Credenciais da API do AliExpress
const APP_KEY = process.env.ALIEXPRESS_APP_KEY || '521748'
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || 'sDO5sEcUDLu3o0mvwtshpFvoY63dopih'
const API_BASE_URL = 'https://api-sg.aliexpress.com/sync'

// Categorias de computador e escritório no AliExpress
const COMPUTER_CATEGORIES = [
  '70801', // Computer Components
  '70802', // Computer Peripherals
  '200001075', // Laptops
  '200001076', // Tablets
  '200216144', // Graphics Cards
  '200216146', // Motherboards
  '200216147', // Memory (RAM)
  '200216148', // Storage (SSD/HDD)
  '200216149', // CPUs
  '200216150', // Power Supplies
  '200216151', // Cases
  '200216152', // Cooling
  '3', // Computer & Office
  '26', // Office Electronics
]

interface AliExpressProduct {
  productId: string
  productTitle: string
  productImage: string
  originalPrice: {
    min: string
    max: string
  }
  salePrice: {
    min: string
    max: string
  }
  discount: number
  productUrl: string
  categoryId: string
  categoryName: string
  shop: {
    shopName: string
    shopUrl: string
  }
}

interface AliExpressResponse {
  result: {
    products: {
      product: AliExpressProduct[]
    }
    totalResults: number
  }
  code: number
  message: string
}

/**
 * Gera assinatura para autenticação na API do AliExpress
 */
function generateSign(params: Record<string, any>, secret: string): string {
  // Ordenar parâmetros alfabeticamente
  const sorted = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('')

  // Criar hash HMAC-MD5
  const sign = crypto
    .createHmac('md5', secret)
    .update(sorted)
    .digest('hex')
    .toUpperCase()

  return sign
}

/**
 * Buscar produtos do AliExpress por categoria
 */
export async function fetchDeals(opts?: { limit?: number; q?: string }): Promise<PcOffer[]> {
  const limit = opts?.limit || 100
  const searchQuery = opts?.q || ''

  try {
    logger.info('🛒 Buscando produtos do AliExpress')

    const results: PcOffer[] = []

    // Se houver query de busca, usar endpoint de busca
    if (searchQuery) {
      const products = await searchProducts(searchQuery, limit)
      results.push(...products)
    } else {
      // Buscar produtos de categorias de computador
      for (const categoryId of COMPUTER_CATEGORIES.slice(0, 3)) { // Primeiras 3 categorias para não sobrecarregar
        try {
          const products = await fetchCategoryProducts(categoryId, Math.floor(limit / 3))
          results.push(...products)

          if (results.length >= limit) break
        } catch (error) {
          logger.warn(`Erro ao buscar categoria ${categoryId}:`, error)
          continue
        }
      }
    }

    logger.info(`✅ AliExpress: ${results.length} produtos encontrados`)
    return results.slice(0, limit)

  } catch (error) {
    logger.error('❌ Erro ao buscar produtos do AliExpress:', error)
    return []
  }
}

/**
 * Buscar produtos por query de busca
 */
async function searchProducts(query: string, limit: number): Promise<PcOffer[]> {
  const timestamp = Date.now().toString()

  const params: Record<string, any> = {
    app_key: APP_KEY,
    method: 'aliexpress.affiliate.productdetail.get',
    timestamp,
    sign_method: 'md5',
    format: 'json',
    v: '2.0',
    keywords: query,
    category_ids: COMPUTER_CATEGORIES.join(','),
    page_size: Math.min(limit, 50),
    target_currency: 'BRL',
    target_language: 'PT',
    ship_to_country: 'BR',
  }

  const sign = generateSign(params, APP_SECRET)
  params.sign = sign

  try {
    const response = await axios.get(API_BASE_URL, {
      params,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (response.data.code !== 0) {
      throw new Error(`AliExpress API Error: ${response.data.message}`)
    }

    return parseProducts(response.data.result?.products?.product || [])
  } catch (error) {
    logger.error('Erro na busca do AliExpress:', error)
    throw error
  }
}

/**
 * Buscar produtos de uma categoria específica
 */
async function fetchCategoryProducts(categoryId: string, limit: number): Promise<PcOffer[]> {
  const timestamp = Date.now().toString()

  const params: Record<string, any> = {
    app_key: APP_KEY,
    method: 'aliexpress.affiliate.category.get',
    timestamp,
    sign_method: 'md5',
    format: 'json',
    v: '2.0',
    category_id: categoryId,
    page_size: Math.min(limit, 50),
    target_currency: 'BRL',
    target_language: 'PT',
    ship_to_country: 'BR',
    sort: 'SALE_PRICE_ASC', // Ordenar por preço
  }

  const sign = generateSign(params, APP_SECRET)
  params.sign = sign

  try {
    const response = await axios.get(API_BASE_URL, {
      params,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (response.data.code !== 0) {
      throw new Error(`AliExpress API Error: ${response.data.message}`)
    }

    return parseProducts(response.data.result?.products?.product || [])
  } catch (error) {
    logger.error(`Erro ao buscar categoria ${categoryId}:`, error)
    return []
  }
}

/**
 * Converter produtos do AliExpress para formato PcOffer
 */
function parseProducts(products: AliExpressProduct[]): PcOffer[] {
  return products
    .filter(product => {
      // Filtrar apenas produtos com desconto
      return product.discount && product.discount > 0
    })
    .map(product => {
      const originalPrice = parseFloat(product.originalPrice?.min || '0')
      const salePrice = parseFloat(product.salePrice?.min || '0')

      // Calcular preços em centavos
      const priceBaseCents = Math.round(originalPrice * 100)
      const priceFinalCents = Math.round(salePrice * 100)

      // Calcular desconto real
      const discountPct = originalPrice > 0
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
        : product.discount || 0

      return {
        store: 'AliExpress',
        title: product.productTitle,
        url: product.productUrl,
        image: product.productImage,
        category: product.categoryName || 'Computador',
        priceBaseCents,
        priceFinalCents,
        discountPct,
        availability: 'in_stock' as const,
        sku: product.productId,
        updatedAt: new Date().toISOString(),
      }
    })
    .filter(offer => {
      // Garantir que temos preços válidos
      return offer.priceFinalCents > 0 && offer.priceBaseCents > 0
    })
}

/**
 * Buscar produtos específicos por termo de busca
 */
export async function fetchSearch(opts: { q: string; limit?: number }): Promise<PcOffer[]> {
  const limit = opts.limit || 50

  try {
    // Adicionar termos relacionados a computador para refinar busca
    const enhancedQuery = `${opts.q} computer hardware`

    return await fetchDeals({ q: enhancedQuery, limit })
  } catch (error) {
    logger.error('Erro na busca do AliExpress:', error)
    return []
  }
}
