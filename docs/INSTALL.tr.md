# Kurulum Rehberi

[English](INSTALL.md) · **Türkçe**

## 1. Gereksinimler

| Gereken | Ayrıntı |
|---|---|
| **Tarayıcı** | WebGL2 destekli güncel Chrome, Edge, Firefox veya Safari |
| **Node.js** | Çok oyunculu mod ve hesaplar için **22.13 veya üstü** (24 LTS önerilir). İndir: <https://nodejs.org> |
| **Git** | İsteğe bağlı. Varsa güncellemeler git ile gelir, yoksa ZIP ile |

Node.js yoksa oyun yalnızca tek kişilik açılır (Python varsa). Hesaplar ve çok oyunculu mod Node ister.

Kontrol: bir terminalde `node -v` yaz; `v22.13` veya daha yüksek bir sürüm görmelisin.

## 2. Windows

### ZIP ile (git bilmeyenler için)
1. <https://github.com/emreyigit-tasdelen/ascii-terra/releases/latest> adresinden **Source code (zip)** dosyasını indir.
2. ZIP'e sağ tıkla → **Tümünü ayıkla**. Kalıcı bir klasör seç (ör. `C:\Oyunlar\ascii-terra`). Geçici klasör (İndirilenler) önermem, güncellemeler ve kayıtlar orada durur.
3. Klasördeki **`start.bat`**'a çift tıkla.
4. Küçük bir konsol penceresi açılır (sunucu; kapatma) ve tarayıcıda oyun gelir: <http://localhost:8765>.
5. Windows Güvenlik Duvarı sorarsa: arkadaşların ya da tabletin bağlanacaksa **Özel ağlar**'a izin ver. Yalnız sen oynayacaksan "İptal" de olur.

### Git ile
```powershell
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
.\start.bat
```

## 3. macOS ve Linux

```bash
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
node server/server.js
```

Sonra <http://localhost:8765> adresini aç. `npm install` gerekmez. Bu sistemlerde `start.bat` çalışmaz; otomatik güncelleme için `git pull` yap (aşağıya bak).

## 4. İlk oyun

- Açılışta **Giriş yap**, **Kaydol** veya **Misafir** seçersin.
  - **Hesap:** ilerleme sunucuda tutulur, her cihazdan devam edersin. Kaydolunca bir **kurtarma kodu** gösterilir; parolanı unutursan tek yolu budur, bir yere yaz.
  - **Misafir:** ilerleme yalnız o tarayıcıda kalır (tarayıcı verisi silinirse gider).
- Yeni oyun karakter oluşturma ve kısa bir eğitimle başlar. Yardım için oyunda `H`.

## 5. Arkadaşlarla (LAN) ve tabletle oynama

1. Oyunu `start.bat` ile **bir bilgisayarda** başlat. O bilgisayar sunucudur ve açık kalmalıdır.
2. Sunucu konsolunda şu satırı bul:
   ```
   For friends on your local network → http://192.168.x.x:8765
   ```
3. Aynı Wi-Fi ya da ağdaki diğer bilgisayar ve tabletlerde bu adresi tarayıcıya yaz.
4. Tablette tableti **yatay** tut. iPad'de Paylaş → **Ana Ekrana Ekle** ile tam ekran açılır.

Bağlanamıyorsan:
- Tablet ve bilgisayar aynı ağda mı? (Misafir Wi-Fi'ler cihazları ayırabilir.)
- Windows Güvenlik Duvarı'nda Node.js'e **özel ağ** izni var mı? (Başlat → "Güvenlik Duvarı üzerinden bir uygulamaya izin ver".)
- Adresin sonunda `:8765` var mı?

İnternet üzerinden oynamak için sunucuyu HTTPS arkasında bir VPS'te çalıştır; istemci otomatik `wss://` kullanır. Evdeki bilgisayarı doğrudan internete açmanı önermem.

## 6. Güncelleme

- **`start.bat` ile:** her açılışta GitHub'daki en yeni **release** (`v0.x.x`) denetlenir ve varsa kurulur. Sen bir şey yapmazsın.
- **ZIP kurulumu:** yalnızca yeni dosyalar indirilir, silinen dosyalar temizlenir. Hesapların ve kayıtların (`server/data/`) değişmez.
- **Git kurulumu:** yerel değişikliğin yoksa en yeni sürüme geçer; varsa güncelleme atlanır ve hiçbir şeye dokunulmaz.
- **Elle (macOS/Linux):** `git pull`.
- İnternet yoksa ya da bir hata olursa oyun mevcut sürümle açılır.
- Yalnızca yayınlanmış release'ler kurulur; yarım kalmış commit'ler gelmez.

## 7. Ayarlar

| Ne | Nasıl |
|---|---|
| Port değiştirme | `PORT=9000 node server/server.js` (Windows PowerShell: `$env:PORT=9000; node server/server.js`) |
| Yalnızca bu bilgisayar | `HOST=127.0.0.1 node server/server.js` (ağdan erişim kapanır) |
| Kalite / performans | Oyunda `Esc` → **Resolution** ve **Grass** |
| Tuşları değiştirme | `Esc` → tuş listesi |

## 8. Veriler, yedek ve yönetim

Her şey `server/data/` klasöründe durur ve git'e girmez:
- `terra.db`: hesaplar ve kayıtlar (SQLite)
- `backups/`: günlük yedekler (son 7 tutulur)

Yedeklemek için sunucu kapalıyken bu klasörü kopyala. Taşımak için yeni kuruluma aynı klasörü koy.

Yönetici komutları (klasörde bir terminalde):
```
node server/admin.js list                 hesapları listele
node server/admin.js reset <ad>           parola sıfırla
node server/admin.js ban <ad> | unban <ad>
node server/admin.js delete <ad> --yes    hesabı sil
node server/admin.js backup               hemen yedek al
```

## 9. Sorun giderme

| Belirti | Çözüm |
|---|---|
| `node` tanınmıyor | Node.js'i kur, terminali ya da `start.bat`'i yeniden aç |
| Sunucu "sqlite" hatası veriyor | Node sürümün eski; 22.13+ kur |
| `EADDRINUSE` / port dolu | Oyun zaten açık olabilir; konsol penceresini kapat ya da `PORT=9000` kullan |
| Siyah ekran / "WebGL" hatası | Tarayıcında donanım hızlandırmayı aç, sürücüyü güncelle |
| Oyun yavaş | `Esc` → Resolution'ı 50% yap, Grass'ı Sparse yap, `[` tuşuyla harfleri büyüt |
| `index.html`'e çift tıklayınca çalışmıyor | Normal; oyun sunucu ister, `start.bat` kullan |
| Tablet bağlanmıyor | 5. bölümdeki kontrol listesi |
| Güncelleme olmadı | İnternet ve GitHub erişimini kontrol et; ayrıca henüz yeni release olmayabilir |

Hâlâ çözemediysen [issue aç](https://github.com/emreyigit-tasdelen/ascii-terra/issues). Kişisel veri (parola, kurtarma kodu) paylaşma.
