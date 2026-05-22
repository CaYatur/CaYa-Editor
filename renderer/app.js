// ============================================================
// CaYaDev Basic AI Code Editor - Main Application
// ============================================================

// ============ STATE ============
const state = {
  projectDir: null,
  isTrusted: false,
  openFiles: [],
  activeFile: null,
  editor: null,
  terminal: null,
  terminalFit: null,
  terminalOpen: false,
  models: [],
  aiProviderType: 'ollama',
  aiProviderBaseUrl: 'http://localhost:11434',
  aiProviderApiKey: '',
  aiProviderModelCatalog: '',
  chatModel: '',
  agentModel: '',
  autocompleteModel: '',
  autocompleteEnabled: true,
  translatePromptsEnabled: false,
  translateModel: '',
  editorFontSize: 14,
  editorTabSize: 2,
  editorWordWrap: false,
  editorMinimap: true,
  uiLanguage: 'system',
  chatHistory: [],
  agentHistory: [],
  isGenerating: false,
  currentRequestId: null,  // Track current Ollama request for abort
  autocompleteTimer: null,
  currentStreamRequestId: null,
  undoStack: [],   // [{ path, oldContent, label }]
  agentCheckpoints: {},
  treeRefreshTimer: null,
  treeRefreshing: false,
  treeRefreshPending: false,
  selectedTreeItem: null,
  leftPanelWidth: 340,
  rightPanelWidth: 340,
  shortcutScope: 'editor',
  terminalMode: null,
  terminalResizeObserver: null,
  dialogOpen: false,
  renameInProgress: false,
  deleteInProgress: false,
  settingsReady: false,
  settingsSaveTimer: null
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
  repairMojibakeInElement(document.body);
  initMojibakeObserver();
  initIcons();
  initWindowControls();
  initClientLogging();
  await loadPersistedSettings();
  initSidebarTabs();
  initPanelResizers();
  updateGridLayout();   // set initial grid based on active panels
  initFileExplorer();
  initMonacoEditor();
  initTerminalToggle();
  initChatPanel();
  initAgentPanel();
  initSettings();
  initKeyboardShortcuts();
  await loadOllamaModels();
  // Hint: enable Shift+Right-Click inspection shortcut
  setupContextInspectShortcut();
});

function setupContextInspectShortcut() {
  // Inform the user once that Shift+Right-Click opens DevTools inspection
  let hinted = false;
  document.addEventListener('contextmenu', (e) => {
    try {
      // Require Shift to avoid interfering with normal context menus
      if (!e.shiftKey) return;
      e.preventDefault();
      // Use clientX/Y for coordinates relative to the viewport
      const x = e.clientX || 0;
      const y = e.clientY || 0;
      if (window.electronAPI && typeof window.electronAPI.openDevToolsAndInspect === 'function') {
        window.electronAPI.openDevToolsAndInspect(x, y);
      } else if (window.electronAPI && typeof window.electronAPI.openDevTools === 'function') {
        window.electronAPI.openDevTools();
      }
      if (!hinted) {
        showToast(uiText('inspect_shortcut_hint'), 'info', 2200);
        hinted = true;
      }
    } catch (err) {
      // ignore
    }
  });
}

// ============ ICONS ============
// Fallback text map for offline / icon not found
const ICON_MAP = {
  'folder-tree': '[D]', 'bot': '[AI]', 'cpu': '[A]', 'settings': '[S]',
  'folder-open': '[O]', 'file-plus': '[+F]', 'folder-plus': '[+D]',
  'refresh-cw': '[R]', 'x': '[x]', 'trash-2': '[del]', 'send': '[>]',
  'paperclip': '[@]', 'file-code': '[{}]', 'shield-alert': '[!]',
  'shield-check': '[v]', 'shield-off': '[x]', 'check-circle': '[v]',
  'alert-circle': '[!]', 'alert-triangle': '[!]', 'info': '[i]',
  'user': '[U]', 'chevron-down': '[v]', 'chevron-right': '[>]',
  'terminal': '[T]', 'folder': '[D]', 'file': '[F]', 'file-edit': '[E]',
  'file-json': '[{}]', 'git-branch': '[G]', 'lock': '[L]', 'image': '[I]',
  'file-archive': '[Z]', 'minus': '[-]', 'square': '[sq]', 'zap': '[!]',
  'chevron-up': '[^]', 'lightbulb': '[*]', 'undo-2': '[U]',
  'corner-down-left': '[L]', 'corner-up-right': '[R]', 'corner-left': '[<]',
  'file-text': '[txt]', 'edit-2': '[E]', 'globe': '[web]'
};

function initIcons() {
  applyIcons();
}

function refreshIcons() {
  applyIcons();
}

function repairMojibake(text) {
  if (typeof text !== 'string') return text;
  const mojibakePattern = /(Ã|Ä|Å|Â|ğŸ|â€™|â€œ|â€|â€¦|â€“|â€”|â†’|âœ)/;
  if (!mojibakePattern.test(text)) return text;

  const replacements = [
    ['ğŸ“', '📁'],
    ['ğŸ“„', '📄'],
    ['â†’', '→'],
    ['âœ“', '✓'],
    ['âœ—', '✗'],
    ['â€“', '–'],
    ['â€”', '—'],
    ['â€™', '’'],
    ['â€œ', '“'],
    ['â€', '”'],
    ['â€¦', '…'],
    ['Ã¼', 'ü'],
    ['Ãœ', 'Ü'],
    ['Ã¶', 'ö'],
    ['Ã–', 'Ö'],
    ['Ã§', 'ç'],
    ['Ã‡', 'Ç'],
    ['Ä±', 'ı'],
    ['Ä°', 'İ'],
    ['ÅŸ', 'ş'],
    ['Åž', 'Ş'],
    ['ÄŸ', 'ğ'],
    ['Äž', 'Ğ'],
    ['Â', '']
  ];

  let fixed = text;
  for (const [bad, good] of replacements) {
    fixed = fixed.split(bad).join(good);
  }

  if (!mojibakePattern.test(fixed)) return fixed;

  try {
    return decodeURIComponent(escape(fixed));
  } catch {
    return fixed;
  }
}

function repairMojibakeInElement(root) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const fixed = repairMojibake(node.nodeValue || '');
    if (fixed !== node.nodeValue) {
      node.nodeValue = fixed;
    }
    node = walker.nextNode();
  }

  root.querySelectorAll('[title],[placeholder],[aria-label]').forEach((el) => {
    ['title', 'placeholder', 'aria-label'].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const currentValue = el.getAttribute(attr) || '';
      const fixed = repairMojibake(currentValue);
      if (fixed !== currentValue) {
        el.setAttribute(attr, fixed);
      }
    });
  });
}

function initMojibakeObserver() {
  const pending = new Set();
  let scheduled = false;

  const scheduleRepair = (node) => {
    if (!node) return;
    const target = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!target) return;
    pending.add(target);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      pending.forEach((el) => {
        if (el && el.isConnected) {
          repairMojibakeInElement(el);
        }
      });
      pending.clear();
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const textNode = mutation.target;
        const fixed = repairMojibake(textNode.nodeValue || '');
        if (fixed !== textNode.nodeValue) {
          textNode.nodeValue = fixed;
        }
        continue;
      }

      if (mutation.type === 'attributes') {
        scheduleRepair(mutation.target);
        continue;
      }

      mutation.addedNodes.forEach((node) => {
        scheduleRepair(node);
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'placeholder', 'aria-label']
  });
}

function createLucideIconElement(name, sourceEl) {
  if (typeof lucide === 'undefined') return null;

  const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const iconDef = lucide[camelName.charAt(0).toUpperCase() + camelName.slice(1)];
  if (!iconDef) return null;

  const [, defaultAttrs, children] = iconDef;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  Object.entries(defaultAttrs || {}).forEach(([k, v]) => svg.setAttribute(k, v));

  const sourceClass = sourceEl.getAttribute('class');
  if (sourceClass) svg.setAttribute('class', sourceClass);

  const sourceStyle = sourceEl.getAttribute('style');
  if (sourceStyle) svg.setAttribute('style', sourceStyle);

  svg.setAttribute('data-lucide', name);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  (children || []).forEach((child) => {
    const [tag, attrs] = child;
    const childEl = document.createElementNS(svgNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => childEl.setAttribute(k, v));
    svg.appendChild(childEl);
  });

  return svg;
}

function createLocalIconElement(name, sourceEl) {
  const iconMarkup = window.CAYA_ICONS?.[name];
  if (!iconMarkup) return null;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('data-lucide', name);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const sourceClass = sourceEl.getAttribute('class');
  if (sourceClass) svg.setAttribute('class', sourceClass);

  const sourceStyle = sourceEl.getAttribute('style');
  if (sourceStyle) svg.setAttribute('style', sourceStyle);

  svg.innerHTML = iconMarkup;
  return svg;
}

function createTextIconFallback(name, sourceEl) {
  const fallback = document.createElement('span');
  fallback.setAttribute('data-lucide', name);
  fallback.textContent = ICON_MAP[name] || '[?]';

  const sourceClass = sourceEl.getAttribute('class');
  if (sourceClass) fallback.setAttribute('class', sourceClass);

  const sourceStyle = sourceEl.getAttribute('style');
  if (sourceStyle) fallback.setAttribute('style', sourceStyle);

  return fallback;
}

function applyIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try {
      window.lucide.createIcons({
        attrs: {
          'stroke-width': 2
        }
      });
    } catch {}
  }

  document.querySelectorAll('i[data-lucide], span[data-lucide]').forEach((el) => {
    const iconName = el.getAttribute('data-lucide');
    if (!iconName) return;

    const localIcon = createLocalIconElement(iconName, el);
    const replacement = localIcon || createTextIconFallback(iconName, el);
    if (replacement !== el) el.replaceWith(replacement);
  });
}

// ============ PROMPTS ============
function getPromptLibrary() {
  return window.CAYA_PROMPTS || {};
}

function buildTranslationSystemPrompt() {
  const promptBuilder = getPromptLibrary().getTranslationSystemPrompt;
  if (typeof promptBuilder === 'function') {
    return String(promptBuilder());
  }
  return 'Translate the user prompt into clear English. Preserve code blocks, file paths, commands, variable names and formatting. Output only the translated English text.';
}

function buildChatSystemPrompt(isThinking) {
  const promptBuilder = getPromptLibrary().getChatSystemPrompt;
  if (typeof promptBuilder === 'function') {
    return String(promptBuilder({ isThinking: !!isThinking }));
  }
  return isThinking
    ? 'You are CaYaDev AI assistant, a helpful coding assistant embedded in a code editor. Provide thorough, well-structured answers. Use markdown with fenced code blocks (```language) for all code snippets. Reply in the same language as the user.'
    : 'You are CaYaDev AI assistant, a helpful coding assistant embedded in a code editor. Be concise and precise. Use markdown with fenced code blocks (```language) for all code snippets. Reply in the same language as the user.';
}

function buildAgentSystemPrompt(projectRoot, contextInfo) {
  const promptBuilder = getPromptLibrary().getAgentSystemPrompt;
  if (typeof promptBuilder === 'function') {
    return String(promptBuilder({ projectRoot, contextInfo }));
  }
  const safeRoot = String(projectRoot || '');
  const safeContext = String(contextInfo || '').trim();
  const fallback = [
    'You are CaYaDev AI Agent, an autonomous coding assistant inside a code editor. You have the ability to create, edit, and delete files.',
    '',
    `PROJECT ROOT: ${safeRoot}`,
    '',
    'Use file operation commands with explicit paths and always reply in the same language as the user.',
    'For code snippets use markdown fenced blocks.'
  ].join('\n');
  return safeContext ? `${fallback}\n\n${safeContext}` : fallback;
}

// ============ PERSISTED SETTINGS ============
const PROVIDER_PRESETS = {
  ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  claude: { label: 'Claude', baseUrl: 'https://api.anthropic.com/v1' },
  grok: { label: 'Grok', baseUrl: 'https://api.x.ai/v1' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  'github-models': { label: 'GitHub Models', baseUrl: 'https://models.inference.ai.azure.com' },
  'custom-openai': { label: 'Custom API', baseUrl: '' }
};

const DEFAULT_PERSISTED_SETTINGS = {
  chatModel: '',
  agentModel: '',
  autocompleteModel: '',
  autocompleteEnabled: true,
  translatePromptsEnabled: false,
  translateModel: '',
  aiProvider: {
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    modelCatalog: ''
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: true
  },
  panelWidths: {
    left: 340,
    right: 340
  },
  agentOptions: {
    includeProject: true,
    includeCurrentFile: false
  }
};

function normalizeBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clampNumber(parsed, min, max);
}

function normalizeProviderType(value) {
  const type = String(value || DEFAULT_PERSISTED_SETTINGS.aiProvider.type).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, type)
    ? type
    : DEFAULT_PERSISTED_SETTINGS.aiProvider.type;
}

function getProviderPreset(type) {
  return PROVIDER_PRESETS[normalizeProviderType(type)];
}

function normalizeProviderConfig(raw = {}) {
  const type = normalizeProviderType(raw.type);
  const preset = getProviderPreset(type);
  const baseUrl = String(raw.baseUrl || '').trim() || preset.baseUrl || '';

  return {
    type,
    baseUrl,
    apiKey: String(raw.apiKey || '').trim(),
    modelCatalog: String(raw.modelCatalog || '').trim()
  };
}

function getProviderDisplayName(type = state.aiProviderType) {
  return getProviderPreset(type).label;
}

function getProviderRuntimeConfig() {
  return normalizeProviderConfig({
    type: state.aiProviderType,
    baseUrl: state.aiProviderBaseUrl,
    apiKey: state.aiProviderApiKey,
    modelCatalog: state.aiProviderModelCatalog
  });
}

function clipLogText(value, max = 400) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...(clipped ${text.length - max} chars)`;
}

function providerForLog() {
  const provider = getProviderRuntimeConfig();
  return {
    type: provider.type,
    baseUrl: provider.baseUrl,
    hasApiKey: !!provider.apiKey,
    modelCatalogSize: String(provider.modelCatalog || '')
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean).length
  };
}

function messagesForLog(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  return safe.slice(0, 24).map((msg, index) => {
    const role = String(msg?.role || 'unknown');
    const content = String(msg?.content ?? '');
    return {
      index,
      role,
      length: content.length,
      preview: clipLogText(content, 220)
    };
  });
}

function logAppEvent(level, eventName, details = {}) {
  try {
    window.electronAPI?.logAppEvent?.({
      level: String(level || 'INFO').toUpperCase(),
      event: String(eventName || 'renderer.event'),
      details
    });
  } catch {}
}

function initClientLogging() {
  logAppEvent('INFO', 'renderer.boot', {
    location: window.location.href,
    userAgent: navigator.userAgent
  });

  window.addEventListener('error', (e) => {
    logAppEvent('ERROR', 'renderer.window.error', {
      message: e.message,
      filename: e.filename,
      line: e.lineno,
      column: e.colno,
      stack: e.error?.stack || null
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    let serializedReason = null;
    if (typeof reason === 'string') {
      serializedReason = reason;
    } else {
      try {
        serializedReason = JSON.stringify(reason || null);
      } catch {
        serializedReason = String(reason || '');
      }
    }
    logAppEvent('ERROR', 'renderer.window.unhandledrejection', {
      reason: reason?.message || serializedReason,
      stack: reason?.stack || null
    });
  });
}

function applyProviderSettingsToUI() {
  const providerConfig = getProviderRuntimeConfig();
  const providerTypeEl = document.getElementById('settings-provider-type');
  const providerBaseUrlEl = document.getElementById('settings-provider-baseurl');
  const providerApiKeyEl = document.getElementById('settings-provider-apikey');
  const providerModelsEl = document.getElementById('settings-provider-models');

  if (providerTypeEl) providerTypeEl.value = providerConfig.type;
  if (providerBaseUrlEl) {
    providerBaseUrlEl.value = providerConfig.baseUrl;
    providerBaseUrlEl.placeholder = getProviderPreset(providerConfig.type).baseUrl || 'https://api.example.com/v1';
  }
  if (providerApiKeyEl) {
    providerApiKeyEl.value = providerConfig.apiKey;
    providerApiKeyEl.placeholder = providerConfig.type === 'ollama'
      ? uiText('provider_api_key_not_required')
      : 'API key';
  }
  if (providerModelsEl) {
    providerModelsEl.value = providerConfig.modelCatalog;
  }
}

function getAgentOptionElements() {
  return {
    includeProject: document.getElementById('agent-include-project'),
    includeCurrentFile: document.getElementById('agent-include-current-file')
  };
}

function applySettingsToUIFromState() {
  const fieldMap = {
    'settings-fontsize': String(state.editorFontSize),
    'settings-tabsize': String(state.editorTabSize),
    'settings-wordwrap': !!state.editorWordWrap,
    'settings-minimap': !!state.editorMinimap,
    'autocomplete-enabled': !!state.autocompleteEnabled,
    'settings-translate-enabled': !!state.translatePromptsEnabled,
    'settings-ui-language': state.uiLanguage || 'system'
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value;
  });

  const { includeProject, includeCurrentFile } = getAgentOptionElements();
  if (includeProject) {
    includeProject.checked = normalizeBool(
      includeProject.checked,
      DEFAULT_PERSISTED_SETTINGS.agentOptions.includeProject
    );
  }
  if (includeCurrentFile) {
    includeCurrentFile.checked = normalizeBool(
      includeCurrentFile.checked,
      DEFAULT_PERSISTED_SETTINGS.agentOptions.includeCurrentFile
    );
  }

  applyProviderSettingsToUI();
  syncModelSelects();
  refreshTranslationSettingsUI();
  applyUILanguage();
}

function setElementText(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = String(text ?? '');
}

function setElementAttr(selector, attr, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.setAttribute(attr, String(text ?? ''));
}

function setCheckboxText(inputId, key) {
  const input = document.getElementById(inputId);
  const labelText = input?.closest('label')?.querySelector('span');
  if (!labelText) return;
  labelText.textContent = uiText(key);
}

function setSelectOptionText(selectId, value, key) {
  const option = document.querySelector(`#${CSS.escape(selectId)} option[value="${value}"]`);
  if (!option) return;
  option.textContent = uiText(key);
}

function setGroupHeadingByControl(controlId, key) {
  const control = document.getElementById(controlId);
  const heading = control?.closest('.setting-group')?.querySelector('h4');
  if (!heading) return;
  heading.textContent = uiText(key);
}

function setLabelNearControl(controlId, key) {
  const control = document.getElementById(controlId);
  const rowLabel = control?.closest('.setting-row')?.querySelector('label');
  if (!rowLabel) return;
  rowLabel.textContent = uiText(key);
}

// Simple UI translations used in renderer for common labels
const UI_TRANSLATIONS = {
  en: {
    welcome: 'AI-powered code editor',
    settings_header: 'SETTINGS',
    ui_language_h4: 'UI Language',
    ui_language_label: 'Language:',
    ui_language_system: 'System (Automatic)',
    ui_language_tr: 'Türkçe',
    ui_language_en: 'English',
    agent_include_project: 'Send project structure',
    agent_include_current_file: 'Send current file',
    agent_input_placeholder: "Give a command to the agent... (e.g. 'create src/utils.js')",
    btn_send_agent_title: 'Run command',
    changes_panel_title: 'Changes',
    type_create: 'Created',
    type_edit: 'Edited',
    type_lines: 'Line Change',
    type_delete: 'Deleted',
    type_error: 'Error',
    type_cancel: 'Cancelled',
    undo: 'Undo',
    redo: 'Redo',
    undo_quick_title: 'Undo (Quick)',
    redo_quick_title: 'Redo (Quick)'
    ,
    status_done: 'Done',
    status_deleted: 'Deleted',
    detail_created: 'File created successfully.',
    detail_updated: 'File updated.',
    detail_deleted: 'File deleted.',
    toast_created: 'Created: ',
    toast_edited: 'Edited: ',
    toast_deleted: 'Deleted: ',
    toast_undo: 'Undone: ',
    toast_redo: 'Redone: ',
    delete_cancelled: 'Delete cancelled',
    error_no_project: 'No project directory selected.',
    error_path_outside: 'Security violation: path outside project!',
    line_edit_redone: 'Line edit re-applied.'
  },
  tr: {
    welcome: 'Yapay zeka kod editörü',
    settings_header: 'AYARLAR',
    ui_language_h4: 'Arayüz Dili',
    ui_language_label: 'Dil:',
    ui_language_system: 'Sistem (Otomatik)',
    ui_language_tr: 'Türkçe',
    ui_language_en: 'English',
    agent_include_project: 'Proje yapısını gönder',
    agent_include_current_file: 'Mevcut dosyayı gönder',
    agent_input_placeholder: "Agent'a komut verin... (örn: 'src/utils.js dosyasını oluştur')",
    btn_send_agent_title: 'Komutu çalıştır',
    changes_panel_title: 'Değişiklikler',
    type_create: 'Oluşturuldu',
    type_edit: 'Düzenlendi',
    type_lines: 'Satır Değişikliği',
    type_delete: 'Silindi',
    type_error: 'Hata',
    type_cancel: 'İptal',
    undo: 'Geri Al',
    redo: 'İleri Al',
    undo_quick_title: 'Geri Al (Hızlı)',
    redo_quick_title: 'İleri Al (Hızlı)'
    ,
    status_done: 'Tamamlandı',
    status_deleted: 'Silindi',
    detail_created: 'Dosya başarıyla oluşturuldu.',
    detail_updated: 'Dosya güncellendi.',
    detail_deleted: 'Dosya silindi.',
    toast_created: 'Oluşturuldu: ',
    toast_edited: 'Düzenlendi: ',
    toast_deleted: 'Silindi: ',
    toast_undo: 'Geri alındı: ',
    toast_redo: 'İleri alındı: ',
    delete_cancelled: 'Silme işlemi iptal edildi.',
    error_no_project: 'Proje dizini seçilmedi.',
    error_path_outside: 'Güvenlik ihlali: proje dizini dışında!',
    line_edit_redone: 'Satır değişikliği yeniden uygulandı.'
  }
};

