import fs from 'fs'

export function loadJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as T
    }
  } catch (e) {
    console.warn('fsStore load error:', e)
  }
  return defaultValue
}

export function saveJson<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.warn('fsStore save error:', e)
  }
}