const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const templates = require('../src/shared/templates.js');

test('TextSwitch: normalizeShortcut adiciona / para atalhos sem prefixo', () => {
  assert.strictEqual(templates.normalizeShortcut('ola'), '/ola');
  assert.strictEqual(templates.normalizeShortcut('/ola'), '/ola');
  assert.strictEqual(templates.normalizeShortcut('-suporte'), '-suporte');
  assert.strictEqual(templates.normalizeShortcut('  /teste  '), '/teste');
  assert.strictEqual(templates.normalizeShortcut(''), '');
});

test('TextSwitch: escapeHtml sanitiza caracteres perigosos contra XSS', () => {
  assert.strictEqual(templates.escapeHtml('<script>alert("oi")</script>'), '&lt;script&gt;alert(&quot;oi&quot;)&lt;/script&gt;');
  assert.strictEqual(templates.escapeHtml("Pedro & Paulo's"), 'Pedro &amp; Paulo&#039;s');
});

test('TextSwitch: resolveTokens substitui {data}, {hora} e {data_hora}', () => {
  const fixedDate = new Date(2026, 10, 18, 14, 30, 0); // 18/11/2026 14:30
  const template = { dateFormat: 'dd/mm/yyyy', timeFormat: 'hh:mm' };
  const text = 'Hoje é {data} às {hora}. Carimbo: {data_hora}';
  const resolved = templates.resolveTokens(text, template, fixedDate);

  assert.match(resolved, /Hoje é 18\/11\/2026 às 14:30\. Carimbo: 18\/11\/2026 14:30/);
});

test('TextSwitch: parseDynamicFields extrai tags do Text Blaze', () => {
  const text = 'Data: {formdate: \\ DD/MM/YYYY}, Opção: {formmenu: Opção A; default=Opção B; Opção C; name=Periodo} e {formtext: Nome; default=João}';
  const fields = templates.parseDynamicFields(text);

  assert.strictEqual(fields.length, 3);
  assert.strictEqual(fields[0].type, 'formdate');
  assert.strictEqual(fields[0].format, 'DD/MM/YYYY');
  assert.strictEqual(fields[1].type, 'formmenu');
  assert.strictEqual(fields[1].label, 'Periodo');
  assert.strictEqual(fields[1].defaultValue, 'Opção B');
  assert.ok(fields[1].options.includes('Opção A'));
  assert.strictEqual(fields[2].type, 'formtext');
});

test('TextSwitch: findMatchingTemplate seleciona o atalho correto pelo maior comprimento', () => {
  const mockTemplates = [
    { shortcut: '/oi', text: 'Olá!' },
    { shortcut: '/oito', text: 'Número 8' }
  ];

  const match1 = templates.findMatchingTemplate('Eu gosto de /oito', mockTemplates);
  assert.strictEqual(match1?.shortcut, '/oito');

  const match2 = templates.findMatchingTemplate('Olá /oi', mockTemplates);
  assert.strictEqual(match2?.shortcut, '/oi');

  // Não deve disparar se for parte de uma palavra sem separador
  const match3 = templates.findMatchingTemplate('x/oi', mockTemplates);
  assert.strictEqual(match3, null);
});

test('TextSwitch: normalizeImportedTemplates importa com sucesso arquivo modelo com pastas', () => {
  const filePath = path.join(__dirname, '../examples/text-blaze-sample.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const imported = templates.normalizeImportedTemplates(raw);
  assert.strictEqual(imported.length, 7);
  assert.strictEqual(imported.ignoredCount, 0);

  const ola = imported.find(t => t.shortcut === '/ola');
  assert.ok(ola);
  assert.strictEqual(ola.title, 'Boas-vindas Geral');
  assert.match(ola.text, /Seja muito bem-vindo/);

  const agendamento = imported.find(t => t.shortcut === '/agendamento');
  assert.ok(agendamento);
  assert.strictEqual(agendamento.folder, 'Formulários Dinâmicos & Agendamentos');
  assert.match(agendamento.text, /formdate/);
});