const UI_TRANSLATION_EXTENSION = {
  en: {
    title_minimize: 'Minimize',
    title_maximize: 'Maximize',
    title_close: 'Close',
    tab_explorer_title: 'File Explorer',
    tab_chat_title: 'AI Chat',
    tab_agent_title: 'AI Agent',
    tab_settings_title: 'Settings',
    panel_explorer_title: 'FILE EXPLORER',
    panel_chat_title: 'AI CHAT',
    panel_agent_title: 'AI AGENT',
    btn_open_folder_title: 'Open Folder',
    btn_new_file_title: 'New File',
    btn_new_folder_title: 'New Folder',
    btn_refresh_tree_title: 'Refresh',
    explorer_empty_text: 'No project directory opened',
    open_folder_btn: 'Open Folder',
    btn_clear_chat_title: 'Clear Chat',
    chat_model_label: 'Chat Model:',
    loading_model_option: 'Loading models...',
    chat_welcome_title: 'CaYaDev AI Assistant',
    chat_welcome_desc: 'Ask coding questions, request edits, or create new files.',
    chat_input_placeholder: 'Type your message... (Enter to send, Shift+Enter new line)',
    btn_attach_file_title: 'Attach current file',
    btn_send_chat_text: 'Send',
    btn_clear_agent_title: 'Reset Agent',
    agent_model_label: 'Agent Model:',
    agent_mode_title: 'Agent Mode',
    agent_mode_desc: 'AI can create, edit and delete files in the project directory. Delete operations require confirmation.',
    agent_welcome_title: 'CaYaDev AI Agent',
    agent_welcome_desc: 'Analyzes project files, edits, creates and deletes. Give a command.',
    btn_toggle_changes_title: 'Collapse/expand indicators',
    btn_move_changes_title: 'Move down / up',
    shortcut_open_folder: 'Open Folder',
    shortcut_save: 'Save',
    shortcut_terminal: 'Terminal',
    shortcut_ai_completion: 'AI Completion',
    ui_language_note: 'The system display language is selected by default; you can change it here later.',
    provider_h4: 'AI Provider',
    provider_label: 'Provider:',
    provider_ollama: 'Ollama (Local)',
    provider_openai: 'OpenAI',
    provider_claude: 'Claude (Anthropic)',
    provider_grok: 'Grok (xAI)',
    provider_openrouter: 'OpenRouter',
    provider_github: 'GitHub Models',
    provider_custom: 'Custom (OpenAI-Compatible)',
    provider_api_key_not_required: 'Not required for Ollama',
    provider_model_catalog_label: 'Model List (optional):',
    provider_models_note: 'If the model endpoint is disabled, enter models line-by-line or comma-separated. These settings are saved to ~/.CaYaDevEditor/settings.json.',
    provider_status_label: 'Status:',
    provider_status_checking: 'Checking...',
    provider_status_checking_with_provider: '{provider} checking...',
    provider_status_connected: '{provider}: {count} models',
    provider_status_disconnected: '{provider}: disconnected',
    provider_manual_fallback_notice: '{provider}: model list loaded from manual catalog.',
    btn_refresh_models_text: 'Refresh Models',
    chat_model_h4: 'Chat Model',
    agent_model_h4: 'Agent Model',
    autocomplete_h4: 'Autocomplete Model',
    autocomplete_off: 'Disabled',
    autocomplete_enabled: 'Autocomplete enabled',
    translate_h4: 'Prompt Translation (Optional)',
    translate_enabled: 'Translate prompt to English first',
    translate_model_placeholder: 'Select a model...',
    translate_note: 'When enabled, your prompt is translated to English using the selected model, then sent to the Chat/Agent model.',
    editor_h4: 'Editor',
    font_size_label: 'Font Size:',
    tab_size_label: 'Tab Size:',
    word_wrap: 'Word Wrap',
    minimap: 'Minimap Preview',
    about_h4: 'About',
    about_version: 'Version {version}',
    terminal_title: 'Terminal',
    btn_terminal_toggle_title: 'Open/Close Terminal',
    btn_terminal_kill_title: 'Close Terminal',
    status_project_title: 'Project Directory',
    status_project_none: 'No project opened',
    status_trust_title: 'Trust Status',
    status_trusted: 'Trusted',
    status_untrusted: 'Untrusted',
    status_ai_ready: 'AI Ready',
    status_plain_text: 'Plain Text',
    status_line_position: 'Line {line}, Column {column}',
    dialog_cancel: 'Cancel',
    dialog_confirm: 'OK',
    inspect_shortcut_hint: 'Shift+Right-Click: Inspect opened',
    site_open_failed: 'Site could not be opened: {error}',
    source_request: 'Request',
    source_chat: 'Chat',
    source_agent: 'Agent',
    translation_model_missing: 'Translation model is not selected. Original prompt was sent.',
    translation_failed_for_source: '{source}: translation failed, original prompt was used.',
    translation_done_for_source: '{source}: prompt translated to English.',
    translation_error_for_source: '{source}: translation error, original prompt was used.',
    status_translating_prompt: 'Translating prompt to English...',
    project_not_trusted: 'Directory was not trusted. AI operations are disabled.',
    project_watch_failed: 'Live file watch could not start: {error}',
    project_opened: 'Project opened: {name}',
    file_open_failed: 'File could not be opened: {error}',
    open_in_browser_error: 'Open in browser error: {error}',
    unknown_error: 'Unknown error',
    file_opened_in_browser: 'File opened in browser',
    ctx_new_file: 'New File',
    ctx_new_folder: 'New Folder',
    ctx_open: 'Open',
    ctx_open_in_browser: 'Open in Browser',
    ctx_rename: 'Rename',
    ctx_delete: 'Delete',
    operation_error: 'Operation error: {error}',
    toast_open_project_first: 'Open a project directory first',
    dialog_new_file_title: 'New File',
    dialog_new_file_placeholder: 'file_name.js',
    dialog_new_folder_title: 'New Folder',
    dialog_new_folder_placeholder: 'folder_name',
    toast_created_with_name: 'Created: {name}',
    toast_deleted_with_name: 'Deleted: {name}',
    toast_delete_failed: 'Delete error: {error}',
    toast_renamed: 'Renamed',
    toast_saved: 'Saved',
    toast_save_failed: 'Save error: {error}',
    toast_no_open_file: 'No open file',
    toast_file_attached: 'File attached: {name}',
    toast_select_model: 'Please select a model',
    chat_context_file_label: 'File',
    status_generating: 'Generating response...',
    status_ai_error: 'AI Error',
    status_agent_running: 'Agent running...',
    status_agent_error: 'Agent Error',
    connection_error_prefix: 'Connection error: {error}',
    toast_ai_connection_error: 'AI connection error: {error}',
    toast_agent_connection_error: 'Agent connection error: {error}',
    error_model_request_failed: 'Model request failed',
    error_agent_model_request_failed: 'Agent model request failed',
    toast_ai_error: 'AI error: {error}',
    toast_agent_error: 'Agent error: {error}',
    btn_stop_title: 'Stop',
    btn_stop_chat_text: 'Stop',
    status_stopped: 'Stopped',
    user_name: 'You',
    assistant_name: 'CaYaDev AI',
    agent_name: 'CaYaDev Agent',
    thinking_label: 'Thinking...',
    thinking_process_label: 'Thinking process',
    agent_commands_processed: 'AI file commands were processed. See details in Changes panel.',
    btn_copy_code: 'Copy',
    btn_copied_code: 'Copied',
    collapse_expand_title: 'Collapse/Expand',
    undo_done: 'Undo Complete',
    undo_error: 'Error',
    redo_error: 'Error',
    undo_action_hint: 'Change was undone. You can re-apply it.',
    undo_failed: 'Undo failed: {error}',
    redo_applied: 'Change re-applied',
    redo_failed: 'Redo failed: {error}',
    parse_unknown_error: 'Unknown error',
    parse_file_not_found: 'File not found',
    parse_permission_denied: 'Access denied',
    parse_is_directory: 'This is a directory',
    parse_exists: 'File already exists',
    security_violation_project_outside: 'Security violation: path outside project!',
    file_read_failed_with_error: 'File could not be read: {error}',
    line_range_meta: 'Lines {start}-{end}',
    line_count_meta: '{count} lines',
    changed_lines_meta: '{count} lines changed',
    line_replaced_detail: 'Replaced with {count} lines.',
    lines_edited_with_file: 'Lines edited: {file}',
    append_meta: 'Append ({count} lines)',
    append_detail: 'Appended to end of file.',
    appended_with_file: 'Appended: {file}',
    create_undo_with_file: 'Creation undone: {file}',
    edit_undo_with_file: 'Undone: {file}',
    delete_undo_with_file: 'Delete undone: {file}',
    create_error_with_error: 'Create error: {error}',
    toast_editor_not_ready: 'Editor is not ready yet',
    terminal_error_mode: 'Terminal switched to error mode: {error}',
    terminal_start_failed: 'Terminal could not be started',
    terminal_fallback_start_failed: 'Fallback terminal could not be started: {error}',
    terminal_error: 'Terminal error: {error}',
    terminal_basic_input_placeholder: 'Type a command and press Enter',
    terminal_basic_opened: 'Terminal opened in basic mode ({reason}).',
    terminal_closed_with_code: '[Terminal closed: {code}]',
    terminal_backend_ready: '[{type} backend ready]',
    terminal_start_failed_with_error: 'Terminal could not be started: {error}',
    terminal_container_not_found: 'Terminal container not found',
    terminal_missing_xterm: 'xterm.js script failed to load',
    terminal_missing_fit: 'xterm-addon-fit script failed to load',
    terminal_preparing: 'Preparing terminal...',
    terminal_closed_reopen: 'Terminal closed (code: {code}). Close/open terminal to restart.',
    terminal_started: '=== Terminal Started ===',
    terminal_compat_mode: '[Compatibility mode: node-pty not found, line-based input will be used]',
    terminal_rebuild_hint: 'Run npm install && npm run rebuild:pty.',
    terminal_started_basic: 'Terminal'
  },
  tr: {
    title_minimize: 'Küçült',
    title_maximize: 'Büyüt',
    title_close: 'Kapat',
    tab_explorer_title: 'Dosya Gezgini',
    tab_chat_title: 'AI Sohbet',
    tab_agent_title: 'AI Agent',
    tab_settings_title: 'Ayarlar',
    panel_explorer_title: 'DOSYA GEZGİNİ',
    panel_chat_title: 'AI SOHBET',
    panel_agent_title: 'AI AGENT',
    btn_open_folder_title: 'Klasör Aç',
    btn_new_file_title: 'Yeni Dosya',
    btn_new_folder_title: 'Yeni Klasör',
    btn_refresh_tree_title: 'Yenile',
    explorer_empty_text: 'Proje dizini açılmadı',
    open_folder_btn: 'Klasör Aç',
    btn_clear_chat_title: 'Sohbeti Temizle',
    chat_model_label: 'Sohbet Modeli:',
    loading_model_option: 'Model yükleniyor...',
    chat_welcome_title: 'CaYaDev AI Asistan',
    chat_welcome_desc: 'Kod hakkında sorular sorun, düzenleme isteyin veya yeni dosya oluşturun.',
    chat_input_placeholder: 'Mesajınızı yazın... (Enter gönder, Shift+Enter yeni satır)',
    btn_attach_file_title: 'Mevcut dosyayı ekle',
    btn_send_chat_text: 'Gönder',
    btn_clear_agent_title: "Agent'ı Sıfırla",
    agent_model_label: 'Agent Modeli:',
    agent_mode_title: 'Agent Modu',
    agent_mode_desc: 'Yapay zeka proje dizinindeki dosyaları oluşturabilir, düzenleyebilir ve silebilir. Silme işlemleri için onay istenecektir.',
    agent_welcome_title: 'CaYaDev AI Agent',
    agent_welcome_desc: 'Proje dosyalarını analiz eder, düzenler, oluşturur ve siler. Komut verin!',
    btn_toggle_changes_title: 'Göstergeleri daralt/genişlet',
    btn_move_changes_title: 'Aşağı / Yukarı taşı',
    shortcut_open_folder: 'Klasör Aç',
    shortcut_save: 'Kaydet',
    shortcut_terminal: 'Terminal',
    shortcut_ai_completion: 'AI Tamamlama',
    ui_language_note: 'Sistem görüntüleme dili varsayılan olarak seçilir; sonradan buradan değiştirilebilir.',
    provider_h4: 'AI Sağlayıcı',
    provider_label: 'Sağlayıcı:',
    provider_ollama: 'Ollama (Yerel)',
    provider_openai: 'OpenAI',
    provider_claude: 'Claude (Anthropic)',
    provider_grok: 'Grok (xAI)',
    provider_openrouter: 'OpenRouter',
    provider_github: 'GitHub Models',
    provider_custom: 'Custom (OpenAI-Compatible)',
    provider_api_key_not_required: 'Ollama için gerekmiyor',
    provider_model_catalog_label: 'Model Listesi (opsiyonel):',
    provider_models_note: "Model endpoint'i kapalıysa modeli satır satır veya virgülle gir. Bu ayarlar ~/.CaYaDevEditor/settings.json içine kaydedilir.",
    provider_status_label: 'Durum:',
    provider_status_checking: 'Kontrol ediliyor...',
    provider_status_checking_with_provider: '{provider} kontrol ediliyor...',
    provider_status_connected: '{provider}: {count} model',
    provider_status_disconnected: '{provider}: bağlantı yok',
    provider_manual_fallback_notice: '{provider}: model listesi manuel kaynaktan yüklendi.',
    btn_refresh_models_text: 'Modelleri Yenile',
    chat_model_h4: 'Sohbet Modeli',
    agent_model_h4: 'Agent Modeli',
    autocomplete_h4: 'Otomatik Tamamlama Modeli',
    autocomplete_off: 'Devre Dışı',
    autocomplete_enabled: 'Otomatik tamamlama etkin',
    translate_h4: 'Prompt Çeviri (Opsiyonel)',
    translate_enabled: 'Promptu önce İngilizceye çevir',
    translate_model_placeholder: 'Model seçin...',
    translate_note: 'Etkin olduğunda, yazdığın prompt seçilen model ile İngilizceye çevrilir ve sonra Chat/Agent modeline gönderilir.',
    editor_h4: 'Editör',
    font_size_label: 'Yazı Boyutu:',
    tab_size_label: 'Tab Boyutu:',
    word_wrap: 'Kelime Sarma',
    minimap: 'Minimap Önizleme',
    about_h4: 'Hakkında',
    about_version: 'Versiyon {version}',
    terminal_title: 'Terminal',
    btn_terminal_toggle_title: 'Terminal Aç/Kapat',
    btn_terminal_kill_title: "Terminal'i Kapat",
    status_project_title: 'Proje Dizini',
    status_project_none: 'Proje açılmadı',
    status_trust_title: 'Güven Durumu',
    status_trusted: 'Güvenilir',
    status_untrusted: 'Güvenilmez',
    status_ai_ready: 'AI Hazır',
    status_plain_text: 'Düz Metin',
    status_line_position: 'Satır {line}, Sütun {column}',
    dialog_cancel: 'İptal',
    dialog_confirm: 'Tamam',
    inspect_shortcut_hint: 'Shift+Right-Click: İncele (Inspect) açıldı',
    site_open_failed: 'Site açılamadı: {error}',
    source_request: 'İstek',
    source_chat: 'Sohbet',
    source_agent: 'Agent',
    translation_model_missing: 'Çeviri modeli seçili değil. Orijinal prompt gönderildi.',
    translation_failed_for_source: '{source}: çeviri başarısız, orijinal prompt kullanıldı.',
    translation_done_for_source: '{source}: prompt İngilizceye çevrildi.',
    translation_error_for_source: '{source}: çeviri hatası, orijinal prompt kullanıldı.',
    status_translating_prompt: 'Prompt İngilizceye çevriliyor...',
    project_not_trusted: 'Dizine güvenilmedi. AI işlemleri devre dışı.',
    project_watch_failed: 'Anlık dosya izleme başlatılamadı: {error}',
    project_opened: 'Proje açıldı: {name}',
    file_open_failed: 'Dosya açılamadı: {error}',
    open_in_browser_error: "Web'de açma hatası: {error}",
    unknown_error: 'Bilinmeyen hata',
    file_opened_in_browser: 'Dosya tarayıcıda açıldı',
    ctx_new_file: 'Yeni Dosya',
    ctx_new_folder: 'Yeni Klasör',
    ctx_open: 'Aç',
    ctx_open_in_browser: "Web'de Aç",
    ctx_rename: 'Yeniden Adlandır',
    ctx_delete: 'Sil',
    operation_error: 'İşlem hatası: {error}',
    toast_open_project_first: 'Önce bir proje dizini açın',
    dialog_new_file_title: 'Yeni Dosya',
    dialog_new_file_placeholder: 'dosya_adi.js',
    dialog_new_folder_title: 'Yeni Klasör',
    dialog_new_folder_placeholder: 'klasor_adi',
    toast_created_with_name: 'Oluşturuldu: {name}',
    toast_deleted_with_name: 'Silindi: {name}',
    toast_delete_failed: 'Silme hatası: {error}',
    toast_renamed: 'Yeniden adlandırıldı',
    toast_saved: 'Kaydedildi',
    toast_save_failed: 'Kaydetme hatası: {error}',
    toast_no_open_file: 'Açık dosya yok',
    toast_file_attached: 'Dosya eklendi: {name}',
    toast_select_model: 'Lütfen bir model seçin',
    chat_context_file_label: 'Dosya',
    status_generating: 'Yanıt oluşturuluyor...',
    status_ai_error: 'AI Hata',
    status_agent_running: 'Agent çalışıyor...',
    status_agent_error: 'Agent Hata',
    connection_error_prefix: 'Bağlantı hatası: {error}',
    toast_ai_connection_error: 'AI bağlantı hatası: {error}',
    toast_agent_connection_error: 'Agent bağlantı hatası: {error}',
    error_model_request_failed: 'Model isteği başarısız',
    error_agent_model_request_failed: 'Agent model isteği başarısız',
    toast_ai_error: 'AI hatası: {error}',
    toast_agent_error: 'Agent hatası: {error}',
    btn_stop_title: 'Durdur',
    btn_stop_chat_text: 'Dur',
    status_stopped: 'Durduruldu',
    user_name: 'Sen',
    assistant_name: 'CaYaDev AI',
    agent_name: 'CaYaDev Agent',
    thinking_label: 'Düşünüyor...',
    thinking_process_label: 'Düşünce süreci',
    agent_commands_processed: 'AI tarafından dosya komutları işlendi. Detaylar Değişiklikler panelinde.',
    btn_copy_code: 'Kopyala',
    btn_copied_code: 'Kopyalandı',
    collapse_expand_title: 'Daralt/Genişlet',
    undo_done: 'Geri Alındı',
    undo_error: 'Hata',
    redo_error: 'Hata',
    undo_action_hint: 'Değişiklik geri alındı. İstersen sonrasını için yeniden uygula.',
    undo_failed: 'Geri alma başarısız: {error}',
    redo_applied: 'Değişiklik yeniden uygulandı',
    redo_failed: 'İleri alma başarısız: {error}',
    parse_unknown_error: 'Bilinmeyen hata',
    parse_file_not_found: 'Dosya bulunamadı',
    parse_permission_denied: 'Erişim reddedildi',
    parse_is_directory: 'Bu bir klasör',
    parse_exists: 'Dosya zaten mevcut',
    security_violation_project_outside: 'Güvenlik ihlali: proje dizini dışında!',
    file_read_failed_with_error: 'Dosya okunamadı: {error}',
    line_range_meta: '{start}-{end}. satırlar',
    line_count_meta: '{count} satır',
    changed_lines_meta: '{count} satır değişti',
    line_replaced_detail: '{count} satır ile değiştirildi.',
    lines_edited_with_file: 'Satırlar düzenlendi: {file}',
    append_meta: 'Ekleme ({count} satır)',
    append_detail: 'Dosyanın sonuna eklendi.',
    appended_with_file: 'Eklendi: {file}',
    create_undo_with_file: 'Oluşturma geri alındı: {file}',
    edit_undo_with_file: 'Geri alındı: {file}',
    delete_undo_with_file: 'Silme işlemi geri alındı: {file}',
    create_error_with_error: 'Oluşturma hatası: {error}',
    toast_editor_not_ready: 'Editör henüz hazır değil',
    terminal_error_mode: 'Terminal hata moduna geçti: {error}',
    terminal_start_failed: 'Terminal başlatılamadı',
    terminal_fallback_start_failed: 'Fallback terminal de başlatılamadı: {error}',
    terminal_error: 'Terminal hatası: {error}',
    terminal_basic_input_placeholder: "Komut yazın ve Enter'a basın",
    terminal_basic_opened: 'Terminal basit modda açıldı ({reason}).',
    terminal_closed_with_code: '[Terminal kapandı: {code}]',
    terminal_backend_ready: '[{type} backend hazır]',
    terminal_start_failed_with_error: 'Terminal başlatılamadı: {error}',
    terminal_container_not_found: 'Terminal konteyneri bulunamadı',
    terminal_missing_xterm: 'xterm.js scripti yüklenemedi',
    terminal_missing_fit: 'xterm-addon-fit scripti yüklenemedi',
    terminal_preparing: 'Terminal hazırlanıyor...',
    terminal_closed_reopen: 'Terminal kapandı (kod: {code}). Yeniden açmak için terminali kapat/aç.',
    terminal_started: '=== Terminal Başlatıldı ===',
    terminal_compat_mode: '[Uyumluluk modu: node-pty bulunamadı, satır tabanlı giriş kullanılacak]',
    terminal_rebuild_hint: 'npm install && npm run rebuild:pty çalıştırın.',
    terminal_started_basic: 'Terminal'
  }
};

