# CaYa Editor — Basic AI Code Editor

**CaYa Editor**, yapay zeka destekli modern bir kod editörüdür. Hedefi; klasik editör hızını korurken, yerel veya bulut tabanlı yapay zekâ sağlayıcılarıyla **sohbet**, **agent** ve **otomatik tamamlama** gibi gelişmiş özellikleri tek yerde sunmaktır.

Ollama destekli (yerel LLM) veya bulut tabanlı AI sağlayıcılarıyla çalışan, geliştiriciler için tasarlanmış bir editördür.

---

## ✨ Öne Çıkan Özellikler

### 🧠 AI Sohbet (Chat)
- Kod hakkında soru sor, açıklama al
- Hata ayıklama ve çözüm önerileri iste
- Refactor, optimize ve temiz kod önerileri al
- Parça parça kod analizi + hızlı geri bildirim

### 🤖 AI Agent Modu (Proje üzerinde aksiyon alır)
Agent, proje klasöründeki dosyalarla **kontrollü biçimde işlem yapabilir**:
- Dosya **oluşturma / düzenleme / silme**
- Proje yapısını analiz ederek otomatik düzenleme önerileri
- Komut tabanlı güvenli format ile çalışır (CREATE_FILE, EDIT_FILE vb.)
- **Güvenilir dizin (Trusted Project)** mantığıyla yetkilendirme

### ⚡ Otomatik Tamamlama (Autocomplete)
- Seçtiğin modele göre kod tamamlama önerileri
- Daha hızlı yazım, daha az tekrar, daha akıcı geliştirme

### 🧠 Thinking Model Desteği
- DeepSeek-R1, QwQ gibi "thinking" modelleri desteklenir
- Karmaşık problem çözmede daha iyi sonuçlar

### 🗂️ Proje & Dosya Yönetimi
- Dosya gezgini + proje ağacı
- Hızlı dosya açma/kaydetme iş akışı
- Proje yapısı gönderme seçeneğiyle daha iyi bağlam (agent için)

### 🧰 Entegre Terminal
- Uygulama içinden terminal kullanımı
- Proje klasöründe komut çalıştırma (build, run, test vb.)

### 🌍 Çoklu AI Sağlayıcı Desteği
CaYa Editor; farklı ihtiyaçlara göre **yerel** ve **bulut** seçeneklerini destekler:
- **Ollama (Yerel)** — gizlilik + kontrol + offline kullanım
- **OpenAI** — GPT modellerine erişim
- **Claude (Anthropic)** — yapay zeka sohbeti
- **Grok (xAI)** — alternatif model
- **OpenRouter** — tek anahtarla birçok model
- **GitHub Models** — GitHub entegrasyonu
- **Custom (OpenAI-Compatible)** — OpenAI API uyumlu herhangi bir sunucu

### 🗣️ Çoklu Dil (TR/EN)
- Sistem dilini otomatik algılar
- Türkçe / İngilizce tam arayüz desteği

### 🎨 Editör Özellikleri
- **Monaco Editor**: VS Code editör motoru ile güçlü sözdizimi vurgulama
- **CaYaDev Teması**: Koyu tema, kırmızı vurgular
- **Güvenli Dizin Yönetimi**: AI yalnızca güvenilen dizinlerde çalışır

---

## 🔒 Gizlilik & Güvenlik Yaklaşımı

- Yerel model (Ollama) kullanımıyla veriler **kendi cihazında** kalabilir
- Agent dosya işlemleri "güvenilir dizin" yaklaşımıyla kontrol edilir
- Ayarlar ve loglar yerelde saklanır
- Hiçbir verisi varsayılan olarak dışarıya çıkmaz

---

## ✅ Kimler için

- "Kod yazarken AI desteği istiyorum" diyen geliştiriciler
- Proje dosyalarını **agent ile otomatik düzenlemek** isteyenler
- Yerel LLM (Ollama) ile **daha kontrollü** bir editör arayanlar
- Tek editör içinde **chat + agent + autocomplete + terminal** isteyenler
- Daha hızlı kod yazması ve daha iyi refactoring önerileri arayanlar

---

## 📋 Gereksinimler

### Kullanıcı için:
- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) (yerel LLM kullanmak istiyorsanız)
- **VEYA** OpenAI, Claude, Grok, OpenRouter vb. bir API anahtarı (bulut sağlayıcı seçecekseniz)

### Geliştirici için:
- Node.js 18+
- npm veya yarn
- Electron 28+
- Python 3.x (icon yapımı için)

---

## 🚀 Kurulum (Kullanıcı)

