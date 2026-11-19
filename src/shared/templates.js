/**
 * Módulo compartilhado de templates da extensão TextSwitch.
 * Contém funções puras para normalização, formatação, parsing de campos dinâmicos e validação.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    const exports = factory();
    root.TextSwitchTemplates = exports;
    root.AtalhoTemplates = exports; // Compatibilidade retroativa
    if (typeof window !== 'undefined') {
      window.TextSwitchTemplates = exports;
      window.AtalhoTemplates = exports;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_TEMPLATES = [
    {
      id: 'welcome',
      shortcut: '/obrigado',
      title: 'Agradecimento',
      text: 'Obrigado pelo contato! Retorno em breve.',
      dateFormat: 'dd/mm/yyyy',
      timeFormat: 'hh:mm'
    },
    {
      id: 'followup',
      shortcut: '/followup',
      title: 'Follow-up',
      text: 'Olá! Passando para acompanhar nossa conversa. Ficou alguma dúvida?',
      dateFormat: 'dd/mm/yyyy',
      timeFormat: 'hh:mm'
    }
  ];

  /**
   * Gera um UUID v4 compatível entre ambientes.
   */
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'ts-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  };

  /**
   * Sanitiza strings contra XSS para inserção segura em HTML.
   */
  const escapeHtml = (text) => {
    if (text == null) return '';
    return String(text).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#039;';
        default: return char;
      }
    });
  };

  /**
   * Normaliza um atalho, garantindo prefixo seguro (/ ou -) e sem espaços.
   */
  const normalizeShortcut = (shortcut) => {
    const value = String(shortcut || '').trim();
    if (!value) return '';
    if (value.startsWith('/') || value.startsWith('-')) return value;
    return `/${value}`;
  };

  /**
   * Formata datas de acordo com a preferência do template.
   */
  const formatDate = (date = new Date(), format = 'dd/mm/yyyy') => {
    const now = date instanceof Date ? date : new Date(date);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    switch (format) {
      case 'yyyy-mm-dd':
        return `${year}-${month}-${day}`;
      case 'month':
        return now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'dd/mm/yyyy':
      default:
        return `${day}/${month}/${year}`;
    }
  };

  /**
   * Formata horários de acordo com a preferência do template.
   */
  const formatTime = (date = new Date(), format = 'hh:mm') => {
    const now = date instanceof Date ? date : new Date(date);
    const options = format === 'hh:mm:ss'
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      : { hour: '2-digit', minute: '2-digit', hour12: false };
    return now.toLocaleTimeString('pt-BR', options);
  };

  /**
   * Resolve tokens automáticos {data}, {hora} e {data_hora}.
   */
  const resolveTokens = (text, template = {}, now = new Date()) => {
    if (typeof text !== 'string') return '';
    const dateStr = formatDate(now, template.dateFormat);
    const timeStr = formatTime(now, template.timeFormat);

    return text
      .replaceAll('{data}', dateStr)
      .replaceAll('{hora}', timeStr)
      .replaceAll('{data_hora}', `${dateStr} ${timeStr}`);
  };

  /**
   * Analisa campos dinâmicos do estilo Text Blaze presentes no texto.
   * Suporta: {formdate:...}, {formmenu:...}, {formtext:...}, {formparagraph:...}
   */
  const parseDynamicFields = (text) => {
    if (typeof text !== 'string') return [];
    const fields = [];
    const pattern = /\{(formdate|formmenu|formtext|formparagraph):([\s\S]*?)\}/gi;
    let match;

    while ((match = pattern.exec(text))) {
      const type = match[1].toLowerCase();
      const body = match[2].trim();
      const field = { token: match[0], type };

      if (type === 'formdate') {
        const formatMatch = body.match(/\b(DD\/MM\/YYYY|MM\/DD\/YYYY|YYYY-MM-DD)\b/i);
        field.format = formatMatch ? formatMatch[1].toUpperCase() : 'DD/MM/YYYY';
        field.label = 'Data';
      } else {
        const nameMatch = body.match(/(?:^|;)\s*name\s*=\s*([^;]+)(?:;|$)/i);
        const defaultMatch = body.match(/(?:^|;)\s*default\s*=\s*([^;]+)(?:;|$)/i);

        let cleanBody = body
          .replace(/(?:^|;)\s*name\s*=[^;]+/gi, '')
          .replace(/(?:^|;)\s*default\s*=[^;]+/gi, '')
          .replace(/(?:^|;)\s*multiple\s*=\s*(?:yes|no)/gi, '')
          .trim();

        if (type === 'formmenu') {
          field.label = nameMatch ? nameMatch[1].trim() : 'Selecione uma opção';
          const parts = cleanBody.split(';').map(part => part.trim()).filter(Boolean);
          field.options = parts;
          field.defaultValue = defaultMatch ? defaultMatch[1].trim() : (field.options[0] || '');
          if (field.defaultValue && !field.options.includes(field.defaultValue)) {
            field.options.unshift(field.defaultValue);
          }
        } else {
          field.label = nameMatch ? nameMatch[1].trim() : (cleanBody || (type === 'formparagraph' ? 'Observações' : 'Texto'));
          field.defaultValue = defaultMatch ? defaultMatch[1].trim() : '';
        }
      }

      if (!fields.some(item => item.token === field.token)) {
        fields.push(field);
      }
    }

    return fields;
  };

  /**
   * Converte a data selecionada (YYYY-MM-DD de <input type="date">) para o formato desejado.
   */
  const formatSelectedDate = (dateValue, targetFormat) => {
    if (!dateValue) return '';
    const parts = dateValue.split('-');
    if (parts.length !== 3) return dateValue;
    const [year, month, day] = parts;

    if (/MM\/DD\/YYYY/i.test(targetFormat)) return `${month}/${day}/${year}`;
    if (/YYYY-MM-DD/i.test(targetFormat)) return dateValue;
    return `${day}/${month}/${year}`;
  };

  /**
   * Normaliza dados importados de JSON em diferentes formatos (Text Blaze, nativo, listas, objetos).
   */
  const normalizeImportedTemplates = (data) => {
    if (!data) throw new Error('Dados JSON inválidos ou vazios');

    let entries = [];
    if (Array.isArray(data.folders)) {
      // Formato Text Blaze
      entries = data.folders.flatMap(folder => (
        Array.isArray(folder.snippets)
          ? folder.snippets.map(snippet => ({ ...snippet, folder: folder.name || '' }))
          : []
      ));
    } else if (Array.isArray(data)) {
      entries = data;
    } else if (Array.isArray(data.templates)) {
      entries = data.templates;
    } else if (Array.isArray(data.items)) {
      entries = data.items;
    } else if (typeof data === 'object') {
      entries = Object.entries(data).map(([shortcut, text]) => ({ shortcut, text }));
    } else {
      throw new Error('Formato JSON não reconhecido');
    }

    const normalized = [];
    const usedShortcuts = new Set();
    let ignoredCount = 0;

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        ignoredCount++;
        continue;
      }

      const rawShortcut = entry.shortcut ?? entry.short ?? entry.abbreviation ?? entry.macro ?? entry.trigger;
      const shortcut = normalizeShortcut(rawShortcut);
      const text = entry.text ?? entry.body ?? entry.content ?? entry.template;

      if (!shortcut || typeof text !== 'string' || !text.trim()) {
        ignoredCount++;
        continue;
      }

      if (usedShortcuts.has(shortcut)) {
        // Ignora atalhos repetidos para evitar colisões
        continue;
      }
      usedShortcuts.add(shortcut);

      const rawTitle = entry.title ?? entry.name ?? entry.label;
      const title = (typeof rawTitle === 'string' && rawTitle.trim()) ? rawTitle.trim() : shortcut;

      normalized.push({
        id: (typeof entry.id === 'string' && entry.id.trim()) ? entry.id.trim() : generateId(),
        title,
        shortcut,
        text,
        folder: typeof entry.folder === 'string' ? entry.folder : '',
        dateFormat: ['dd/mm/yyyy', 'yyyy-mm-dd', 'month'].includes(entry.dateFormat) ? entry.dateFormat : 'dd/mm/yyyy',
        timeFormat: ['hh:mm', 'hh:mm:ss'].includes(entry.timeFormat) ? entry.timeFormat : 'hh:mm'
      });
    }

    if (!normalized.length) {
      throw new Error('Nenhum template válido encontrado no arquivo');
    }

    normalized.ignoredCount = ignoredCount;
    return normalized;
  };

  /**
   * Localiza o template correspondente ao texto imediatamente antes do cursor.
   * Prioriza o atalho mais longo (longest-match).
   */
  const findMatchingTemplate = (beforeCursor, templates = []) => {
    if (!beforeCursor || !Array.isArray(templates) || !templates.length) return null;

    const sorted = [...templates].sort((a, b) => (b.shortcut?.length || 0) - (a.shortcut?.length || 0));

    return sorted.find(item => {
      if (!item.shortcut || !beforeCursor.endsWith(item.shortcut)) return false;
      const charBefore = beforeCursor.slice(0, -item.shortcut.length);
      return charBefore === '' || /[\s([{'"-]$/.test(charBefore);
    }) || null;
  };

  return {
    DEFAULT_TEMPLATES,
    generateId,
    escapeHtml,
    normalizeShortcut,
    formatDate,
    formatTime,
    resolveTokens,
    parseDynamicFields,
    formatSelectedDate,
    normalizeImportedTemplates,
    findMatchingTemplate
  };
});
