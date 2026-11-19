const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'docs', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Carrega templates de exemplo
const sampleData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'examples', 'text-blaze-sample.json'), 'utf8'));
const templatesModule = require(path.join(ROOT_DIR, 'src', 'shared', 'templates.js'));
const sampleTemplates = templatesModule.normalizeImportedTemplates(sampleData);

// Lê arquivos fonte
const optionsHtml = fs.readFileSync(path.join(ROOT_DIR, 'src', 'options', 'options.html'), 'utf8');
const optionsCss = fs.readFileSync(path.join(ROOT_DIR, 'src', 'options', 'options.css'), 'utf8');
const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.css'), 'utf8');
const templatesJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'shared', 'templates.js'), 'utf8');
const storageJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'shared', 'storage.js'), 'utf8');
const optionsJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'options', 'options.js'), 'utf8');
const popupJs = fs.readFileSync(path.join(ROOT_DIR, 'src', 'popup', 'popup.js'), 'utf8');

const TMP_DIR = path.join(ROOT_DIR, 'docs', '.tmp_shots');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function takeShot(htmlContent, outFilename, width, height, virtualTime = 2000) {
  const tmpFile = path.join(TMP_DIR, `temp_${path.basename(outFilename, '.png')}.html`);
  fs.writeFileSync(tmpFile, htmlContent, 'utf8');
  const outFile = path.join(SCREENSHOTS_DIR, outFilename);
  const fileUrl = 'file:///' + tmpFile.replace(/\\/g, '/');

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${virtualTime}`,
    `--screenshot=${outFile}`,
    fileUrl
  ];

  execFileSync(CHROME_PATH, args, { stdio: 'ignore' });
  console.log(`✓ Gerado: docs/screenshots/${outFilename}`);
}

// 1. Dashboard de Templates com dados reais de exemplo
const baseInjectedStorage = `
<script>
  localStorage.setItem('textswitch_templates', JSON.stringify(${JSON.stringify(sampleTemplates)}));
</script>
`;

// Prepara HTML para Options
function createOptionsPage(customScript = '') {
  return optionsHtml
    .replace('<link rel="stylesheet" href="options.css">', `<style>${optionsCss}</style>`)
    .replace('<img src="../icons/icon-48.png"', `<img src="file:///${path.join(ROOT_DIR, 'src', 'icons', 'icon-48.png').replace(/\\/g, '/')}"`)
    .replace('<script src="../shared/templates.js"></script>', `<script>${templatesJs}</script>${baseInjectedStorage}`)
    .replace('<script src="../shared/storage.js"></script>', `<script>${storageJs}</script>`)
    .replace('<script src="options.js"></script>', `<script>${optionsJs}\n${customScript}</script>`);
}

// 1. Dashboard principal
takeShot(createOptionsPage(), 'dashboard-templates.png', 1280, 820);

// 2. Modal de Criação / Edição aberto com Construtor de Menu
const openModalScript = `
setTimeout(() => {
  openEditor();
  const btn = document.getElementById('btnOpenMenuBuilder');
  if (btn) btn.click();
  document.getElementById('titleInput').value = 'Confirmação de Atendimento';
  document.getElementById('shortcutInput').value = '/atendimento';
  document.getElementById('menuNameInput').value = 'Turno';
  document.getElementById('menuOptionsInput').value = 'Manhã (09h às 12h), Tarde (14h às 18h)';
  document.getElementById('textInput').value = 'Olá {formtext: Nome}! Confirmamos seu atendimento em {data} no turno ';
}, 300);
`;
takeShot(createOptionsPage(openModalScript), 'editor-variables.png', 1280, 850, 3000);

// 3. Aba Como Funciona
const guideTabScript = `
setTimeout(() => {
  const guideBtn = document.querySelector('.nav-item[data-tab="tab-guide"]');
  if (guideBtn) guideBtn.click();
}, 200);
`;
takeShot(createOptionsPage(guideTabScript), 'how-it-works.png', 1280, 850, 2500);

// 4. Aba Privacidade & Open Source
const privacyTabScript = `
setTimeout(() => {
  const privBtn = document.querySelector('.nav-item[data-tab="tab-privacy"]');
  if (privBtn) privBtn.click();
}, 200);
`;
takeShot(createOptionsPage(privacyTabScript), 'privacy-local.png', 1280, 850, 2500);

// 5. Popup View
const popupInjected = popupHtml
  .replace('<link rel="stylesheet" href="popup.css">', `<style>${popupCss}</style>`)
  .replace('<img src="../icons/icon-32.png"', `<img src="file:///${path.join(ROOT_DIR, 'src', 'icons', 'icon-32.png').replace(/\\/g, '/')}"`)
  .replace('<script src="../shared/templates.js"></script>', `<script>${templatesJs}</script>${baseInjectedStorage}`)
  .replace('<script src="../shared/storage.js"></script>', `<script>${storageJs}</script>`)
  .replace('<script src="popup.js"></script>', `<script>${popupJs}</script>`);

takeShot(popupInjected, 'popup-view.png', 440, 600, 2500);

// Limpeza temporária
fs.rmSync(TMP_DIR, { recursive: true, force: true });
console.log('Todas as screenshots foram geradas com sucesso!');
