const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const http = require('http');
const https = require('https');

let mainWindow;
let ptyProcess = null;
let currentProjectDir = null;
let trustedDirs = new Set();
let activeOllamaRequests = new Map(); // Track requests for abort
let projectTreeWatcher = null;
let projectTreeWatcherDir = null;
let projectTreeDebounce = null;
const APP_SETTINGS_DIR = path.join(os.homedir(), '.CaYaDevEditor');
const APP_SETTINGS_FILE = path.join(APP_SETTINGS_DIR, 'settings.json');
const APP_LOGS_DIR = path.join(APP_SETTINGS_DIR, 'logs');
const LOG_SENSITIVE_KEYS = new Set([
  'apikey', 'api_key', 'authorization', 'token', 'password', 'secret', 'x-api-key'
]);
let logWriteQueue = Promise.resolve();
const PROVIDER_PRESETS = {
  ollama: { kind: 'ollama', baseUrl: 'http://localhost:11434' },
  openai: { kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  claude: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  grok: { kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1' },
  openrouter: { kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1' },
  'github-models': { kind: 'openai-compatible', baseUrl: 'https://models.inference.ai.azure.com' },
  'custom-openai': { kind: 'openai-compatible', baseUrl: '' }
};

const MAIN_I18N = {
  en: {
    settings_read_failed: 'Settings file could not be read:',
    provider_base_url_required: 'API base URL is required for the selected provider.',
    provider_api_key_required: 'API key is required for the selected provider.',
    streaming_unreadable: 'Streaming response could not be read.',
    menu_file: 'File',
    menu_open_project: 'Open Project Directory',
    menu_save: 'Save',
    menu_exit: 'Exit',
    menu_edit: 'Edit',
    menu_undo: 'Undo',
    menu_redo: 'Redo',
    menu_cut: 'Cut',
    menu_copy: 'Copy',
    menu_paste: 'Paste',
    menu_view: 'View',
    menu_reload: 'Reload',
    menu_devtools: 'Developer Tools',
    menu_zoom_in: 'Zoom In',
    menu_zoom_out: 'Zoom Out',
    menu_zoom_reset: 'Reset Zoom',
    choose_project_directory: 'Select Project Directory',
    invalid_file_path: 'Invalid file path',
    file_not_found: 'File not found',
    selected_not_file: 'Selected item is not a file',
    trust_title: 'Directory Trust',
    trust_message: 'Do you trust this directory?\n\n{dirPath}\n\nAI may create, edit and delete files in this directory.',
    trust_button: 'Trust',
    cancel_button: 'Cancel',
    invalid_directory_path: 'Invalid directory path',
    delete_confirm_title: 'Delete File Confirmation',
    delete_confirm_message: 'Are you sure you want to delete this file?\n\n{filePath}',
    delete_confirm_detail: 'This action cannot be undone!',
    delete_button: 'Delete',
    model_not_found: 'Model not found. Enter a model list or check the connection.',
    request_not_found: 'Request not found',
    response_not_readable: 'Response could not be read',
    response_parse_failed: 'Response could not be parsed'
  },
  tr: {
    settings_read_failed: 'Ayar dosyası okunamadı:',
    provider_base_url_required: 'Seçilen sağlayıcı için API base URL gerekli.',
    provider_api_key_required: 'Seçilen sağlayıcı için API anahtarı gerekli.',
    streaming_unreadable: 'Streaming response okunamadı.',
    menu_file: 'Dosya',
    menu_open_project: 'Proje Dizini Aç',
    menu_save: 'Kaydet',
    menu_exit: 'Çıkış',
    menu_edit: 'Düzenle',
    menu_undo: 'Geri Al',
    menu_redo: 'Yinele',
    menu_cut: 'Kes',
    menu_copy: 'Kopyala',
    menu_paste: 'Yapıştır',
    menu_view: 'Görünüm',
    menu_reload: 'Yenile',
    menu_devtools: 'Geliştirici Araçları',
    menu_zoom_in: 'Yakınlaştır',
    menu_zoom_out: 'Uzaklaştır',
    menu_zoom_reset: 'Sıfırla',
    choose_project_directory: 'Proje Dizini Seç',
    invalid_file_path: 'Geçersiz dosya yolu',
    file_not_found: 'Dosya bulunamadı',
    selected_not_file: 'Seçilen öğe bir dosya değil',
    trust_title: 'Dizin Güvenliği',
    trust_message: 'Bu dizine güveniyor musunuz?\n\n{dirPath}\n\nYapay zeka bu dizindeki dosyaları oluşturabilir, düzenleyebilir ve silebilir.',
    trust_button: 'Güven',
    cancel_button: 'İptal',
    invalid_directory_path: 'Geçersiz dizin yolu',
    delete_confirm_title: 'Dosya Silme Onayı',
    delete_confirm_message: 'Bu dosyayı silmek istediğinizden emin misiniz?\n\n{filePath}',
    delete_confirm_detail: 'Bu işlem geri alınamaz!',
    delete_button: 'Sil',
    model_not_found: 'Model bulunamadi. Model listesi girin veya baglantiyi kontrol edin.',
    request_not_found: 'İstek bulunamadı',
    response_not_readable: 'Yanit okunamadi',
    response_parse_failed: 'Yanit parse edilemedi'
  }
};

function normalizeUILanguageChoice(value) {
  const raw = String(value || 'system').trim().toLowerCase();
  if (raw === 'tr' || raw === 'en' || raw === 'system') return raw;
  return 'system';
}

function detectSystemLanguage() {
  try {
    const locale = String(app.getLocale?.() || Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
    return locale.startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

let mainLanguage = detectSystemLanguage();

function resolveMainLanguage(settingsLike) {
  const choice = normalizeUILanguageChoice(settingsLike?.uiLanguage);
  return choice === 'system' ? detectSystemLanguage() : choice;
}

function mainT(key, vars = {}, langOverride) {
  const lang = langOverride || mainLanguage;
  const dict = MAIN_I18N[lang] || MAIN_I18N.en;
  const fallback = MAIN_I18N.en;
  const template = String(dict[key] ?? fallback[key] ?? key);
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

function pad(num, len = 2) {
  return String(num).padStart(len, '0');
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getLocalTimestamp(date = new Date()) {
  return `${getLocalDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function clipText(value, limit = 1200) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...(clipped ${text.length - limit} chars)`;
}

function toSafeLogValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') return clipText(value, 4000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return '[Function]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      stack: clipText(value.stack || '', 6000)
    };
  }
  if (Array.isArray(value)) {
    if (depth > 4) return `[Array(${value.length})]`;
    const limited = value.slice(0, 50).map((item) => toSafeLogValue(item, depth + 1, seen));
    if (value.length > 50) {
      limited.push(`...(${value.length - 50} more)`);
    }
    return limited;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (depth > 4) return '[Object]';
    const out = {};
    for (const [rawKey, rawVal] of Object.entries(value)) {
      const key = String(rawKey || '');
      if (LOG_SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = toSafeLogValue(rawVal, depth + 1, seen);
    }
    return out;
  }
  return String(value);
}

function providerForLog(provider = {}) {
  return {
    type: String(provider.type || ''),
    kind: String(provider.kind || ''),
    baseUrl: String(provider.baseUrl || ''),
    hasApiKey: !!provider.apiKey,
    modelCatalogSize: parseManualModelCatalog(provider.modelCatalog || '').length
  };
}

function summarizeMessagesForLog(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  return safe.slice(0, 30).map((msg, index) => {
    const role = String(msg?.role || 'unknown');
    const content = String(msg?.content ?? '');
    return {
      index,
      role,
      length: content.length,
      preview: clipText(content, 240)
    };
  });
}

async function appendLogEntry(level, eventName, details = {}) {
  const now = new Date();
  const ts = getLocalTimestamp(now);
  const day = getLocalDateKey(now);
  const payload = {
    ts,
    level: String(level || 'INFO').toUpperCase(),
    event: String(eventName || 'unknown'),
    details: toSafeLogValue(details)
  };
  const line = `[${payload.ts}] [${payload.level}] ${payload.event} ${JSON.stringify(payload.details)}${os.EOL}`;
  const logFile = path.join(APP_LOGS_DIR, `${day}.log`);

  logWriteQueue = logWriteQueue
    .then(async () => {
      await fs.promises.mkdir(APP_LOGS_DIR, { recursive: true });
      await fs.promises.appendFile(logFile, line, 'utf-8');
    })
    .catch((err) => {
      console.error('Log yazma hatasi:', err?.message || err);
    });

  return logWriteQueue;
}

function logInfo(eventName, details) {
  return appendLogEntry('INFO', eventName, details);
}

function logWarn(eventName, details) {
  return appendLogEntry('WARN', eventName, details);
}

function logError(eventName, details) {
  return appendLogEntry('ERROR', eventName, details);
}

function normalizeProviderType(value) {
  const type = String(value || 'ollama').trim().toLowerCase();
  return PROVIDER_PRESETS[type] ? type : 'ollama';
}

function sanitizeSettingsPayload(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const asString = (value) => (typeof value === 'string' ? value : '');
  const asBool = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);
  const asNumber = (value, fallback, min, max) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const editor = source.editor && typeof source.editor === 'object' && !Array.isArray(source.editor)
    ? source.editor
    : {};
  const panelWidths = source.panelWidths && typeof source.panelWidths === 'object' && !Array.isArray(source.panelWidths)
    ? source.panelWidths
    : {};
  const agentOptions = source.agentOptions && typeof source.agentOptions === 'object' && !Array.isArray(source.agentOptions)
    ? source.agentOptions
    : {};
  const aiProvider = source.aiProvider && typeof source.aiProvider === 'object' && !Array.isArray(source.aiProvider)
    ? source.aiProvider
    : {};
  const normalizedProviderType = normalizeProviderType(aiProvider.type);
  const preset = PROVIDER_PRESETS[normalizedProviderType] || PROVIDER_PRESETS.ollama;
  const providerBaseUrl = String(aiProvider.baseUrl || preset.baseUrl || '').trim();

  return {
    chatModel: asString(source.chatModel),
    agentModel: asString(source.agentModel),
    autocompleteModel: asString(source.autocompleteModel),
    autocompleteEnabled: asBool(source.autocompleteEnabled, true),
    translatePromptsEnabled: asBool(source.translatePromptsEnabled, false),
    translateModel: asString(source.translateModel),
    uiLanguage: normalizeUILanguageChoice(source.uiLanguage),
    editor: {
      fontSize: asNumber(editor.fontSize, 14, 10, 30),
      tabSize: asNumber(editor.tabSize, 2, 1, 8),
      wordWrap: asBool(editor.wordWrap, false),
      minimap: asBool(editor.minimap, true)
    },
    panelWidths: {
      left: asNumber(panelWidths.left, 340, 220, 560),
      right: asNumber(panelWidths.right, 340, 220, 560)
    },
    agentOptions: {
      includeProject: asBool(agentOptions.includeProject, true),
      includeCurrentFile: asBool(agentOptions.includeCurrentFile, false)
    },
    aiProvider: {
      type: normalizedProviderType,
      baseUrl: providerBaseUrl,
      apiKey: asString(aiProvider.apiKey),
      modelCatalog: asString(aiProvider.modelCatalog)
    }
  };
}

async function loadSettingsFromDisk() {
  try {
    const raw = await fs.promises.readFile(APP_SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return sanitizeSettingsPayload(parsed);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return {};
    }
    logWarn('settings.load.failed', { error: err });
    console.warn(mainT('settings_read_failed'), err.message);
    return {};
  }
}

async function refreshMainLanguageFromDisk() {
  const settings = await loadSettingsFromDisk();
  mainLanguage = resolveMainLanguage(settings);
  return settings;
}

function normalizeProviderConfig(raw = {}) {
  const type = normalizeProviderType(raw.type);
  const preset = PROVIDER_PRESETS[type] || PROVIDER_PRESETS.ollama;
  const baseUrl = String(raw.baseUrl || preset.baseUrl || '').trim().replace(/\/+$/, '');
  return {
    type,
    kind: preset.kind,
    baseUrl,
    apiKey: String(raw.apiKey || '').trim(),
    modelCatalog: String(raw.modelCatalog || '').trim()
  };
}

async function getEffectiveProviderConfig(overrideConfig) {
  const settings = await loadSettingsFromDisk();
  const savedProvider = settings?.aiProvider && typeof settings.aiProvider === 'object'
    ? settings.aiProvider
    : {};
  const override = overrideConfig && typeof overrideConfig === 'object'
    ? overrideConfig
    : {};
  return normalizeProviderConfig({ ...savedProvider, ...override });
}

function parseManualModelCatalog(rawText) {
  return [...new Set(
    String(rawText || '')
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

function toModelObjects(modelNames) {
  return modelNames.map((name) => ({
    name,
    model: name,
    size: 0
  }));
}

function formatApiError(status, payloadText, payloadJson) {
  const candidate =
    payloadJson?.error?.message ||
    payloadJson?.error ||
    payloadJson?.message ||
    payloadText ||
    'Unknown API error';
  const clean = String(candidate).trim();
  return `HTTP ${status}: ${clean}`;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payloadText = await response.text();
    let payloadJson = null;
    try {
      payloadJson = payloadText ? JSON.parse(payloadText) : null;
    } catch {}

    if (!response.ok) {
      throw new Error(formatApiError(response.status, payloadText, payloadJson));
    }

    return payloadJson || {};
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    const wrapped = isAbort
      ? new Error(`Request timeout after ${timeoutMs}ms (${url})`)
      : err;
    if (isAbort) {
      wrapped.name = 'TimeoutError';
    }
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

function buildOpenAICompatibleHeaders(provider) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  if (provider.type === 'openrouter') {
    headers['HTTP-Referer'] = 'https://cayadev.com';
    headers['X-Title'] = 'CaYaDev Editor';
  }
  return headers;
}

function ensureProviderCredentials(provider) {
  if (!provider.baseUrl) {
    throw new Error(mainT('provider_base_url_required'));
  }
  if (provider.type === 'ollama') return;
  if (provider.type === 'custom-openai') return;
  if (!provider.apiKey) {
    throw new Error(mainT('provider_api_key_required'));
  }
}

async function listModelsByProvider(provider) {
  ensureProviderCredentials(provider);

  if (provider.type === 'ollama') {
    const payload = await fetchJsonWithTimeout(`${provider.baseUrl || PROVIDER_PRESETS.ollama.baseUrl}/api/tags`, {}, 8000);
    return Array.isArray(payload.models) ? payload.models : [];
  }

  if (provider.kind === 'anthropic') {
    const payload = await fetchJsonWithTimeout(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, 12000);
    const models = Array.isArray(payload.data) ? payload.data : [];
    return models.map((m) => ({ name: m.id || m.name || '' })).filter((m) => m.name);
  }

  const payload = await fetchJsonWithTimeout(`${provider.baseUrl}/models`, {
    method: 'GET',
    headers: buildOpenAICompatibleHeaders(provider)
  }, 12000);
  const models = Array.isArray(payload.data) ? payload.data : [];
  return models.map((m) => ({
    name: m.id || m.name || '',
    size: m.size || 0
  })).filter((m) => m.name);
}

function splitSystemFromMessages(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  const systemParts = [];
  const converted = [];

  for (const msg of safe) {
    if (!msg || typeof msg !== 'object') continue;
    const role = String(msg.role || 'user');
    const content = String(msg.content ?? '');
    if (!content) continue;

    if (role === 'system') {
      systemParts.push(content);
      continue;
    }

    converted.push({
      role: role === 'assistant' ? 'assistant' : 'user',
      content
    });
  }

  if (converted.length === 0) {
    converted.push({ role: 'user', content: 'Hello' });
  }

  return {
    system: systemParts.join('\n\n').trim(),
    messages: converted
  };
}

async function consumeSSEStream(response, onDataBlock) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error(mainT('streaming_unreadable'));
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');

    let markerIndex;
    while ((markerIndex = buffer.indexOf('\n\n')) >= 0) {
      const eventChunk = buffer.slice(0, markerIndex);
      buffer = buffer.slice(markerIndex + 2);
      const trimmed = eventChunk.trim();
      if (!trimmed) continue;
      onDataBlock(trimmed);
    }
  }

  const tail = buffer.trim();
  if (tail) onDataBlock(tail);
}

function safeSendStreamChunk(requestId, chunkPayload) {
  mainWindow?.webContents.send('ollama-stream', {
    requestId,
    ...chunkPayload
  });
}

async function streamOpenAICompatibleChat({ provider, requestId, model, messages }) {
  const controller = new AbortController();
  activeOllamaRequests.set(requestId, controller);
  let fullResponse = '';
  let parseFailures = 0;
  logInfo('ai.chat.stream.start', {
    requestId,
    mode: 'openai-compatible',
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildOpenAICompatibleHeaders(provider),
      body: JSON.stringify({
        model,
        messages,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson = null;
      try { errorJson = errorText ? JSON.parse(errorText) : null; } catch {}
      throw new Error(formatApiError(response.status, errorText, errorJson));
    }

    await consumeSSEStream(response, (chunk) => {
      const lines = chunk.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          const delta =
            parsed?.choices?.[0]?.delta?.content ||
            parsed?.choices?.[0]?.message?.content ||
            '';
          if (!delta) continue;
          fullResponse += delta;
          safeSendStreamChunk(requestId, { content: delta, done: false });
        } catch {
          parseFailures += 1;
        }
      }
    });

    if (activeOllamaRequests.has(requestId)) {
      safeSendStreamChunk(requestId, { content: '', done: true });
    }
    logInfo('ai.chat.stream.success', {
      requestId,
      mode: 'openai-compatible',
      provider: providerForLog(provider),
      model,
      responseChars: fullResponse.length,
      parseFailures
    });

    return { success: true, requestId, response: fullResponse };
  } catch (err) {
    if (err?.name === 'AbortError') {
      logWarn('ai.chat.stream.aborted', {
        requestId,
        mode: 'openai-compatible',
        provider: providerForLog(provider),
        model,
        responseChars: fullResponse.length,
        parseFailures
      });
      return { success: true, requestId, response: fullResponse, aborted: true };
    }
    if (activeOllamaRequests.has(requestId)) {
      safeSendStreamChunk(requestId, { content: '', done: true, error: err.message });
    }
    logError('ai.chat.stream.failed', {
      requestId,
      mode: 'openai-compatible',
      provider: providerForLog(provider),
      model,
      responseChars: fullResponse.length,
      parseFailures,
      error: err
    });
    return { success: false, error: err.message };
  } finally {
    activeOllamaRequests.delete(requestId);
  }
}

async function streamAnthropicChat({ provider, requestId, model, messages }) {
  const controller = new AbortController();
  activeOllamaRequests.set(requestId, controller);
  let fullResponse = '';
  let parseFailures = 0;
  logInfo('ai.chat.stream.start', {
    requestId,
    mode: 'anthropic',
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });

  try {
    const split = splitSystemFromMessages(messages);
    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        system: split.system || undefined,
        messages: split.messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson = null;
      try { errorJson = errorText ? JSON.parse(errorText) : null; } catch {}
      throw new Error(formatApiError(response.status, errorText, errorJson));
    }

    await consumeSSEStream(response, (chunk) => {
      const lines = chunk.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const text =
            parsed?.delta?.text ||
            parsed?.content_block?.text ||
            parsed?.message?.content?.[0]?.text ||
            '';
          if (!text) continue;
          fullResponse += text;
          safeSendStreamChunk(requestId, { content: text, done: false });
        } catch {
          parseFailures += 1;
        }
      }
    });

    if (activeOllamaRequests.has(requestId)) {
      safeSendStreamChunk(requestId, { content: '', done: true });
    }
    logInfo('ai.chat.stream.success', {
      requestId,
      mode: 'anthropic',
      provider: providerForLog(provider),
      model,
      responseChars: fullResponse.length,
      parseFailures
    });

    return { success: true, requestId, response: fullResponse };
  } catch (err) {
    if (err?.name === 'AbortError') {
      logWarn('ai.chat.stream.aborted', {
        requestId,
        mode: 'anthropic',
        provider: providerForLog(provider),
        model,
        responseChars: fullResponse.length,
        parseFailures
      });
      return { success: true, requestId, response: fullResponse, aborted: true };
    }
    if (activeOllamaRequests.has(requestId)) {
      safeSendStreamChunk(requestId, { content: '', done: true, error: err.message });
    }
    logError('ai.chat.stream.failed', {
      requestId,
      mode: 'anthropic',
      provider: providerForLog(provider),
      model,
      responseChars: fullResponse.length,
      parseFailures,
      error: err
    });
    return { success: false, error: err.message };
  } finally {
    activeOllamaRequests.delete(requestId);
  }
}

async function chatSyncOpenAICompatible(provider, model, messages) {
  logInfo('ai.chat.sync.start', {
    mode: 'openai-compatible',
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });
  try {
    const payload = await fetchJsonWithTimeout(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildOpenAICompatibleHeaders(provider),
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    }, 60000);

    const content = payload?.choices?.[0]?.message?.content || '';
    logInfo('ai.chat.sync.success', {
      mode: 'openai-compatible',
      provider: providerForLog(provider),
      model,
      responseChars: String(content || '').length
    });
    return {
      success: true,
      message: { content: String(content || '') }
    };
  } catch (err) {
    logError('ai.chat.sync.failed', {
      mode: 'openai-compatible',
      provider: providerForLog(provider),
      model,
      error: err
    });
    throw err;
  }
}

async function chatSyncAnthropic(provider, model, messages) {
  logInfo('ai.chat.sync.start', {
    mode: 'anthropic',
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });
  try {
    const split = splitSystemFromMessages(messages);
    const payload = await fetchJsonWithTimeout(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: split.system || undefined,
        messages: split.messages
      })
    }, 90000);

    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    const content = blocks
      .map((b) => (b?.type === 'text' ? String(b.text || '') : ''))
      .join('')
      .trim();
    logInfo('ai.chat.sync.success', {
      mode: 'anthropic',
      provider: providerForLog(provider),
      model,
      responseChars: content.length
    });

    return {
      success: true,
      message: { content }
    };
  } catch (err) {
    logError('ai.chat.sync.failed', {
      mode: 'anthropic',
      provider: providerForLog(provider),
      model,
      error: err
    });
    throw err;
  }
}

