import { env } from './src/env.js'
import * as terabyte from './src/services/pc/terabyte.js'
import { getCurrentPcFeed, rebuildPcFeed } from './src/services/pc/aggregate.js'

async function testPcFeed() {
  console.log('Testing PC feed aggregation...')
  
  // Test current feed first
  console.log('\n=== Current PC Feed ===')
  const currentFeed = getCurrentPcFeed()
  console.log(`Current feed has ${currentFeed.items.length} items`)
  console.log('Feed date:', currentFeed.slotDate)
  
  if (currentFeed.items.length > 0) {
    console.log('First item in current feed:')
    console.log('- Title:', currentFeed.items[0].title)
    console.log('- Store:', currentFeed.items[0].store)
    console.log('- Price Final:', currentFeed.items[0].priceFinalCents)
    console.log('- Discount:', currentFeed.items[0].discountPct)
  }
  
  // Test rebuild feed
  console.log('\n=== Rebuilding PC Feed ===')
  try {
    const connectors = [
      () => terabyte.fetchDeals({ limit: 20 })
    ]
    
    const rebuiltFeed = await rebuildPcFeed(connectors)
    console.log(`Rebuilt feed has ${rebuiltFeed.items.length} items`)
    
    if (rebuiltFeed.items.length > 0) {
      console.log('First item in rebuilt feed:')
      console.log('- Title:', rebuiltFeed.items[0].title)
      console.log('- Store:', rebuiltFeed.items[0].store)
      console.log('- Price Final:', rebuiltFeed.items[0].priceFinalCents)
      console.log('- Discount:', rebuiltFeed.items[0].discountPct)
    }
    
    // Check current feed again after rebuild
    console.log('\n=== Current PC Feed After Rebuild ===')
    const newCurrentFeed = getCurrentPcFeed()
    console.log(`Current feed now has ${newCurrentFeed.items.length} items`)
    
  } catch (error) {
    console.error('Error rebuilding PC feed:', error)
  }
}

testPcFeed()