# Görsel Stil Rehberi

> English summary: everything on screen is an ASCII glyph. The scene is rendered to an off-screen target,
> every material writes an ID into the alpha channel, and the ASCII pass picks a glyph set per material.

Referans: karanlık, atmosferik ASCII MMORPG estetiği (ilham alınan geliştirme videolarından çıkarılan kurallar).

## Altın kural
**Ekrandaki her piksel bir glifin parçasıdır.** Hiçbir nesne "doğrudan" 3B görüntü olarak çizilmez;
çimen, zırh, su, ateş, yağmur dahil her şey karakterlerden oluşur. Arayüz (HUD) de monospace metindir.

## Genel his
- Koyu, soğuk, alacakaranlık paleti; gündüz bile loş. Sıcak renk yalnızca ateş, meşale ve büyülerde.
- Kamera yukarıdan ~55° eğik, varsayılan olarak kuzeye bakar.
- İmleç ekranda `+`; karakter imlece doğru saldırır.

## Malzemeye göre glif setleri
Her malzeme kimliğini render hedefinin alfa kanalına yazar (`src/core.js` → `MID`), ASCII geçişi (`src/render.js`) buna göre seçer:

| Malzeme | Izgara | Glifler / renk |
|---|---|---|
| Çimen | normal | sapın ekrandaki yönüne göre `- ~ _` · `/ '` · `\| ! l` · `\ ``` yeşil-gri |
| Çiçek | normal | beyaz `o * + .` |
| Zemin | normal | seyrek ` . , : ; '`; mavimsi zeminde taş seti |
| Taş (sur, menhir, kaya, ev) | normal | `oaeswqpdbmOQ0&%$#@MW` rastgele harf dokusu, mavi-gri |
| Ahşap | normal | `. : - = \| # H` |
| Yaprak | normal | `. , ; : * o % & 8 @ #` koyu çam yeşili |
| Su | normal | siyah zemin, kıyıya paralel beyaz köpük `- ~ = *` |
| Ateş | normal, titrer | turuncu `. * + o % # & @` |
| Parlak ince nesne (kristal, pencere, ağ) | normal | `+ x * # @` |
| Yağmur | normal | `/ '` |
| Karakter (şövalye, NPC, iskelet) | ince (0.65x) | zırh seti `. : ; + = x o O 0 Q 8 % # @` |
| Yaratık (kurt, örümcek) | ince (0.65x) | tüy seti `. ' : ; ! / \| \ ( ) { } o x % # 8 @` |

İnce nesneler (yağmur, ağ, çiçek) hücrenin 9 örneğinden birine bile değse o hücreye kendi glifini basar; böylece 1 piksellik çizgiler kaybolmaz.

## Karakterler
- **Senje (oyuncu):** gümüş plaka zırh + vizörlü miğfer, kırmızı tabard ve kalkan, kılıç.
- **İskelet savaşçı:** kemik beyazı, paslı kılıç. **Kurt:** gri tüy, kırmızı gözler.
- **Boss — Alacakaranlık Dulu:** dev örümcek, çevresinde beyaz ağlar, yere turuncu AoE uyarı daireleri.

## Arayüz
- Altta 10 yuvalı hotbar, üstünde HP (kırmızı) ve XP (altın, bölmeli) çubukları; ortada `LV n · x / y XP`.
- Üstte hedef kutusu (`İsim hp/max` + ince beyaz çubuk); boss için geniş, 4 bölmeli kırmızı çubuk.
- Düşman üstünde `İsim · sv n` ve ince can çubuğu. Hasar sayıları beyaz / kırmızı, kritik sarı.
- Yazı tipi Consolas, 9–11 px, gölgeli.