// ============================================================
// WINDOW CREATION
// ============================================================
function createWindow() {
  logInfo('window.create.start', { platform: process.platform, electron: process.versions.electron });
  const iconPath = (() => {
    const svg = path.join(__dirname, 'assets', 'CYEditorLogo.svg');
    const ico = path.join(__dirname, 'assets', 'CYEditorLogo.ico');
    if (process.platform === 'win32' && fs.existsSync(ico)) return ico;
    return svg;
  })();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'CaYaDev Basic AI Code Editor',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#0d1117',
    frame: false,
    titleBarStyle: 'hidden'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  logInfo('window.create.loaded', { file: path.join(__dirname, 'renderer', 'index.html') });

  // Build Menu
  const menuTemplate = [
    {
      label: mainT('menu_file'),
        submenu: [
          { label: mainT('menu_open_project'), accelerator: 'CmdOrCtrl+O', click: () => openProjectDirectory() },
        { type: 'separator' },
        { label: mainT('menu_save'), accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu-save') },
        { type: 'separator' },
        { label: mainT('menu_exit'), accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: mainT('menu_edit'),
      submenu: [
        { role: 'undo', label: mainT('menu_undo') },
        { role: 'redo', label: mainT('menu_redo') },
        { type: 'separator' },
        { role: 'cut', label: mainT('menu_cut') },
        { role: 'copy', label: mainT('menu_copy') },
        { role: 'paste', label: mainT('menu_paste') }
      ]
    },
    {
      label: mainT('menu_view'),
      submenu: [
        { role: 'reload', label: mainT('menu_reload') },
        { role: 'toggleDevTools', label: mainT('menu_devtools') },
        { type: 'separator' },
        { role: 'zoomIn', label: mainT('menu_zoom_in') },
        { role: 'zoomOut', label: mainT('menu_zoom_out') },
        { role: 'resetZoom', label: mainT('menu_zoom_reset') }
      ]
    }
  ];

  // Menü oluşturma - custom titlebar ile
  // Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    logInfo('window.closed', {});
    mainWindow = null;
    stopProjectTreeWatcher();
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
}

// ============================================================
// PROJECT DIRECTORY
// ============================================================
async function openProjectDirectory() {
  logInfo('project.open-dialog.start', {});
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: mainT('choose_project_directory')
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const dirPath = result.filePaths[0];
    logInfo('project.open-dialog.selected', { dirPath });
    mainWindow.webContents.send('project-directory-selected', dirPath);
  } else {
    logInfo('project.open-dialog.cancelled', {});
  }
}

function stopProjectTreeWatcher() {
  if (projectTreeDebounce) {
    clearTimeout(projectTreeDebounce);
    projectTreeDebounce = null;
  }

  if (projectTreeWatcher) {
    try {
      projectTreeWatcher.close();
    } catch {}
    projectTreeWatcher = null;
  }

  projectTreeWatcherDir = null;
}

// ============================================================
// IPC HANDLERS
// ============================================================

// --- Window Controls ---
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// --- Renderer Log Bridge ---
ipcMain.on('app-log-event', (event, payload = {}) => {
  const level = String(payload.level || 'INFO').toUpperCase();
  const eventName = String(payload.event || 'renderer.event');
  const details = {
    source: 'renderer',
    webContentsId: event?.sender?.id,
    ...payload.details
  };

  if (level === 'ERROR') {
    logError(eventName, details);
  } else if (level === 'WARN' || level === 'WARNING') {
    logWarn(eventName, details);
  } else {
    logInfo(eventName, details);
  }
});

// --- Open External URL ---
ipcMain.handle('open-external-url', async (event, rawUrl) => {
  try {
    const input = String(rawUrl || '').trim();
    if (!input) {
      logWarn('external-url.open.invalid', { reason: 'empty-url' });
      return { success: false, error: 'URL is empty' };
    }

    let parsed;
    try {
      parsed = new URL(input);
    } catch {
      logWarn('external-url.open.invalid', { reason: 'invalid-url', input });
      return { success: false, error: 'Invalid URL' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logWarn('external-url.open.invalid', { reason: 'unsupported-protocol', protocol: parsed.protocol, url: parsed.toString() });
      return { success: false, error: 'Unsupported URL protocol' };
    }

    await shell.openExternal(parsed.toString());
    logInfo('external-url.open.success', { url: parsed.toString() });
    return { success: true };
  } catch (err) {
    logError('external-url.open.failed', { url: String(rawUrl || ''), error: err });
    return { success: false, error: err.message };
  }
});

// --- Open Local File In Browser ---
ipcMain.handle('open-file-in-browser', async (event, rawFilePath) => {
  try {
    const inputPath = String(rawFilePath || '').trim();
    if (!inputPath) {
      logWarn('file.open-browser.invalid', { reason: 'empty-path' });
      return { success: false, error: mainT('invalid_file_path') };
    }

    const resolvedPath = path.resolve(inputPath);
    let stat;
    try {
      stat = await fs.promises.stat(resolvedPath);
    } catch {
      logWarn('file.open-browser.missing', { filePath: resolvedPath });
      return { success: false, error: mainT('file_not_found') };
    }

    if (!stat.isFile()) {
      logWarn('file.open-browser.not-file', { filePath: resolvedPath });
      return { success: false, error: mainT('selected_not_file') };
    }

    const fileUrl = pathToFileURL(resolvedPath).toString();
    await shell.openExternal(fileUrl);
    logInfo('file.open-browser.success', { filePath: resolvedPath, fileUrl });
    return { success: true };
  } catch (err) {
    logError('file.open-browser.failed', { filePath: String(rawFilePath || ''), error: err });
    return { success: false, error: err.message };
  }
});

// --- App Settings ---
ipcMain.handle('app-settings-load', async () => {
  try {
    const settings = await loadSettingsFromDisk();
    mainLanguage = resolveMainLanguage(settings);
    logInfo('settings.load.success', { path: APP_SETTINGS_FILE, hasProvider: !!settings?.aiProvider });
    return { success: true, settings, path: APP_SETTINGS_FILE };
  } catch (err) {
    logError('settings.load.failed', { path: APP_SETTINGS_FILE, error: err });
    return { success: false, settings: {}, error: err.message };
  }
});

ipcMain.handle('app-settings-save', async (event, payload) => {
  try {
    const settings = sanitizeSettingsPayload(payload);
    mainLanguage = resolveMainLanguage(settings);
    await fs.promises.mkdir(APP_SETTINGS_DIR, { recursive: true });
    await fs.promises.writeFile(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    logInfo('settings.save.success', { path: APP_SETTINGS_FILE, provider: providerForLog(settings.aiProvider || {}) });
    return { success: true, path: APP_SETTINGS_FILE };
  } catch (err) {
    logError('settings.save.failed', { path: APP_SETTINGS_FILE, error: err });
    return { success: false, error: err.message };
  }
});

// --- Open Directory Dialog ---
ipcMain.handle('open-directory-dialog', async () => {
  logInfo('project.open-directory-dialog.start', {});
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: mainT('choose_project_directory')
  });
  if (!result.canceled && result.filePaths.length > 0) {
    logInfo('project.open-directory-dialog.selected', { dirPath: result.filePaths[0] });
    return result.filePaths[0];
  }
  logInfo('project.open-directory-dialog.cancelled', {});
  return null;
});

// --- Trust Directory ---
ipcMain.handle('trust-directory', async (event, dirPath) => {
  logInfo('project.trust.prompt', { dirPath });
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: mainT('trust_title'),
    message: mainT('trust_message', { dirPath }),
    buttons: [mainT('trust_button'), mainT('cancel_button')],
    defaultId: 1,
    cancelId: 1
  });

  if (result.response === 0) {
    trustedDirs.add(dirPath);
    currentProjectDir = dirPath;
    logInfo('project.trust.accepted', { dirPath });
    return true;
  }
  logInfo('project.trust.rejected', { dirPath });
  return false;
});

