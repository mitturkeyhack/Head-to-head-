# Kafa Kafaya 🧠⚡

Türkçe bilgi yarışması oyunu. Kategoriler, 7'li kombo, jokerler, günlük soru, hatalarım modu, avatar, ünvan ve rozetler.

## Telefona kurma
[Releases → son-surum](../../releases/tag/son-surum) sayfasından **KafaKafaya.apk** dosyasını indirip kur.
Her `main` güncellemesinde APK GitHub Actions ile yeniden derlenir.

## Tarayıcıda deneme
GitHub Pages: https://mitturkeyhack.github.io/Head-to-head-/

## Yapı
- `www/` — oyunun kendisi (HTML/CSS/JS, internet gerektirmez)
- `www/js/questions.js` — soru bankası. Biçim: `[soru, doğru, yanlış1, yanlış2, yanlış3]`
- `assets/` — uygulama ikonu ve açılış ekranı kaynakları
- `.github/workflows/` — APK ve web derleme

## Yol haritası
- [x] Tek başına, karışık, günlük soru, hatalarım
- [x] Kafa Kafaya Hesabı (bu sürümde cihazda saklanır)
- [ ] Çevrimiçi hesap ve sıralama
- [ ] Karşılıklı: 1vs1, özel oda, 5'li
- [ ] Etkinlikler