### 1) Ollama Kurulumu (Windows) — *Opsiyonel*

- Tarayıcıdan **ollama.com** adresine girin
- Windows için Ollama kurulum dosyasını indirin
- Kurulumu normal şekilde tamamlayın
- (İsteğe bağlı kontrol) PowerShell açıp sürümü kontrol edin:
  ```powershell
  ollama --version
  ```

### 2) CaYa Editor Kurulumu

```bash
# Bağımlılıkları kur
npm install

# Native modülleri yeniden derle
npx electron-rebuild

# Uygulamayı başlat
npm start
```

### 3) CaYa Editor Ayarları (AI Sağlayıcısını Bağla)

#### Ollama (Yerel) İçin:
- CaYa Editor'ü açın
- **Ayarlar (Settings)** bölümüne girin
- **AI Provider / Sağlayıcı** olarak **Ollama (Yerel)** seçin
- **API Base URL** alanına şunu yazın: `http://localhost:11434`
- **Modeleri Yenile / Refresh Models** butonuna basın

#### Bulut Sağlayıcıları İçin (OpenAI, Claude, vb.):
- İlgili sağlayıcıdan API anahtarını alın
- CaYa Editor **Ayarlar** → **AI Provider** seçerek ilgili servisi seçin
- API anahtarınızı girin
- Modeleri listele / Refresh edin

### 4) Önerilen Modelleri İndir (Ollama İçin)

```bash
# Chat / Agent (Kod yazma için test edildi ve önerilir)
ollama pull glm-4.7-flash:latest

# Otomatik Tamamlama (Hızlı ve hafif)
ollama pull llama3.2:1b

# (İsteğe bağlı) Kurulu modelleri görmek için
ollama list
```

### 5) CaYa Editor'de Modelleri Seç

CaYa Editor → **Ayarlar** bölümünde şu seçimleri yapın:
- **Agent Modeli**: `glm-4.7-flash:latest`
- **Chat (Sohbet) Modeli**: `glm-4.7-flash:latest`
- **Autocomplete (Kod Tamamlama) Modeli**: `llama3.2:1b`

Son olarak **Modeleri Yenile / Refresh Models** butonuna basın.

### 6) Hızlı Sorun Giderme

Modelleri göremiyorsanız:
```bash
# Ollama kurulu mu kontrol et
ollama --version

# Modeller inmiş mi kontrol et
ollama list

# CaYa Editor'de kontrol et:
# - Sağlayıcı: Ollama (Yerel)
# - Base URL: http://localhost:11434
# - Ardından Refresh Models'e tıkla
```

---

## ⌨️ Kısayollar

| Kısayol | İşlem |
|---------|-------|
| `Ctrl+O` | Klasör Aç |
| `Ctrl+S` | Dosya Kaydet |
| `Ctrl+W` | Sekmeyi Kapat |
| `Ctrl+\`` | Terminal Aç/Kapat |
| `Ctrl+B` | Kenar Çubuğu Aç/Kapat |
| `Ctrl+Shift+P` | Komut Paleti (Command Palette) |
| `Ctrl+/` | Yorum Ekle/Kaldır |
| `Alt+Up/Down` | Satırı Yukarı/Aşağı Taşı |

---

## 👨‍💻 Geliştirici Kılavuzu

### Proje Yapısı

```
CaYa-Editor/
├── main.js                 # Electron main process
├── preload.js              # Preload script (IPC güvenliği için)
├── package.json            # Dependencies ve scripts
├── renderer/               # Frontend (Electron renderer process)
│   ├── index.html          # Ana HTML dosyası
│   ├── app.js              # Ana uygulama mantığı
│   ├── prompts.js          # Prompt yönetimi
│   ├── icons.js            # İcon yönetimi
│   └── styles.css          # Stil dosyası
├── scripts/                # Yardımcı scriptler
│   └── make-icon.js        # Icon oluşturucu
├── assets/                 # Proje kaynakları (ikonlar, temalar vb.)
└── dist/                   # Build çıktısı (derleme sonrası oluşur)
```

### Geliştirme Ortamı Kurulumu

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Native modülleri derle
npx electron-rebuild

# 3. Dev modu ile başlat (dev console açılı)
npm run dev

# VEYA normal mod
npm start
```

### İkonu Yeniden Oluşturma

CaYa Editor kütüphanesi PNG dosyaları kullanarak Windows .ico dosyaları oluşturur:

```bash
npm run make-icon
```

Bu komut `assets/CYEditorLogo.ico` dosyasını günceller.

### Build & Distribution

#### Portable EXE Olarak Paketleme:

```bash
# Test paketi (build işlemini doğrula)
npm run pack