// --- Check Trust ---
ipcMain.handle('is-trusted', (event, dirPath) => {
  return trustedDirs.has(dirPath);
});

// --- Watch Project Tree (Realtime Explorer) ---
ipcMain.handle('watch-project-tree', async (event, dirPath) => {
  stopProjectTreeWatcher();

  if (!dirPath) {
    logWarn('project.watch.invalid', { reason: 'empty-dir' });
    return { success: false, error: mainT('invalid_directory_path') };
  }

  try {
    projectTreeWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      if (projectTreeDebounce) clearTimeout(projectTreeDebounce);
      projectTreeDebounce = setTimeout(() => {
        mainWindow?.webContents.send('project-tree-changed', {
          eventType,
          filename: filename ? filename.toString() : '',
          watchedDir: projectTreeWatcherDir
        });
      }, 150);
    });

    projectTreeWatcherDir = dirPath;
    logInfo('project.watch.started', { dirPath, recursive: true, debounceMs: 150 });
    return { success: true };
  } catch (err) {
    stopProjectTreeWatcher();
    logError('project.watch.failed', { dirPath, error: err });
    return { success: false, error: err.message };
  }
});

// --- Stop Project Tree Watch ---
ipcMain.handle('unwatch-project-tree', async () => {
  stopProjectTreeWatcher();
  logInfo('project.watch.stopped', {});
  return { success: true };
});