Object.assign(UI_TRANSLATIONS.en, UI_TRANSLATION_EXTENSION.en);
Object.assign(UI_TRANSLATIONS.tr, UI_TRANSLATION_EXTENSION.tr);


function getCurrentUILang() {
  const choice = String(state.uiLanguage || 'system');
  if (choice === 'system') {
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.startsWith('tr') ? 'tr' : 'en';
  }
  return choice === 'tr' ? 'tr' : 'en';
}

function uiText(key) {
  const lang = getCurrentUILang();
  // support simple keys like 'type.create' or 'agent_input_placeholder'
  const simpleKey = key.replace(/^.*\./, '') || key;
  const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
  return dict[key] || dict[simpleKey] || UI_TRANSLATIONS.en[key] || UI_TRANSLATIONS.en[simpleKey] || '';
}

function uiTextf(key, vars = {}) {
  const template = String(uiText(key) || '');
  if (!template) return '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return `{${name}}`;
    return String(vars[name] ?? '');
  });
}

function applyUILanguage() {
  const lang = getCurrentUILang();
  try {
    document.documentElement.lang = lang;
  } catch {}

  setElementAttr('#btn-minimize', 'title', uiText('title_minimize'));
  setElementAttr('#btn-maximize', 'title', uiText('title_maximize'));
  setElementAttr('#btn-close', 'title', uiText('title_close'));
  setElementAttr('.sidebar-tab[data-panel="explorer"]', 'title', uiText('tab_explorer_title'));
  setElementAttr('.sidebar-tab[data-panel="ai-chat"]', 'title', uiText('tab_chat_title'));
  setElementAttr('.sidebar-tab[data-panel="ai-agent"]', 'title', uiText('tab_agent_title'));
  setElementAttr('.sidebar-tab[data-panel="settings"]', 'title', uiText('tab_settings_title'));

  setElementText('#panel-explorer .panel-header > span', uiText('panel_explorer_title'));
  setElementText('#panel-ai-chat .panel-header > span', uiText('panel_chat_title'));
  setElementText('#panel-ai-agent .panel-header > span', uiText('panel_agent_title'));
  setElementText('#panel-settings .panel-header > span', uiText('settings_header'));
  setElementAttr('#btn-open-folder', 'title', uiText('btn_open_folder_title'));
  setElementAttr('#btn-new-file', 'title', uiText('btn_new_file_title'));
  setElementAttr('#btn-new-folder', 'title', uiText('btn_new_folder_title'));
  setElementAttr('#btn-refresh-tree', 'title', uiText('btn_refresh_tree_title'));
  setElementText('#file-tree .empty-state p', uiText('explorer_empty_text'));
  setElementText('#btn-open-project', uiText('open_folder_btn'));

  setElementAttr('#btn-clear-chat', 'title', uiText('btn_clear_chat_title'));
  setElementText('#panel-ai-chat .ai-model-select label', uiText('chat_model_label'));
  setElementText('#chat-messages .chat-welcome h3', uiText('chat_welcome_title'));
  setElementText('#chat-messages .chat-welcome p', uiText('chat_welcome_desc'));
  setElementAttr('#chat-input', 'placeholder', uiText('chat_input_placeholder'));
  setElementAttr('#btn-attach-file', 'title', uiText('btn_attach_file_title'));
  setElementText('#btn-send-chat', uiText('btn_send_chat_text'));

  setElementAttr('#btn-clear-agent', 'title', uiText('btn_clear_agent_title'));
  setElementText('#panel-ai-agent .ai-model-select label', uiText('agent_model_label'));
  setElementText('.agent-info-box strong', uiText('agent_mode_title'));
  setElementText('.agent-info-box p', uiText('agent_mode_desc'));
  setElementText('#agent-messages .chat-welcome h3', uiText('agent_welcome_title'));
  setElementText('#agent-messages .chat-welcome p', uiText('agent_welcome_desc'));
  setElementAttr('#btn-toggle-changes', 'title', uiText('btn_toggle_changes_title'));
  setElementAttr('#btn-move-changes', 'title', uiText('btn_move_changes_title'));
  setElementText('.agent-changes-label', uiText('changes_panel_title'));
  setCheckboxText('agent-include-project', 'agent_include_project');
  setCheckboxText('agent-include-current-file', 'agent_include_current_file');
  setElementAttr('#agent-input', 'placeholder', uiText('agent_input_placeholder'));
  setElementAttr('#btn-send-agent', 'title', uiText('btn_send_agent_title'));

  const uiLangGroup = document.getElementById('settings-ui-language')?.closest('.setting-group');
  if (uiLangGroup) {
    const h4 = uiLangGroup.querySelector('h4');
    const rowLabel = uiLangGroup.querySelector('.setting-row label');
    const note = uiLangGroup.querySelector('.setting-note');
    if (h4) h4.textContent = uiText('ui_language_h4');
    if (rowLabel) rowLabel.textContent = uiText('ui_language_label');
    if (note) note.textContent = uiText('ui_language_note');
  }
  setSelectOptionText('settings-ui-language', 'system', 'ui_language_system');
  setSelectOptionText('settings-ui-language', 'tr', 'ui_language_tr');
  setSelectOptionText('settings-ui-language', 'en', 'ui_language_en');

  setGroupHeadingByControl('settings-provider-type', 'provider_h4');
  setLabelNearControl('settings-provider-type', 'provider_label');
  setLabelNearControl('settings-provider-models', 'provider_model_catalog_label');
  setElementText('#settings-provider-models-label', uiText('provider_model_catalog_label'));
  setLabelNearControl('ollama-status', 'provider_status_label');
  setSelectOptionText('settings-provider-type', 'ollama', 'provider_ollama');
  setSelectOptionText('settings-provider-type', 'openai', 'provider_openai');
  setSelectOptionText('settings-provider-type', 'claude', 'provider_claude');
  setSelectOptionText('settings-provider-type', 'grok', 'provider_grok');
  setSelectOptionText('settings-provider-type', 'openrouter', 'provider_openrouter');
  setSelectOptionText('settings-provider-type', 'github-models', 'provider_github');
  setSelectOptionText('settings-provider-type', 'custom-openai', 'provider_custom');
  const refreshModelsBtn = document.getElementById('btn-refresh-models');
  if (refreshModelsBtn) {
    refreshModelsBtn.innerHTML = `<i data-lucide="refresh-cw" class="icon-xs"></i> ${uiText('btn_refresh_models_text')}`;
  }

  const providerNote = document.querySelector('#settings-provider-models')?.closest('.setting-group')?.querySelector('.setting-note');
  if (providerNote) providerNote.textContent = uiText('provider_models_note');

  setGroupHeadingByControl('settings-chat-model', 'chat_model_h4');
  setGroupHeadingByControl('settings-agent-model', 'agent_model_h4');
  setGroupHeadingByControl('settings-autocomplete-model', 'autocomplete_h4');
  setSelectOptionText('settings-autocomplete-model', '', 'autocomplete_off');
  setCheckboxText('autocomplete-enabled', 'autocomplete_enabled');

  setGroupHeadingByControl('settings-translate-enabled', 'translate_h4');
  setCheckboxText('settings-translate-enabled', 'translate_enabled');
  const translateNote = document.querySelector('#settings-translate-model')?.closest('.setting-group')?.querySelector('.setting-note');
  if (translateNote) translateNote.textContent = uiText('translate_note');

  setGroupHeadingByControl('settings-fontsize', 'editor_h4');
  setLabelNearControl('settings-fontsize', 'font_size_label');
  setLabelNearControl('settings-tabsize', 'tab_size_label');
  setCheckboxText('settings-wordwrap', 'word_wrap');
  setCheckboxText('settings-minimap', 'minimap');

  const aboutGroup = document.querySelector('.about-info')?.closest('.setting-group');
  const aboutHeading = aboutGroup?.querySelector('h4');
  if (aboutHeading) aboutHeading.textContent = uiText('about_h4');
  const aboutVersion = document.getElementById('about-version');
  if (aboutVersion) {
    const version = aboutVersion.dataset.version || '1.0.0';
    aboutVersion.textContent = uiTextf('about_version', { version });
  }

  setElementText('#editor-welcome .welcome-content p', uiText('welcome'));
  const shortcuts = document.querySelectorAll('#editor-welcome .welcome-shortcuts .shortcut');
  if (shortcuts[0]) shortcuts[0].innerHTML = `<kbd>Ctrl</kbd>+<kbd>O</kbd> ${uiText('shortcut_open_folder')}`;
  if (shortcuts[1]) shortcuts[1].innerHTML = `<kbd>Ctrl</kbd>+<kbd>S</kbd> ${uiText('shortcut_save')}`;
  if (shortcuts[2]) shortcuts[2].innerHTML = `<kbd>Ctrl</kbd>+<kbd>\`</kbd> ${uiText('shortcut_terminal')}`;
  if (shortcuts[3]) shortcuts[3].innerHTML = `<kbd>Ctrl</kbd>+<kbd>Space</kbd> ${uiText('shortcut_ai_completion')}`;

  const terminalHeaderLabel = document.querySelector('#terminal-header > span');
  if (terminalHeaderLabel) {
    terminalHeaderLabel.innerHTML = `<i data-lucide="terminal" class="icon-xs"></i> ${uiText('terminal_title')}`;
  }
  setElementAttr('#btn-terminal-toggle', 'title', uiText('btn_terminal_toggle_title'));
  setElementAttr('#btn-terminal-kill', 'title', uiText('btn_terminal_kill_title'));
  setElementAttr('#btn-toggle-terminal', 'title', uiText('btn_terminal_toggle_title'));

  setElementAttr('#status-project', 'title', uiText('status_project_title'));
  setElementAttr('#status-trust', 'title', uiText('status_trust_title'));
  if (!state.projectDir) {
    setElementText('#status-project span:last-child', uiText('status_project_none'));
  }
  if (!state.isTrusted) {
    setElementText('#status-trust span:last-child', uiText('status_untrusted'));
  }
  if (!state.activeFile) {
    setElementText('#status-language', uiText('status_plain_text'));
  }
  if (!state.isGenerating) {
    updateAIStatus(uiText('status_ai_ready'));
  }

  populateModelSelects();
  syncModelSelects();
  refreshTranslationSettingsUI();
  applyProviderSettingsToUI();
  updateSendButtonState('chat');
  updateSendButtonState('agent');
  refreshIcons();
}

function buildPersistedSettingsPayload() {
  const { includeProject, includeCurrentFile } = getAgentOptionElements();

  return {
    chatModel: String(state.chatModel || ''),
    agentModel: String(state.agentModel || ''),
    autocompleteModel: String(state.autocompleteModel || ''),
    autocompleteEnabled: !!state.autocompleteEnabled,
    translatePromptsEnabled: !!state.translatePromptsEnabled,
    translateModel: String(state.translateModel || ''),
    aiProvider: getProviderRuntimeConfig(),
    editor: {
      fontSize: normalizeNumber(state.editorFontSize, DEFAULT_PERSISTED_SETTINGS.editor.fontSize, 10, 30),
      tabSize: normalizeNumber(state.editorTabSize, DEFAULT_PERSISTED_SETTINGS.editor.tabSize, 1, 8),
      wordWrap: !!state.editorWordWrap,
      minimap: !!state.editorMinimap
    },
    panelWidths: {
      left: normalizeNumber(state.leftPanelWidth, DEFAULT_PERSISTED_SETTINGS.panelWidths.left, PANEL_RESIZE_MIN_WIDTH, PANEL_RESIZE_MAX_WIDTH),
      right: normalizeNumber(state.rightPanelWidth, DEFAULT_PERSISTED_SETTINGS.panelWidths.right, PANEL_RESIZE_MIN_WIDTH, PANEL_RESIZE_MAX_WIDTH)
    },
    agentOptions: {
      includeProject: includeProject ? !!includeProject.checked : DEFAULT_PERSISTED_SETTINGS.agentOptions.includeProject,
      includeCurrentFile: includeCurrentFile ? !!includeCurrentFile.checked : DEFAULT_PERSISTED_SETTINGS.agentOptions.includeCurrentFile
    }
    ,
    uiLanguage: String(state.uiLanguage || 'system')
  };
}

async function persistSettingsNow() {
  if (!state.settingsReady) return;
  const payload = buildPersistedSettingsPayload();
  const result = await window.electronAPI.saveAppSettings(payload);
  if (!result?.success) {
    logAppEvent('ERROR', 'renderer.settings.save.failed', {
      error: result?.error || 'Unknown error'
    });
    console.warn('Settings could not be saved:', result?.error || 'Unknown error');
  } else {
    logAppEvent('INFO', 'renderer.settings.save.success', {
      path: result.path || null,
      provider: providerForLog()
    });
  }
}

function scheduleSettingsSave(delay = 250) {
  if (!state.settingsReady) return;
  if (state.settingsSaveTimer) {
    clearTimeout(state.settingsSaveTimer);
  }
  state.settingsSaveTimer = setTimeout(() => {
    state.settingsSaveTimer = null;
    persistSettingsNow();
  }, delay);
}

async function loadPersistedSettings() {
  try {
    const result = await window.electronAPI.loadAppSettings();
    if (result?.success && result.settings && typeof result.settings === 'object') {
      const settings = result.settings;

      if (typeof settings.chatModel === 'string') state.chatModel = settings.chatModel;
      if (typeof settings.agentModel === 'string') state.agentModel = settings.agentModel;
      if (typeof settings.autocompleteModel === 'string') state.autocompleteModel = settings.autocompleteModel;
      state.autocompleteEnabled = normalizeBool(settings.autocompleteEnabled, DEFAULT_PERSISTED_SETTINGS.autocompleteEnabled);
      state.translatePromptsEnabled = normalizeBool(settings.translatePromptsEnabled, DEFAULT_PERSISTED_SETTINGS.translatePromptsEnabled);
      if (typeof settings.translateModel === 'string') state.translateModel = settings.translateModel;
      const providerConfig = normalizeProviderConfig(settings.aiProvider || DEFAULT_PERSISTED_SETTINGS.aiProvider);
      state.aiProviderType = providerConfig.type;
      state.aiProviderBaseUrl = providerConfig.baseUrl;
      state.aiProviderApiKey = providerConfig.apiKey;
      state.aiProviderModelCatalog = providerConfig.modelCatalog;

      const editorSettings = settings.editor || {};
      state.editorFontSize = normalizeNumber(editorSettings.fontSize, DEFAULT_PERSISTED_SETTINGS.editor.fontSize, 10, 30);
      state.editorTabSize = normalizeNumber(editorSettings.tabSize, DEFAULT_PERSISTED_SETTINGS.editor.tabSize, 1, 8);
      state.editorWordWrap = normalizeBool(editorSettings.wordWrap, DEFAULT_PERSISTED_SETTINGS.editor.wordWrap);
      state.editorMinimap = normalizeBool(editorSettings.minimap, DEFAULT_PERSISTED_SETTINGS.editor.minimap);

      const panelWidths = settings.panelWidths || {};
      state.leftPanelWidth = normalizeNumber(panelWidths.left, DEFAULT_PERSISTED_SETTINGS.panelWidths.left, PANEL_RESIZE_MIN_WIDTH, PANEL_RESIZE_MAX_WIDTH);
      state.rightPanelWidth = normalizeNumber(panelWidths.right, DEFAULT_PERSISTED_SETTINGS.panelWidths.right, PANEL_RESIZE_MIN_WIDTH, PANEL_RESIZE_MAX_WIDTH);

      const agentOptions = settings.agentOptions || {};
      const { includeProject, includeCurrentFile } = getAgentOptionElements();
      if (includeProject) {
        includeProject.checked = normalizeBool(agentOptions.includeProject, DEFAULT_PERSISTED_SETTINGS.agentOptions.includeProject);
      }
      if (includeCurrentFile) {
        includeCurrentFile.checked = normalizeBool(agentOptions.includeCurrentFile, DEFAULT_PERSISTED_SETTINGS.agentOptions.includeCurrentFile);
      }
      // UI language (system / tr / en)
      if (typeof settings.uiLanguage === 'string') {
        state.uiLanguage = settings.uiLanguage || 'system';
      }
    }
  } catch (err) {
    logAppEvent('ERROR', 'renderer.settings.load.failed', {
      error: err?.message || String(err),
      stack: err?.stack || null
    });
    console.warn('Settings could not be loaded:', err?.message || err);
  } finally {
    applySettingsToUIFromState();
    state.settingsReady = true;
  }
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = 'info', duration = 3000) {
  const safeMessage = repairMojibake(String(message ?? ''));
  logAppEvent(type === 'error' ? 'ERROR' : (type === 'warning' ? 'WARN' : 'INFO'), 'renderer.toast', {
    type,
    message: clipLogText(safeMessage, 500),
    duration
  });
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
  toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="icon-sm"></i><span>${safeMessage}</span>`;
  container.appendChild(toast);
  repairMojibakeInElement(toast);
  refreshIcons();
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============ DIALOG ============
function showInputDialog(title, placeholder = '', defaultValue = '') {
  const existingOverlay = document.querySelector('.dialog-overlay');
  if (state.dialogOpen || existingOverlay) {
    const existingInput = existingOverlay?.querySelector('.dialog-input');
    existingInput?.focus();
    existingInput?.select?.();
    return Promise.resolve(null);
  }

  state.dialogOpen = true;
  return new Promise((resolve) => {
    const safeTitle = repairMojibake(title);
    const safePlaceholder = repairMojibake(placeholder);
    const safeDefaultValue = repairMojibake(defaultValue);
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-title">${safeTitle}</div>
        <input type="text" class="dialog-input" placeholder="${safePlaceholder}" value="${safeDefaultValue}">
        <div class="dialog-actions">
          <button class="btn btn-secondary btn-sm" id="dialog-cancel">${uiText('dialog_cancel')}</button>
          <button class="btn btn-primary btn-sm" id="dialog-confirm">${uiText('dialog_confirm')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    repairMojibakeInElement(overlay);
    const input = overlay.querySelector('.dialog-input');
    input.focus();
    input.select();

    let settled = false;
    const cleanup = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      state.dialogOpen = false;
      resolve(value);
    };

    overlay.querySelector('#dialog-cancel').onclick = () => cleanup(null);
    overlay.querySelector('#dialog-confirm').onclick = () => cleanup(input.value);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') cleanup(input.value);
      if (e.key === 'Escape') cleanup(null);
    };
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
  });
}

// ============ WINDOW CONTROLS ============
function initWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
  document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI.maximizeWindow());
  document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI.closeWindow());

  // Menu events
  window.electronAPI.onMenuSave(() => saveCurrentFile());
  window.electronAPI.onProjectDirectorySelected((dir) => openProject(dir));
}

// ============ KEYBOARD SHORTCUTS ============
function isExplorerShortcutEvent(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key !== 'Delete' && e.key !== 'F2') return false;
  if (!state.selectedTreeItem) return false;
  if (state.shortcutScope !== 'explorer') return false;

  const explorerPanel = document.getElementById('panel-explorer');
  return !!explorerPanel?.classList.contains('active');
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (isExplorerShortcutEvent(e)) {
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Delete') {
        deleteItem(state.selectedTreeItem.path, state.selectedTreeItem.name, state.selectedTreeItem.isDirectory);
      } else {
        renameTreeItem(state.selectedTreeItem);
      }
      return;
    }

    // Ctrl+S - Save
    if (e.ctrlKey && e.key && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
    // Ctrl+O - Open folder
    if (e.ctrlKey && e.key && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      openFolderDialog();
    }
    // Ctrl+` - Toggle terminal
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      toggleTerminal();
    }
    // Ctrl+W - Close tab
    if (e.ctrlKey && e.key && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (state.activeFile) closeTab(state.activeFile);
    }
    // Ctrl+B - Toggle sidebar
    if (e.ctrlKey && e.key && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const panels = document.querySelectorAll('.sidebar-panel');
      const sidebar = document.getElementById('sidebar');
      const anyActive = document.querySelector('.sidebar-panel.active');
      if (anyActive) {
        panels.forEach(p => p.classList.remove('active'));
        sidebar.style.width = 'var(--sidebar-width)';
      } else {
        document.querySelector('.sidebar-panel').classList.add('active');
        sidebar.style.width = '';
      }
    }
  });
}

// ============ SIDEBAR TABS ============
const PANEL_RESIZE_MIN_WIDTH = 220;
const PANEL_RESIZE_MAX_WIDTH = 560;
const PANEL_RESIZE_MIN_EDITOR_WIDTH = 420;

function isLeftSidebarPanelOpen() {
  return !!document.querySelector('#panel-explorer.active, #panel-settings.active');
}

function isRightSidebarPanelOpen() {
  return !!document.querySelector('#panel-ai-chat.active, #panel-ai-agent.active');
}

