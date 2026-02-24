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

> **CaYa Editor**, hız ve pratikliği korurken; AI sohbeti, agent modu ve çoklu sağlayıcı desteğiyle geliştirme sürecini tek bir merkezde toplar.