// --- Read Directory ---
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result = [];
    for (const item of items) {
      // Skip hidden files and node_modules
      if (item.name.startsWith('.') && item.name !== '.gitignore') continue;
      if (item.name === 'node_modules' || item.name === '.git') continue;

      result.push({
        name: item.name,
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        isFile: item.isFile()
      });
    }
    // Sort: directories first, then files
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    logInfo('fs.read-directory.success', { dirPath, count: result.length });
    return result;
  } catch (err) {
    logError('fs.read-directory.failed', { dirPath, error: err });
    return [];
  }
});

// --- Read File ---
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    logInfo('fs.read-file.success', { filePath, size: Buffer.byteLength(content, 'utf-8') });
    return { success: true, content };
  } catch (err) {
    logError('fs.read-file.failed', { filePath, error: err });
    return { success: false, error: err.message };
  }
});

// --- Write File ---
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    logInfo('fs.write-file.success', { filePath, size: Buffer.byteLength(String(content ?? ''), 'utf-8') });
    return { success: true };
  } catch (err) {
    logError('fs.write-file.failed', { filePath, size: Buffer.byteLength(String(content ?? ''), 'utf-8'), error: err });
    return { success: false, error: err.message };
  }
});

// --- Create File ---
ipcMain.handle('create-file', async (event, filePath, content = '') => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    logInfo('fs.create-file.success', { filePath, size: Buffer.byteLength(String(content ?? ''), 'utf-8') });
    return { success: true };
  } catch (err) {
    logError('fs.create-file.failed', { filePath, error: err });
    return { success: false, error: err.message };
  }
});

