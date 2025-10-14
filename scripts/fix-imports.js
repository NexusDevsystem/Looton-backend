import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

async function fixImports(dir) {
  const files = await readdir(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const fileStat = await stat(filePath);
    
    if (fileStat.isDirectory()) {
      await fixImports(filePath); // Recursively process subdirectories
    } else if (file.endsWith('.js')) {
      let content = await readFile(filePath, 'utf8');
      
      // Replace relative imports with .js extension
      content = content.replace(
        /from\s+['"](\.{1,2}\/[^'"]+?)['"]/g,
        (match, path) => {
          // Add .js extension to relative imports if they don't already have an extension
          if (!/\.(js|ts|json|mjs|cjs)$/.test(path)) {
            return `from '${path}.js'`;
          }
          return match;
        }
      );
      
      await writeFile(filePath, content, 'utf8');
      console.log(`Fixed imports in ${filePath}`);
    }
  }
}

// Start the process in the dist directory
const distDir = './dist';
fixImports(distDir)
  .then(() => console.log('Import fixing completed!'))
  .catch(err => console.error('Error fixing imports:', err));