function getSidebarWidthPx() {
  const fromVar = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'),
    10
  );
  return Number.isFinite(fromVar) && fromVar > 0 ? fromVar : 48;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function constrainPanelWidths(mainContainer, leftOpen, rightOpen) {
  if (!mainContainer) return;

  const rect = mainContainer.getBoundingClientRect();
  const containerWidth = rect.width || mainContainer.clientWidth;
  if (!containerWidth) return;

  const sidebarWidth = getSidebarWidthPx();
  const availableForPanels = Math.max(140, containerWidth - sidebarWidth - PANEL_RESIZE_MIN_EDITOR_WIDTH);
  const minSingle = Math.min(PANEL_RESIZE_MIN_WIDTH, availableForPanels);
  const maxSingle = Math.min(PANEL_RESIZE_MAX_WIDTH, availableForPanels);

  state.leftPanelWidth = clampNumber(state.leftPanelWidth, minSingle, maxSingle);
  state.rightPanelWidth = clampNumber(state.rightPanelWidth, minSingle, maxSingle);

  if (leftOpen && rightOpen) {
    const total = state.leftPanelWidth + state.rightPanelWidth;
    if (total > availableForPanels) {
      let overflow = total - availableForPanels;
      const rightReducible = Math.max(0, state.rightPanelWidth - minSingle);
      const rightReduce = Math.min(overflow, rightReducible);
      state.rightPanelWidth -= rightReduce;
      overflow -= rightReduce;

      if (overflow > 0) {
        state.leftPanelWidth = Math.max(minSingle, state.leftPanelWidth - overflow);
      }
    }
  }
}

function updateGridLayout() {
  const mainContainer = document.getElementById('main-container');
  if (!mainContainer) return;

  const leftOpen = isLeftSidebarPanelOpen();
  const rightOpen = isRightSidebarPanelOpen();
  constrainPanelWidths(mainContainer, leftOpen, rightOpen);

  mainContainer.classList.remove('left-open', 'right-open', 'both-open');
  if (leftOpen && rightOpen) mainContainer.classList.add('both-open');
  else if (leftOpen) mainContainer.classList.add('left-open');
  else if (rightOpen) mainContainer.classList.add('right-open');

  mainContainer.style.setProperty('--panel-width-left', `${Math.round(state.leftPanelWidth)}px`);
  mainContainer.style.setProperty('--panel-width-right', `${Math.round(state.rightPanelWidth)}px`);
}

function initPanelResizers() {
  const mainContainer = document.getElementById('main-container');
  const leftHandle = document.getElementById('left-panel-resize-handle');
  const rightHandle = document.getElementById('right-panel-resize-handle');
  if (!mainContainer || !leftHandle || !rightHandle) return;

  let activeSide = null;

  const stopResize = () => {
    if (!activeSide) return;
    activeSide = null;
    document.body.classList.remove('resizing-panels');
    leftHandle.classList.remove('dragging');
    rightHandle.classList.remove('dragging');
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', stopResize);
    scheduleSettingsSave(50);
  };

  const onResizeMove = (e) => {
    if (!activeSide) return;
    const rect = mainContainer.getBoundingClientRect();
    const sidebarWidth = getSidebarWidthPx();
    const leftOpen = isLeftSidebarPanelOpen();
    const rightOpen = isRightSidebarPanelOpen();

    if (activeSide === 'left') {
      const rightWidth = rightOpen ? state.rightPanelWidth : 0;
      const maxWidth = rect.width - sidebarWidth - rightWidth - PANEL_RESIZE_MIN_EDITOR_WIDTH;
      if (maxWidth < 120) return;
      const minWidth = Math.min(PANEL_RESIZE_MIN_WIDTH, maxWidth);
      const clampedWidth = clampNumber(
        e.clientX - rect.left - sidebarWidth,
        minWidth,
        Math.min(PANEL_RESIZE_MAX_WIDTH, maxWidth)
      );
      state.leftPanelWidth = Math.round(clampedWidth);
    } else if (activeSide === 'right') {
      const leftWidth = leftOpen ? state.leftPanelWidth : 0;
      const maxWidth = rect.width - sidebarWidth - leftWidth - PANEL_RESIZE_MIN_EDITOR_WIDTH;
      if (maxWidth < 120) return;
      const minWidth = Math.min(PANEL_RESIZE_MIN_WIDTH, maxWidth);
      const clampedWidth = clampNumber(
        rect.right - e.clientX,
        minWidth,
        Math.min(PANEL_RESIZE_MAX_WIDTH, maxWidth)
      );
      state.rightPanelWidth = Math.round(clampedWidth);
    }

    updateGridLayout();
  };

  const startResize = (side, e) => {
    if (side === 'left' && !isLeftSidebarPanelOpen()) return;
    if (side === 'right' && !isRightSidebarPanelOpen()) return;
    e.preventDefault();
    activeSide = side;
    document.body.classList.add('resizing-panels');
    if (side === 'left') leftHandle.classList.add('dragging');
    if (side === 'right') rightHandle.classList.add('dragging');
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', stopResize);
  };

  leftHandle.addEventListener('mousedown', (e) => startResize('left', e));
  rightHandle.addEventListener('mousedown', (e) => startResize('right', e));

  window.addEventListener('resize', () => {
    updateGridLayout();
  });
}

function initSidebarTabs() {
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      const isRightPanel = ['ai-chat', 'ai-agent'].includes(panelId);
      const isLeftPanel = ['explorer', 'settings'].includes(panelId);
      const panel = document.getElementById(`panel-${panelId}`);
      const isCurrentlyActive = tab.classList.contains('active');

      if (isCurrentlyActive) {
        tab.classList.remove('active');
        if (panel) panel.classList.remove('active');
        updateGridLayout();
        return;
      }

      // Deactivate other tabs on same side
      document.querySelectorAll('.sidebar-tab').forEach(t => {
        if (isRightPanel && ['ai-chat', 'ai-agent'].includes(t.dataset.panel)) t.classList.remove('active');
        else if (isLeftPanel && ['explorer', 'settings'].includes(t.dataset.panel)) t.classList.remove('active');
      });

      // Hide other panels on same side
      if (isRightPanel) document.querySelectorAll('#panel-ai-chat, #panel-ai-agent').forEach(p => p.classList.remove('active'));
      else if (isLeftPanel) document.querySelectorAll('#panel-explorer, #panel-settings').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      if (panel) panel.classList.add('active');
      if (panelId === 'explorer') state.shortcutScope = 'explorer';
      else if (panelId === 'ai-chat') state.shortcutScope = 'chat';
      else if (panelId === 'ai-agent') state.shortcutScope = 'agent';
      updateGridLayout();
    });
  });
}

// ============ FILE EXPLORER ============
function setSelectedTreeItem(item, element) {
  if (!item || !element) return;
  state.selectedTreeItem = {
    path: item.path,
    name: item.name,
    isDirectory: !!item.isDirectory,
    isFile: !!item.isFile
  };
  document.querySelectorAll('.tree-item.tree-selected').forEach((el) => el.classList.remove('tree-selected'));
  element.classList.add('tree-selected');
}

function restoreSelectedTreeItem() {
  if (!state.selectedTreeItem?.path) return;
  const selectedEl = document.querySelector(`.tree-item[data-path="${CSS.escape(state.selectedTreeItem.path)}"]`);
  if (!selectedEl) {
    state.selectedTreeItem = null;
    return;
  }
  selectedEl.classList.add('tree-selected');
}

function initFileExplorer() {
  document.getElementById('btn-open-folder')?.addEventListener('click', openFolderDialog);
  document.getElementById('btn-open-project')?.addEventListener('click', openFolderDialog);
  document.getElementById('btn-new-file')?.addEventListener('click', newFileDialog);
  document.getElementById('btn-new-folder')?.addEventListener('click', newFolderDialog);
  document.getElementById('btn-refresh-tree')?.addEventListener('click', refreshFileTree);

  // Empty space right-click in file tree
  const fileTree = document.getElementById('file-tree');
  if (fileTree) {
    fileTree.addEventListener('click', (e) => {
      if (e.target === fileTree || e.target.closest('.tree-item') === null) {
        state.shortcutScope = 'explorer';
        state.selectedTreeItem = null;
        document.querySelectorAll('.tree-item.tree-selected').forEach((el) => el.classList.remove('tree-selected'));
      }
    });

    fileTree.addEventListener('contextmenu', (e) => {
      // Only show menu if clicking on empty tree space (not on file/folder item)
      if (e.target === fileTree || e.target.closest('.tree-item') === null) {
        e.preventDefault();
        state.shortcutScope = 'explorer';
        state.selectedTreeItem = null;
        document.querySelectorAll('.tree-item.tree-selected').forEach((el) => el.classList.remove('tree-selected'));
        if (state.projectDir) {
          showContextMenuForEmptySpace(e.clientX, e.clientY);
        }
      }
    });
  }

  window.electronAPI.onProjectTreeChanged((payload) => {
    if (!state.projectDir) return;
    if (payload?.watchedDir && payload.watchedDir !== state.projectDir) return;
    scheduleRealtimeTreeRefresh();
  });

  window.addEventListener('beforeunload', () => {
    window.electronAPI.removeProjectTreeChangedListeners();
    window.electronAPI.unwatchProjectTree();
    if (state.settingsSaveTimer) {
      clearTimeout(state.settingsSaveTimer);
      state.settingsSaveTimer = null;
      persistSettingsNow();
    }
  });
}

function scheduleRealtimeTreeRefresh() {
  if (!state.projectDir) return;
  if (state.treeRefreshTimer) {
    clearTimeout(state.treeRefreshTimer);
  }
  state.treeRefreshTimer = setTimeout(() => {
    refreshFileTree({ preserveScroll: true });
  }, 120);
}

async function openFolderDialog() {
  const dir = await window.electronAPI.openDirectoryDialog();
  if (dir) {
    await openProject(dir);
  }
}

async function openProject(dir) {
  await window.electronAPI.unwatchProjectTree();

  const trusted = await window.electronAPI.trustDirectory(dir);
  if (!trusted) {
    showToast(uiText('project_not_trusted'), 'warning');
    // Still open but restricted
  }

  state.projectDir = dir;
  state.isTrusted = trusted;

  // Update status bar
  const dirName = dir.split(/[/\\]/).pop();
  document.querySelector('#status-project span:last-child').textContent = dirName;

  const trustEl = document.getElementById('status-trust');
  if (trusted) {
    trustEl.className = 'status-item status-trusted';
    trustEl.innerHTML = `<i data-lucide="shield-check" class="icon-xs"></i><span>${uiText('status_trusted')}</span>`;
  } else {
    trustEl.className = 'status-item status-untrusted';
    trustEl.innerHTML = `<i data-lucide="shield-off" class="icon-xs"></i><span>${uiText('status_untrusted')}</span>`;
  }
  refreshIcons();

  await refreshFileTree();

  // Init terminal with project dir
  if (state.terminalOpen) {
    await initTerminal();
  }

  const watchResult = await window.electronAPI.watchProjectTree(dir);
  if (!watchResult.success) {
    showToast(uiTextf('project_watch_failed', { error: watchResult.error }), 'warning');
  }

  showToast(uiTextf('project_opened', { name: dirName }), 'success');
}

async function refreshFileTree(options = {}) {
  if (!state.projectDir) return;
  if (state.treeRefreshing) {
    state.treeRefreshPending = true;
    return;
  }

  state.treeRefreshing = true;
  const preserveScroll = options.preserveScroll !== false;
  const tree = document.getElementById('file-tree');
  const previousScroll = preserveScroll ? tree.scrollTop : 0;

  try {
    tree.innerHTML = '';
    await renderDirectory(state.projectDir, tree, 0);
    refreshTreeModifiedIndicators();

    if (state.activeFile) {
      const activeTreeItem = document.querySelector(`.tree-item[data-path="${CSS.escape(state.activeFile)}"]`);
      if (activeTreeItem) activeTreeItem.classList.add('active');
    }
    restoreSelectedTreeItem();

    if (preserveScroll) {
      tree.scrollTop = previousScroll;
    }
    refreshIcons();
  } finally {
    state.treeRefreshing = false;
    if (state.treeRefreshPending) {
      state.treeRefreshPending = false;
      refreshFileTree(options);
    }
  }
}

async function renderDirectory(dirPath, container, depth) {
  const items = await window.electronAPI.readDirectory(dirPath);
  for (const item of items) {
    const el = createTreeItem(item, depth);
    container.appendChild(el);
  }
}

function createTreeItem(item, depth) {
  const div = document.createElement('div');
  div.className = `tree-item ${item.isDirectory ? 'folder' : 'file'}`;
  div.style.setProperty('--indent', depth);
  div.dataset.path = item.path;
  div.dataset.isDir = item.isDirectory;
  div.tabIndex = 0;  // Make focusable

  const ext = item.name.split('.').pop().toLowerCase();
  if (!item.isDirectory) {
    div.classList.add(`file-${ext}`);
  }

  const fileIcon = item.isDirectory ? 'folder' : getFileIcon(ext);

  if (item.isDirectory) {
    div.innerHTML = `
      <i data-lucide="chevron-right" class="tree-chevron"></i>
      <i data-lucide="${fileIcon}" class="tree-icon"></i>
      <span class="tree-name">${item.name}<span class="tree-modified-dot" aria-hidden="true"></span></span>
      <div class="tree-item-actions">
        <button class="icon-btn-xs" title="${uiText('ctx_rename')}" aria-label="${uiText('ctx_rename')}" data-action="rename"><i data-lucide="edit-2" class="icon-xs"></i></button>
        <button class="icon-btn-xs" title="${uiText('ctx_delete')}" aria-label="${uiText('ctx_delete')}" data-action="delete"><i data-lucide="trash-2" class="icon-xs"></i></button>
      </div>
    `;

    let expanded = false;
    let childContainer = null;

    div.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action]')) return;
      state.shortcutScope = 'explorer';
      setSelectedTreeItem(item, div);
      div.focus();
      const chevron = div.querySelector('.tree-chevron');
      if (!expanded) {
        expanded = true;
        chevron.classList.add('open');
        div.querySelector('.tree-icon').setAttribute('data-lucide', 'folder-open');
        childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        div.after(childContainer);
        await renderDirectory(item.path, childContainer, depth + 1);
        refreshIcons();
      } else {
        expanded = false;
        chevron.classList.remove('open');
        div.querySelector('.tree-icon').setAttribute('data-lucide', 'folder');
        if (childContainer) {
          childContainer.remove();
          childContainer = null;
        }
        refreshIcons();
      }
    });
  } else {
    div.innerHTML = `
      <span style="width:14px;display:inline-block"></span>
      <i data-lucide="${fileIcon}" class="tree-icon"></i>
      <span class="tree-name">${item.name}<span class="tree-modified-dot" aria-hidden="true"></span></span>
      <div class="tree-item-actions">
        <button class="icon-btn-xs" title="${uiText('ctx_rename')}" aria-label="${uiText('ctx_rename')}" data-action="rename"><i data-lucide="edit-2" class="icon-xs"></i></button>
        <button class="icon-btn-xs" title="${uiText('ctx_delete')}" aria-label="${uiText('ctx_delete')}" data-action="delete"><i data-lucide="trash-2" class="icon-xs"></i></button>
      </div>
    `;

    div.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      state.shortcutScope = 'explorer';
      setSelectedTreeItem(item, div);
      div.focus();
      openFile(item.path, { focusEditor: false });
    });
  }

    // Delete action handler
  const deleteHandler = async (e) => {
    if (e) e.stopPropagation();
    state.shortcutScope = 'explorer';
    setSelectedTreeItem(item, div);
    await deleteItem(item.path, item.name, item.isDirectory);
  };

    // Rename button
  div.querySelector('[data-action="rename"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.shortcutScope = 'explorer';
    setSelectedTreeItem(item, div);
    renameTreeItem(item);
  });
  div.querySelector('[data-action="delete"]')?.addEventListener('click', deleteHandler);

  // Delete key support
  div.addEventListener('keydown', (e) => {
    state.shortcutScope = 'explorer';
    setSelectedTreeItem(item, div);
    if (e.repeat) return;
    if (e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      deleteHandler();
    }
    if (e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      renameTreeItem(item);
    }
  });

  // Right-click context menu
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.shortcutScope = 'explorer';
    setSelectedTreeItem(item, div);
    div.focus();
    showContextMenu(e.clientX, e.clientY, item);
  });

  return div;
}

function getFileIcon(ext) {
  const iconMap = {
    js: 'file-code', ts: 'file-code', jsx: 'file-code', tsx: 'file-code',
    py: 'file-code', rb: 'file-code', go: 'file-code', rs: 'file-code',
    java: 'file-code', c: 'file-code', cpp: 'file-code', cs: 'file-code',
    php: 'file-code', swift: 'file-code', kt: 'file-code',
    html: 'file-code', css: 'file-code', scss: 'file-code', less: 'file-code',
    json: 'file-json', xml: 'file-code', yaml: 'file-text', yml: 'file-text',
    md: 'file-text', txt: 'file-text', log: 'file-text',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image',
    pdf: 'file', zip: 'file-archive',
    vue: 'file-code', svelte: 'file-code',
    sh: 'terminal', bat: 'terminal', ps1: 'terminal',
    gitignore: 'git-branch',
    env: 'lock', lock: 'lock'
  };
  return iconMap[ext] || 'file';
}

function updateTreeItemModifiedState(filePath, modified) {
  const el = document.querySelector(`.tree-item[data-path="${CSS.escape(filePath)}"]`);
  if (!el) return;
  el.classList.toggle('modified', !!modified);
}

function refreshTreeModifiedIndicators() {
  state.openFiles.forEach(file => {
    updateTreeItemModifiedState(file.path, !!file.modified);
  });
}

async function openFileFromExplorerContext(filePath) {
  try {
    await openFile(filePath, { focusEditor: true });
  } catch (err) {
    showToast(uiTextf('file_open_failed', { error: err?.message || String(err) }), 'error');
  }
}

async function openFileInBrowserFromExplorer(filePath) {
  const result = await window.electronAPI.openFileInBrowser(filePath);
  if (!result?.success) {
    showToast(uiTextf('open_in_browser_error', {
      error: result?.error || uiText('unknown_error')
    }), 'error');
    return;
  }
  showToast(uiText('file_opened_in_browser'), 'info', 1500);
}

// Context Menu
function showContextMenu(x, y, item) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const items = [];
  if (item.isDirectory) {
    items.push({ icon: 'file-plus', label: uiText('ctx_new_file'), action: () => newFileInDir(item.path) });
    items.push({ icon: 'folder-plus', label: uiText('ctx_new_folder'), action: () => newFolderInDir(item.path) });
    items.push({ type: 'separator' });
  }
  if (item.isFile) {
    items.push({ icon: 'file-edit', label: uiText('ctx_open'), action: () => openFileFromExplorerContext(item.path) });
    items.push({ icon: 'globe', label: uiText('ctx_open_in_browser'), action: () => openFileInBrowserFromExplorer(item.path) });
    items.push({ type: 'separator' });
  }
  items.push({ icon: 'edit-2', label: uiText('ctx_rename'), action: () => renameTreeItem(item) });
  items.push({ type: 'separator' });
  items.push({ icon: 'trash-2', label: uiText('ctx_delete'), action: () => deleteItem(item.path, item.name, item.isDirectory), danger: true });

  for (const it of items) {
    if (it.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = `context-menu-item${it.danger ? ' danger' : ''}`;
      el.innerHTML = `<i data-lucide="${it.icon}" class="icon-sm"></i>${it.label}`;
      el.addEventListener('click', async () => {
        removeContextMenu();
        try {
          await it.action();
        } catch (err) {
          showToast(uiTextf('operation_error', { error: err?.message || String(err) }), 'error');
        }
      });
      menu.appendChild(el);
    }
  }

  document.body.appendChild(menu);
  refreshIcons();

  // Adjust position if out of bounds
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

  setTimeout(() => {
    document.addEventListener('click', removeContextMenu, { once: true });
  }, 0);
}

function removeContextMenu() {
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
}

function showContextMenuForEmptySpace(x, y) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const items = [
    { icon: 'file-plus', label: uiText('ctx_new_file'), action: () => newFileDialog() },
    { icon: 'folder-plus', label: uiText('ctx_new_folder'), action: () => newFolderDialog() }
  ];

  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'context-menu-item';
    el.innerHTML = `<i data-lucide="${it.icon}" class="icon-sm"></i>${it.label}`;
    el.addEventListener('click', () => { removeContextMenu(); it.action(); });
    menu.appendChild(el);
  }

  document.body.appendChild(menu);
  refreshIcons();

  // Adjust position if out of bounds
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

  setTimeout(() => {
    document.addEventListener('click', removeContextMenu, { once: true });
  }, 0);
}

async function newFileDialog() {
  if (!state.projectDir) { showToast(uiText('toast_open_project_first'), 'warning'); return; }
  const name = await showInputDialog(uiText('dialog_new_file_title'), uiText('dialog_new_file_placeholder'));
  if (name) {
    const filePath = await window.electronAPI.pathJoin(state.projectDir, name);
    const result = await window.electronAPI.createFile(filePath, '');
    if (result.success) {
      showToast(uiTextf('toast_created_with_name', { name }), 'success');
      await refreshFileTree();
      openFile(filePath);
    } else {
      showToast(uiTextf('operation_error', { error: result.error }), 'error');
    }
  }
}