// --- Delete File Without Confirmation (for undo operations) ---
ipcMain.handle('delete-file-silent', async (event, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      await fs.promises.rm(filePath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(filePath);
    }
    logInfo('fs.delete-file-silent.success', { filePath, isDirectory: stat.isDirectory() });
    return { success: true };
  } catch (err) {
    logError('fs.delete-file-silent.failed', { filePath, error: err });
    return { success: false, error: err.message };
  }
});

// --- Delete File with Confirmation ---
ipcMain.handle('delete-file', async (event, filePath) => {
  logInfo('fs.delete-file.prompt', { filePath });
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: mainT('delete_confirm_title'),
    message: mainT('delete_confirm_message', { filePath }),
    detail: mainT('delete_confirm_detail'),
    buttons: [mainT('delete_button'), mainT('cancel_button')],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });

  if (result.response === 0) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        await fs.promises.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(filePath);
      }
      logInfo('fs.delete-file.success', { filePath, isDirectory: stat.isDirectory() });
      return { success: true, confirmed: true };
    } catch (err) {
      logError('fs.delete-file.failed', { filePath, error: err });
      return { success: false, error: err.message };
    }
  }
  logInfo('fs.delete-file.cancelled', { filePath });
  return { success: false, confirmed: false };
});

// --- Rename File ---
ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    logInfo('fs.rename.success', { oldPath, newPath });
    return { success: true };
  } catch (err) {
    logError('fs.rename.failed', { oldPath, newPath, error: err });
    return { success: false, error: err.message };
  }
});

