## CaYa Editor — Basic AI Code Editor

- **CaYa Editor**, **AI destekli modern bir kod editörüdür**.  
- Hedefi; klasik editör hızını korurken, yerel veya bulut tabanlı yapay zekâ sağlayıcılarıyla **sohbet**, **agent** ve **otomatik tamamlama** gibi gelişmiş özellikleri tek yerde sunmaktır.

---

### ✨ Öne Çıkan Özellikler

#### 🧠 AI Sohbet (Chat)
- Kod hakkında soru sor, açıklama al
- Hata ayıklama ve çözüm önerileri iste
- Refactor, optimize ve temiz kod önerileri al
- Parça parça kod analizi + hızlı geri bildirim

#### 🤖 AI Agent Modu (Proje üzerinde aksiyon alır)
Agent, proje klasöründeki dosyalarla **kontrollü biçimde işlem yapabilir**:
- Dosya **oluşturma / düzenleme / silme**
- Proje yapısını analiz ederek otomatik düzenleme önerileri
- Komut tabanlı güvenli format ile çalışır (CREATE_FILE, EDIT_FILE vb.)
- **Güvenilir dizin (Trusted Project)** mantığıyla yetkilendirme

#### ⚡ Otomatik Tamamlama (Autocomplete)
- Seçtiğin modele göre kod tamamlama önerileri
- Daha hızlı yazım, daha az tekrar, daha akıcı geliştirme

#### 🗂️ Proje & Dosya Yönetimi
- Dosya gezgini + proje ağacı
- Hızlı dosya açma/kaydetme iş akışı
- Proje yapısı gönderme seçeneğiyle daha iyi bağlam (agent için)

#### 🧰 Entegre Terminal
- Uygulama içinden terminal kullanımı
- Proje klasöründe komut çalıştırma (build, run, test vb.)

#### 🌍 Çoklu AI Sağlayıcı Desteği
CaYa Editor; farklı ihtiyaçlara göre **yerel** ve **bulut** seçeneklerini destekler:
- **Ollama (Yerel)** — gizlilik + kontrol + offline kullanım
- **OpenAI**
- **Claude (Anthropic)**
- **Grok (xAI)**
- **OpenRouter** (tek anahtarla birçok model)
- **GitHub Models**
- **Custom (OpenAI-Compatible)** (OpenAI API uyumlu herhangi bir sunucu)

#### 🗣️ Çoklu Dil (TR/EN)
- Sistem dilini algılar
- Türkçe / İngilizce arayüz desteği

---

### 🔒 Gizlilik & Güvenlik Yaklaşımı
- Yerel model (Ollama) kullanımıyla veriler **kendi cihazında** kalabilir
- Agent dosya işlemleri “güvenilir dizin” yaklaşımıyla kontrol edilir
- Ayarlar ve loglar yerelde saklanır

---

### ✅ Kimler için?
- “Kod yazarken AI desteği istiyorum” diyen geliştiriciler
- Proje dosyalarını **agent ile otomatik düzenlemek** isteyenler
- Yerel LLM (Ollama) ile **daha kontrollü** bir editör arayanlar
- Tek editör içinde **chat + agent + autocomplete + terminal** isteyenler

---

## CaYa Editor için Ollama Kurulumu + Önerilen Modeller

- **Amaç:** CaYa Editor’ü **Ollama (Yerel)** ile kullanmak ve önerilen modelleri kurmak.
- **Not:** Modeller indirildikten sonra **run komutu çalıştırmanız gerekmez**. CaYa Editor seçtiğiniz modeli otomatik kullanır.

---

### 1) Ollama Kurulumu (Windows)

- Tarayıcıdan **ollama.com** adresine girin.
- Windows için Ollama kurulum dosyasını indirin.
- Kurulumu normal şekilde tamamlayın.
- (İsteğe bağlı kontrol) PowerShell veya CMD açıp şu komutla sürümü kontrol edin:
  - `ollama --version`

---

### 2) CaYa Editor Ayarları (Ollama’yı Bağla)

- CaYa Editor’ü açın.
- **Ayarlar (Settings)** bölümüne girin.
- **AI Provider / Sağlayıcı** olarak **Ollama (Yerel)** seçin.
- **API Base URL** alanına şunu yazın:
  - `http://localhost:11434`
- **Modeleri Yenile / Refresh Models** butonuna basın.
- (Uzak sunucu kullanıyorsanız) localhost yerine sunucu IP/domain yazın:
  - Örnek: `http://192.168.1.50:11434`

---

### 3) Önerilen Modelleri İndir (Model Kurulumu = Pull)

- PowerShell veya CMD açın.
- **Chat / Agent (Kod yazma için test edildi ve önerilir):**
  - Model: glm-4.7-flash:latest
  - İndirme Komut:
    - `ollama pull glm-4.7-flash:latest`
- **Otomatik Tamamlama (Hızlı ve hafif):**
  - Model: llama3.2:1b
  - İndirme Komut:
    - `ollama pull llama3.2:1b`
- (İsteğe bağlı) Kurulu modelleri görmek için:
  - `ollama list`

---

### 4) CaYa Editor’de Model Seç (Önerilen Kombinasyon)

- CaYa Editor → **Ayarlar** bölümünde şu seçimleri yapın:
  - **Agent Modeli:** `glm-4.7-flash:latest`
  - **Chat (Sohbet) Modeli:** `glm-4.7-flash:latest`
  - **Autocomplete (Kod Tamamlama) Modeli:** `llama3.2:1b`
- Son olarak **Modeleri Yenile / Refresh Models** butonuna tekrar basın.

---

### 5) Hızlı Sorun Giderme (Model listesi görünmüyorsa)

- Ollama kurulu mu kontrol edin:
  - `ollama --version`
- Modeller inmiş mi kontrol edin:
  - `ollama list`
- CaYa Editor’de şunlar doğru mu kontrol edin:
  - Sağlayıcı: **Ollama (Yerel)**
  - Base URL: `http://localhost:11434`
  - Ardından **Modeleri Yenile / Refresh Models**’e basın.

---

> **CaYa Editor**, hız ve pratikliği korurken; AI sohbeti, agent modu ve çoklu sağlayıcı desteğiyle geliştirme sürecini tek bir merkezde toplar.
