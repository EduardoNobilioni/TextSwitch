/**
 * Controlador do Popup da extensão TextSwitch.
 */
(() => {
  'use strict';

  const T = window.TextSwitchTemplates || window.AtalhoTemplates;
  const Storage = window.TextSwitchStorage || window.AtalhoStorage;

  let templates = [];
  let editingId = null;

  // Seletores DOM
  const $ = (id) => document.getElementById(id);
  const searchInput = $('searchInput');
  const templateList = $('templateList');
  const countLabel = $('countLabel');
  const emptyState = $('emptyState');
  const editorModal = $('editorModal');
  const templateForm = $('templateForm');
  const modalTitle = $('modalTitle');
  const titleInput = $('titleInput');
  const shortcutInput = $('shortcutInput');
  const textInput = $('textInput');
  const dateFormat = $('dateFormat');
  const timeFormat = $('timeFormat');
  const fileInput = $('fileInput');
  const dropOverlay = $('dropOverlay');
  const toastEl = $('toast');

  // Construtores de Variáveis e Campos
  const menuBuilderBox = $('menuBuilderBox');
  const menuNameInput = $('menuNameInput');
  const menuOptionsInput = $('menuOptionsInput');
  const textBuilderBox = $('textBuilderBox');
  const customTextFieldInput = $('customTextFieldInput');

  let toastTimer = null;

  /**
   * Exibe mensagem toast não obstrutiva.
   */
  const showToast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  };

  /**
   * Insere texto na posição atual do cursor no textarea do template.
   */
  const insertAtCursor = (textToInsert) => {
    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;
    textInput.setRangeText(textToInsert, start, end, 'end');
    textInput.focus();
  };

  /**
   * Abre a página de configurações em uma nova aba do navegador.
   */
  const openSettingsPage = (queryParam = '') => {
    const url = chrome.runtime.getURL(`options/options.html${queryParam}`);
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(url, '_blank');
    }
  };

  /**
   * Renderiza a lista de templates filtrada pela busca.
   */
  const renderList = () => {
    const query = (searchInput.value || '').trim().toLowerCase();

    const filtered = templates.filter((item) => {
      if (!query) return true;
      const haystack = `${item.title || ''} ${item.shortcut || ''} ${item.text || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    countLabel.textContent = `${templates.length} ${templates.length === 1 ? 'atalho salvo' : 'atalhos salvos'}`;

    if (templates.length === 0) {
      emptyState.hidden = false;
      templateList.innerHTML = '';
      return;
    }

    if (filtered.length === 0) {
      emptyState.hidden = true;
      templateList.innerHTML = `
        <div class="empty-state" style="padding: 24px 10px;">
          <p>Nenhum resultado para "<strong>${T.escapeHtml(query)}</strong>"</p>
        </div>
      `;
      return;
    }

    emptyState.hidden = true;

    templateList.innerHTML = filtered.map((item) => `
      <article class="template-card" data-id="${item.id}">
        <div class="template-card-header">
          <span class="template-badge" data-copy-shortcut="${T.escapeHtml(item.shortcut)}" title="Clique para copiar o atalho">
            ${T.escapeHtml(item.shortcut)}
          </span>
          <h2 class="template-title" title="${T.escapeHtml(item.title)}">${T.escapeHtml(item.title)}</h2>
          <div class="template-actions">
            <button type="button" class="btn-action" data-copy-text="${item.id}" title="Copiar texto completo">Copiar</button>
            <button type="button" class="btn-action" data-edit="${item.id}" title="Editar template">Editar</button>
            <button type="button" class="btn-action btn-danger" data-delete="${item.id}" title="Excluir">✕</button>
          </div>
        </div>
        <p class="template-preview">${T.escapeHtml(item.text)}</p>
      </article>
    `).join('');
  };

  /**
   * Abre o modal de criação ou edição de template.
   */
  const openEditor = (id = null) => {
    editingId = id;
    const current = templates.find((item) => item.id === id);

    modalTitle.textContent = current ? 'Editar Template' : 'Criar Template';
    titleInput.value = current?.title || '';
    shortcutInput.value = current?.shortcut || '';
    textInput.value = current?.text || '';
    dateFormat.value = current?.dateFormat || 'dd/mm/yyyy';
    timeFormat.value = current?.timeFormat || 'hh:mm';

    // Fecha caixas de construtor
    menuBuilderBox.hidden = true;
    textBuilderBox.hidden = true;

    editorModal.showModal();
    (current ? textInput : titleInput).focus();
  };

  /**
   * Fecha o modal de edição.
   */
  const closeEditor = () => {
    editorModal.close();
    editingId = null;
  };

  /**
   * Copia texto para a área de transferência.
   */
  const copyToClipboard = async (text, successMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch {
      showToast('Erro ao copiar texto');
    }
  };

  /**
   * Processa a importação de uma string JSON de templates.
   */
  const processImportJson = async (jsonText) => {
    try {
      const rawData = JSON.parse(jsonText);
      const imported = T.normalizeImportedTemplates(rawData);

      templates = imported;
      await Storage.saveTemplates(templates);
      renderList();

      const ignored = imported.ignoredCount || 0;
      const msg = ignored
        ? `${imported.length} templates importados (${ignored} vazios ignorados)!`
        : `${imported.length} templates importados com sucesso!`;
      showToast(msg);
    } catch (err) {
      showToast(err instanceof Error ? `Erro: ${err.message}` : 'Arquivo JSON inválido');
    }
  };

  // Event Listeners

  searchInput.addEventListener('input', renderList);

  $('newBtn').onclick = () => openEditor();
  $('emptyNewBtn').onclick = () => openEditor();
  $('closeModalBtn').onclick = closeEditor;
  $('cancelBtn').onclick = closeEditor;

  // Abrir Configurações
  $('openOptionsBtn').onclick = () => openSettingsPage();
  $('footerSettingsBtn').onclick = () => openSettingsPage();

  // Importar JSON
  const handleImportClick = () => {
    openSettingsPage('?action=import');
  };

  $('importBtn').onclick = handleImportClick;
  $('emptyImportBtn').onclick = handleImportClick;

  // Suporte a Drag & Drop de arquivos JSON no popup
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.hidden = false;
  });

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      dropOverlay.hidden = true;
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropOverlay.hidden = true;

    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
      const text = await file.text();
      await processImportJson(text);
    } else {
      showToast('Por favor, solte um arquivo .json válido');
    }
  });

  // Fallback se acionado fileInput
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await processImportJson(text);
    event.target.value = '';
  });

  // Inserção direta de tokens de data e hora
  document.querySelectorAll('[data-token]').forEach((btn) => {
    btn.onclick = () => {
      insertAtCursor(btn.dataset.token);
    };
  });

  // Construtor de Menu / Lista de Opções
  $('btnOpenMenuBuilder').onclick = () => {
    menuBuilderBox.hidden = !menuBuilderBox.hidden;
    textBuilderBox.hidden = true;
    if (!menuBuilderBox.hidden) {
      menuNameInput.focus();
    }
  };

  $('btnCloseMenuBuilder').onclick = () => {
    menuBuilderBox.hidden = true;
  };

  $('btnInsertMenu').onclick = () => {
    const rawName = menuNameInput.value.trim();
    const rawOptions = menuOptionsInput.value.trim();

    if (!rawOptions) {
      showToast('Informe as opções separadas por vírgula');
      menuOptionsInput.focus();
      return;
    }

    const optionsList = rawOptions
      .split(/[,;]/)
      .map((opt) => opt.trim())
      .filter(Boolean);

    if (optionsList.length < 2) {
      showToast('Digite pelo menos 2 opções');
      menuOptionsInput.focus();
      return;
    }

    const nameParam = rawName ? `; name=${rawName}` : '';
    const token = `{formmenu: ${optionsList.join('; ')}${nameParam}}`;

    insertAtCursor(token);
    menuNameInput.value = '';
    menuOptionsInput.value = '';
    menuBuilderBox.hidden = true;
    showToast('Menu inserido!');
  };

  // Construtor de Campo de Texto
  $('btnOpenTextBuilder').onclick = () => {
    textBuilderBox.hidden = !textBuilderBox.hidden;
    menuBuilderBox.hidden = true;
    if (!textBuilderBox.hidden) {
      customTextFieldInput.focus();
    }
  };

  $('btnCloseTextBuilder').onclick = () => {
    textBuilderBox.hidden = true;
  };

  $('btnInsertCustomText').onclick = () => {
    const fieldName = customTextFieldInput.value.trim() || 'Texto';
    insertAtCursor(`{formtext: ${fieldName}}`);
    customTextFieldInput.value = '';
    textBuilderBox.hidden = true;
    showToast('Campo de texto inserido!');
  };

  // Ações nos cards da lista
  templateList.addEventListener('click', (event) => {
    const copyShortcutBtn = event.target.closest('[data-copy-shortcut]');
    if (copyShortcutBtn) {
      copyToClipboard(copyShortcutBtn.dataset.copyShortcut, 'Atalho copiado!');
      return;
    }

    const copyTextBtn = event.target.closest('[data-copy-text]');
    if (copyTextBtn) {
      const id = copyTextBtn.dataset.copyText;
      const item = templates.find((t) => t.id === id);
      if (item) copyToClipboard(item.text, 'Texto copiado!');
      return;
    }

    const editBtn = event.target.closest('[data-edit]');
    if (editBtn) {
      openEditor(editBtn.dataset.edit);
      return;
    }

    const deleteBtn = event.target.closest('[data-delete]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      templates = templates.filter((t) => t.id !== id);
      Storage.saveTemplates(templates).then(() => {
        renderList();
        showToast('Template excluído');
      });
    }
  });

  // Salvar formulário
  templateForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const rawShortcut = shortcutInput.value.trim();
    const shortcut = T.normalizeShortcut(rawShortcut);
    const text = textInput.value.trim();

    if (!shortcut) {
      showToast('Informe um atalho de disparo');
      shortcutInput.focus();
      return;
    }

    if (!text) {
      showToast('Informe o texto do template');
      textInput.focus();
      return;
    }

    const duplicate = templates.find((item) => item.shortcut === shortcut && item.id !== editingId);
    if (duplicate) {
      showToast(`O atalho "${shortcut}" já está em uso`);
      shortcutInput.focus();
      return;
    }

    const newTemplate = {
      id: editingId || T.generateId(),
      title: title || shortcut,
      shortcut,
      text,
      dateFormat: dateFormat.value,
      timeFormat: timeFormat.value
    };

    if (editingId) {
      templates = templates.map((item) => (item.id === editingId ? newTemplate : item));
    } else {
      templates = [newTemplate, ...templates];
    }

    await Storage.saveTemplates(templates);
    renderList();
    closeEditor();
    showToast(editingId ? 'Template atualizado!' : 'Template criado com sucesso!');
  });

  // Exportar JSON
  $('exportBtn').onclick = () => {
    const payload = {
      version: 1,
      app: 'TextSwitch',
      exportedAt: new Date().toISOString(),
      templates
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `textswitch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso!');
  };

  // Atalhos de teclado no popup
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && editorModal.open) {
      event.preventDefault();
      templateForm.requestSubmit();
      return;
    }

    if (event.key === '/' && !editorModal.open && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  // Inicialização
  Storage.getTemplates().then((loaded) => {
    templates = loaded;
    renderList();
  });

  Storage.onTemplatesChange((newTemplates) => {
    templates = newTemplates;
    renderList();
  });
})();