async function newFolderDialog() {
  if (!state.projectDir) { showToast(uiText('toast_open_project_first'), 'warning'); return; }
  const name = await showInputDialog(uiText('dialog_new_folder_title'), uiText('dialog_new_folder_placeholder'));
  if (name) {
    const dirPath = await window.electronAPI.pathJoin(state.projectDir, name);
    const result = await window.electronAPI.createDirectory(dirPath);
    if (result.success) {
      showToast(uiTextf('toast_created_with_name', { name }), 'success');
      await refreshFileTree();
    } else {
      showToast(uiTextf('operation_error', { error: result.error }), 'error');
    }
  }
}

async function newFileInDir(dirPath) {
  const name = await showInputDialog(uiText('dialog_new_file_title'), uiText('dialog_new_file_placeholder'));
  if (name) {
    const filePath = await window.electronAPI.pathJoin(dirPath, name);
    const result = await window.electronAPI.createFile(filePath, '');
    if (result.success) {
      showToast(uiTextf('toast_created_with_name', { name }), 'success');
      await refreshFileTree();
      openFile(filePath);
    }
  }
}

async function newFolderInDir(dirPath) {
  const name = await showInputDialog(uiText('dialog_new_folder_title'), uiText('dialog_new_folder_placeholder'));
  if (name) {
    const path = await window.electronAPI.pathJoin(dirPath, name);
    const result = await window.electronAPI.createDirectory(path);
    if (result.success) {
      showToast(uiTextf('toast_created_with_name', { name }), 'success');
      await refreshFileTree();
    }
  }
}

function closeDeletedPathTabs(itemPath, isDirectory = false) {
  if (!isDirectory) {
    closeTab(itemPath);
    return;
  }

  const normalizedPath = itemPath.replace(/[\\\/]+$/, '');
  const tabsToClose = state.openFiles
    .filter((f) => f.path === normalizedPath || f.path.startsWith(`${normalizedPath}\\`) || f.path.startsWith(`${normalizedPath}/`))
    .map((f) => f.path);

  tabsToClose.forEach((tabPath) => closeTab(tabPath));
}

async function deleteItem(itemPath, itemName = '', isDirectory = false) {
  if (state.deleteInProgress) return false;
  state.deleteInProgress = true;
  try {
    const result = await window.electronAPI.deleteFile(itemPath);
    if (result.success) {
      showToast(uiTextf('toast_deleted_with_name', { name: itemName || uiText('status_deleted') }), 'success');
      closeDeletedPathTabs(itemPath, isDirectory);
      if (state.selectedTreeItem?.path === itemPath) {
        state.selectedTreeItem = null;
      }
      await refreshFileTree();
      return true;
    }
    if (!result.confirmed) {
      return false;
    }
    showToast(uiTextf('toast_delete_failed', { error: result.error || uiText('unknown_error') }), 'error');
    return false;
  } finally {
    state.deleteInProgress = false;
  }
}

async function renameTreeItem(item) {
  if (!item?.path) return;
  if (state.renameInProgress) return;
  state.renameInProgress = true;
  try {
    const dir = await window.electronAPI.pathDirname(item.path);
    const currentName = await window.electronAPI.pathBasename(item.path);
    const newName = await showInputDialog(uiText('ctx_rename'), currentName, currentName);
    if (!newName || newName === currentName) return;
    const targetPath = await window.electronAPI.pathJoin(dir, newName);
    const result = await window.electronAPI.renameFile(item.path, targetPath);
    if (result.success) {
      if (state.selectedTreeItem?.path === item.path) {
        state.selectedTreeItem = {
          ...state.selectedTreeItem,
          path: targetPath,
          name: newName
        };
      }
      showToast(uiText('toast_renamed'), 'success');
      await refreshFileTree();
    } else {
      showToast(uiTextf('operation_error', { error: result.error }), 'error');
    }
  } finally {
    state.renameInProgress = false;
  }
}

// ============ FILE OPERATIONS ============
async function openFile(filePath, options = {}) {
  const focusEditor = options.focusEditor !== false;
  try {
    if (!state.editor || typeof monaco === 'undefined' || !monaco?.editor) {
      showToast(uiText('toast_editor_not_ready'), 'warning');
      return;
    }

    // Check if already open
    const existing = state.openFiles.find(f => f.path === filePath);
    if (existing) {
      activateTab(filePath, { focusEditor });
      return;
    }

    const res = await window.electronAPI.readFile(filePath);
    if (!res.success) {
      showToast(uiTextf('file_open_failed', { error: res.error }), 'error');
      return;
    }

    const baseName = await window.electronAPI.pathBasename(filePath);
    const ext = baseName.split('.').pop().toLowerCase();
    const language = getLanguageFromExt(ext);

    // Create Monaco model
    const uri = monaco.Uri.file(filePath);
    let monacoModel = monaco.editor.getModel(uri);
    if (monacoModel) {
      monacoModel.setValue(res.content);
    } else {
      monacoModel = monaco.editor.createModel(res.content, language, uri);
    }

    const fileObj = {
      path: filePath,
      name: baseName,
      content: res.content,
      model: monacoModel,
      modified: false,
      language
    };

    state.openFiles.push(fileObj);
    createTab(fileObj);
    activateTab(filePath, { focusEditor });
    updateTreeItemModifiedState(filePath, false);

    // Track modifications
    monacoModel.onDidChangeContent(() => {
      const f = state.openFiles.find(f => f.path === filePath);
      if (f) {
        f.modified = true;
        updateTabModified(filePath, true);
        updateTreeItemModifiedState(filePath, true);
      }
      // Autocomplete trigger
      triggerAutocomplete();
    });
  } catch (err) {
    showToast(uiTextf('file_open_failed', { error: err?.message || String(err) }), 'error');
  }
}

function createTab(fileObj) {
  const tabList = document.getElementById('tabs-list');
  const tab = document.createElement('div');
  tab.className = 'editor-tab';
  tab.dataset.path = fileObj.path;
  const ext = fileObj.name.split('.').pop().toLowerCase();

  tab.innerHTML = `
    <i data-lucide="${getFileIcon(ext)}" class="tab-icon"></i>
    <span class="tab-name">${fileObj.name}</span>
    <span class="tab-dot"></span>
    <span class="tab-close"><i data-lucide="x" style="width:12px;height:12px"></i></span>
  `;

  tab.addEventListener('click', (e) => {
    if (e.target.closest('.tab-close')) {
      closeTab(fileObj.path);
    } else {
      activateTab(fileObj.path);
    }
  });

  tabList.appendChild(tab);
  refreshIcons();
}

function activateTab(filePath, options = {}) {
  const focusEditor = options.focusEditor !== false;
  state.activeFile = filePath;
  const fileObj = state.openFiles.find(f => f.path === filePath);

  // Update tab UI
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.editor-tab[data-path="${CSS.escape(filePath)}"]`);
  if (tab) tab.classList.add('active');

  // Update file tree highlight
  document.querySelectorAll('.tree-item').forEach(t => t.classList.remove('active'));
  const treeItem = document.querySelector(`.tree-item[data-path="${CSS.escape(filePath)}"]`);
  if (treeItem) treeItem.classList.add('active');

  // Show editor, hide welcome
  document.getElementById('editor-welcome').style.display = 'none';
  document.getElementById('monaco-editor').style.display = 'block';

  if (fileObj && state.editor) {
    state.editor.setModel(fileObj.model);
    if (focusEditor) {
      state.editor.focus();
      state.shortcutScope = 'editor';
    }
  }

  // Update status bar
  if (fileObj) {
    document.getElementById('status-language').textContent = fileObj.language || uiText('status_plain_text');
  }
}

function closeTab(filePath) {
  const index = state.openFiles.findIndex(f => f.path === filePath);
  if (index === -1) return;

  const fileObj = state.openFiles[index];

  // Dispose model
  if (fileObj.model) {
    fileObj.model.dispose();
  }

  state.openFiles.splice(index, 1);
  updateTreeItemModifiedState(filePath, false);

  // Remove tab element
  const tab = document.querySelector(`.editor-tab[data-path="${CSS.escape(filePath)}"]`);
  if (tab) tab.remove();

  // Activate another tab
  if (state.activeFile === filePath) {
    if (state.openFiles.length > 0) {
      const nextIndex = Math.min(index, state.openFiles.length - 1);
      activateTab(state.openFiles[nextIndex].path);
    } else {
      state.activeFile = null;
      document.getElementById('editor-welcome').style.display = 'flex';
      document.getElementById('monaco-editor').style.display = 'none';
      document.getElementById('status-language').textContent = uiText('status_plain_text');
    }
  }
}

function updateTabModified(filePath, modified) {
  const tab = document.querySelector(`.editor-tab[data-path="${CSS.escape(filePath)}"]`);
  if (tab) {
    tab.classList.toggle('modified', modified);
  }
}

async function saveCurrentFile() {
  if (!state.activeFile) return;
  const fileObj = state.openFiles.find(f => f.path === state.activeFile);
  if (!fileObj) return;

  const content = fileObj.model.getValue();
  const result = await window.electronAPI.writeFile(fileObj.path, content);

  if (result.success) {
    fileObj.modified = false;
    fileObj.content = content;
    updateTabModified(fileObj.path, false);
    updateTreeItemModifiedState(fileObj.path, false);
    showToast(uiText('toast_saved'), 'success', 1500);
  } else {
    showToast(uiTextf('toast_save_failed', { error: result.error }), 'error');
  }
}

function getLanguageFromExt(ext) {
  const langMap = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', pyw: 'python',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json', jsonc: 'json',
    xml: 'xml', svg: 'xml',
    md: 'markdown', mdx: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    bat: 'bat', cmd: 'bat', ps1: 'powershell',
    sql: 'sql',
    java: 'java', kt: 'kotlin',
    c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    r: 'r',
    lua: 'lua',
    dart: 'dart',
    vue: 'html',
    svelte: 'html',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'ini',
    ini: 'ini',
    env: 'ini',
    gitignore: 'ini',
    txt: 'plaintext',
    log: 'plaintext'
  };
  return langMap[ext] || 'plaintext';
}

// ============ MONACO EDITOR ============
function initMonacoEditor() {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

  require(['vs/editor/editor.main'], () => {
    // Define CaYaDev theme
    monaco.editor.defineTheme('cayadev-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6e7681', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'ffa657' },
        { token: 'constant', foreground: '79c0ff' },
        { token: 'operator', foreground: 'ff7b72' },
        { token: 'delimiter', foreground: '8b949e' },
        { token: 'tag', foreground: '7ee787' },
        { token: 'attribute.name', foreground: '79c0ff' },
        { token: 'attribute.value', foreground: 'a5d6ff' },
        { token: 'meta', foreground: '8b949e' },
        { token: 'regexp', foreground: '7ee787' }
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#264f7833',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editorCursor.foreground': '#e63946',
        'editor.findMatchBackground': '#e6394644',
        'editor.findMatchHighlightBackground': '#e6394622',
        'editorWidget.background': '#1c2938',
        'editorWidget.border': '#1e2d3d',
        'editorSuggestWidget.background': '#1c2938',
        'editorSuggestWidget.border': '#1e2d3d',
        'editorSuggestWidget.selectedBackground': '#243044',
        'editorSuggestWidget.highlightForeground': '#e63946',
        'editorGutter.background': '#0d1117',
        'minimap.background': '#0d1117',
        'scrollbarSlider.background': '#2a3a5266',
        'scrollbarSlider.hoverBackground': '#2a3a5299',
        'scrollbarSlider.activeBackground': '#2a3a52cc'
      }
    });

    state.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
      theme: 'cayadev-dark',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: state.editorFontSize,
      lineHeight: 22,
      tabSize: state.editorTabSize,
      minimap: { enabled: state.editorMinimap },
      scrollBeyondLastLine: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      autoIndent: 'full',
      formatOnPaste: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      wordWrap: state.editorWordWrap ? 'on' : 'off',
      padding: { top: 8 },
      automaticLayout: true
    });

    state.editor.onDidFocusEditorText(() => {
      state.shortcutScope = 'editor';
    });

    // Cursor position tracking
    state.editor.onDidChangeCursorPosition((e) => {
      document.getElementById('status-line').textContent =
        uiTextf('status_line_position', { line: e.position.lineNumber, column: e.position.column });
    });

    // Register AI autocomplete provider
    registerAICompletionProvider();
  });
}

// ============ AI AUTOCOMPLETE ============
function registerAICompletionProvider() {
  // Inline completion (ghost text)
  let lastInlineRequest = null;

  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, context, token) => {
      if (!state.autocompleteEnabled || !state.autocompleteModel) return { items: [] };

      // Cancel previous request
      if (lastInlineRequest) {
        lastInlineRequest.cancelled = true;
      }
      const request = { cancelled: false };
      lastInlineRequest = request;

      // Debounce - higher debounce for better UX
      await new Promise(r => setTimeout(r, 1200));
      if (request.cancelled || token.isCancellationRequested) return { items: [] };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: Math.max(1, position.lineNumber - 50),
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      // Only trigger on reasonable characters
      const lineContent = model.getLineContent(position.lineNumber);
      const charBefore = lineContent[position.column - 2];
      
      // Skip if at start of line or after whitespace only
      if (!charBefore || /^[\s]$/.test(charBefore.slice(-5))) {
        return { items: [] };
      }

      const language = model.getLanguageId();
      const prompt = `Continue the following ${language} code. Output ONLY the code completion, no explanations, no markdown fences:\n\n${textUntilPosition}`;

      try {
        const result = await window.electronAPI.ollamaGenerate({
          model: state.autocompleteModel,
          prompt,
          stream: false,
          providerConfig: getProviderRuntimeConfig()
        });

        if (request.cancelled || token.isCancellationRequested) return { items: [] };

        if (result.success && result.response) {
          let suggestion = result.response.trim();
          
          // Clean up the response - remove code blocks
          if (suggestion.startsWith('```')) {
            suggestion = suggestion.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
          }
          
          // Only show if reasonable length (not too long)
          if (suggestion && suggestion.length < 500 && !suggestion.includes('\n\n')) {
            // Remove extra newlines
            suggestion = suggestion.replace(/\n+/g, '\n');
            
            return {
              items: [{
                insertText: suggestion,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                },
                command: { id: 'editor.action.triggerSuggest' }
              }]
            };
          }
        }
      } catch (err) {
        // Silently fail
      }
      return { items: [] };
    },
    freeInlineCompletions: () => {}
  });
}

function triggerAutocomplete() {
  // The inline completions will be automatically triggered by Monaco
}

// ============ OLLAMA MODELS ============
async function loadOllamaModels() {
  const statusEl = document.getElementById('ollama-status');
  const providerConfig = getProviderRuntimeConfig();
  const providerName = getProviderDisplayName(providerConfig.type);
  logAppEvent('INFO', 'renderer.models.load.start', {
    provider: providerForLog()
  });

  if (statusEl) {
    statusEl.className = 'status-badge status-checking';
    statusEl.textContent = uiTextf('provider_status_checking_with_provider', { provider: providerName });
  }

  const result = await window.electronAPI.ollamaListModels(providerConfig);

  if (result.success) {
    state.models = Array.isArray(result.models) ? result.models : [];
    if (statusEl) {
      statusEl.className = 'status-badge status-connected';
      statusEl.textContent = uiTextf('provider_status_connected', {
        provider: providerName,
        count: state.models.length
      });
    }

    populateModelSelects();
    refreshTranslationSettingsUI();

    if (state.models.length > 0) {
      // Auto-select first model
      setDefaultModels();
    }

    if (result.warning) {
      logAppEvent('WARN', 'renderer.models.load.warning', {
        provider: providerForLog(),
        warning: result.warning,
        count: state.models.length
      });
      showToast(uiTextf('provider_manual_fallback_notice', {
        provider: providerName
      }), 'warning', 2600);
    } else {
      logAppEvent('INFO', 'renderer.models.load.success', {
        provider: providerForLog(),
        count: state.models.length
      });
      showToast(uiTextf('provider_status_connected', {
        provider: providerName,
        count: state.models.length
      }), 'success');
    }
  } else {
    state.models = [];
    if (statusEl) {
      statusEl.className = 'status-badge status-disconnected';
      statusEl.textContent = uiTextf('provider_status_disconnected', { provider: providerName });
    }
    populateModelSelects();
    refreshTranslationSettingsUI();
    logAppEvent('ERROR', 'renderer.models.load.failed', {
      provider: providerForLog(),
      error: result.error || 'unknown-error'
    });
    showToast(result.error || uiTextf('provider_status_disconnected', { provider: providerName }), 'error');
  }
}

function populateModelSelects() {
  const selects = [
    document.getElementById('chat-model-select'),
    document.getElementById('agent-model-select'),
    document.getElementById('settings-chat-model'),
    document.getElementById('settings-agent-model'),
    document.getElementById('settings-autocomplete-model'),
    document.getElementById('settings-translate-model')
  ];

  for (const select of selects) {
    if (!select) continue;
    const isAutocomplete = select.id === 'settings-autocomplete-model';
    const isTranslate = select.id === 'settings-translate-model';
    if (isAutocomplete) {
      select.innerHTML = `<option value="">${uiText('autocomplete_off')}</option>`;
    } else if (isTranslate) {
      select.innerHTML = `<option value="">${uiText('translate_model_placeholder')}</option>`;
    } else if (!Array.isArray(state.models) || state.models.length === 0) {
      select.innerHTML = `<option value="">${uiText('loading_model_option')}</option>`;
    } else {
      select.innerHTML = '';
    }

    for (const model of state.models) {
      const modelName = String(model?.name || model?.model || '').trim();
      if (!modelName) continue;
      const opt = document.createElement('option');
      opt.value = modelName;

      // Detect model type
      const isThinking = isThinkingModel(modelName);
      const sizeStr = formatModelSize(model.size);
      opt.textContent = `${modelName} ${sizeStr}${isThinking ? ' [think]' : ''}`;
      select.appendChild(opt);
    }
  }
}

function isThinkingModel(modelName) {
  const thinkingPatterns = [
    'deepseek-r1', 'deepseek-reasoner', 'qwq', 'o1', 'o3',
    'thinking', 'reason', 'cot', 'r1'
  ];
  const lower = modelName.toLowerCase();
  return thinkingPatterns.some(p => lower.includes(p));
}

function formatModelSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `(${gb.toFixed(1)}GB)`;
  const mb = bytes / (1024 * 1024);
  return `(${mb.toFixed(0)}MB)`;
}

function setDefaultModels() {
  if (state.models.length === 0) return;

  const modelNames = state.models
    .map((m) => String(m?.name || m?.model || '').trim())
    .filter(Boolean);
  if (modelNames.length === 0) return;

  const available = new Set(modelNames);
  const firstName = modelNames[0];

  // Find a smaller model for autocomplete if available
  const smallModels = state.models
    .map((m) => ({
      name: String(m?.name || m?.model || '').trim(),
      size: Number(m?.size || 0)
    }))
    .filter((m) => !!m.name)
    .filter((m) => {
      const gb = m.size / (1024 * 1024 * 1024);
      return gb > 0 && gb < 4;
    });
  const preferredSmall = smallModels.length > 0 ? smallModels[0].name : '';

  if (!state.chatModel || !available.has(state.chatModel)) {
    state.chatModel = firstName;
  }

  if (!state.agentModel || !available.has(state.agentModel)) {
    state.agentModel = firstName;
  }

  if (!state.autocompleteModel || !available.has(state.autocompleteModel)) {
    state.autocompleteModel = preferredSmall || '';
  }

  if (!state.translateModel || !available.has(state.translateModel)) {
    state.translateModel = preferredSmall || firstName;
  }

  syncModelSelects();
  refreshTranslationSettingsUI();
  scheduleSettingsSave(120);
}

