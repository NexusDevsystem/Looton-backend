// Test script to simulate the /search endpoint response
// This shows what the frontend should receive after our fixes

async function testSearchEndpoint() {
  try {
    console.log('🔍 Testing search endpoint for "wrc"...\n');
    
    // Simulate the Steam API storesearch response
    const mockSteamStoreResponse = {
      items: [
        {
          id: 1446780,
          name: "WRC Generations - The FIA WRC Official Game",
          tiny_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1446780/capsule_184x69.jpg"
        },
        {
          id: 1532930, 
          name: "WRC 10 FIA World Rally Championship",
          tiny_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1532930/capsule_184x69.jpg"
        }
      ]
    };

    // Simulate the enriched Steam API appdetails response for each game
    const mockEnrichedResponses = [
      {
        id: "app:1446780",
        kind: "game",
        title: "WRC Generations - The FIA WRC Official Game",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1446780/header_292x136.jpg",
        currency: "BRL",
        priceOriginalCents: 14999, // R$ 149.99 in centavos
        priceFinalCents: 1499,     // R$ 14.99 in centavos (90% discount)
        discountPct: 90
      },
      {
        id: "app:1532930",
        kind: "game", 
        title: "WRC 10 FIA World Rally Championship",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1532930/header_292x136.jpg",
        currency: "BRL",
        priceOriginalCents: 10999, // R$ 109.99 in centavos  
        priceFinalCents: 1099,     // R$ 10.99 in centavos (90% discount)
        discountPct: 90
      }
    ];

    console.log('📋 Expected /search endpoint response:');
    console.log(JSON.stringify(mockEnrichedResponses, null, 2));
    
    console.log('\n🎯 Frontend processing (after our fixes):');
    
    // Simulate how the frontend processes this data after our fixes
    const processedForFrontend = mockEnrichedResponses.map(item => {
      const appId = item.id.replace('app:', ''); // Extract "1446780" from "app:1446780"
      const priceInReais = (item.priceFinalCents || 0) / 100; // Convert centavos to reais
      const originalPriceInReais = (item.priceOriginalCents || 0) / 100;
      
      return {
        appId: appId,
        title: item.title,
        coverUrl: item.image, // Using 'image' field from backend
        priceFinal: priceInReais,
        priceBase: originalPriceInReais,
        discountPct: item.discountPct,
        url: `https://store.steampowered.com/app/${appId}/`
      };
    });
    
    console.log('Frontend will receive:');
    processedForFrontend.forEach(game => {
      console.log(`
🎮 ${game.title}
   ID: ${game.appId}
   Price: R$ ${game.priceFinal.toFixed(2)} (was R$ ${game.priceBase.toFixed(2)})
   Discount: ${game.discountPct}%
   Image: ${game.coverUrl ? '✅ Available' : '❌ Missing'}
   URL: ${game.url}
`);
    });

    console.log('✅ The fixes should resolve:');
    console.log('  - appId extraction from "app:123" format');
    console.log('  - Price conversion from centavos to reais');  
    console.log('  - Image field mapping (image -> coverUrl)');
    console.log('  - No more "R$ 1.099,00" display errors');
    console.log('  - Images will show in search results');
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

testSearchEndpoint();