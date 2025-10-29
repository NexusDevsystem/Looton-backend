import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  USE_REDIS: z.coerce.boolean().default(false),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_REQUIRE_NOEVICTION: z.coerce.boolean().default(false),
  CURRENCY_BASE: z.string().default('BRL'),
  CURRENCY_REFRESH_CRON: z.string().default('0 3 * * *'),
  DEALS_REFRESH_CRON: z.string().default('*/20 * * * *'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  USE_MOCK_ADAPTERS: z.coerce.boolean().default(true),
  // Curation config (no DB)
  CURATION_CC: z.string().default('BR'),
  CURATION_LANG: z.string().default('portuguese'),
  CURATION_WINDOW_HOURS: z.coerce.number().default(24),
  CURATION_MIN_DISCOUNT: z.coerce.number().default(20),
  CURATION_ROTATION_COOLDOWN_HOURS: z.coerce.number().default(72),
  CURATION_FEED_SIZE: z.coerce.number().default(30),
  CURATION_CRON: z.string().default('*/30 * * * *'),
  ROTATION_FILE: z.string().default('.rotation_memory.json'),
  CACHE_TTL_SECONDS: z.coerce.number().default(900),
  OFFERS_EXPIRATION_DAYS: z.coerce.number().default(7),
  OFFERS_CLEANUP_CRON: z.string().default('0 */6 * * *'),
  // PC Hardware deals (no DB)
  PC_CUR_MIN_DISCOUNT: z.coerce.number().default(5),
  PC_CUR_ROTATION_COOLDOWN_HOURS: z.coerce.number().default(72),
  PC_CUR_FEED_SIZE: z.coerce.number().default(40),
  PC_CUR_CRON: z.string().default('*/30 * * * *'),
  PC_ROTATION_FILE: z.string().default('.pc_rotation.json'),
  PC_CACHE_TTL_SECONDS: z.coerce.number().default(900),
  // Full-mode caching (raw connectors results) TTL in seconds
  PC_FULL_CACHE_TTL_SECONDS: z.coerce.number().default(1800),
  // PC filtering: keep only computer parts and peripherals
  // Comma-separated keyword lists (case-insensitive, accent-insensitive)
  PC_USE_KEYWORD_FILTER: z.coerce.boolean().default(true),
  PC_ALLOW_KEYWORDS: z
    .string()
    .default(
      [
        // Components
        'cpu', 'processador', 'ryzen', 'intel', 'i3', 'i5', 'i7', 'i9', 'am4', 'am5', 'lga',
        'gpu', 'placa de video', 'placa de vídeo', 'rtx', 'gtx', 'radeon', 'rx',
        'placa-mae', 'placa mãe', 'placa mae', 'motherboard', 'b550', 'b650', 'x670', 'z790', 'b760',
        'memoria', 'memória', 'ram', 'ddr3', 'ddr4', 'ddr5',
        'ssd', 'nvme', 'm.2', 'hd', 'hdd', 'disco', 'armazenamento',
        'gabinete', 'case pc', 'fonte', 'psu', 'cooler', 'watercooler', 'air cooler', 'ventoinha', 'fan', 'dissipador',
        // Peripherals
        'monitor', 'teclado', 'mouse', 'headset', 'fone', 'microfone', 'mic', 'webcam', 'mousepad', 'placa de captura', 'capture card',
        'controlador', 'controle', 'soundbar gamer', 'speaker gamer', 'placa de som',
        // Networking/others frequently para PC
        'roteador', 'switch gigabit', 'placa de rede'
      ].join(',')
    ),
  PC_BLOCK_KEYWORDS: z
    .string()
    .default(
      [
        'airfryer', 'air fryer', 'fritadeira', 'panela', 'liquidificador', 'cafeteira', 'micro-ondas', 'microondas', 'forno', 'fogao', 'fogão',
        'geladeira', 'adega', 'ar condicionado', 'climatizador', 'ventilador', 'secador', 'lava e seca', 'maquina de lavar', 'máquina de lavar',
        'batedeira', 'espremedor', 'cooktop', 'exaustor', 'coifa', 'purificador', 'umidificador',
        'tv', 'smart tv', 'smart-tv', 'televisao', 'televisão',
        'celular', 'smartphone', 'tablet', 'notebook', 'laptop', // notebooks podem aparecer; caso queira incluir remova daqui
        'cama', 'colchao', 'colchão', 'sofa', 'sofá', 'tapete', 'mesa', 'guarda-roupa', 'armario', 'armário',
        'brinquedo', 'roupa', 'perfume'
      ].join(',')
    ),
  // PC store category URLs (page 1 and optional page 2)
  TBT_CATEGORY_URL: z.string().default('https://www.terabyteshop.com.br/promocoes?pagina=1'),
  TBT_CATEGORY_URL_2: z.string().default('https://www.terabyteshop.com.br/promocoes?pagina=2'),
  PCH_CATEGORY_URL: z.string().default('https://www.pichau.com.br/hardware?sort=promotion&page=1'),
  PCH_CATEGORY_URL_2: z.string().default('https://www.pichau.com.br/hardware?sort=promotion&page=2'),
  KABUM_CATEGORY_URL: z.string().default('https://www.kabum.com.br/produtos?pagina=1&ordem=5&limite=24'),
  KABUM_CATEGORY_URL_2: z.string().default('https://www.kabum.com.br/produtos?pagina=2&ordem=5&limite=24'),
  // Terabyte deep crawl options (to fetch more than the first pages)
  TBT_MAX_PAGES: z.coerce.number().default(20),
  // Comma-separated seed URLs; if they contain ?pagina=, we'll iterate 1..TBT_MAX_PAGES
  TBT_DEEP_SEEDS: z.string().default(''),
  // Terabyte search URL template. Use {q} placeholder for query. If it contains ?pagina=, we'll iterate 1..TBT_SEARCH_MAX_PAGES
  TBT_SEARCH_URL: z.string().default('https://www.terabyteshop.com.br/busca?str={q}&pagina=1'),
  TBT_SEARCH_MAX_PAGES: z.coerce.number().default(3),
  // Optional cookies to bypass anti-bot (paste full Cookie header value captured from a real browser session)
  PCH_COOKIE: z.string().default(''),
  TBT_COOKIE: z.string().default(''),
  KABUM_COOKIE: z.string().default('')
})

export const env = envSchema.parse(process.env)