function syncModelSelects() {
  const sets = {
    'chat-model-select': state.chatModel,
    'agent-model-select': state.agentModel,
    'settings-chat-model': state.chatModel,
    'settings-agent-model': state.agentModel,
    'settings-autocomplete-model': state.autocompleteModel,
    'settings-translate-model': state.translateModel
  };

  for (const [id, value] of Object.entries(sets)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
}

function refreshTranslationSettingsUI() {
  const translateCheckbox = document.getElementById('settings-translate-enabled');
  const translateSelect = document.getElementById('settings-translate-model');
  if (!translateCheckbox || !translateSelect) return;

  translateCheckbox.checked = !!state.translatePromptsEnabled;
  translateSelect.disabled = !state.translatePromptsEnabled;
  translateSelect.classList.toggle('disabled', !state.translatePromptsEnabled);
}

async function maybeTranslatePrompt(prompt, sourceLabel = '') {
  const input = String(prompt || '').trim();
  const currentSourceLabel = sourceLabel || uiText('source_request');
  if (!input || !state.translatePromptsEnabled) return input;
  if (!state.translateModel) {
    logAppEvent('WARN', 'renderer.translate.skipped.no-model', {
      sourceLabel: currentSourceLabel,
      inputLength: input.length,
      provider: providerForLog()
    });
    showToast(uiText('translation_model_missing'), 'warning', 2200);
    return input;
  }

  const prevStatus = document.getElementById('status-ai-text')?.textContent || uiText('status_ai_ready');
  updateAIStatus(uiText('status_translating_prompt'));

  try {
    const translationResult = await window.electronAPI.ollamaChatSync({
      model: state.translateModel,
      messages: [
        {
          role: 'system',
          content: buildTranslationSystemPrompt()
        },
        { role: 'user', content: input }
      ],
      providerConfig: getProviderRuntimeConfig()
    });

    const translated = translationResult?.success
      ? String(translationResult.message?.content || '').trim()
      : '';

    if (!translated) {
      logAppEvent('WARN', 'renderer.translate.empty-result', {
        sourceLabel: currentSourceLabel,
        model: state.translateModel,
        inputLength: input.length,
        response: translationResult
      });
      showToast(uiTextf('translation_failed_for_source', { source: currentSourceLabel }), 'warning', 2200);
      return input;
    }

    logAppEvent('INFO', 'renderer.translate.success', {
      sourceLabel: currentSourceLabel,
      model: state.translateModel,
      inputLength: input.length,
      outputLength: translated.length,
      changed: translated !== input
    });
    if (translated !== input) {
      showToast(uiTextf('translation_done_for_source', { source: currentSourceLabel }), 'info', 1500);
    }
    return translated;
  } catch (err) {
    logAppEvent('ERROR', 'renderer.translate.failed', {
      sourceLabel: currentSourceLabel,
      model: state.translateModel,
      inputLength: input.length,
      error: err?.message || String(err),
      stack: err?.stack || null
    });
    showToast(uiTextf('translation_error_for_source', { source: currentSourceLabel }), 'warning', 2200);
    return input;
  } finally {
    if (!state.isGenerating) {
      updateAIStatus(prevStatus);
    }
  }
}

// ============ CHAT PANEL ============
function initChatPanel() {
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  const btnClear = document.getElementById('btn-clear-chat');
  const btnAttach = document.getElementById('btn-attach-file');
  const btnRemoveCtx = document.getElementById('btn-remove-context');
  const chatModelSelect = document.getElementById('chat-model-select');

  btnSend?.addEventListener('click', sendChatMessage);
  btnClear?.addEventListener('click', clearChat);
  btnAttach?.addEventListener('click', attachCurrentFile);
  btnRemoveCtx?.addEventListener('click', () => {
    document.getElementById('chat-context-bar').style.display = 'none';
    state.chatContext = null;
  });

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  chatInput?.addEventListener('focus', () => {
    state.shortcutScope = 'chat';
  });

  chatModelSelect?.addEventListener('change', (e) => {
    state.chatModel = e.target.value;
    document.getElementById('settings-chat-model').value = e.target.value;
    scheduleSettingsSave();
  });
}

function attachCurrentFile() {
  if (!state.activeFile) {
    showToast(uiText('toast_no_open_file'), 'warning');
    return;
  }
  const fileObj = state.openFiles.find(f => f.path === state.activeFile);
  if (fileObj) {
    state.chatContext = { path: fileObj.path, name: fileObj.name, content: fileObj.model.getValue() };
    document.getElementById('chat-context-bar').style.display = 'flex';
    document.getElementById('chat-context-filename').textContent = fileObj.name;
    refreshIcons();
    showToast(uiTextf('toast_file_attached', { name: fileObj.name }), 'info', 1500);
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || state.isGenerating) return;
  if (!state.chatModel) {
    showToast(uiText('toast_select_model'), 'warning');
    return;
  }

  input.value = '';
  const promptForModel = await maybeTranslatePrompt(message, uiText('source_chat'));

  // Build user message with context
  let fullMessage = promptForModel;
  if (state.chatContext) {
    fullMessage = `[${uiText('chat_context_file_label')}: ${state.chatContext.name}]\n\`\`\`\n${state.chatContext.content}\n\`\`\`\n\n${promptForModel}`;
  }

  // Add user message to history
  state.chatHistory.push({ role: 'user', content: fullMessage });
  addChatMessageUI('user', message, state.chatContext?.name);
  logAppEvent('INFO', 'renderer.chat.send.start', {
    model: state.chatModel,
    provider: providerForLog(),
    sourceLength: message.length,
    promptLength: promptForModel.length,
    hasContext: !!state.chatContext,
    historyCount: state.chatHistory.length
  });

  // Show typing indicator
  state.isGenerating = true;
  state.currentRequestId = Date.now().toString();
  updateAIStatus(uiText('status_generating'));
  updateSendButtonState('chat');
  const typingEl = addTypingIndicator('chat-messages');

  try {
    // Setup streaming
    window.electronAPI.removeOllamaStreamListeners();
    let responseText = '';
    let streamCompleted = false;
    const responseEl = createAssistantMessageUI('chat-messages');

    window.electronAPI.onOllamaStream((data) => {
      if (streamCompleted) return;

      if (data?.error) {
        streamCompleted = true;
        state.isGenerating = false;
        state.currentRequestId = null;
        updateAIStatus(uiText('status_ai_error'));
        updateSendButtonState('chat');
        typingEl.remove();
        updateAssistantMessage(responseEl, uiTextf('connection_error_prefix', { error: data.error }));
        showToast(uiTextf('toast_ai_connection_error', { error: data.error }), 'error', 3800);
        logAppEvent('ERROR', 'renderer.chat.stream.error', {
          model: state.chatModel,
          provider: providerForLog(),
          error: String(data.error || ''),
          partialResponseChars: responseText.length
        });
        return;
      }

      if (data.content) {
        responseText += data.content;
        updateAssistantMessage(responseEl, responseText);
      }
      if (data.done) {
        streamCompleted = true;
        state.isGenerating = false;
        state.currentRequestId = null;
        updateAIStatus(uiText('status_ai_ready'));
        updateSendButtonState('chat');
        typingEl.remove();
        state.chatHistory.push({ role: 'assistant', content: responseText });
        processThinkingContent(responseEl, responseText);
        logAppEvent('INFO', 'renderer.chat.stream.done', {
          model: state.chatModel,
          provider: providerForLog(),
          responseChars: responseText.length,
          historyCount: state.chatHistory.length
        });
      }
    });

    const isThinking = isThinkingModel(state.chatModel);
    const systemPrompt = buildChatSystemPrompt(isThinking);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...state.chatHistory
    ];
    logAppEvent('INFO', 'renderer.chat.stream.request', {
      model: state.chatModel,
      provider: providerForLog(),
      messageCount: messages.length,
      messages: messagesForLog(messages)
    });

    const chatResult = await window.electronAPI.ollamaChat({
      requestId: state.currentRequestId,
      model: state.chatModel,
      messages,
      stream: true,
      providerConfig: getProviderRuntimeConfig()
    });
    if (chatResult?.success === false) {
      throw new Error(chatResult.error || uiText('error_model_request_failed'));
    }
  } catch (err) {
    state.isGenerating = false;
    state.currentRequestId = null;
    updateAIStatus(uiText('status_ai_ready'));
    updateSendButtonState('chat');
    typingEl.remove();
    logAppEvent('ERROR', 'renderer.chat.send.failed', {
      model: state.chatModel,
      provider: providerForLog(),
      error: err?.message || String(err),
      stack: err?.stack || null
    });
    showToast(uiTextf('toast_ai_error', { error: err.message }), 'error');
  }
}

function updateSendButtonState(panel) {
  const btn = panel === 'chat'
    ? document.getElementById('btn-send-chat')
    : document.getElementById('btn-send-agent');
  
  if (!btn) return;
  
  if (state.isGenerating) {
    btn.classList.add('btn-stop');
    if (panel === 'agent') {
      btn.title = uiText('btn_stop_title');
      btn.innerHTML = '<i data-lucide="square" class="icon-sm"></i>';
    } else {
      btn.innerHTML = `<i data-lucide="square" class="icon-xs"></i> ${uiText('btn_stop_chat_text')}`;
    }
    btn.onclick = () => stopGeneration(panel);
    refreshIcons();
  } else {
    btn.classList.remove('btn-stop');
    if (panel === 'agent') {
      btn.title = uiText('btn_send_agent_title');
      btn.innerHTML = '<i data-lucide="send" class="icon-sm"></i>';
    } else {
      btn.innerHTML = `<i data-lucide="send" class="icon-xs"></i> ${uiText('btn_send_chat_text')}`;
    }
    btn.onclick = () => {
      if (panel === 'chat') sendChatMessage();
      else sendAgentCommand();
    };
    refreshIcons();
  }
}

async function stopGeneration(panel) {
  if (state.currentRequestId && state.isGenerating) {
    await window.electronAPI.ollamaAbort(state.currentRequestId);
    state.isGenerating = false;
    state.currentRequestId = null;
    updateAIStatus(uiText('status_stopped'));
    updateSendButtonState(panel);
  }
}

function addChatMessageUI(role, text, contextFile = null) {
  const container = document.getElementById('chat-messages');
  // Remove welcome
  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  const icon = role === 'user' ? 'user' : 'bot';
  const name = role === 'user' ? uiText('user_name') : uiText('assistant_name');

  let contextHtml = '';
  if (contextFile) {
    contextHtml = `<span style="font-size:10px;color:var(--text-muted);margin-left:8px;display:inline-flex;align-items:center;gap:3px;"><i data-lucide="paperclip" class="icon-xs"></i> ${contextFile}</span>`;
  }

  div.innerHTML = `
    <div class="msg-header">
      <i data-lucide="${icon}" class="icon-xs"></i>
      <span>${name}</span>${contextHtml}
    </div>
    <div class="msg-body">${formatMessage(text)}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  refreshIcons();
}

function createAssistantMessageUI(containerId) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'chat-message assistant';
  div.innerHTML = `
    <div class="msg-header">
      <i data-lucide="bot" class="icon-xs"></i>
      <span>${uiText('assistant_name')}</span>
    </div>
    <div class="msg-body"></div>
  `;
  container.appendChild(div);
  refreshIcons();
  return div;
}

function updateAssistantMessage(el, text) {
  const body = el.querySelector('.msg-body');
  if (body) {
    const isAgent = el.dataset.isAgent === 'true';
    const displayText = isAgent ? cleanAgentResponseForDisplay(text) : text;

    // Check if we're streaming a thinking model response
    const hasThink = displayText.includes('<think>') && !displayText.includes('</think>');
    
    if (hasThink) {
      // Show thinking indicator while waiting for thinking to complete
      body.innerHTML = `
        <div class="thinking-loader">
          <div class="thinking-spinner"></div>
          <span>${uiText('thinking_label')}</span>
        </div>
      ` + formatMessage(displayText.replace(/<think>/g, '').trim());
    } else {
      body.innerHTML = formatMessage(displayText);
    }
    
    const container = el.parentElement;
    // Instant scroll - no smooth behavior
    container.scrollTop = container.scrollHeight;
  }
}

function processThinkingContent(el, text) {
  // Handle thinking model output (e.g., <think>...</think>)
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const thinkContent = thinkMatch[1].trim();
    const mainContent = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    const body = el.querySelector('.msg-body');
    if (body) {
      // Remove any existing thinking-loader placeholder
      const loader = body.querySelector('.thinking-loader');
      if (loader) loader.remove();
      
      const blockId = 'think-' + Date.now();
      const thinkingBlock = `
        <div class="thinking-block">
          <button class="thinking-toggle" onclick="
            var b = document.getElementById('${blockId}');
            this.classList.toggle('open');
            b.classList.toggle('open');
          ">
            <i data-lucide="lightbulb" class="icon-xs thinking-icon"></i>
            <span class="thinking-label-text">${uiText('thinking_process_label')}</span>
            <i data-lucide="chevron-down" class="icon-xs thinking-chevron"></i>
          </button>
          <div class="thinking-body" id="${blockId}">${formatMessage(thinkContent)}</div>
        </div>
      `;
      
      // Prepend thinking block, keep main content
      body.innerHTML = thinkingBlock + formatMessage(mainContent);
      refreshIcons();
    }
  }
}

function addTypingIndicator(containerId) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function clearChat() {
  state.chatHistory = [];
  state.chatContext = null;
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="chat-welcome">
      <i data-lucide="bot" class="welcome-icon"></i>
      <h3>${uiText('chat_welcome_title')}</h3>
      <p>${uiText('chat_welcome_desc')}</p>
    </div>
  `;
  document.getElementById('chat-context-bar').style.display = 'none';
  refreshIcons();
}

// Remove raw file operation command blocks from agent response display
function cleanAgentResponseForDisplay(text) {
  // Strip out CREATE_FILE / EDIT_FILE / EDIT_LINES / APPEND_FILE / DELETE_FILE command blocks
  // These are processed separately and shown as file-change-cards
  let cleaned = text
    .replace(/```(?:CREATE_FILE|EDIT_FILE|EDIT_LINES|APPEND_FILE|DELETE_FILE)[^]*?```END_FILE\s*/g, '')
    .replace(/```DELETE_FILE:[^\n`]+```\s*/g, '')
    // Also handle '''-style variants that some models output
    .replace(/'''(?:CREATE_FILE|EDIT_FILE|EDIT_LINES|APPEND_FILE|DELETE_FILE)[^]*?'''END_FILE\s*/g, '')
    .trim();
  if (!cleaned) {
    // If all content were file-command blocks, show a concise note instead of raw commands
    return uiText('agent_commands_processed');
  }
  return cleaned;
}

function formatMessage(text) {
  if (typeof marked !== 'undefined') {
    try {
      marked.setOptions({ breaks: true, gfm: true, pedantic: false, smartLists: true });

      const html = marked.parse(text);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      wrapper.querySelectorAll('script, iframe').forEach(el => el.remove());

      // Wrap each <pre><code> block with a styled header (language + copy button)
      wrapper.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        const classList = code.className || '';
        const langMatch = classList.match(/language-([\w-+]+)/);
        const lang = langMatch ? langMatch[1] : 'code';
        const codeText = code.textContent || '';

        const blockWrapper = document.createElement('div');
        blockWrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `<span class="code-lang-label">${lang}</span><button class="btn-copy-code" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').textContent).then(()=>{this.textContent='${uiText('btn_copied_code')}';setTimeout(()=>this.textContent='${uiText('btn_copy_code')}',1500)})">${uiText('btn_copy_code')}</button>`;

        pre.parentNode.insertBefore(blockWrapper, pre);
        blockWrapper.appendChild(header);
        blockWrapper.appendChild(pre);
      });

      return wrapper.innerHTML;
    } catch (e) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateAIStatus(text) {
  document.getElementById('status-ai-text').textContent = text;
}

// ============ AGENT PANEL ============
function initAgentPanel() {
  const agentInput = document.getElementById('agent-input');
  const btnSend = document.getElementById('btn-send-agent');
  const btnClear = document.getElementById('btn-clear-agent');
  const agentModelSelect = document.getElementById('agent-model-select');

  btnSend?.addEventListener('click', sendAgentCommand);
  btnClear?.addEventListener('click', clearAgent);

  agentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAgentCommand();
    }
  });
  agentInput?.addEventListener('focus', () => {
    state.shortcutScope = 'agent';
  });

  agentModelSelect?.addEventListener('change', (e) => {
    state.agentModel = e.target.value;
    document.getElementById('settings-agent-model').value = e.target.value;
    scheduleSettingsSave();
  });

  document.getElementById('agent-include-project')?.addEventListener('change', () => {
    scheduleSettingsSave();
  });

  document.getElementById('agent-include-current-file')?.addEventListener('change', () => {
    scheduleSettingsSave();
  });

  // Agent changes controls (collapse and move)
  const changesEl = document.getElementById('agent-changes');
  const changesBar = document.getElementById('agent-changes-bar');
  const btnToggle = document.getElementById('btn-toggle-changes');
  const btnMove = document.getElementById('btn-move-changes');
  const aiAgentPanel = document.getElementById('panel-ai-agent');
  const agentChatWrapper = document.querySelector('.agent-chat-wrapper');

  if (btnToggle && changesEl) {
    btnToggle.addEventListener('click', (e) => {
      e.preventDefault();
      changesEl.classList.toggle('minimized');
      const ic = btnToggle.querySelector('i');
      if (changesEl.classList.contains('minimized')) ic.setAttribute('data-lucide', 'chevron-up');
      else ic.setAttribute('data-lucide', 'chevron-down');
      refreshIcons();
    });
  }

  if (btnMove && changesEl && changesBar && aiAgentPanel && agentChatWrapper) {
    btnMove.addEventListener('click', (e) => {
      e.preventDefault();
      const chatInputArea = aiAgentPanel.querySelector('.chat-input-area');
      if (!chatInputArea) return;

      if (changesEl.parentElement === agentChatWrapper) {
        aiAgentPanel.appendChild(changesBar);
        aiAgentPanel.appendChild(changesEl);
        btnMove.querySelector('i').setAttribute('data-lucide', 'corner-up-right');
      } else {
        agentChatWrapper.appendChild(changesBar);
        agentChatWrapper.appendChild(changesEl);
        btnMove.querySelector('i').setAttribute('data-lucide', 'corner-down-left');
      }

      refreshIcons();
    });
  }
}

async function sendAgentCommand() {
  const input = document.getElementById('agent-input');
  const command = input.value.trim();
  if (!command || state.isGenerating) return;
  if (!state.agentModel) {
    showToast(uiText('toast_select_model'), 'warning');
    return;
  }
  if (!state.projectDir) {
    showToast(uiText('toast_open_project_first'), 'warning');
    return;
  }
  if (!state.isTrusted) {
    showToast(uiText('project_not_trusted'), 'error');
    return;
  }

  input.value = '';
  const promptForModel = await maybeTranslatePrompt(command, uiText('source_agent'));
  state.agentCheckpoints = {};

  // Build context
  let contextInfo = '';

  // Include project structure if checked
  const includeProject = document.getElementById('agent-include-project')?.checked;
  const includeFile = document.getElementById('agent-include-current-file')?.checked;

  if (includeProject) {
    const tree = await getProjectStructureText(state.projectDir, '', 3);
    contextInfo += `\n\n${uiText('status_project_title')}: ${state.projectDir}\n${uiText('agent_include_project')}:\n${tree}\n`;
  }

  if (includeFile && state.activeFile) {
    const fileObj = state.openFiles.find(f => f.path === state.activeFile);
    if (fileObj) {
      contextInfo += `\n\n${uiText('chat_context_file_label')} (${fileObj.name}):\n\`\`\`${fileObj.language}\n${fileObj.model.getValue()}\n\`\`\`\n`;
    }
  }

  // Add user message to agent UI
  addAgentMessageUI('user', command);
  logAppEvent('INFO', 'renderer.agent.send.start', {
    model: state.agentModel,
    provider: providerForLog(),
    sourceLength: command.length,
    promptLength: promptForModel.length,
    includeProject: !!includeProject,
    includeCurrentFile: !!includeFile,
    hasActiveFile: !!state.activeFile
  });

  state.isGenerating = true;
  state.currentRequestId = Date.now().toString();
  updateAIStatus(uiText('status_agent_running'));
  updateSendButtonState('agent');
  const typingEl = addTypingIndicator('agent-messages');

  const systemPrompt = buildAgentSystemPrompt(state.projectDir, contextInfo);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...state.agentHistory,
      { role: 'user', content: promptForModel }
    ];

    // Use streaming for agent too
    window.electronAPI.removeOllamaStreamListeners();
    let responseText = '';
    let streamCompleted = false;
    const responseEl = createAssistantMessageUI('agent-messages');
    responseEl.dataset.isAgent = 'true'; // mark as agent message for display cleaning
    // Track processed command blocks for this streaming response to avoid duplicates
    if (!state.agentStreamProcessed) state.agentStreamProcessed = {};
    state.agentStreamProcessed[state.currentRequestId] = new Set();

    window.electronAPI.onOllamaStream((data) => {
      if (streamCompleted) return;

      if (data?.error) {
        streamCompleted = true;
        typingEl.remove();
        state.isGenerating = false;
        state.currentRequestId = null;
        updateAIStatus(uiText('status_agent_error'));
        updateSendButtonState('agent');
        updateAssistantMessage(responseEl, uiTextf('connection_error_prefix', { error: data.error }));
        showToast(uiTextf('toast_agent_connection_error', { error: data.error }), 'error', 3800);
        logAppEvent('ERROR', 'renderer.agent.stream.error', {
          model: state.agentModel,
          provider: providerForLog(),
          error: String(data.error || ''),
          partialResponseChars: responseText.length
        });
        return;
      }

      if (data.content) {
        responseText += data.content;
        updateAssistantMessage(responseEl, responseText);
        // Process any file-command blocks as they arrive, creating files immediately.
        try {
          const _req = state.currentRequestId;
          if (!state.agentStreamProcessing) state.agentStreamProcessing = {};
                if (!state.agentStreamProcessing[_req]) {
                  state.agentStreamProcessing[_req] = true;
                  (async () => {
                    try {
                      // During streaming, require complete command blocks (with ```END_FILE or closing ```)
                      await processAgentActions(responseText, state.agentStreamProcessed && state.agentStreamProcessed[_req], true);
                    } catch (e) {
                      console.error('processAgentActions streaming error', e);
                    } finally {
                      delete state.agentStreamProcessing[_req];
                    }
                  })();
                }
        } catch (e) {
          console.error('processAgentActions scheduling error', e);
        }
      }
      if (data.done) {
        streamCompleted = true;
        typingEl.remove();
        state.isGenerating = false;
        const _reqId = state.currentRequestId; // capture before nulling
        state.currentRequestId = null;
        updateAIStatus(uiText('status_ai_ready'));
        updateSendButtonState('agent');

        state.agentHistory.push({ role: 'user', content: promptForModel });
        state.agentHistory.push({ role: 'assistant', content: responseText });

        // Process thinking
        processThinkingContent(responseEl, responseText);

        // Final pass for any remaining agent actions (use same processed set)
        try {
          // Final pass: allow tolerant parsing (missing END_FILE) to catch any remaining commands
          processAgentActions(responseText, state.agentStreamProcessed && state.agentStreamProcessed[_reqId], false);
        } catch (e) {
          console.error('processAgentActions final pass error', e);
        }
        // Clean up processed tracking for this request
        if (state.agentStreamProcessed && state.agentStreamProcessed[_reqId]) delete state.agentStreamProcessed[_reqId];
        logAppEvent('INFO', 'renderer.agent.stream.done', {
          model: state.agentModel,
          provider: providerForLog(),
          responseChars: responseText.length,
          agentHistoryCount: state.agentHistory.length
        });
      }
    });

    logAppEvent('INFO', 'renderer.agent.stream.request', {
      model: state.agentModel,
      provider: providerForLog(),
      messageCount: messages.length,
      messages: messagesForLog(messages)
    });

    const chatResult = await window.electronAPI.ollamaChat({
      requestId: state.currentRequestId,
      model: state.agentModel,
      messages,
      stream: true,
      providerConfig: getProviderRuntimeConfig()
    });
    if (chatResult?.success === false) {
      throw new Error(chatResult.error || uiText('error_agent_model_request_failed'));
    }

  } catch (err) {
    typingEl.remove();
    state.isGenerating = false;
    state.currentRequestId = null;
    updateAIStatus(uiText('status_ai_ready'));
    updateSendButtonState('agent');
    logAppEvent('ERROR', 'renderer.agent.send.failed', {
      model: state.agentModel,
      provider: providerForLog(),
      error: err?.message || String(err),
      stack: err?.stack || null
    });
    showToast(uiTextf('toast_agent_error', { error: err.message }), 'error');
  }
}

