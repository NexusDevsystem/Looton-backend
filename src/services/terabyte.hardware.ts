// Componentes de hardware da TerabyteShop
export const TB_HARDWARE_COMPONENTS = [
  // CPUs
  {
    id: 'tb-cpu-001',
    name: 'Processador AMD Ryzen 5 5600X 3.7GHz AM4',
    price: 1199.00,
    originalPrice: 1299.00,
    discountPct: 7.7,
    imageUrl: 'https://media.terabyteshop.com.br/produto/11813/ryzen-5-5600x-box.jpg',
    url: 'https://www.terabyteshop.com.br/produto/11813/processador-amd-ryzen-5-5600x-37ghz-am4',
    category: 'cpu',
    brand: 'AMD',
    specs: '6 núcleos, 12 threads, 3.7GHz Boost, AM4',
    rating: 4.8,
    store: 'TerabyteShop'
  },
  {
    id: 'tb-cpu-002',
    name: 'Processador Intel Core i5-12400F 2.5GHz LGA1700',
    price: 1299.00,
    originalPrice: 1399.00,
    discountPct: 7.1,
    imageUrl: 'https://media.terabyteshop.com.br/produto/13465/core-i5-12400f-box.jpg',
    url: 'https://www.terabyteshop.com.br/produto/13465/processador-intel-core-i5-12400f-25ghz-lga1700',
    category: 'cpu',
    brand: 'Intel',
    specs: '6 núcleos, 12 threads, 2.5GHz Base, LGA1700',
    rating: 4.7,
    store: 'TerabyteShop'
  },
  
  // GPUs
  {
    id: 'tb-gpu-001',
    name: 'Placa de Vídeo RTX 4060 Ti 16GB Gigabyte',
    price: 3199.00,
    originalPrice: 3499.00,
    discountPct: 8.6,
    imageUrl: 'https://media.terabyteshop.com.br/produto/14567/gigabyte-rtx-4060-ti-16gb.jpg',
    url: 'https://www.terabyteshop.com.br/produto/14567/placa-de-video-gigabyte-geforce-rtx-4060-ti-16gb',
    category: 'gpu',
    brand: 'NVIDIA',
    specs: '16GB GDDR6, Ray Tracing, DLSS 3',
    rating: 4.9,
    store: 'TerabyteShop'
  },
  {
    id: 'tb-gpu-002',
    name: 'Placa de Vídeo RX 7600 8GB Asus TUF',
    price: 2399.00,
    originalPrice: 2599.00,
    discountPct: 7.7,
    imageUrl: 'https://media.terabyteshop.com.br/produto/14234/asus-rx-7600-8gb.jpg',
    url: 'https://www.terabyteshop.com.br/produto/14234/placa-de-video-asus-tuf-radeon-rx-7600-8gb',
    category: 'gpu',
    brand: 'AMD',
    specs: '8GB GDDR6, FSR 2, 16GB/s',
    rating: 4.7,
    store: 'TerabyteShop'
  },
  
  // RAM
  {
    id: 'tb-ram-001',
    name: 'Memória Corsair Vengeance LPX 16GB (2x8GB) 3200MHz',
    price: 399.00,
    originalPrice: 449.00,
    discountPct: 11.1,
    imageUrl: 'https://media.terabyteshop.com.br/produto/8765/corsair-vengeance-lpx-16gb-2x8-3200.jpg',
    url: 'https://www.terabyteshop.com.br/produto/8765/memoria-corsair-vengeance-lpx-16gb-(2x8gb)-ddr4-3200mhz-cl16',
    category: 'ram',
    brand: 'Corsair',
    specs: '16GB (2x8GB) DDR4, 3200MHz CL16',
    rating: 4.8,
    store: 'TerabyteShop'
  },
  
  // Storage
  {
    id: 'tb-storage-001',
    name: 'SSD Samsung 980 PRO 1TB NVMe M.2',
    price: 699.00,
    originalPrice: 799.00,
    discountPct: 12.5,
    imageUrl: 'https://media.terabyteshop.com.br/produto/9876/samsung-980-pro-1tb-nvme.jpg',
    url: 'https://www.terabyteshop.com.br/produto/9876/ssd-samsung-980-pro-1tb-nvme-m2',
    category: 'storage',
    brand: 'Samsung',
    specs: '1TB NVMe Gen 4.0, 7000MB/s',
    rating: 4.9,
    store: 'TerabyteShop'
  },
  
  // Motherboards
  {
    id: 'tb-mb-001',
    name: 'Placa-Mãe ASUS B550M-A AM4',
    price: 699.00,
    originalPrice: 799.00,
    discountPct: 12.5,
    imageUrl: 'https://media.terabyteshop.com.br/produto/10234/asus-b550m-a-am4.jpg',
    url: 'https://www.terabyteshop.com.br/produto/10234/placa-mae-asus-prime-b550m-a-am4',
    category: 'mb',
    brand: 'ASUS',
    specs: 'AM4, DDR4, USB 3.2, WiFi',
    rating: 4.7,
    store: 'TerabyteShop'
  },
  
  // PSUs
  {
    id: 'tb-psu-001',
    name: 'Fonte Corsair RM750x 750W 80 Plus Gold Modular',
    price: 799.00,
    originalPrice: 899.00,
    discountPct: 11.1,
    imageUrl: 'https://media.terabyteshop.com.br/produto/7890/corsair-rm750x-750w.jpg',
    url: 'https://www.terabyteshop.com.br/produto/7890/fonte-corsair-rm750x-750w-80-plus-gold-modular',
    category: 'psu',
    brand: 'Corsair',
    specs: '750W, 80 Plus Gold, Modular',
    rating: 4.8,
    store: 'TerabyteShop'
  }
];

