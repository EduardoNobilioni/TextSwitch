/**
 * Content Script da extensão TextSwitch.
 * Monitora digitação em campos de texto e expande atalhos cadastrados.
 */
(() => {
  'use strict';

  // Utilitários de templates (carregados via shared/templates.js ou fallback)
  const T = window.TextSwitchTemplates || window.AtalhoTemplates || {
    DEFAULT_TEMPLATES: [
      { shortcut: '/obrigado', title: 'Agradecimento', text: 'Obrigado pelo contato! Retorno em breve.', dateFormat: 'dd/mm/yyyy', timeFormat: 'hh:mm' },
      { shortcut: '/followup', title: 'Follow-up', text: 'Olá! Passando para acompanhar nossa conversa. Ficou alguma dúvida?', dateFormat: 'dd/mm/yyyy', timeFormat: 'hh:mm' }
    ],
    normalizeShortcut: (s) => (s ? (s.startsWith('/') || s.startsWith('-') ? s : `/${s}`) : ''),
    formatDate: () => new Date().toLocaleDateString('pt-BR'),
    formatTime: () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    resolveTokens: (text) => text,
    parseDynamicFields: () => [],
    formatSelectedDate: (val) => val,
    findMatchingTemplate: (before, list) => {
      const sorted = [...list].sort((a, b) => (b.shortcut?.length || 0) - (a.shortcut?.length || 0));
      return sorted.find(item => before.endsWith(item.shortcut)) || null;
    }
  };

  let activeTemplates = [];

  /**
   * Atualiza a lista de templates em memória.
   */
  const updateTemplatesList = (data) => {
    const list = Array.isArray(data?.templates) ? data.templates : T.DEFAULT_TEMPLATES;
    activeTemplates = list
      .map(item => ({
        shortcut: T.normalizeShortcut(item.shortcut ?? item.short ?? item.abbreviation ?? item.macro ?? item.trigger),
        text: item.text ?? item.body ?? item.content ?? item.template,
        dateFormat: item.dateFormat || 'dd/mm/yyyy',
        timeFormat: item.timeFormat || 'hh:mm'
      }))
      .filter(item => item.shortcut && typeof item.text === 'string');
  };

  /**
   * Carrega os templates salvos do storage do Chrome.
   */
  const loadTemplates = () => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get({ templates: null }, (localData) => {
      if (Array.isArray(localData.templates)) {
        updateTemplatesList(localData);
        return;
      }
      if (chrome.storage.sync) {
        chrome.storage.sync.get({ templates: T.DEFAULT_TEMPLATES }, (syncData) => {
          updateTemplatesList(syncData);
          chrome.storage.local.set(syncData);
        });
      }
    });
  };

  loadTemplates();

  // Escuta alterações em tempo real nos templates
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.templates) {
      updateTemplatesList({ templates: changes.templates.newValue });
    }
  });

  /**
   * Verifica se um elemento é um campo editável válido.
   */
  const isEditableElement = (el) => {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') return true;
    if (!/^(INPUT|TEXTAREA)$/.test(el.tagName)) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return ['text', 'search', 'email', 'url', 'tel', 'password'].includes(el.type || 'text');
  };

  /**
   * Obtém o elemento editável de destino do evento.
   */
  const getEditableTarget = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const directTarget = path.find(isEditableElement);
    if (directTarget) return directTarget;
    if (isEditableElement(document.activeElement)) return document.activeElement;
    return null;
  };

  /**
   * Obtém o texto atual do elemento editável.
   */
  const getElementText = (el) => {
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
      return el.innerText ?? el.textContent ?? '';
    }
    return el.value ?? '';
  };

  /**
   * Calcula o offset de caracteres antes da seleção atual em um container contentEditable.
   */
  const getContentEditableOffset = (el) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    try {
      range.setEnd(selection.anchorNode, selection.anchorOffset);
      return range.toString().length;
    } catch {
      return null;
    }
  };

  /**
   * Encontra a posição de nó/offset no DOM correspondente a um offset de caracteres.
   */
  const getRangeAtOffset = (container, offset) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node;
    while ((node = walker.nextNode())) {
      if (remaining <= node.data.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= node.data.length;
    }
    const fallback = document.createRange();
    fallback.selectNodeContents(container);
    fallback.collapse(false);
    return fallback;
  };

  /**
   * Substitui o atalho pelo texto expandido em um elemento contentEditable.
   */
  const replaceInContentEditable = (el, shortcut, expandedText, suffix, caretOffset) => {
    if (caretOffset == null) return;
    const shortcutStart = caretOffset - shortcut.length;
    if (shortcutStart < 0) return;

    const startPoint = getRangeAtOffset(el, shortcutStart);
    const endPoint = getRangeAtOffset(el, caretOffset);
    const range = document.createRange();

    range.setStart(startPoint.startContainer, startPoint.startOffset);
    range.setEnd(endPoint.startContainer, endPoint.startOffset);
    range.deleteContents();

    const textToInsert = expandedText + suffix;
    const textNode = document.createTextNode(textToInsert);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: textToInsert
    }));
  };

  /**
   * Substitui o atalho pelo texto expandido em <input> ou <textarea>.
   */
  const replaceInTextInput = (el, shortcutLength, expandedText, suffix, startPos) => {
    const fullReplacement = expandedText + suffix;
    el.setRangeText(fullReplacement, startPos, startPos + shortcutLength, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /**
   * Exibe o diálogo modal para preenchimento de campos dinâmicos do Text Blaze.
   */
  const promptDynamicFields = (rawText) => {
    const fields = T.parseDynamicFields(rawText);
    if (!fields.length) return Promise.resolve(rawText);

    return new Promise((resolve) => {
      const existing = document.getElementById('textswitch-dynamic-modal');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'textswitch-dynamic-modal';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }
        .dialog {
          background: #ffffff;
          color: #0f172a;
          border-radius: 14px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          box-sizing: border-box;
          animation: modalIn 0.15s ease-out;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .icon-box {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #4f46e5, #ec4899);
          color: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);
        }
        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .subtitle {
          margin: 0 0 16px;
          font-size: 13px;
          color: #64748b;
        }
        .field {
          display: block;
          margin-bottom: 14px;
        }
        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #334155;
        }
        input, select, textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 9px 12px;
          font: inherit;
          font-size: 14px;
          color: #0f172a;
          background: #ffffff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        textarea {
          min-height: 80px;
          resize: vertical;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }
        button {
          border: 0;
          border-radius: 8px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-cancel {
          background: #f1f5f9;
          color: #475569;
        }
        .btn-cancel:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-submit {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);
        }
        .btn-submit:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
      `;

      const backdrop = document.createElement('div');
      backdrop.className = 'backdrop';

      const dialog = document.createElement('div');
      dialog.className = 'dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      dialog.innerHTML = `
        <div class="header">
          <div class="icon-box">⇄</div>
          <h2>Preencha os campos</h2>
        </div>
        <p class="subtitle">Complete as informações para expandir o template:</p>
        <form id="fields-form"></form>
      `;

      shadow.append(style, backdrop);
      backdrop.appendChild(dialog);

      const form = shadow.getElementById('fields-form');

      fields.forEach((field, index) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'field';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'field-label';
        labelSpan.textContent = field.label;
        wrapper.appendChild(labelSpan);

        let control;
        if (field.type === 'formdate') {
          control = document.createElement('input');
          control.type = 'date';
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          control.value = `${y}-${m}-${d}`;
        } else if (field.type === 'formmenu') {
          control = document.createElement('select');
          field.options.forEach(opt => {
            const optEl = document.createElement('option');
            optEl.value = opt;
            optEl.textContent = opt.replace(/^\*|\*$/g, '');
            control.appendChild(optEl);
          });
          control.value = field.defaultValue;
        } else if (field.type === 'formparagraph') {
          control = document.createElement('textarea');
          control.value = field.defaultValue || '';
        } else {
          control = document.createElement('input');
          control.type = 'text';
          control.value = field.defaultValue || '';
        }

        control.id = `field-${index}`;
        wrapper.appendChild(control);
        form.appendChild(wrapper);
      });

      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.innerHTML = `
        <button type="button" class="btn-cancel">Cancelar</button>
        <button type="submit" class="btn-submit">Inserir Template</button>
      `;
      form.appendChild(actions);

      const close = () => host.remove();

      actions.querySelector('.btn-cancel').onclick = () => {
        close();
        resolve(null);
      };

      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          close();
          resolve(null);
        }
      };

      const handleKey = (e) => {
        if (e.key === 'Escape') {
          close();
          window.removeEventListener('keydown', handleKey, true);
          resolve(null);
        }
      };
      window.addEventListener('keydown', handleKey, true);

      form.onsubmit = (e) => {
        e.preventDefault();
        window.removeEventListener('keydown', handleKey, true);

        let resolved = rawText;
        fields.forEach((field, index) => {
          const ctrl = shadow.getElementById(`field-${index}`);
          let val = ctrl ? ctrl.value : '';
          if (field.type === 'formdate') {
            val = T.formatSelectedDate(val, field.format);
          }
          val = val.replace(/^\*|\*$/g, '');
          resolved = resolved.split(field.token).join(val);
        });

        close();
        resolve(resolved);
      };

      setTimeout(() => shadow.getElementById('field-0')?.focus(), 30);
    });
  };

  /**
   * Listener global de teclas para interceptar os atalhos.
   */
  document.addEventListener('keydown', async (event) => {
    // Dispara com Espaço, Enter ou Tab sem modificadores
    if (![' ', 'Enter', 'Tab'].includes(event.key)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const el = getEditableTarget(event);
    if (!el) return;

    const fullText = getElementText(el);
    const isRich = el.isContentEditable || el.getAttribute('role') === 'textbox';

    const cursor = isRich ? null : el.selectionStart;
    const textBeforeCursor = cursor == null ? fullText : fullText.slice(0, cursor);

    const match = T.findMatchingTemplate(textBeforeCursor, activeTemplates);
    if (!match) return;

    event.preventDefault();

    const savedInputStart = cursor == null ? null : cursor - match.shortcut.length;
    const savedCaretOffset = isRich ? getContentEditableOffset(el) : null;

    // Resolve campos interativos (se houver)
    const dynamicResolved = await promptDynamicFields(match.text);
    if (dynamicResolved == null) return;

    // Resolve tokens de data/hora
    const finalText = T.resolveTokens(dynamicResolved, match);
    const suffix = event.key === ' ' ? ' ' : event.key === 'Enter' ? '\n' : '';

    if (isRich) {
      replaceInContentEditable(el, match.shortcut, finalText, suffix, savedCaretOffset);
    } else {
      const startPos = savedInputStart ?? (textBeforeCursor.length - match.shortcut.length);
      replaceInTextInput(el, match.shortcut.length, finalText, suffix, startPos);
    }
  }, true);
})();