# Dağıtım için final exe oluştur
npm run dist
```

Çıktı dosyası: `dist/CaYaEditor [version].exe`

#### Build Yapılandırması:
- `electron-builder` kullanılır
- Taşınabilir (portable) EXE olarak dağıtılır
- Icon, uygulama adı, app ID vb. `package.json`'da tanımlıdır

### IPC & Process Yönetimi

Electron'un security best practices'i izlenir:

**main.js:**
- Window oluşturma ve yönetimi
- IPC handler'ları
- App lifecycle olayları

**preload.js:**
- Renderer process'e IPC sınırlı api sunma
- XSS attack'larından koruma

**renderer/app.js:**
- UI mantığı
- IPC ile ana processe iletişim
- State management

### Debugging

#### VS Code'da:

1. VS Code debug configuration oluştur (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron Main",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/main.js",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["."],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

2. **npm run dev** ile başlat (DevTools açılı olur)
3. DevTools'da Console/Network/Elements sekmelerinden debug et

#### Sık Hatalar:

- **"Cannot find module 'node-pty'"**: `npm install` ve `npx electron-rebuild` çalıştır
- **"Cannot find Ollama"**: Ollama'nın `localhost:11434`'te çalıştığından emin ol
- **Icon güncellenmedi**: `npm run make-icon` çalıştır ve rebuild et

### Mimari Genel Bakış

**Electron Architecture:**
```
┌─────────────────────────────────────────┐
│        Browser Process (Main)           │
│  • Window management                    │
│  • IPC handlers                         │
│  • Ollama/API communication             │
└─────────────────────────────────────────┘
            ↕ IPC (Preload)
┌─────────────────────────────────────────┐
│      Renderer Process (Frontend)         │
│  • Monaco Editor                        │
│  • File Explorer                        │
│  • Terminal UI                          │
│  • Settings Panel                       │
└─────────────────────────────────────────┘
```

**AI Integration Flow:**
1. Kullanıcı chat/agent komutunu girer (renderer)
2. Renderer, preload aracılığıyla main'e IPC gönderir
3. Main, Ollama/OpenAI/Custom API'ye bağlanır
4. Sonuç renderer'a geri gönderilir
5. UI güncellenir

### Dependencies Açıklaması

| Paket | Versiyon | Kullanım |
|-------|----------|----------|
| `electron` | ^28.1.0 | Desktop uygulama framework'ü |
| `electron-store` | ^8.1.0 | Yerel ayarlar/cache depolama |
| `node-pty` | ^1.0.0 | Terminal emülasyonu |
| `xterm` | ^5.3.0 | Terminal UI (CSS-based) |
| `xterm-addon-fit` | ^0.8.0 | Terminal auto-fit |
| `xterm-addon-web-links` | ^0.9.0 | Terminal içinde hyperlink desteği |
| `electron-rebuild` | ^3.2.9 | Native modüller recompile |
| `sharp` | ^0.32.0 | Image processing (icon yapımı) |
| `png-to-ico` | ^1.0.0 | PNG→ICO dönüşümü |
| `electron-builder` | ^24.6.0 | EXE/MSI paketle |

### Contributing

Katkı vermek istersen:

1. Repository'yi fork et
2. Feature branch oluştur: `git checkout -b feature/amazing-feature`
3. Değişiklikleri commit et: `git commit -m 'Add amazing feature'`
4. Branch'i push et: `git push origin feature/amazing-feature`
5. Pull Request oluştur

### Roadmap

- [ ] Plugin/Extension desteği
- [ ] Multi-workspace desteği
- [ ] Git integration
- [ ] Collaboration features
- [ ] Mobile companion app
- [ ] Theme customization UI
- [ ] Keyboard binding customization
- [ ] Built-in LLM (ONNX models)

### Troubleshooting Checklist

- [ ] Node.js 18+ yüklü mü? → `node -v`
- [ ] npm dependencies kurulu mu? → `npm install`
- [ ] Electron rebuild yapıldı mı? → `npx electron-rebuild`
- [ ] Ollama çalışıyor mu? → `ollama list`
- [ ] API anahtarları doğru mu? (bulut sağlayıcılar için)
- [ ] Firewall/antivirus blok edip etmediği kontrol edildi mi?

---

## 📄 Lisans

MIT - CaYaDev

Proje CaYaDev tarafından geliştirilmektedir. Katkıda bulunmak ve sorun bildirmek için GitHub issues/pull requests kullan.