// Função para obter componentes recomendados com base nos requisitos mínimos
export const getHardwareRecommendationsForGame = (gameRequirements: string, gameName: string): any[] => {
  // Analisar os requisitos do jogo para determinar componentes recomendados
  const requirements = parseGameRequirements(gameRequirements);
  
  // Selecionar componentes baseados nos requisitos
  const recommendedComponents = [];
  
  // CPU recomendada
  if (requirements.cpu) {
    const cpu = findRecommendedCPU(requirements.cpu);
    if (cpu) recommendedComponents.push(cpu);
  }
  
  // GPU recomendada
  if (requirements.gpu) {
    const gpu = findRecommendedGPU(requirements.gpu);
    if (gpu) recommendedComponents.push(gpu);
  }
  
  // RAM recomendada
  if (requirements.ram) {
    const ram = findRecommendedRAM(requirements.ram);
    if (ram) recommendedComponents.push(ram);
  }
  
  // Storage recomendado
  const storage = findRecommendedStorage();
  if (storage) recommendedComponents.push(storage);
  
  // Placa-mãe recomendada
  const mb = findRecommendedMotherboard();
  if (mb) recommendedComponents.push(mb);
  
  // Fonte recomendada
  const psu = findRecommendedPSU();
  if (psu) recommendedComponents.push(psu);
  
  return recommendedComponents;
};

// Função para analisar os requisitos do jogo
const parseGameRequirements = (requirements: string) => {
  const result: any = {};
  
  // Simplificação para demonstração - em produção seria mais complexa
  if (requirements.toLowerCase().includes('i7') || requirements.toLowerCase().includes('ryzen 7')) {
    result.cpu = 'high';
  } else if (requirements.toLowerCase().includes('i5') || requirements.toLowerCase().includes('ryzen 5')) {
    result.cpu = 'medium';
  } else {
    result.cpu = 'low';
  }
  
  if (requirements.toLowerCase().includes('rtx') || requirements.toLowerCase().includes('radeon rx')) {
    if (requirements.toLowerCase().includes('4090') || requirements.toLowerCase().includes('7900')) {
      result.gpu = 'high';
    } else if (requirements.toLowerCase().includes('4070') || requirements.toLowerCase().includes('7700')) {
      result.gpu = 'medium';
    } else {
      result.gpu = 'low';
    }
  }
  
  if (requirements.toLowerCase().includes('16gb')) {
    result.ram = 'high';
  } else if (requirements.toLowerCase().includes('8gb')) {
    result.ram = 'medium';
  } else {
    result.ram = 'low';
  }
  
  return result;
};

// Funções para encontrar componentes recomendados
const findRecommendedCPU = (level: string) => {
  if (level === 'high') {
    return TB_HARDWARE_COMPONENTS.find(c => c.category === 'cpu' && c.brand === 'AMD' && c.name.includes('5600X'));
  } else if (level === 'medium') {
    return TB_HARDWARE_COMPONENTS.find(c => c.category === 'cpu' && c.brand === 'Intel' && c.name.includes('i5-12400F'));
  }
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'cpu');
};

const findRecommendedGPU = (level: string) => {
  if (level === 'high') {
    return TB_HARDWARE_COMPONENTS.find(c => c.category === 'gpu' && c.brand === 'NVIDIA' && c.name.includes('RTX 4060 Ti'));
  } else if (level === 'medium') {
    return TB_HARDWARE_COMPONENTS.find(c => c.category === 'gpu' && c.brand === 'AMD' && c.name.includes('RX 7600'));
  }
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'gpu');
};

const findRecommendedRAM = (level: string) => {
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'ram');
};

const findRecommendedStorage = () => {
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'storage');
};

const findRecommendedMotherboard = () => {
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'mb');
};

const findRecommendedPSU = () => {
  return TB_HARDWARE_COMPONENTS.find(c => c.category === 'psu');
};

// Note: top-level exports (export const ...) already export these symbols.
// The explicit export block was removed to avoid duplicate export/declaration errors.