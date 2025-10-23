const fs = require('fs');
const path = require('path');

// Função para adicionar extensão .js aos imports nos arquivos JS
function addJsExtensionToImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Expressão regular para encontrar imports do projeto (relativos começando com .)
  const importRegex = /(from\s+['"])(\.[^'"]*?)(['"])/g;
  
  let newContent = content;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const start = match[1];
    const modulePath = match[2];
    const end = match[3];
    
    // Verificar se o caminho NÃO termina com extensão .js/.ts/.json e é um caminho relativo
    if (!/\.(js|ts|json)$/.test(modulePath) && modulePath.startsWith('.')) {
      // Substituir o import adicionando .js
      const newImport = `${start}${modulePath}.js${end}`;
      newContent = newContent.replace(fullMatch, newImport);
    }
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Atualizado:', filePath);
  }
}

// Processar todos os arquivos JS no diretório dist
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js')) {
      addJsExtensionToImports(fullPath);
    }
  }
}

processDirectory('./dist');
console.log('Concluído!');