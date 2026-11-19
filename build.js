/**
 * Script de Build da extensão TextSwitch.
 * Copia os arquivos de src/ para dist/, validando a integridade do manifesto e assets.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('⚡ Iniciando build da extensão TextSwitch...');

// Limpa e recria dist/
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

/**
 * Copia diretório recursivamente.
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirSync(SRC_DIR, DIST_DIR);

// Validação do manifest.json
const manifestPath = path.join(DIST_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Erro: manifest.json não encontrado em dist/!');
  process.exit(1);
}

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`✓ Manifesto validado: ${manifest.name} v${manifest.version}`);

  // Verifica arquivos essenciais apontados no manifesto
  const requiredFiles = [
    manifest.options_page,
    manifest.action?.default_popup,
    ...(manifest.content_scripts?.[0]?.js || []),
    ...(manifest.icons ? Object.values(manifest.icons) : [])
  ].filter(Boolean);

  for (const relFile of requiredFiles) {
    const fullPath = path.join(DIST_DIR, relFile);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Aviso: Arquivo referenciado no manifesto não foi encontrado: ${relFile}`);
    } else {
      console.log(`  ✓ Verificado: ${relFile}`);
    }
  }
} catch (err) {
  console.error('❌ Erro ao analisar manifest.json:', err.message);
  process.exit(1);
}

console.log('\n✅ Build concluído com sucesso em: dist/');
console.log('👉 Carregue a pasta "dist" no Chrome (chrome://extensions -> Carregar sem compactação).');
