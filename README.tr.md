<div align="center">

```
    _    ____   ____ ___ ___     _____ _____ ____  ____      _
   / \  / ___| / ___|_ _|_ _|   |_   _| ____|  _ \|  _ \    / \
  / _ \ \___ \| |    | | | |_____| | |  _| | |_) | |_) |  / _ \
 / ___ \ ___) | |___ | | | |_____| | | |___|  _ <|  _ <  / ___ \
/_/   \_\____/ \____|___|___|    |_| |_____|_| \_\_| \_\/_/   \_\
```

**Ekrandaki her şeyin ASCII karakterlerinden oluştuğu karanlık bir şövalye dünyası aksiyon RPG'si.**

Çimen, zırh, kale surları, deniz, ateş ve yağmur; hepsi gerçek zamanlı olarak, tarayıcında, karakterlerle çizilir.

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-destek%20ol-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/emreyigit-tasdelen)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-destek%20ol-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/emreyigit.tasdelen)

[English](README.md) · **Türkçe**

</div>

---

## Nedir?

ASCII-Terra, klasik zindan oyunlarının ruhunu taşıyan ama tamamen metinle çizilen bir açık dünya ARPG'si.
3B sahne Three.js ile ekran dışına çizilir; özel bir shader her pikseli malzemesine göre seçilmiş bir glife
çevirir: taş surlar yoğun harf dokusuna, çimen her sapın yönünü izleyen `/ | \` çizgilerine, deniz beyaz
`~ =` köpüklü siyaha, ateş turuncu `# % &` titreşimine dönüşür.

**Senje**'yi oynarsın: gümüş plaka zırhlı, kırmızı tabardlı bir şövalye. Kale harabesindeki ölüleri temizle,
kurtları avla, dev örümcek *Alacakaranlık Dulu*'nu yen ve Taş Çember'de yemini al.

> Durum: erken geliştirme (v0.2). Uzun vadeli hedef çevrim içi, çok oyunculu bir ASCII MMORPG.
> Ayrıntılar: [yol haritası](ROADMAP.md).

## Özellikler

- **%100 ASCII çizim** — malzemeye özel glif setleri, piksel hizalı glif atlası, karakter ve yaratıklar için ince ızgara
- Şövalye dünyası: köy, kuleli ve meşaleli kapılı kale harabesi, köpüklü kıyıda menhirler, ormanlar
- Gerçek zamanlı dövüş: kılıç, ateş topu, kasırga, yuvarlanma; düşmanlar saldırıyı yerde turuncu daireyle haber verir
- Düşmanlar: iskelet savaşçılar, kurtlar ve ağlarıyla boss örümcek
- 5 görevlik başlangıç zinciri, envanter ve ekipman (silah / zırh), düşen eşyalar, seviye atlama
- Gece / gündüz döngüsü, yağmur, tarayıcıda otomatik kayıt

## Çalıştırma

Oyun ES modülleri kullandığı için yerel bir web sunucusu gerekir (`index.html`'e çift tıklamak çalışmaz).

```bash
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
python -m http.server 8765
```

Sonra <http://localhost:8765/index.html> adresini aç. Windows'ta `baslat.bat`'a çift tıklaman yeterli.
Herhangi bir statik dosya sunucusu da olur (örneğin `npx serve`). WebGL2 destekli bir tarayıcı gerekir.

## Kontroller

| Tuş | Eylem |
|---|---|
| `W A S D` | yürü (`Shift` ile koş) |
| `Boşluk` | yuvarlan |
| Sol tık / `1` | imlece doğru kılıç |
| `2` / `3` | ateş topu / kasırga |
| `4` / `Q` | iksir iç |
| `E` | NPC ile konuş |
| `I` / `M` | envanter / harita |
| `R` | yağmuru aç / kapat |
| Sağ tık sürükle, ok tuşları, tekerlek | kamerayı döndür / eğ / yakınlaştır |
| `[` `]` | harf boyutu |

## ASCII çizici nasıl çalışır?

1. Sahne tam çözünürlükte ekran dışı bir hedefe çizilir.
2. Her malzeme alfa kanalına bir **malzeme kimliği** yazar (`src/core.js` → `MID`). Çimen ayrıca her sapın ekrandaki açısını taşır.
3. Tam ekran bir geçiş (`src/render.js`) ekranı glif hücrelerine böler, her hücreyi 3×3 örnekler ve o malzemenin glif setinden, sahne rengiyle boyanmış bir karakter seçer.
4. İnce nesneler (yağmur, ağ, çiçek) tek bir örneğe bile değse hücreyi alır; 1 piksellik çizgiler kaybolmaz.

Ayrıntılar: [docs/STIL-REHBERI.md](docs/STIL-REHBERI.md).

## Proje yapısı

```
index.html, style.css   giriş sayfası ve arayüz stilleri
src/core.js             matematik, gürültü, arazi yüksekliği, çarpışma, malzeme kimlikleri
src/render.js           renderer, ASCII son-işleme, gece/gündüz, yağmur
src/world.js            arazi, deniz, çimen, ağaçlar, köy, kale, kıyı, kristaller, örümcek yuvası
src/models.js           şövalye, NPC, iskelet, kurt ve örümcek modelleri + animasyon
src/actors.js           oyuncu, düşman yapay zekâsı, beceriler, mermiler, uyarı daireleri
src/game.js             durum, eşyalar, görevler, diyalog, kayıt, arayüz
src/main.js             girdi, kamera, ana döngü
legacy/                 ilk tek dosyalık prototip
```

## Destek

ASCII-Terra açık geliştiriliyor. Beğendiysen geliştirmeye destek olabilirsin:

- GitHub Sponsors: <https://github.com/sponsors/emreyigit-tasdelen>
- Buy Me a Coffee: <https://buymeacoffee.com/emreyigit.tasdelen>

## Katkı

Issue ve pull request'ler açıktır. Tek temel kural: ekranda görünen her şey ASCII olmalı.