// --- Create Directory ---
ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    logInfo('fs.create-directory.success', { dirPath });
    return { success: true };
  } catch (err) {
    logError('fs.create-directory.failed', { dirPath, error: err });
    return { success: false, error: err.message };
  }
});

// --- File Exists? ---
ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// --- Get File Info ---
ipcMain.handle('get-file-info', async (event, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    return {
      size: stat.size,
      modified: stat.mtime,
      created: stat.birthtime,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile()
    };
  } catch (err) {
    return null;
  }
});

// --- Path Operations ---
ipcMain.handle('path-join', (event, ...parts) => path.join(...parts));
ipcMain.handle('path-basename', (event, filePath) => path.basename(filePath));
ipcMain.handle('path-dirname', (event, filePath) => path.dirname(filePath));
ipcMain.handle('path-relative', (event, from, to) => path.relative(from, to));
ipcMain.handle('path-resolve', (event, ...parts) => path.resolve(...parts));

// --- Security: Check if path is within project dir ---
ipcMain.handle('is-path-safe', (event, filePath, projectDir) => {
  const resolved = path.resolve(filePath);
  const resolvedProject = path.resolve(projectDir);
  return resolved.startsWith(resolvedProject);
});

// ============================================================
// OLLAMA API
// ============================================================
function resolveOllamaRequestConfig(provider, apiPath, postData) {
  const base = provider?.baseUrl || PROVIDER_PRESETS.ollama.baseUrl;
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    parsed = new URL(PROVIDER_PRESETS.ollama.baseUrl);
  }

  const transport = parsed.protocol === 'https:' ? https : http;
  return {
    transport,
    options: {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }
  };
}

ipcMain.handle('ollama-list-models', async (event, providerConfig) => {
  try {
    const provider = await getEffectiveProviderConfig(providerConfig);
    logInfo('ai.models.list.start', { provider: providerForLog(provider) });
    const manualModels = toModelObjects(parseManualModelCatalog(provider.modelCatalog));
    const models = await listModelsByProvider(provider);

    if (models.length > 0) {
      logInfo('ai.models.list.success', { provider: providerForLog(provider), source: 'provider-api', count: models.length });
      return { success: true, provider: provider.type, models };
    }
    if (manualModels.length > 0) {
      logWarn('ai.models.list.manual-fallback', { provider: providerForLog(provider), count: manualModels.length });
      return { success: true, provider: provider.type, models: manualModels };
    }
    logWarn('ai.models.list.empty', { provider: providerForLog(provider) });
    return { success: false, error: mainT('model_not_found') };
  } catch (err) {
    try {
      const provider = await getEffectiveProviderConfig(providerConfig);
      const manualModels = toModelObjects(parseManualModelCatalog(provider.modelCatalog));
      if (manualModels.length > 0) {
        logWarn('ai.models.list.manual-after-error', {
          provider: providerForLog(provider),
          count: manualModels.length,
          error: err
        });
        return {
          success: true,
          provider: provider.type,
          models: manualModels,
          warning: err.message
        };
      }
    } catch {}
    logError('ai.models.list.failed', { error: err });
    return { success: false, error: err.message };
  }
});