async function processAgentActions(text, processedSet, requireComplete = false) {
  const changesContainer = document.getElementById('agent-changes');
  // Allow caller to pass a Set to track already-processed commands across stream chunks
  const processed = processedSet || new Set(); // avoid duplicate processing

  console.log('processAgentActions START', { requireComplete: !!requireComplete, textLength: String(text || '').length, processedCount: processed.size });

  // Normalize common model variations and ensure consistent END_FILE markers
  const normalized = String(text || '')
    .replace(/'''(CREATE_FILE|EDIT_FILE|EDIT_LINES|APPEND_FILE|DELETE_FILE)/g, '```$1')
    .replace(/'''END_FILE/g, '```END_FILE')
    // Only collapse immediate duplicate fences; do not consume the next block opener.
    .replace(/```END_FILE[ \t]*```/g, '```END_FILE');

  // Robust non-greedy block parser. Two-pass behavior:
  // - streaming (requireComplete=true): only match blocks that have an explicit terminator (```END_FILE or closing ```)
  // - final pass (requireComplete=false): tolerate blocks that run to end-of-input
  const blocks = [];
  // When requiring completeness, don't allow match to reach end-of-input without a terminator
  const terminator = requireComplete ? '(?:```END_FILE|```)' : '(?:```END_FILE|```|$)';
  const blockRegex = new RegExp('```(CREATE_FILE|EDIT_FILE|APPEND_FILE|EDIT_LINES|DELETE_FILE)\\s*:?' + '\\s*([^\\n`]*)\\n([\\s\\S]*?)' + terminator, 'gi');
  let m;
  while ((m = blockRegex.exec(normalized)) !== null) {
    const cmd = m[1];
    const header = (m[2] || '').trim();
    const content = String(m[3] || '');
    // If in streaming mode and the match ended with end-of-input (no terminator), skip until final pass
    if (requireComplete && !(m[0].includes('```END_FILE') || m[0].endsWith('```'))) {
      continue;
    }
    blocks.push({ cmd, header, content });
  }
  if (blocks.length === 0) {
    console.log('processAgentActions: no complete blocks found', { requireComplete: !!requireComplete });
  } else {
    console.log('processAgentActions: found blocks', blocks.map(b => ({ cmd: b.cmd, header: b.header })));
  }

  for (const blk of blocks) {
    const rawHeader = String(blk.header || '').trim();
    const filenameCandidates = rawHeader.split(':')[0] || rawHeader;
    const filename = String(filenameCandidates || '').trim().replace(/^\.\/+/, '').replace(/\\+/g, '/');
    if (!filename && blk.cmd !== 'DELETE_FILE' && blk.cmd !== 'EDIT_LINES') continue;

    const keyBase = `${blk.cmd.toLowerCase()}:${filename}`;
    if (processed.has(keyBase)) continue;
    processed.add(keyBase);

    try {
      if (blk.cmd === 'CREATE_FILE') {
        console.debug('Agent CREATE_FILE detected:', filename);
        await executeAgentAction('create', filename, blk.content, changesContainer);
      } else if (blk.cmd === 'EDIT_FILE') {
        console.debug('Agent EDIT_FILE detected:', filename);
        await executeAgentAction('edit', filename, blk.content, changesContainer);
      } else if (blk.cmd === 'APPEND_FILE') {
        console.debug('Agent APPEND_FILE detected:', filename);
        await executeAppendAction(filename, blk.content, changesContainer);
      } else if (blk.cmd === 'EDIT_LINES') {
        // header format: path:START-END
        const m = rawHeader.match(/([^:]+):(\d+)-(\d+)/);
        if (m) {
          const rel = m[1].trim();
          const s = parseInt(m[2], 10);
          const e = parseInt(m[3], 10);
          console.debug('Agent EDIT_LINES detected:', rel, s, e);
          await executeLineEditAction(rel, s, e, blk.content, changesContainer);
        }
      } else if (blk.cmd === 'DELETE_FILE') {
        const delName = filename || rawHeader;
        console.debug('Agent DELETE_FILE detected:', delName);
        await executeAgentAction('delete', delName, null, changesContainer);
      }
    } catch (err) {
      console.error(`Failed executing ${blk.cmd} for`, filename || rawHeader, err);
      makeFileChangeCard(changesContainer, {
        type: 'error',
        filename: filename || rawHeader,
        detail: uiTextf('operation_error', { error: err?.message || err })
      });
    }
  }
}

function syncOpenFileWithContent(fullPath, content) {
  const openFile = state.openFiles.find(f => f.path === fullPath);
  if (openFile) {
    openFile.model.setValue(content || '');
    openFile.modified = false;
    updateTabModified(fullPath, false);
    updateTreeItemModifiedState(fullPath, false);
  }
}

async function captureAgentCheckpoint(relativePath) {
  if (!state.projectDir) return { exists: false, content: null };
  if (state.agentCheckpoints[relativePath]) return state.agentCheckpoints[relativePath];
  const fullPath = await window.electronAPI.pathJoin(state.projectDir, relativePath);
  const exists = await window.electronAPI.fileExists(fullPath);
  let content = null;
  if (exists) {
    const read = await window.electronAPI.readFile(fullPath);
    content = read.success ? read.content : null;
  }
  const checkpoint = { exists, content };
  state.agentCheckpoints[relativePath] = checkpoint;
  return checkpoint;
}


// ============ FILE CHANGE CARD (Modern Copilot-style UI) ============
function makeFileChangeCard(container, opts) {
  if (!container) {
    console.warn('makeFileChangeCard: missing container');
    return;
  }
  // opts: { type: 'create'|'edit'|'lines'|'delete'|'error', filename, meta, detail, undoFn, redoFn }
  const typeIcons  = { create: 'file-plus', edit: 'file-edit', lines: 'file-code', delete: 'trash-2', error: 'alert-circle', cancel: 'x' };
  const typeLabels = {
    create: uiText('type_create') || 'Created',
    edit: uiText('type_edit') || 'Edited',
    lines: uiText('type_lines') || 'Line Change',
    delete: uiText('type_delete') || 'Deleted',
    error: uiText('type_error') || 'Error',
    cancel: uiText('type_cancel') || 'Cancelled'
  };
  const showHeaderBadge = opts.type !== 'create';
  const headerBadge = showHeaderBadge
    ? `<span class="fcc-badge"><i data-lucide="${typeIcons[opts.type] || 'file'}" class="icon-xs"></i> ${typeLabels[opts.type] || opts.type}</span>`
    : '';
  const card = document.createElement('div');
  card.className = `file-change-card card-${opts.type}`;

  const undoBtn = opts.undoFn
    ? `<button class="fcc-btn undo-btn" title="${uiText('undo')||'Undo'}"><i data-lucide="undo-2" class="icon-xs"></i> ${uiText('undo')||'Undo'}</button>`
    : '';
  const redoBtn = opts.redoFn
    ? `<button class="fcc-btn redo-btn" title="${uiText('redo')||'Redo'}"><i data-lucide="corner-up-right" class="icon-xs"></i> ${uiText('redo')||'Redo'}</button>`
    : '';
  const headerUndoIcon = opts.undoFn ? `<button class="icon-btn-xs fcc-undo-icon" title="${uiText('undo_quick_title')||'Undo (Quick)'}"><i data-lucide="corner-left" class="icon-xs"></i></button>` : '';
  const headerRedoIcon = opts.redoFn ? `<button class="icon-btn-xs fcc-redo-icon" title="${uiText('redo_quick_title')||'Redo (Quick)'}"><i data-lucide="corner-up-right" class="icon-xs"></i></button>` : '';

  card.innerHTML = `
    <div class="fcc-header">
      ${headerBadge}
      <span class="fcc-filename">${opts.filename}</span>
      ${opts.meta ? `<span class="fcc-meta">${opts.meta}</span>` : ''}
      <div class="fcc-header-actions">
        ${headerUndoIcon}${headerRedoIcon}
        <button class="icon-btn-xs fcc-collapse-btn" title="${uiText('collapse_expand_title')}"><i data-lucide="chevron-down" class="icon-xs"></i></button>
      </div>
    </div>
    <div class="fcc-body">
      <span class="fcc-detail">
        <span class="fcc-detail-status">${typeLabels[opts.type] || opts.type}:</span>
        <span class="fcc-detail-text">${opts.detail || ''}</span>
      </span>
      <div class="fcc-actions">${undoBtn}${redoBtn}</div>
    </div>
  `;
  repairMojibakeInElement(card);

  const undoButton = card.querySelector('.undo-btn');
  const redoButton = card.querySelector('.redo-btn');
  const undoHtml = undoButton ? undoButton.innerHTML : '';

  if (undoButton && opts.undoFn) {
    undoButton.addEventListener('click', async (e) => {
      e.preventDefault();
      undoButton.disabled = true;
      undoButton.innerHTML = '...';
      try {
        await opts.undoFn();
        undoButton.innerHTML = `✓ ${uiText('undo_done')}`;
        undoButton.style.opacity = '0.5';
        if (redoButton) {
          redoButton.classList.add('visible');
          redoButton.disabled = false;
        }
        if (opts.redoFn) {
          showToast(uiText('undo_action_hint'), 'info', 2000);
        }
      } catch (err) {
        undoButton.innerHTML = `✗ ${uiText('undo_error')}`;
        undoButton.style.color = '#ff7b72';
        showToast(uiTextf('undo_failed', { error: err.message }), 'error');
        undoButton.disabled = false;
      }
    });
  }

  if (redoButton && opts.redoFn) {
    redoButton.addEventListener('click', async (e) => {
      e.preventDefault();
      redoButton.disabled = true;
      redoButton.innerHTML = '...';
      try {
        await opts.redoFn();
        if (undoButton) {
          undoButton.disabled = false;
          undoButton.innerHTML = undoHtml;
          undoButton.style.opacity = '';
          undoButton.style.color = '';
        }
        redoButton.classList.remove('visible');
        showToast(uiText('redo_applied'), 'success', 1500);
      } catch (err) {
        redoButton.innerHTML = `✗ ${uiText('redo_error')}`;
        redoButton.style.color = '#ff7b72';
        showToast(uiTextf('redo_failed', { error: err.message }), 'error');
        redoButton.disabled = false;
      }
    });
  }

  container.appendChild(card);
  // Ensure changes bar is visible when we have changes
  const changesBar = document.getElementById('agent-changes-bar');
  if (changesBar) { changesBar.classList.add('has-changes'); changesBar.setAttribute('aria-hidden', 'false'); }
  container.classList.add('has-changes');
  container.scrollTop = container.scrollHeight;
  refreshIcons();

  return { card, opts, undoButton, redoButton };

  // Collapse button behavior
  const collapseBtn = card.querySelector('.fcc-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const wasCollapsed = card.classList.contains('collapsed');
      card.classList.toggle('collapsed');
      const icon = collapseBtn.querySelector('i');
      if (card.classList.contains('collapsed')) icon.setAttribute('data-lucide', 'chevron-up');
      else icon.setAttribute('data-lucide', 'chevron-down');
      refreshIcons();
      // If we just expanded the card, ensure it's visible inside the scrollable changes container
      try {
        if (!wasCollapsed) return; // we collapsed it, no need to scroll
        // Smooth scroll the container so this card is visible
        if (container && typeof container.scrollTo === 'function') {
          const rect = card.getBoundingClientRect();
          const parentRect = container.getBoundingClientRect();
          const offsetTop = card.offsetTop;
          const target = Math.max(0, offsetTop - (container.clientHeight / 2));
          container.scrollTo({ top: target, behavior: 'smooth' });
        } else {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (ex) {
        // fallback
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
}

function parseAgentError(err) {
  if (!err) return uiText('parse_unknown_error');
  if (err.includes('ENOENT')) return uiText('parse_file_not_found');
  if (err.includes('EACCES')) return uiText('parse_permission_denied');
  if (err.includes('EISDIR')) return uiText('parse_is_directory');
  if (err.includes('EEXIST')) return uiText('parse_exists');
  return err;
}

async function executeAgentAction(action, relativePath, content, container) {
  if (!container) { console.warn('executeAgentAction: no container'); return; }
  if (!state.projectDir) {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: uiText('error_no_project') || 'No project directory selected.' });
    return;
  }
  const fullPath = await window.electronAPI.pathJoin(state.projectDir, relativePath);

  const safe = await window.electronAPI.isPathSafe(fullPath, state.projectDir);
  if (!safe) {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: uiText('error_path_outside') || 'Security violation: path outside project!' });
    return;
  }

  const checkpoint = await captureAgentCheckpoint(relativePath);
  let lastCard = null;

  if (action === 'create') {
    let result = null;
    try {
      console.log('executeAgentAction.create ->', { projectDir: state.projectDir, relativePath, fullPath, contentLength: String(content || '').length });
      const safeCheck = await window.electronAPI.isPathSafe(fullPath, state.projectDir);
      console.log('executeAgentAction.create pathSafe ->', safeCheck);
      result = await window.electronAPI.createFile(fullPath, content);
      console.log('executeAgentAction.create result ->', result);
    } catch (ex) {
      console.error('executeAgentAction.create threw', ex);
      lastCard = makeFileChangeCard(container, {
        type: 'error',
        filename: relativePath,
        detail: uiTextf('create_error_with_error', { error: ex?.message || String(ex) })
      });
      return;
    }
    if (result.success) {
      const lineCount = (content || '').split('\n').length;
      const newContent = content || '';
      const prevExisted = checkpoint.exists;
      const prevContent = checkpoint.content || '';
      const undoFn = async () => {
        if (prevExisted) {
          await window.electronAPI.writeFile(fullPath, prevContent);
          syncOpenFileWithContent(fullPath, prevContent);
        } else {
          const delResult = await window.electronAPI.deleteFileSilent(fullPath);
          if (!delResult.success) throw new Error(delResult.error);
        }
        await refreshFileTree();
        showToast(uiTextf('create_undo_with_file', { file: relativePath }), 'info');
      };
      const redoFn = async () => {
        await window.electronAPI.writeFile(fullPath, newContent);
        syncOpenFileWithContent(fullPath, newContent);
        await refreshFileTree();
      };
      lastCard = makeFileChangeCard(container, {
        type: 'create',
        filename: relativePath,
        meta: uiTextf('line_count_meta', { count: lineCount }),
        detail: uiText('detail_created') || 'File created successfully.',
        undoFn,
        redoFn
      });
      showToast((uiText('toast_created') || 'Created: ') + relativePath, 'success');
      await refreshFileTree();
    } else {
      console.warn('createFile failed for', fullPath, result);
      lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: parseAgentError(result.error) });
    }

  } else if (action === 'edit') {
    // Save old content for undo
    const oldRead = await window.electronAPI.readFile(fullPath);
    const oldContent = oldRead.success ? oldRead.content : '';

    const result = await window.electronAPI.writeFile(fullPath, content);
    if (result.success) {
      const newLines = (content || '').split('\n').length;
      const changedLines = oldContent !== null
        ? content.split('\n').filter((l, i) => l !== (oldContent.split('\n')[i] || '')).length
        : newLines;

      const originalContent = checkpoint.content || '';
      const newContent = content || '';
      const undoFn = async () => {
        await window.electronAPI.writeFile(fullPath, originalContent);
        syncOpenFileWithContent(fullPath, originalContent);
        showToast(uiTextf('edit_undo_with_file', { file: relativePath }), 'info');
        await refreshFileTree();
      };
      const redoFn = async () => {
        await window.electronAPI.writeFile(fullPath, newContent);
        syncOpenFileWithContent(fullPath, newContent);
        await refreshFileTree();
      };

      lastCard = makeFileChangeCard(container, {
        type: 'edit', filename: relativePath,
        meta: `~${uiTextf('changed_lines_meta', { count: changedLines })}`, detail: uiText('detail_updated') || 'File updated.',
        undoFn, redoFn
      });
      showToast((uiText('toast_edited') || 'Edited: ') + relativePath, 'success');
      syncOpenFileWithContent(fullPath, newContent);
    } else {
      lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: parseAgentError(result.error) });
    }

  } else if (action === 'delete') {
    const result = await window.electronAPI.deleteFile(fullPath);
    if (result.success) {
      const prevContent = checkpoint.content || '';
      const undoFn = async () => {
        await window.electronAPI.writeFile(fullPath, prevContent);
        syncOpenFileWithContent(fullPath, prevContent);
        showToast(uiTextf('delete_undo_with_file', { file: relativePath }), 'info');
        await refreshFileTree();
      };
      const redoFn = async () => {
        const silent = await window.electronAPI.deleteFileSilent(fullPath);
        if (!silent.success) throw new Error(silent.error);
        closeTab(fullPath);
        await refreshFileTree();
      };
      lastCard = makeFileChangeCard(container, { type: 'delete', filename: relativePath, detail: uiText('detail_deleted') || 'File deleted.', undoFn, redoFn });
      showToast((uiText('toast_deleted') || 'Deleted: ') + relativePath, 'success');
      closeTab(fullPath);
      await refreshFileTree();
    } else if (!result.confirmed) {
      lastCard = makeFileChangeCard(container, { type: 'cancel', filename: relativePath, detail: uiText('delete_cancelled') || 'Delete cancelled' });
    } else {
      lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: parseAgentError(result.error) });
    }
  }

  // Header quick-undo / redo icon wiring (if present)
  const cardEl = lastCard?.card;
  const optsLocal = lastCard?.opts || {};
  const undoButton = lastCard?.undoButton;
  const redoButton = lastCard?.redoButton;

  if (cardEl) {
    const headerUndo = cardEl.querySelector('.fcc-undo-icon');
    if (headerUndo) {
      headerUndo.addEventListener('click', async (e) => {
        e.preventDefault();
        if (undoButton) return undoButton.click();
        try {
          headerUndo.disabled = true;
          if (typeof optsLocal.undoFn === 'function') await optsLocal.undoFn();
          showToast((uiText('toast_undo') || 'Undone: ') + (optsLocal.filename || ''), 'info');
        } catch (err) {
          showToast((uiText('type_error') || 'Error') + ': ' + (err?.message || err), 'error');
        } finally {
          headerUndo.disabled = false;
        }
      });
    }

    const headerRedo = cardEl.querySelector('.fcc-redo-icon');
    if (headerRedo) {
      headerRedo.addEventListener('click', async (e) => {
        e.preventDefault();
        if (redoButton) return redoButton.click();
        try {
          headerRedo.disabled = true;
          if (typeof optsLocal.redoFn === 'function') await optsLocal.redoFn();
          showToast((uiText('toast_redo') || 'Redone: ') + (optsLocal.filename || ''), 'success');
        } catch (err) {
          showToast((uiText('type_error') || 'Error') + ': ' + (err?.message || err), 'error');
        } finally {
          headerRedo.disabled = false;
        }
      });
    }
  }
}

async function executeLineEditAction(relativePath, startLine, endLine, replacement, container) {
  let lastCard = null;
  const fullPath = await window.electronAPI.pathJoin(state.projectDir, relativePath);
  const safe = await window.electronAPI.isPathSafe(fullPath, state.projectDir);
  if (!safe) {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: uiText('security_violation_project_outside') });
    return;
  }

  const checkpoint = await captureAgentCheckpoint(relativePath);

  const readResult = await window.electronAPI.readFile(fullPath);
    if (!readResult.success) {
    lastCard = makeFileChangeCard(container, {
      type: 'error',
      filename: relativePath,
      detail: uiTextf('file_read_failed_with_error', { error: parseAgentError(readResult.error) })
    });
    return;
  }

  const oldContent = readResult.content;
  const lines = oldContent.split('\n');
  const replacementLines = replacement.replace(/\n$/, '').split('\n');
  lines.splice(startLine - 1, endLine - startLine + 1, ...replacementLines);
  const newContent = lines.join('\n');

  const writeResult = await window.electronAPI.writeFile(fullPath, newContent);
  if (writeResult.success) {
    const undoFn = async () => {
      const original = checkpoint.content || '';
      await window.electronAPI.writeFile(fullPath, original);
      syncOpenFileWithContent(fullPath, original);
      showToast(uiTextf('edit_undo_with_file', { file: relativePath }), 'info');
    };
      const redoFn = async () => {
      await window.electronAPI.writeFile(fullPath, newContent);
      syncOpenFileWithContent(fullPath, newContent);
        showToast(uiText('line_edit_redone') || 'Line edit re-applied.', 'success', 1500);
    };
    lastCard = makeFileChangeCard(container, {
      type: 'lines', filename: relativePath,
      meta: uiTextf('line_range_meta', { start: startLine, end: endLine }),
      detail: uiTextf('line_replaced_detail', { count: replacementLines.length }),
      undoFn, redoFn
    });
    showToast(uiTextf('lines_edited_with_file', { file: relativePath }), 'success');
    const openFile = state.openFiles.find(f => f.path === fullPath);
    if (openFile) { openFile.model.setValue(newContent); openFile.modified = false; updateTabModified(fullPath, false); }
  } else {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: parseAgentError(writeResult.error) });
  }
  container.scrollTop = container.scrollHeight;
}

