<div align="center">

```
    _    ____   ____ ___ ___     _____ _____ ____  ____      _
   / \  / ___| / ___|_ _|_ _|   |_   _| ____|  _ \|  _ \    / \
  / _ \ \___ \| |    | | | |_____| | |  _| | |_) | |_) |  / _ \
 / ___ \ ___) | |___ | | | |_____| | | |___|  _ <|  _ <  / ___ \
/_/   \_\____/ \____|___|___|    |_| |_____|_| \_\_| \_\/_/   \_\
```

### Ekrandaki her şeyin ASCII karakterlerden oluştuğu, karanlık bir şövalye dünyası aksiyon RPG'si.

Çimen, zırh, kale duvarları, deniz, ateş ve yağmur; hepsi tarayıcında, gerçek zamanlı, harflerle çiziliyor.<br>
Tek başına, LAN'da arkadaşlarınla ya da tabletten oyna.

[![Sürüm](https://img.shields.io/github/v/release/emreyigit-tasdelen/ascii-terra?color=c9a227)](https://github.com/emreyigit-tasdelen/ascii-terra/releases)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue)](LICENSE)
![Sıfır bağımlılık](https://img.shields.io/badge/sunucu-s%C4%B1f%C4%B1r%20ba%C4%9F%C4%B1ml%C4%B1l%C4%B1k-brightgreen)
![WebGL2](https://img.shields.io/badge/gerekli-WebGL2-lightgrey)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-destek-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/emreyigit-tasdelen)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-destek-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/emreyigit.tasdelen)

[English](README.md) · **Türkçe**

<img src="docs/screenshot.jpg" alt="ASCII-Terra oynanış" width="800">

</div>

---

## Hızlı başlangıç

**Windows:** [son sürümü](https://github.com/emreyigit-tasdelen/ascii-terra/releases/latest) indir, ZIP'i aç ve **`start.bat`**'a çift tıkla. Oyun tarayıcıda açılır.

**[Node.js](https://nodejs.org) 22.5+ olan her sistem:**

```bash
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
node server/server.js
```

Sonra <http://localhost:8765> adresini aç. `npm install` yok, derlenecek bir şey yok.

> **Güncelleme:** `start.bat` her açılışta GitHub'da yeni sürüm olup olmadığına bakar ve varsa kendisi kurar.
> Hesapların ve kayıtların (`server/data/`) hiçbir zaman değiştirilmez.

## Bu nedir?

ASCII-Terra, klasik zindan oyunları ruhunda, tamamen metinle çizilen açık dünya bir ARPG'dir.
3D sahne Three.js ile ekran dışında çizilir; özel bir shader her pikseli malzemeye göre seçilen bir
karaktere çevirir: taş duvarlar yoğun harf dokusu olur, çimen her yaprağı izleyen `/ | \` çizgileri olur,
su siyah zemin üstünde beyaz `~ =` köpüğüdür, ateş turuncu `# % &` olarak titrer.

Gümüş zırhlı, kırmızı tabard'lı şövalye **Torvan**'ı oynarsın. Kale harabesindeki ölümsüzleri temizle,
kurtları avla, dev örümcek *Gloomweaver*'ı yen ve Taş Çember'de yemin et.

> **Durum:** erken geliştirme. Uzun vadeli hedef çevrimiçi, çok oyunculu bir ASCII MMORPG. [Yol haritası](ROADMAP.md).

## Öne çıkanlar

| | |
|---|---|
| **%100 ASCII** | Malzemeye göre karakter setleri, piksele hizalı karakter atlası, karakter ve yaratıklar için daha ince ızgara. Gerçek zamanlı gölge, parlak zırh, parçacıklar, gece/gündüz, yağmur ve sis. |
| **Savaş** | Kılıç kombosu, stamina ile kalkan ve **savuşturma (parry)**, ateş topu, kasırga, boşluk küresi, ay mızrağı, yuvarlanma, zıplama, at. Boss'lar saldırıyı yerde turuncu daireyle önceden gösterir, canı yarının altına inince öfkelenir. |
| **Dünya** | Köy, meşaleli kapılı kale harabesi, menhirli köpüklü kıyı, ormanlar ve sisli **Misty Swamp**. Dünya haritası, 9 görevlik zincir, yere düşen ganimet ve rünlü demircilik (kılıç ve zırh). |
| **Yaratıklar** | İskeletler, kara şövalyeler, yaralanınca kaçan kurtlar, ghoul'ler, bataklık cadıları ve trol, örümcek *Gloomweaver* ve kanatlı *Ash Dragon*; hepsi tam animasyonlu prosedürel modeller. |
| **Çok oyunculu** | 32 oyuncuya kadar, otomatik host devriyle host-yetkili co-op, sohbet, ortak XP ve görevli **partiler**, **PvP düellolar**, sunucuda kayıtlı hesaplar. |
| **Dokunmatik** | iPad ve Android tabletlerde sanal joystick, kaydırarak bakma ve nişan, iki parmakla yakınlaştırma ve aksiyon düğmeleri. Masaüstü kontrolleri aynı kalır. |

## Arkadaşlarla oyna (LAN partisi)

`start.bat`'i bir bilgisayarda çalıştır. Sunucu diğerleri için adresi yazar:

```
For friends on your local network → http://192.168.x.x:8765
```

Aynı ağdaki herkes bu adresi bilgisayarda ya da tablette tarayıcıda açar.
Windows sorarsa Node.js'e **özel ağlarda** izin ver. İnternet üzerinden oynamak için sunucuyu HTTPS arkasında bir VPS'te çalıştır; istemci otomatik olarak `wss://` kullanır.

## Tabletler (iPad ve Android)

LAN adresini Safari ya da Chrome'da aç ve tableti yatay tut.

- **Sol taraf:** sürükleyerek yürü, kenara kadar itince koş
- **Sağ taraf:** kaydırarak kamerayı çevir ve nişan al, iki parmakla yakınlaştır
- **Düğmeler:** saldırı, kalkan, zıplama, yuvarlanma, yetenekler, iksir, kullan, at, envanter, harita, demircilik, sohbet
- iPad'de sayfayı ana ekrana ekleyip tam ekran oynayabilirsin

## Kontroller (klavye ve fare)

| Tuş | İşlev |
|---|---|
| `W A S D` / `Shift` | yürü / koş |
| `Space` / `C` | zıpla / yuvarlan |
| Sol tık ya da `1` | imlece doğru kılıç saldırısı (3'lü kombo) |
| `Alt` (basılı) | kalkan; darbe anında doğru zamanda bloklarsan **savuşturursun** |
| `2` `3` `5` `6` | ateş topu, kasırga, boşluk küresi, ay mızrağı |
| `4` / `Q` | iksir |
| `E` / `F` | konuş / at |
| `I` `K` `M` `N` | envanter, demircilik, dünya haritası, mini harita |
| `Enter` | sohbet |
| `G` / `J` | düello / parti daveti (`Y` kabul, `N` ret) |
| `Esc` / `P` | duraklatma menüsü (tuşlar buradan değiştirilebilir) |
| Sağ sürükle, oklar, tekerlek | kamera |

Tam liste: oyunda `H` tuşuna bas. Yeni oyun, karakter oluşturma ve kısa bir eğitimle başlar.

## Çok oyunculu ayrıntılar

- **Host-yetkili co-op:** görünür ilk oyuncu düşmanları ve boss'ları simüle eder; diğerleri küçük anlık görüntüler (10 Hz) alır ve vuruşlarını host'a gönderir. Host ayrılırsa rol otomatik olarak başka bir oyuncuya geçer.
- Öldürme ödülü son vuruşu yapana gider; yakındaki parti üyeleri XP'yi ve görev öldürme sayılarını paylaşır.
- **Hesaplar:** ilerlemeni sunucuda tutmak için başlangıç ekranında kaydol ya da misafir oyna (ilerleme o tarayıcıda kalır). Parolalar tuzlu scrypt özeti, giriş jetonları SHA-256 özeti olarak saklanır, girişler hız sınırlıdır ve her şey git'in yok saydığı `server/data/` içindedir.
- **Veritabanı:** Node'un yerleşik SQLite'ı (`node:sqlite`), WAL modu, günlük yedek (son 7 tutulur). Parola kurtarma tek kullanımlık kurtarma koduyla yapılır; e-posta saklanmaz.
- **Yönetici CLI:** `node server/admin.js list | reset <ad> | ban <ad> | unban <ad> | delete <ad> --yes | backup`
- Sunucu bağımlılıksızdır: statik dosyalar ve minimal WebSocket düz Node ile, yol geçişi koruması ile mesaj boyutu ve hız sınırlarıyla.

## ASCII çizici nasıl çalışır

1. Sahne ekran dışı bir hedefe tam çözünürlükte çizilir.
2. Her malzeme alfa kanalına bir **malzeme kimliği** yazar (`src/core.js`). Çimen ayrıca her yaprağın ekran açısını kodlar.
3. Tam ekran bir geçiş (`src/render.js`) ekranı karakter hücrelerine böler, her hücreyi 3×3 örnekler ve o malzemeye ait setten bir karakter seçip sahnenin rengiyle boyar.
4. İnce nesneler (yağmur, ağ, çiçek) herhangi bir örnek isabet ederse hücreyi sahiplenir; 1 piksellik çizgiler kaybolmaz.

Ayrıntılar: [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md)

## Proje yapısı

```
index.html, style.css   giriş sayfası ve arayüz stilleri
src/core.js             matematik, gürültü, arazi yüksekliği, çarpışma, malzeme kimlikleri
src/render.js           çizici, ASCII son işlem, gece/gündüz, yağmur
src/world.js            arazi, deniz, çimen, ağaçlar, köy, kale, bataklık
src/models.js           karakter modelleri ve animasyon
src/actors.js           oyuncu, düşman yapay zekâsı, yetenekler, mermiler
src/game.js             durum, eşyalar, görevler, diyalog, kayıt, arayüz
src/net.js, duel.js, party.js   çok oyunculu istemci, düellolar, partiler
src/touch.js            tabletler için dokunmatik kontroller
src/main.js             girdi, kamera, ana döngü
server/                 bağımlılıksız Node.js sunucusu, SQLite, yönetici CLI
update.bat              sürüm güncelleyici (start.bat çağırır)
```

## Destek

ASCII-Terra açık geliştirilir. Beğendiysen geliştirmeyi destekleyebilirsin:
[GitHub Sponsors](https://github.com/sponsors/emreyigit-tasdelen) · [Buy Me a Coffee](https://buymeacoffee.com/emreyigit.tasdelen)

## Katkı

Issue ve pull request'ler memnuniyetle karşılanır. Temel kural: **ekranda görünen her şey ASCII olmalı.**

## Lisans

[MIT](LICENSE)
