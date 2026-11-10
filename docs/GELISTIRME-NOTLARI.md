# Geliştirme Notları (oturumlar arası devir)

> Yeni oturum buradan başlar. Her adımdan sonra güncellenir. Ayrıntılı plan: [ROADMAP.md](../ROADMAP.md), görsel kurallar: [STIL-REHBERI.md](STIL-REHBERI.md).

## Kurallar
- Ekrandaki **her şey ASCII** (doğrudan 3B çizim yok).
- Her değişiklikten sonra commit + push. Yazar: `emreyigit-tasdelen` + noreply e-posta. Claude asla katkıcı/co-author değil.
- Kişisel veri yok (e-posta, yerel yollar, hesap verisi). `server/data/` git'e girmez.
- README.md (EN) ve README.tr.md (TR) birlikte güncellenir.
- Test: `PORT=8766 node server/server.js` (arka planda), tarayıcı panelinde `http://localhost:8766`. Bitince süreci kapat, `server/data` test verisini sil.

## Mimari (kısa)
`src/core.js` (yükseklik, çarpışma, MID) · `render.js` (ASCII geçişi, ışık, gölge) · `world.js` (arazi, köy, kale, bataklık) · `models.js` (modeller + `animBiped`) · `actors.js` (oyuncu, düşman AI, beceriler, kalkan) · `fx.js` (parçacık) · `game.js` (görev, envanter, HUD, kayıt) · `net.js` (çok oyunculu istemci) · `main.js` (girdi, döngü, giriş ekranı, duraklatma) · `server/server.js` (bağımlılıksız Node: statik + WebSocket + hesaplar).

## Yapılanlar (en yeni üstte)
- Kalkan V tuşunda (sağ tık/F kaldırıldı), blokta kalkan 90° yatay döner (`r.shield`). Kamera sağ veya orta tuşla sürüklenir.
- MIT lisansı, README'ye ekran görüntüsü (docs/screenshot.jpg). Düello/parti/ortak görev ve DB/şifre sıfırlama planı ROADMAP Faz 5'e yazıldı.
- v0.7 Esc/P duraklatma menüsü (tek oyunculuda dünya donar, çevrimiçide oyuncu dokunulmaz).
- v0.6 Kalkan (sağ tık/F, blok + savuşturma + dayanıklılık), hesaplar (kayıt/giriş/misafir, scrypt, belirteç, sunucu kaydı). Kamera döndürme orta tuşta.
- v0.5 Çok oyunculu: host yetkili ortak oyun, sohbet, host devri, arka plan sekmesi için yedek tick.
- v0.4 Animasyon v2 (kombo, takla, zıplama=Boşluk, yuvarlanma=C), Sisli Bataklık + hortlak/cadı/trol, kamera ufka iner.
- v0.3 Detaylı şövalye/canavar modelleri, ejderha, gölgeler, parçacıklar.
- v0.2 Her şey ASCII, modüler kod, public repo, README EN/TR, sponsor linkleri.

## Açık işler / sıradaki
- DB önerisi (node:sqlite + kurtarma kodu + admin.js CLI) kullanıcı onayı bekliyor → onaylanınca uygula.
- Sonra: parti (v0.8) → ortak görev (v0.9) → düello (v0.10), ayrıntı ROADMAP Faz 5.
- Kullanıcı "çok oyunculuya girilemiyor" dedi: Node sunucusuyla kayıt/giriş/oyun test edildi, çalışıyor. Python yedek sunucusu veya index.html doğrudan açılırsa çevrimiçi olmaz. Kullanıcının nasıl başlattığı netleşmedi.
- Kılıç/kasırga vuruşu çok oyunculu elle test edilmeli (iki sekme).
