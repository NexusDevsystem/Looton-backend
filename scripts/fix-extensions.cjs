// scripts/fix-extensions.cjs
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

function fixExtensions(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixExtensions(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Substitui imports e requires relativos para adicionar extensão .js
      content = content.replace(
        /(from\s+["'])(\.+\/[^"']*)(["'])/g,
        (match, before, importPath, after) => {
          // Verificar se já tem extensão
          if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.endsWith('.node')) {
            return match;
          }
          
          // Verificar se é um import relativo (não é node_modules ou URL externa)
          if (importPath.includes('node_modules') || importPath.startsWith('http') || importPath.startsWith('https')) {
            return match;
          }
          
          // Adiciona .js para imports relativos
          return `${before}${importPath}.js${after}`;
        }
      );
      
      // Faz o mesmo para requires
      content = content.replace(
        /(require\(\s*["'])(\.+\/[^"']*)(["'])/g,
        (match, before, importPath, after) => {
          if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.endsWith('.node')) {
            return match;
          }
          
          if (importPath.includes('node_modules') || importPath.startsWith('http') || importPath.startsWith('https')) {
            return match;
          }
          
          return `${before}${importPath}.js${after}`;
        }
      );
      
      fs.writeFileSync(filePath, content);
    }
  }
}

// Executa a correção nos arquivos compilados
if (fs.existsSync(distDir)) {
  fixExtensions(distDir);
  console.log('Extensões .js adicionadas aos imports relativos em dist/');
} else {
  console.log('Pasta dist/ não encontrada. Execute tsc primeiro.');
}