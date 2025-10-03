import { env } from './src/env.js'
import * as terabyte from './src/services/pc/terabyte.js'

async function testPcDeals() {
  console.log('Testing PC deals fetching...')
  console.log('Environment variables:')
  console.log('- TBT_CATEGORY_URL:', env.TBT_CATEGORY_URL)
  console.log('- TBT_CATEGORY_URL_2:', env.TBT_CATEGORY_URL_2)
  console.log('- TBT_DEEP_SEEDS:', env.TBT_DEEP_SEEDS)
  console.log('- PC_USE_KEYWORD_FILTER:', env.PC_USE_KEYWORD_FILTER)
  console.log('- PC_CUR_MIN_DISCOUNT:', env.PC_CUR_MIN_DISCOUNT)
  
  try {
    console.log('\nFetching deals from Terabyte with limit 10...')
    const deals = await terabyte.fetchDeals({ limit: 10 })
    console.log(`Found ${deals.length} deals`)
    
    if (deals.length > 0) {
      console.log('\nFirst deal:')
      console.log('- Title:', deals[0].title)
      console.log('- Store:', deals[0].store)
      console.log('- Price Final:', deals[0].priceFinalCents)
      console.log('- Price Base:', deals[0].priceBaseCents)
      console.log('- Discount:', deals[0].discountPct)
      console.log('- URL:', deals[0].url)
      console.log('- Category:', deals[0].category)
      console.log('- Available:', deals[0].availability)
    } else {
      console.log('No deals found!')
    }
  } catch (error) {
    console.error('Error fetching deals:', error)
  }
}

testPcDeals()