// --- Ollama Chat (Streaming) ---
ipcMain.handle('ollama-chat', async (event, params = {}) => {
  const { model, messages, stream = true, providerConfig } = params;
  let provider;
  try {
    provider = await getEffectiveProviderConfig(providerConfig);
  } catch (err) {
    logError('ai.chat.stream.provider-config.failed', { error: err });
    return { success: false, error: err.message };
  }
  const requestId = (params && params.requestId) ? String(params.requestId) : Date.now().toString();
  logInfo('ai.chat.stream.dispatch', {
    requestId,
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });

  if (provider.type !== 'ollama') {
    try {
      ensureProviderCredentials(provider);
      if (provider.kind === 'anthropic') {
        return streamAnthropicChat({ provider, requestId, model, messages });
      }
      return streamOpenAICompatibleChat({ provider, requestId, model, messages });
    } catch (err) {
      logError('ai.chat.stream.provider-dispatch.failed', {
        requestId,
        provider: providerForLog(provider),
        model,
        error: err
      });
      safeSendStreamChunk(requestId, { content: '', done: true, error: err.message });
      return { success: false, error: err.message };
    }
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ model, messages, stream });
    const { transport, options } = resolveOllamaRequestConfig(provider, '/api/chat', postData);

    const req = transport.request(options, (res) => {
      let fullResponse = '';
      let parseFailures = 0;

      res.on('data', (chunk) => {
        if (!activeOllamaRequests.has(requestId)) return;

        const text = chunk.toString();
        const lines = text.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              fullResponse += json.message.content;
              safeSendStreamChunk(requestId, {
                content: json.message.content,
                done: json.done || false
              });
            }
            if (json.done) {
              safeSendStreamChunk(requestId, {
                content: '',
                done: true,
                total_duration: json.total_duration,
                eval_count: json.eval_count
              });
            }
          } catch {
            parseFailures += 1;
          }
        }
      });

      res.on('end', () => {
        activeOllamaRequests.delete(requestId);
        logInfo('ai.chat.stream.success', {
          requestId,
          mode: 'ollama',
          provider: providerForLog(provider),
          model,
          responseChars: fullResponse.length,
          parseFailures
        });
        resolve({ success: true, requestId, response: fullResponse });
      });

      res.on('error', (err) => {
        activeOllamaRequests.delete(requestId);
        safeSendStreamChunk(requestId, { content: '', done: true, error: err.message });
        logError('ai.chat.stream.response-failed', {
          requestId,
          mode: 'ollama',
          provider: providerForLog(provider),
          model,
          responseChars: fullResponse.length,
          parseFailures,
          error: err
        });
        resolve({ success: false, error: err.message });
      });
    });

    req.on('error', (err) => {
      activeOllamaRequests.delete(requestId);
      safeSendStreamChunk(requestId, { content: '', done: true, error: err.message });
      logError('ai.chat.stream.failed', {
        requestId,
        mode: 'ollama',
        provider: providerForLog(provider),
        model,
        error: err
      });
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      try { req.destroy(new Error('Ollama request timeout')); } catch {}
    });

    activeOllamaRequests.set(requestId, req);
    req.setTimeout(300000);
    req.write(postData);
    req.end();
  });
});

// --- Ollama Abort (stop generation) ---
ipcMain.handle('ollama-abort', (event, requestId) => {
  const req = activeOllamaRequests.get(requestId);
  if (req) {
    if (typeof req.abort === 'function') req.abort();
    else if (typeof req.destroy === 'function') req.destroy();

    activeOllamaRequests.delete(requestId);
    safeSendStreamChunk(requestId, {
      content: '',
      done: true,
      aborted: true
    });
    logWarn('ai.chat.abort.success', { requestId });
    return { success: true };
  }
  logWarn('ai.chat.abort.missing-request', { requestId });
  return { success: false, error: mainT('request_not_found') };
});

  // --- Open DevTools / Inspect element from renderer ---
  ipcMain.on('open-devtools', () => {
    try {
      if (mainWindow && mainWindow.webContents) mainWindow.webContents.openDevTools({ mode: 'right' });
    } catch (e) {}
  });

  ipcMain.on('open-devtools-inspect', (event, x, y) => {
    try {
      if (!mainWindow || !mainWindow.webContents) return;
      // open devtools then inspect the element at the given coordinates
      mainWindow.webContents.openDevTools({ mode: 'right' });
      // small timeout to ensure devtools is ready
      setTimeout(() => {
        try {
          mainWindow.webContents.inspectElement(Math.floor(Number(x) || 0), Math.floor(Number(y) || 0));
        } catch (e) {}
      }, 120);
    } catch (e) {}
  });

// --- Ollama Generate (for autocomplete) ---
ipcMain.handle('ollama-generate', async (event, params = {}) => {
  const { model, prompt, providerConfig } = params;
  let provider;
  try {
    provider = await getEffectiveProviderConfig(providerConfig);
  } catch (err) {
    logError('ai.generate.provider-config.failed', { error: err });
    return { success: false, error: err.message };
  }
  logInfo('ai.generate.start', {
    provider: providerForLog(provider),
    model,
    promptLength: String(prompt || '').length,
    promptPreview: clipText(String(prompt || ''), 240)
  });

  if (provider.type !== 'ollama') {
    try {
      ensureProviderCredentials(provider);
      if (provider.kind === 'anthropic') {
        const result = await chatSyncAnthropic(provider, model, [{ role: 'user', content: String(prompt || '') }]);
        const response = String(result?.message?.content || '');
        logInfo('ai.generate.success', { provider: providerForLog(provider), model, responseChars: response.length });
        return { success: true, response };
      }
      const result = await chatSyncOpenAICompatible(provider, model, [{ role: 'user', content: String(prompt || '') }]);
      const response = String(result?.message?.content || '');
      logInfo('ai.generate.success', { provider: providerForLog(provider), model, responseChars: response.length });
      return { success: true, response };
    } catch (err) {
      logError('ai.generate.failed', { provider: providerForLog(provider), model, error: err });
      return { success: false, error: err.message };
    }
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 150,
        stop: ['\n\n', '```']
      }
    });
    const { transport, options } = resolveOllamaRequestConfig(provider, '/api/generate', postData);

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          logInfo('ai.generate.success', {
            provider: providerForLog(provider),
            model,
            responseChars: String(parsed.response || '').length
          });
          resolve({ success: true, response: parsed.response || '' });
        } catch {
          logError('ai.generate.parse-failed', {
            provider: providerForLog(provider),
            model,
            rawPreview: clipText(data, 400)
          });
          resolve({ success: false, error: mainT('response_not_readable') });
        }
      });
    });

    req.on('error', (err) => {
      logError('ai.generate.failed', { provider: providerForLog(provider), model, error: err });
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      try { req.destroy(new Error('Ollama generate timeout')); } catch {}
    });

    req.setTimeout(30000);
    req.write(postData);
    req.end();
  });
});

