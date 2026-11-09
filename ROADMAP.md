# ASCII-Terra — Yol Haritası

Hedef: karanlık, atmosferik bir ASCII MMORPG görünüşünde, karakterlerden örülü bir **şövalye dünyası**;
önce tek oyunculu sağlam bir ARPG, sonra çok oyunculu (MMO). Görsel kurallar: [docs/STIL-REHBERI.md](docs/STIL-REHBERI.md).

Durum işaretleri: `[x]` bitti · `[~]` kısmen · `[ ]` yapılacak

---

## Faz 0 — Temel (v0.2, şu an)
- [x] Modüler kod: `src/core.js`, `render.js`, `world.js`, `models.js`, `actors.js`, `game.js`, `main.js`
- [x] ASCII render v2: malzeme kimliği (alfa kanalı) → malzemeye özel glif seti; ekrandaki her şey glif (çimen yön glifleri, karakterler ince ızgara)
- [x] Piksel-hizalı glif atlası (hücre boyutunda üretilir, keskin)
- [x] Yukarıdan sabit kamera, imleçle nişan, sağ tık sürükleyerek döndürme
- [x] Şövalye Senje (zırh, tabard, kılıç, kalkan), yürüme/saldırı animasyonu, yuvarlanma (dodge roll)
- [x] Köy, kale harabesi (surlar, kuleler, kemerli kapı, meşaleler), kıyı menhirleri, köpüklü deniz
- [x] Düşmanlar: iskelet savaşçı, kurt, boss Alacakaranlık Dulu (turuncu AoE uyarı daireleri)
- [x] Beceriler: kılıç, ateş topu, kasırga, iksir; hotbar + bekleme süreleri
- [x] 5 görevlik başlangıç zinciri, envanter/ekipman, kayıt (localStorage)
- [x] Public GitHub deposu, README (EN + TR), sponsor bağlantıları
- [ ] Vite ile geliştirme sunucusu ve build (CDN bağımlılığını kaldırmak için three.js yerel paket)

## Faz 1 — Görsel sadakat (videolara bire bir)
- [ ] Gerçek gölge haritası (karakter, sur, ağaç gölgeleri); çimen shader'ına gölge örneklemesi
- [ ] Kıyıda sis/pus partikülleri, deniz üzerinde köpük kıvrımları, dalga animasyonu
- [ ] Ateş/büyü partikülleri (turuncu `#%&` kıvılcımlar), ateş topu izi, isabet parlaması (bloom benzeri)
- [ ] Yıldırım/buz/mor büyü efektleri (video: New skills)
- [ ] Malzemeye özel ızgara: zincir zırh `o8o8` deseni, ejderha pulları, örümcek tüyü (custom grid + symbol)
- [ ] Dinamik hava: yağmur sıçraması, ıslak zemin parlaması, sis, kar; hava döngüsü
- [ ] Gece/gündüz ince ayarı, meşale ışık yarıçapları, ay ışığı
- [ ] Ağaç ve kaya modellerini zenginleştirme, rüzgârda sallanan yapraklar
- [ ] Kalite ayarları menüsü (hücre boyutu, çimen yoğunluğu, çözünürlük ölçeği)

## Faz 2 — Oynanış çekirdeği
- [ ] Dövüş hissi: hitstop, kamera sarsıntısı, kombo, kalkanla blok, yönlü vuruş
- [ ] Beceri sistemi + destek taşları (support gems) ile build oluşturma (video: skills & support gems)
- [ ] Mana / dayanıklılık, beceri ağacı, sınıf yok — eşyaya bağlı build
- [ ] Ekipman slotları: Silah, Miğfer, Omuzluk, Göğüs, Eldiven, Bacak, Çizme (video: craft ekranı)
- [ ] Zanaat (craft): metal seçimi (Demir, Çelik, Bronz, Gümüş, Altın, Ay Çeliği, Gece Camı, Kan Demiri, Kemiktaş, Kor Taşı) + rün yuvaları + büyüler
- [ ] Craft ekranında 3B ASCII eşya önizlemesi (döndürülebilir)
- [ ] Loot tabloları, nadirlik renkleri, yerde eşya etiketleri ("Rusty Stiletto" gibi)
- [ ] Fare ile envanter ızgarası, sürükle-bırak
- [ ] Düşman yapay zekâsı: gruplar, okçular, büyücüler, kaçma/çevreleme; boss fazları
- [ ] Karakter yaratma ekranı (görünüm, isim)

## Faz 3 — Dünya
- [ ] Harita taslağından prosedürel üretim (video: map sketch pipeline): biyomlar, nehirler, yollar
- [ ] Başlangıç öğretici alanı + ilk köy (video: tutorial area)
- [ ] Yeni bölgeler: bataklık, karlı dağ, çöl harabeleri, zindanlar (iç mekan)
- [ ] NPC rutinleri (gündüz/gece), tüccar, demirci, han
- [ ] Ses ve müzik: adım, kılıç, ateş, yağmur, ortam (video: Added sound)
- [ ] Büyük dünya için akış (chunk yükleme), uzak mesafe LOD

## Faz 4 — İçerik
- [ ] Ana hikâye ve görev zinciri, diyalog ağacı sistemi
- [ ] Bestiyer: iskelet okçu, ölü şövalye, ejderha, dev örümcek türleri, at/binek
- [ ] Bosslar: Alacakaranlık Dulu (fazlı), Ejderha, Kale Lordu
- [ ] Başarımlar, unvanlar

## Faz 5 — Çok oyunculu (MMO)
- [ ] Node.js + WebSocket yetkili sunucu, sabit tick simülasyonu
- [ ] Oyuncu senkronu, tahmin + uzlaştırma, ilgi alanı (AOI) filtresi
- [ ] PVP düello daveti ("X seni düelloya davet ediyor", video), parti, sohbet
- [ ] Hesap sistemi, sunucu tarafı kayıt (veritabanı), hile koruması
- [ ] Ölçekleme: bölge sunucuları

## Faz 6 — Yayın
- [ ] Masaüstü paketi (Tauri/Electron), Steam sayfası
- [ ] Ayarlar menüsü, tuş atama, gamepad
- [ ] Lokalizasyon (TR / EN)
- [ ] Performans profili, düşük donanım modu

---

## Sıradaki sprint (önerilen)
1. Vite ile geliştirme sunucusu ve build
2. Gölge haritası + kıyı sisi + ateş partikülleri (Faz 1'in en görünür 3 maddesi)
3. Ekipman slotları ve craft ekranının ilk sürümü
