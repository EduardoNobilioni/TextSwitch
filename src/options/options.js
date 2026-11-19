/**
 * Controlador da Página de Opções e Documentação da extensão TextSwitch.
 */
(() => {
  'use strict';

  const T = window.TextSwitchTemplates || window.AtalhoTemplates;
  const Storage = window.TextSwitchStorage || window.AtalhoStorage;

  let templates = [];
  let editingId = null;

  // Seletores do DOM
  const $ = (id) => document.getElementById(id);
  const searchInput = $('searchInput');
  const countLabel = $('countLabel');
  const totalTemplatesStat = $('totalTemplatesStat');
  const templateTableBody = $('templateTableBody');
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
  const toastEl = $('toast');

  // Construtores de Variáveis e Campos
  const menuBuilderBox = $('menuBuilderBox');
  const menuNameInput = $('menuNameInput');
  const menuOptionsInput = $('menuOptionsInput');
  const textBuilderBox = $('textBuilderBox');
  const customTextFieldInput = $('customTextFieldInput');

  let toastTimer = null;

  /**
   * Exibe notificação toast na tela.
   */
  const showToast = (message) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2500);
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
   * Sistema de navegação por abas na barra lateral.
   */
  const initTabs = () => {
    const navButtons = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;

        navButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach((tab) => {
          if (tab.id === targetId) {
            tab.hidden = false;
            tab.classList.add('active');
          } else {
            tab.hidden = true;
            tab.classList.remove('active');
          }
        });
      });
    });
  };

  /**
   * Atualiza a renderização da tabela com base no filtro de busca.
   */
  const renderTable = () => {
    const query = (searchInput.value || '').trim().toLowerCase();

    const filtered = templates.filter((item) => {
      if (!query) return true;
      const haystack = `${item.title || ''} ${item.shortcut || ''} ${item.folder || ''} ${item.text || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    totalTemplatesStat.textContent = templates.length;
    countLabel.textContent = `${filtered.length} de ${templates.length} ${templates.length === 1 ? 'template' : 'templates'}`;

    if (templates.length === 0) {
      emptyState.hidden = false;
      templateTableBody.innerHTML = '';
      return;
    }

    if (filtered.length === 0) {
      emptyState.hidden = true;
      templateTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Nenhum template encontrado correspondente a "<strong>${T.escapeHtml(query)}</strong>"
          </td>
        </tr>
      `;
      return;
    }

    emptyState.hidden = true;

    templateTableBody.innerHTML = filtered.map((item) => `
      <tr data-id="${item.id}">
        <td>
          <span class="shortcut-badge" data-copy-shortcut="${T.escapeHtml(item.shortcut)}" title="Clique para copiar o atalho">
            ${T.escapeHtml(item.shortcut)}
          </span>
        </td>
        <td class="template-name-cell">
          ${T.escapeHtml(item.title)}
          ${item.folder ? `<span class="template-name-folder">📁 ${T.escapeHtml(item.folder)}</span>` : ''}
        </td>
        <td class="template-text-cell" title="${T.escapeHtml(item.text)}">
          ${T.escapeHtml(item.text)}
        </td>
        <td style="text-align: right;">
          <div class="table-actions">
            <button type="button" class="btn btn-sm" data-copy-text="${item.id}" title="Copiar texto completo">Copiar</button>
            <button type="button" class="btn btn-sm" data-edit="${item.id}" title="Editar">Editar</button>
            <button type="button" class="btn btn-sm btn-danger" data-delete="${item.id}" title="Excluir">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  /**
   * Abre o modal de edição ou criação.
   */
  const openEditor = (id = null) => {
    editingId = id;
    const current = templates.find((t) => t.id === id);

    modalTitle.textContent = current ? 'Editar Template' : 'Criar Template';
    titleInput.value = current?.title || '';
    shortcutInput.value = current?.shortcut || '';
    textInput.value = current?.text || '';
    dateFormat.value = current?.dateFormat || 'dd/mm/yyyy';
    timeFormat.value = current?.timeFormat || 'hh:mm';

    // Fecha subpainéis de criação ao abrir modal
    menuBuilderBox.hidden = true;
    textBuilderBox.hidden = true;

    editorModal.showModal();
    (current ? textInput : titleInput).focus();
  };

  /**
   * Fecha o modal.
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
      showToast('Erro ao copiar para a área de transferência');
    }
  };

  // Event Listeners

  initTabs();

  searchInput.addEventListener('input', renderTable);

  $('newBtn').onclick = () => openEditor();
  $('emptyNewBtn').onclick = () => openEditor();
  $('closeModalBtn').onclick = closeEditor;
  $('cancelBtn').onclick = closeEditor;

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
      showToast('Informe as opções da lista separadas por vírgula');
      menuOptionsInput.focus();
      return;
    }

    const optionsList = rawOptions
      .split(/[,;]/)
      .map((opt) => opt.trim())
      .filter(Boolean);

    if (optionsList.length < 2) {
      showToast('Digite pelo menos 2 opções para criar uma lista');
      menuOptionsInput.focus();
      return;
    }

    const nameParam = rawName ? `; name=${rawName}` : '';
    const token = `{formmenu: ${optionsList.join('; ')}${nameParam}}`;

    insertAtCursor(token);
    menuNameInput.value = '';
    menuOptionsInput.value = '';
    menuBuilderBox.hidden = true;
    showToast('Lista de opções inserida no texto!');
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

  // Inserção de Parágrafo
  $('btnOpenParagraphBuilder').onclick = () => {
    menuBuilderBox.hidden = true;
    textBuilderBox.hidden = true;
    insertAtCursor('{formparagraph: Observações}');
    showToast('Campo de parágrafo inserido!');
  };

  // Ações da tabela
  templateTableBody.addEventListener('click', (event) => {
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
      const item = templates.find((t) => t.id === id);
      if (item && confirm(`Deseja realmente excluir o template "${item.title}"?`)) {
        templates = templates.filter((t) => t.id !== id);
        Storage.saveTemplates(templates).then(() => {
          renderTable();
          showToast('Template excluído');
        });
      }
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
      showToast('Por favor, informe um atalho');
      shortcutInput.focus();
      return;
    }

    if (!text) {
      showToast('Por favor, digite o texto do template');
      textInput.focus();
      return;
    }

    const duplicate = templates.find((item) => item.shortcut === shortcut && item.id !== editingId);
    if (duplicate) {
      showToast(`O atalho "${shortcut}" já está em uso pelo template "${duplicate.title}"`);
      shortcutInput.focus();
      return;
    }

    const currentTemplate = editingId ? templates.find(t => t.id === editingId) : null;
    const newTemplate = {
      id: editingId || T.generateId(),
      title: title || shortcut,
      shortcut,
      text,
      folder: currentTemplate?.folder || '',
      dateFormat: dateFormat.value,
      timeFormat: timeFormat.value
    };

    if (editingId) {
      templates = templates.map((item) => (item.id === editingId ? newTemplate : item));
    } else {
      templates = [newTemplate, ...templates];
    }

    await Storage.saveTemplates(templates);
    renderTable();
    closeEditor();
    showToast(editingId ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!');
  });

  // Exportar Backup JSON
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

  // Importar JSON
  const triggerImport = () => fileInput.click();
  $('importBtn').onclick = triggerImport;
  const emptyImportBtn = $('emptyImportBtn');
  if (emptyImportBtn) emptyImportBtn.onclick = triggerImport;

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const rawData = JSON.parse(content);
      const imported = T.normalizeImportedTemplates(rawData);

      templates = imported;
      await Storage.saveTemplates(templates);
      renderTable();

      const ignored = imported.ignoredCount || 0;
      const msg = ignored
        ? `${imported.length} templates importados com sucesso (${ignored} vazios ignorados)!`
        : `${imported.length} templates importados com sucesso!`;
      showToast(msg);
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao importar: ${err.message}` : 'Arquivo JSON inválido');
    } finally {
      event.target.value = '';
    }
  });

  // Atalhos de teclado no modal
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && editorModal.open) {
      event.preventDefault();
      templateForm.requestSubmit();
    }
  });

  // Inicialização
  Storage.getTemplates().then((loaded) => {
    templates = loaded;
    renderTable();

    // Se a página foi aberta com ?action=import (ex.: clicado no popup), dispara o seletor na hora
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'import') {
      setTimeout(() => triggerImport(), 150);
    }
  });

  Storage.onTemplatesChange((newTemplates) => {
    templates = newTemplates;
    renderTable();
  });
})();