// --- Ollama Chat for non-streaming (Agent mode) ---
ipcMain.handle('ollama-chat-sync', async (event, params = {}) => {
  const { model, messages, providerConfig } = params;
  let provider;
  try {
    provider = await getEffectiveProviderConfig(providerConfig);
  } catch (err) {
    logError('ai.chat-sync.provider-config.failed', { error: err });
    return { success: false, error: err.message };
  }
  logInfo('ai.chat-sync.start', {
    provider: providerForLog(provider),
    model,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: summarizeMessagesForLog(messages)
  });

  if (provider.type !== 'ollama') {
    try {
      ensureProviderCredentials(provider);
      if (provider.kind === 'anthropic') {
        const result = await chatSyncAnthropic(provider, model, messages);
        logInfo('ai.chat-sync.success', { provider: providerForLog(provider), model, responseChars: String(result?.message?.content || '').length });
        return result;
      }
      const result = await chatSyncOpenAICompatible(provider, model, messages);
      logInfo('ai.chat-sync.success', { provider: providerForLog(provider), model, responseChars: String(result?.message?.content || '').length });
      return result;
    } catch (err) {
      logError('ai.chat-sync.failed', { provider: providerForLog(provider), model, error: err });
      return { success: false, error: err.message };
    }
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ model, messages, stream: false });
    const { transport, options } = resolveOllamaRequestConfig(provider, '/api/chat', postData);

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          logInfo('ai.chat-sync.success', {
            provider: providerForLog(provider),
            model,
            responseChars: String(parsed?.message?.content || '').length,
            totalDuration: parsed.total_duration,
            evalCount: parsed.eval_count
          });
          resolve({
            success: true,
            message: parsed.message || { content: '' },
            total_duration: parsed.total_duration,
            eval_count: parsed.eval_count
          });
        } catch {
          logError('ai.chat-sync.parse-failed', {
            provider: providerForLog(provider),
            model,
            rawPreview: clipText(data, 400)
          });
          resolve({ success: false, error: mainT('response_parse_failed') });
        }
      });
    });

    req.on('error', (err) => {
      logError('ai.chat-sync.failed', { provider: providerForLog(provider), model, error: err });
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      try { req.destroy(new Error('Ollama chat-sync timeout')); } catch {}
    });

    req.setTimeout(600000);
    req.write(postData);
    req.end();
  });
});
// ============================================================
// TERMINAL (PTY)
// ============================================================

let ptyModule = null;
let fallbackProcess = null;

function loadPty() {
  try {
    ptyModule = require('node-pty');
    logInfo('terminal.pty.load.success', {});
    return true;
  } catch (err) {
    logWarn('terminal.pty.load.failed', { error: err });
    console.error('node-pty could not be loaded:', err.message);
    return false;
  }
}

ipcMain.handle('terminal-create', async (event, cwd) => {
  const workDir = cwd || process.env.USERPROFILE || process.env.HOME || process.cwd();
  logInfo('terminal.create.start', { cwd: workDir });

  // Try node-pty first
  if (ptyModule || loadPty()) {
    try {
      if (ptyProcess) {
        try { ptyProcess.kill(); } catch {}
      }

      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      const shellArgs = process.platform === 'win32' ? ['-NoLogo'] : [];

      ptyProcess = ptyModule.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: workDir,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
      });

      ptyProcess.onData((data) => {
        mainWindow?.webContents.send('terminal-data', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send('terminal-exit', exitCode);
        logInfo('terminal.pty.exit', { exitCode });
        ptyProcess = null;
      });

      logInfo('terminal.create.success', { mode: 'pty', shell, cwd: workDir });
      return { success: true, type: 'pty' };
    } catch (err) {
      logWarn('terminal.create.pty-failed', { cwd: workDir, error: err });
      console.error('PTY spawn error:', err.message);
      // Fall through to child_process fallback
    }
  }

  // Fallback: child_process without PTY (limited but functional)
  try {
    const { spawn } = require('child_process');
    if (fallbackProcess) {
      try { fallbackProcess.kill(); } catch {}
    }

    const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');
    const shellArgs = process.platform === 'win32' ? ['/K'] : ['-i'];

    fallbackProcess = spawn(shell, shellArgs, {
      cwd: workDir,
      env: process.platform === 'win32'
        ? { ...process.env, PROMPT: '$P$G ' }
        : { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (fallbackProcess.stdin) fallbackProcess.stdin.setDefaultEncoding('utf8');
    fallbackProcess.stdout?.setEncoding?.('utf8');
    fallbackProcess.stderr?.setEncoding?.('utf8');

    fallbackProcess.stdout.on('data', (data) => {
      mainWindow?.webContents.send('terminal-data', String(data));
    });
    fallbackProcess.stderr.on('data', (data) => {
      mainWindow?.webContents.send('terminal-data', String(data));
    });
    fallbackProcess.on('exit', (code) => {
      mainWindow?.webContents.send('terminal-exit', code);
      logInfo('terminal.fallback.exit', { code });
      fallbackProcess = null;
    });

    logInfo('terminal.create.success', { mode: 'fallback', shell, cwd: workDir });
    return { success: true, type: 'fallback' };
  } catch (err) {
    logError('terminal.create.failed', { cwd: workDir, error: err });
    return { success: false, error: err.message };
  }
});

ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess) {
    if (String(data || '').includes('\r')) {
      logInfo('terminal.input.command', { mode: 'pty', length: String(data || '').length, preview: clipText(String(data || ''), 240) });
    }
    ptyProcess.write(data);
  } else if (fallbackProcess && fallbackProcess.stdin) {
    // Keep interactive behavior in fallback mode; only strip bracketed paste toggles.
    let cleaned = String(data || '')
      .replace(/\x1b\[\?2004h/g, '')
      .replace(/\x1b\[\?2004l/g, '')
      .replace(/\x1b\[200~/g, '')
      .replace(/\x1b\[201~/g, '');

    if (process.platform === 'win32') {
      cleaned = cleaned.replace(/\r(?!\n)/g, '\r\n');
    }

    if (cleaned.includes('\r') || cleaned.includes('\n')) {
      logInfo('terminal.input.command', { mode: 'fallback', length: cleaned.length, preview: clipText(cleaned, 240) });
    }
    fallbackProcess.stdin.write(cleaned);
  }
});

ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  if (ptyProcess) {
    try { ptyProcess.resize(cols, rows); } catch {}
  }
});

ipcMain.handle('terminal-kill', () => {
  if (ptyProcess) {
    try { ptyProcess.kill(); } catch {}
    ptyProcess = null;
  }
  if (fallbackProcess) {
    try { fallbackProcess.kill(); } catch {}
    fallbackProcess = null;
  }
  logInfo('terminal.kill', {});
});

// ============================================================
// APP LIFECYCLE
// ============================================================
process.on('uncaughtException', (err) => {
  logError('process.uncaught-exception', { error: err });
});

process.on('unhandledRejection', (reason) => {
  logError('process.unhandled-rejection', { reason });
});

app.whenReady().then(async () => {
  await refreshMainLanguageFromDisk();
  logInfo('app.ready', {
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    settingsFile: APP_SETTINGS_FILE,
    logsDir: APP_LOGS_DIR
  });
  createWindow();

  app.on('activate', async () => {
    logInfo('app.activate', { windows: BrowserWindow.getAllWindows().length });
    if (BrowserWindow.getAllWindows().length === 0) {
      await refreshMainLanguageFromDisk();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logInfo('app.window-all-closed', { platform: process.platform });
  stopProjectTreeWatcher();
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
  if (process.platform !== 'darwin') {
    logInfo('app.quit.requested', { reason: 'all-windows-closed' });
    app.quit();
  }
});