async function executeAppendAction(relativePath, content, container) {
  let lastCard = null;
  const fullPath = await window.electronAPI.pathJoin(state.projectDir, relativePath);
  const safe = await window.electronAPI.isPathSafe(fullPath, state.projectDir);
  if (!safe) {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: uiText('security_violation_project_outside') });
    return;
  }

  const readResult = await window.electronAPI.readFile(fullPath);
  if (!readResult.success) {
    lastCard = makeFileChangeCard(container, {
      type: 'error',
      filename: relativePath,
      detail: uiTextf('file_read_failed_with_error', { error: parseAgentError(readResult.error) })
    });
    return;
  }

  const oldContent = readResult.content;
  // Append: make sure there's a newline between old and new content if needed
  const newContent = oldContent + (oldContent.endsWith('\n') ? '' : '\n') + content;
  const linesAdded = content.split('\n').length;

  const writeResult = await window.electronAPI.writeFile(fullPath, newContent);
  if (writeResult.success) {
    const undoFn = async () => {
      await window.electronAPI.writeFile(fullPath, oldContent);
      const openFile = state.openFiles.find(f => f.path === fullPath);
      if (openFile) { openFile.model.setValue(oldContent); openFile.modified = false; updateTabModified(fullPath, false); }
      showToast(uiTextf('edit_undo_with_file', { file: relativePath }), 'info');
    };
    lastCard = makeFileChangeCard(container, {
      type: 'lines', filename: relativePath,
      meta: uiTextf('append_meta', { count: linesAdded }),
      detail: uiText('append_detail'),
      undoFn
    });
    showToast(uiTextf('appended_with_file', { file: relativePath }), 'success');
    const openFile = state.openFiles.find(f => f.path === fullPath);
    if (openFile) { openFile.model.setValue(newContent); openFile.modified = false; updateTabModified(fullPath, false); }
  } else {
    lastCard = makeFileChangeCard(container, { type: 'error', filename: relativePath, detail: parseAgentError(writeResult.error) });
  }
  container.scrollTop = container.scrollHeight;
}

function addAgentMessageUI(role, text) {
  const container = document.getElementById('agent-messages');
  // Remove welcome and fade out info-box on first user message
  if (role === 'user') {
    const welcome = container.querySelector('.chat-welcome');
    if (welcome && container.children.length === 1) {
      welcome.remove();
    }
    // Fade out agent-info-box after first user message
    const infoBox = document.querySelector('.agent-info-box');
    if (infoBox && !infoBox.dataset.dismissed) {
      infoBox.dataset.dismissed = '1';
      setTimeout(() => {
        infoBox.style.transition = 'opacity 0.5s ease, max-height 0.5s ease, margin 0.5s ease, padding 0.5s ease, border-width 0.5s ease';
        infoBox.style.opacity = '0';
        infoBox.style.maxHeight = '0';
        infoBox.style.margin = '0';
        infoBox.style.padding = '0';
        infoBox.style.borderWidth = '0';
        infoBox.style.overflow = 'hidden';
      }, 800);
    }
  }

  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  const icon = role === 'user' ? 'user' : 'cpu';
  const name = role === 'user' ? uiText('user_name') : uiText('agent_name');

  div.innerHTML = `
    <div class="msg-header">
      <i data-lucide="${icon}" class="icon-xs"></i>
      <span>${name}</span>
    </div>
    <div class="msg-body">${formatMessage(text)}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  refreshIcons();
}

function clearAgent() {
  state.agentHistory = [];
  const container = document.getElementById('agent-messages');
  container.innerHTML = `
    <div class="chat-welcome">
      <i data-lucide="cpu" class="welcome-icon"></i>
      <h3>${uiText('agent_welcome_title')}</h3>
      <p>${uiText('agent_welcome_desc')}</p>
    </div>
  `;
  const changes = document.getElementById('agent-changes');
  const changesBar = document.getElementById('agent-changes-bar');
  if (changes) {
    changes.innerHTML = '';
    changes.classList.remove('has-changes');
    changes.classList.remove('minimized');
  }
  if (changesBar) {
    changesBar.classList.remove('has-changes');
    changesBar.setAttribute('aria-hidden', 'true');
  }
  // Restore agent-info-box visibility
  const infoBox = document.querySelector('.agent-info-box');
  if (infoBox) {
    infoBox.dataset.dismissed = '';
    infoBox.style.transition = '';
    infoBox.style.opacity = '';
    infoBox.style.maxHeight = '';
    infoBox.style.margin = '';
    infoBox.style.padding = '';
    infoBox.style.borderWidth = '';
    infoBox.style.overflow = '';
  }
  refreshIcons();
}

async function getProjectStructureText(dirPath, prefix, maxDepth) {
  if (maxDepth <= 0) return prefix + '...\n';
  let result = '';
  try {
    const items = await window.electronAPI.readDirectory(dirPath);
    for (const item of items) {
      if (item.isDirectory) {
        result += `${prefix}📁 ${item.name}/\n`;
        result += await getProjectStructureText(item.path, prefix + '  ', maxDepth - 1);
      } else {
        result += `${prefix}📄 ${item.name}\n`;
      }
    }
  } catch {}
  return result;
}

// ============ TERMINAL ============
function initTerminalToggle() {
  document.getElementById('btn-toggle-terminal')?.addEventListener('click', toggleTerminal);
  document.getElementById('btn-terminal-toggle')?.addEventListener('click', toggleTerminal);
  document.getElementById('btn-terminal-kill')?.addEventListener('click', killTerminal);

  // Resize handle
  const handle = document.getElementById('terminal-resize-handle');
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  handle?.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = document.getElementById('terminal-container').offsetHeight;
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
  });

  function onResize(e) {
    if (!isResizing) return;
    const delta = startY - e.clientY;
    const newHeight = Math.max(100, Math.min(600, startHeight + delta));
    document.getElementById('terminal-container').style.height = newHeight + 'px';
    if (state.terminalFit) state.terminalFit.fit();
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
  }
}

async function toggleTerminal() {
  const container = document.getElementById('terminal-container');
  const handle = document.getElementById('terminal-resize-handle');

  if (state.terminalOpen) {
    container.style.display = 'none';
    handle.style.display = 'none';
    state.terminalOpen = false;
  } else {
    container.style.display = 'flex';
    handle.style.display = 'block';
    state.terminalOpen = true;
    // Wait for layout reflow using rAF (more reliable than setTimeout)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await initTerminal();
    } catch (err) {
      const body = document.getElementById('terminal-body');
      if (body) {
        try {
          await initBasicTerminal(body, uiTextf('terminal_error_mode', { error: err?.message || String(err) }));
        } catch (fallbackErr) {
          body.innerHTML = `
            <div class="terminal-error-box">
              <strong>${uiText('terminal_start_failed')}</strong>
              <p>${escapeHtml(err?.message || String(err))}</p>
              <p>${escapeHtml(uiTextf('terminal_fallback_start_failed', { error: fallbackErr?.message || String(fallbackErr) }))}</p>
            </div>
          `;
        }
      }
      showToast(uiTextf('terminal_error', { error: err?.message || err }), 'error', 3500);
    }
  }
}

function echoFallbackInput(data) {
  if (!state.terminal || state.terminalMode !== 'fallback') return;
  const cleaned = String(data || '')
    .replace(/\x1b\[\?2004h/g, '')
    .replace(/\x1b\[\?2004l/g, '')
    .replace(/\x1b\[200~/g, '')
    .replace(/\x1b\[201~/g, '');

  for (const ch of cleaned) {
    if (ch === '\r') {
      state.terminal.write('\r\n');
      continue;
    }
    if (ch === '\u007f') {
      state.terminal.write('\b \b');
      continue;
    }
    if (ch >= ' ') {
      state.terminal.write(ch);
    }
  }
}

function stripAnsiCodes(text) {
  return String(text || '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B[@-_]/g, '');
}

function appendBasicTerminalOutput(outputEl, text) {
  if (!outputEl) return;
  const normalized = stripAnsiCodes(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  outputEl.textContent += normalized;
  outputEl.scrollTop = outputEl.scrollHeight;
}

async function initBasicTerminal(container, reason) {
  state.terminalMode = 'basic';
  container.innerHTML = `
    <div class="basic-terminal">
      <pre class="basic-terminal-output"></pre>
      <div class="basic-terminal-input-row">
        <span class="basic-terminal-prompt">></span>
        <input class="basic-terminal-input" type="text" autocomplete="off" spellcheck="false" placeholder="${uiText('terminal_basic_input_placeholder')}">
      </div>
    </div>
  `;

  const output = container.querySelector('.basic-terminal-output');
  const input = container.querySelector('.basic-terminal-input');
  if (!output || !input) return;

  appendBasicTerminalOutput(output, `${uiTextf('terminal_basic_opened', { reason })}\n`);

  input.addEventListener('focus', () => {
    state.shortcutScope = 'terminal';
  });

  container.addEventListener('click', () => {
    state.shortcutScope = 'terminal';
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    state.shortcutScope = 'terminal';
    if (e.key === 'Enter') {
      e.preventDefault();
      const command = input.value || '';
      appendBasicTerminalOutput(output, `> ${command}\n`);
      window.electronAPI.terminalInput(command + '\r');
      input.value = '';
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      appendBasicTerminalOutput(output, '^C\n');
      window.electronAPI.terminalInput('\x03');
    }
  });

  window.electronAPI.onTerminalData((data) => {
    appendBasicTerminalOutput(output, data);
  });

  window.electronAPI.onTerminalExit((code) => {
    appendBasicTerminalOutput(output, `\n${uiTextf('terminal_closed_with_code', { code })}\n`);
    state.terminalMode = null;
  });

  const cwd = state.projectDir || undefined;
  const result = await window.electronAPI.terminalCreate(cwd);
  if (result.success) {
    const backendType = result.type === 'pty' ? 'PTY' : 'Fallback';
    appendBasicTerminalOutput(output, `${uiTextf('terminal_backend_ready', { type: backendType })}\n`);
    window.electronAPI.terminalInput('\r');
  } else {
    appendBasicTerminalOutput(output, `${uiTextf('terminal_start_failed_with_error', { error: result.error })}\n`);
  }

  input.focus();
}

async function initTerminal() {
  const container = document.getElementById('terminal-body');
  if (!container) throw new Error(uiText('terminal_container_not_found'));

  // Clean up existing terminal
  window.electronAPI.removeTerminalListeners();
  if (state.terminalResizeObserver) {
    state.terminalResizeObserver.disconnect();
    state.terminalResizeObserver = null;
  }
  if (state.terminal) {
    state.terminal.dispose();
    state.terminal = null;
  }
  state.terminalMode = null;
  container.innerHTML = '';

  const missingXterm = typeof Terminal === 'undefined';
  const missingFit = !window.FitAddon || typeof window.FitAddon.FitAddon !== 'function';
  if (missingXterm || missingFit) {
    const reason = missingXterm
      ? uiText('terminal_missing_xterm')
      : uiText('terminal_missing_fit');
    await initBasicTerminal(container, reason);
    return;
  }

  // Create xterm
  state.terminal = new Terminal({
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: 13,
    lineHeight: 1.4,
    theme: {
      background: '#0d1117',
      foreground: '#e6edf3',
      cursor: '#e63946',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black: '#484f58',
      red: '#ff7b72',
      green: '#7ee787',
      yellow: '#d29922',
      blue: '#79c0ff',
      magenta: '#d2a8ff',
      cyan: '#a5d6ff',
      white: '#e6edf3',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#a5d6ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#b6e3ff',
      brightWhite: '#ffffff'
    },
    cursorBlink: true,
    scrollback: 5000
  });

  state.terminalFit = new FitAddon.FitAddon();
  state.terminal.loadAddon(state.terminalFit);

  try {
    const webLinks = new WebLinksAddon.WebLinksAddon();
    state.terminal.loadAddon(webLinks);
  } catch {}

  state.terminal.open(container);

  // Ensure container is focusable
  container.style.outline = 'none';

  // Ensure proper sizing before writing anything
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try { state.terminalFit.fit(); } catch {}

  // Focus terminal to enable keyboard input
  state.terminal.focus();
  state.terminal.write(`\x1b[90m${uiText('terminal_preparing')}\x1b[0m\r\n`);

  // Resize observer
  const observer = new ResizeObserver(() => {
    if (state.terminalFit) {
      try { state.terminalFit.fit(); } catch {}
    }
  });
  observer.observe(container);
  state.terminalResizeObserver = observer;

  // Connect PTY input from xterm right away (before create)
  state.terminal.onData(data => {
    echoFallbackInput(data);
    window.electronAPI.terminalInput(data);
  });

  // Resize sync
  state.terminal.onResize(({ cols, rows }) => {
    window.electronAPI.terminalResize({ cols, rows });
  });

  // Ensure focus when clicking on terminal
  container.addEventListener('click', () => {
    state.shortcutScope = 'terminal';
    state.terminal?.focus();
  });

  window.electronAPI.onTerminalData(data => {
    state.terminal?.write(data);
  });

  window.electronAPI.onTerminalExit(code => {
    state.terminal?.write(`\r\n\x1b[33m${uiTextf('terminal_closed_reopen', { code })}\x1b[0m\r\n`);
    state.terminalMode = null;
  });

  // Create PTY process
  const cwd = state.projectDir || undefined;
  const result = await window.electronAPI.terminalCreate(cwd);

  if (result.success) {
    state.terminalMode = result.type || 'pty';
    // Write welcome message after a short delay to ensure xterm canvas is painted
    setTimeout(() => {
      if (!state.terminal) return;
      state.terminal.write(`\x1b[36m${uiText('terminal_started')}\x1b[0m\r\n`);
      if (result.type === 'fallback') {
        state.terminal.write(`\x1b[33m${uiText('terminal_compat_mode')}\x1b[0m\r\n`);
        window.electronAPI.terminalInput('\r');
      }
    }, 80);

    // Initial resize and focus after PTY is ready
    setTimeout(() => {
      if (state.terminalFit) {
        try {
          state.terminalFit.fit();
          const dims = state.terminalFit.proposeDimensions();
          if (dims) window.electronAPI.terminalResize(dims);
        } catch {}
      }
      state.terminal?.focus();
    }, 150);

  } else {
    state.terminalMode = null;
    setTimeout(() => {
      state.terminal?.write(`\x1b[31m${uiTextf('terminal_start_failed_with_error', { error: result.error })}\x1b[0m\r\n`);
      state.terminal?.write(`\x1b[33m→ ${uiText('terminal_rebuild_hint')}\x1b[0m\r\n`);
    }, 80);
  }
}

async function killTerminal() {
  await window.electronAPI.terminalKill();
  window.electronAPI.removeTerminalListeners();
  if (state.terminalResizeObserver) {
    state.terminalResizeObserver.disconnect();
    state.terminalResizeObserver = null;
  }
  if (state.terminal) {
    state.terminal.dispose();
    state.terminal = null;
  }
  state.terminalMode = null;
  document.getElementById('terminal-container').style.display = 'none';
  document.getElementById('terminal-resize-handle').style.display = 'none';
  state.terminalOpen = false;
}

// ============ SETTINGS ============
function initSettings() {
  // UI language selector
  document.getElementById('settings-ui-language')?.addEventListener('change', (e) => {
    state.uiLanguage = String(e.target.value || 'system');
    applyUILanguage();
    scheduleSettingsSave();
  });
  const btnRefresh = document.getElementById('btn-refresh-models');
  btnRefresh?.addEventListener('click', () => {
    loadOllamaModels();
  });

  const providerTypeEl = document.getElementById('settings-provider-type');
  const providerBaseUrlEl = document.getElementById('settings-provider-baseurl');
  const providerApiKeyEl = document.getElementById('settings-provider-apikey');
  const providerModelsEl = document.getElementById('settings-provider-models');

  providerTypeEl?.addEventListener('change', async (e) => {
    const previousType = normalizeProviderType(state.aiProviderType);
    const nextType = normalizeProviderType(e.target.value);
    const previousPreset = getProviderPreset(previousType);
    const nextPreset = getProviderPreset(nextType);
    const currentBaseUrl = String(state.aiProviderBaseUrl || '').trim();

    state.aiProviderType = nextType;
    if (!currentBaseUrl || currentBaseUrl === previousPreset.baseUrl) {
      state.aiProviderBaseUrl = nextPreset.baseUrl || '';
    }

    applyProviderSettingsToUI();
    scheduleSettingsSave(100);
    logAppEvent('INFO', 'renderer.settings.provider.type.changed', {
      provider: providerForLog()
    });
    await loadOllamaModels();
  });

  providerBaseUrlEl?.addEventListener('change', async (e) => {
    const fallbackBaseUrl = getProviderPreset(state.aiProviderType).baseUrl || '';
    state.aiProviderBaseUrl = String(e.target.value || '').trim() || fallbackBaseUrl;
    e.target.value = state.aiProviderBaseUrl;
    scheduleSettingsSave();
    logAppEvent('INFO', 'renderer.settings.provider.baseurl.changed', {
      provider: providerForLog()
    });
    await loadOllamaModels();
  });

  providerApiKeyEl?.addEventListener('change', async (e) => {
    state.aiProviderApiKey = String(e.target.value || '').trim();
    scheduleSettingsSave();
    logAppEvent('INFO', 'renderer.settings.provider.apikey.changed', {
      provider: providerForLog()
    });
    await loadOllamaModels();
  });

  providerModelsEl?.addEventListener('change', async (e) => {
    state.aiProviderModelCatalog = String(e.target.value || '');
    scheduleSettingsSave();
    logAppEvent('INFO', 'renderer.settings.provider.models.changed', {
      provider: providerForLog()
    });
    await loadOllamaModels();
  });

  const aboutLink = document.querySelector('.about-link');
  if (aboutLink) {
    aboutLink.setAttribute('role', 'link');
    aboutLink.setAttribute('tabindex', '0');
    aboutLink.setAttribute('title', 'https://cayadev.com/');

    const openAboutSite = async (e) => {
      e?.preventDefault?.();
      const result = await window.electronAPI.openExternalUrl('https://cayadev.com/');
      if (!result?.success) {
        showToast(uiTextf('site_open_failed', { error: result?.error || uiText('unknown_error') }), 'error', 2500);
      }
    };

    aboutLink.addEventListener('click', openAboutSite);
    aboutLink.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        openAboutSite(e);
      }
    });
  }

  // Chat model sync
  document.getElementById('settings-chat-model')?.addEventListener('change', (e) => {
    state.chatModel = e.target.value;
    document.getElementById('chat-model-select').value = e.target.value;
    scheduleSettingsSave();
  });

  // Agent model sync
  document.getElementById('settings-agent-model')?.addEventListener('change', (e) => {
    state.agentModel = e.target.value;
    document.getElementById('agent-model-select').value = e.target.value;
    scheduleSettingsSave();
  });

  // Autocomplete model
  document.getElementById('settings-autocomplete-model')?.addEventListener('change', (e) => {
    state.autocompleteModel = e.target.value;
    scheduleSettingsSave();
  });

  // Autocomplete enabled
  document.getElementById('autocomplete-enabled')?.addEventListener('change', (e) => {
    state.autocompleteEnabled = e.target.checked;
    scheduleSettingsSave();
  });

  // Prompt translation options
  document.getElementById('settings-translate-enabled')?.addEventListener('change', (e) => {
    state.translatePromptsEnabled = e.target.checked;
    refreshTranslationSettingsUI();
    scheduleSettingsSave();
  });

  document.getElementById('settings-translate-model')?.addEventListener('change', (e) => {
    state.translateModel = e.target.value;
    scheduleSettingsSave();
  });

  // Font size
  document.getElementById('settings-fontsize')?.addEventListener('change', (e) => {
    const size = parseInt(e.target.value);
    if (size < 10 || size > 30) return;
    state.editorFontSize = size;
    if (state.editor) state.editor.updateOptions({ fontSize: size });
    scheduleSettingsSave();
  });

  // Tab size
  document.getElementById('settings-tabsize')?.addEventListener('change', (e) => {
    const size = parseInt(e.target.value);
    if (size < 1 || size > 8) return;
    state.editorTabSize = size;
    if (state.editor) state.editor.updateOptions({ tabSize: size });
    scheduleSettingsSave();
  });

  // Word wrap
  document.getElementById('settings-wordwrap')?.addEventListener('change', (e) => {
    state.editorWordWrap = e.target.checked;
    if (state.editor) state.editor.updateOptions({ wordWrap: state.editorWordWrap ? 'on' : 'off' });
    scheduleSettingsSave();
  });

  // Minimap
  document.getElementById('settings-minimap')?.addEventListener('change', (e) => {
    state.editorMinimap = e.target.checked;
    if (state.editor) state.editor.updateOptions({ minimap: { enabled: state.editorMinimap } });
    scheduleSettingsSave();
  });

  applySettingsToUIFromState();
  refreshTranslationSettingsUI();
}
