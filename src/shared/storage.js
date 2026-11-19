/**
 * Módulo de armazenamento da extensão TextSwitch.
 * Encapsula a API chrome.storage com Promises e fallback seguro.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    const exports = factory();
    root.TextSwitchStorage = exports;
    root.AtalhoStorage = exports; // Compatibilidade retroativa
    if (typeof window !== 'undefined') {
      window.TextSwitchStorage = exports;
      window.AtalhoStorage = exports;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const defaultTemplates = (typeof TextSwitchTemplates !== 'undefined' && TextSwitchTemplates.DEFAULT_TEMPLATES)
    ? TextSwitchTemplates.DEFAULT_TEMPLATES
    : [
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
   * Obtém a lista atual de templates salvos.
   * Realiza migração transparente de storage.sync para storage.local se necessário.
   * @returns {Promise<Array>}
   */
  const getTemplates = () => {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Fallback para desenvolvimento / testes fora da extensão
        try {
          const stored = localStorage.getItem('textswitch_templates') || localStorage.getItem('atalho_templates');
          resolve(stored ? JSON.parse(stored) : defaultTemplates);
        } catch {
          resolve(defaultTemplates);
        }
        return;
      }

      chrome.storage.local.get({ templates: null }, (localData) => {
        if (Array.isArray(localData.templates)) {
          resolve(localData.templates);
          return;
        }

        // Tenta migrar do chrome.storage.sync
        if (chrome.storage.sync) {
          chrome.storage.sync.get({ templates: defaultTemplates }, (syncData) => {
            const templates = Array.isArray(syncData.templates) ? syncData.templates : defaultTemplates;
            chrome.storage.local.set({ templates }, () => {
              resolve(templates);
            });
          });
        } else {
          chrome.storage.local.set({ templates: defaultTemplates }, () => {
            resolve(defaultTemplates);
          });
        }
      });
    });
  };

  /**
   * Salva a lista de templates no storage local.
   * @param {Array} templates
   * @returns {Promise<void>}
   */
  const saveTemplates = (templates) => {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(templates)) {
        reject(new TypeError('Templates deve ser uma lista (Array)'));
        return;
      }

      if (typeof chrome === 'undefined' || !chrome.storage) {
        try {
          localStorage.setItem('textswitch_templates', JSON.stringify(templates));
          resolve();
        } catch (err) {
          reject(err);
        }
        return;
      }

      chrome.storage.local.set({ templates }, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  };

  /**
   * Observa mudanças no storage para manter telas e scripts sincronizados em tempo real.
   * @param {Function} callback
   * @returns {Function} Função de cancelamento da inscrição (unsubscribe)
   */
  const onTemplatesChange = (callback) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return () => {};
    }

    const listener = (changes, areaName) => {
      if (areaName === 'local' && changes.templates) {
        callback(changes.templates.newValue || []);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  };

  return {
    getTemplates,
    saveTemplates,
    onTemplatesChange
  };
});
