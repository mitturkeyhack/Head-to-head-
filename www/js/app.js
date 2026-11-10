/* Kafa Kafaya — ana uygulama */
(function () {
  "use strict";

  const SURUM = "0.1.0";
  const WEB_ADRES = "https://mitturkeyhack.github.io/Head-to-head-/";
  const SORUN_ADRES = "https://github.com/mitturkeyhack/Head-to-head-/issues/new";
  const MAKS_KALP = 10;
  const KALP_DK = 20;
  const TUR_SN = 90;
  const KOMBO = 7;
  const JOKER = { yari: 200, cift: 200, degis: 100 };
  const KATLAR = window.KATEGORILER;
  const KAT = Object.fromEntries(KATLAR.map(k => [k.id, k]));
  const BOLUMLER = ["Manevi", "Zaman Yolculuğu", "Popüler", "Ortaya Karışık", "Sanata Dair", "Taze Çıktı"];

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  let zamanlayici = null;      // ekran zamanlayıcısı
  let geriHedef = null;        // donanım geri tuşu için

  /* ---------- yardımcılar ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bugun = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dun = () => { const d = new Date(); d.setDate(d.getDate() - 1); return bugun(d); };
  const karistir = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sayi = n => n.toLocaleString("tr-TR");
  function tohum(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._z); t._z = setTimeout(() => t.classList.remove("on"), 2600); }
  const oku = (k, v) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : v; } catch (e) { return v; } };
  const yaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  async function ozet(s) {
    try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kk:" + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
    catch (e) { let h = 0; for (const c of "kk:" + s) h = (h * 31 + c.charCodeAt(0)) | 0; return "f" + h; }
  }

  /* ---------- ayarlar, ses, titreşim ---------- */
  const ayar = Object.assign({ ses: true, titresim: true }, oku("kk_ayar", {}));
  let ses_ctx = null;
  function ses(tip) {
    if (!ayar.ses) return;
    try {
      ses_ctx = ses_ctx || new (window.AudioContext || window.webkitAudioContext)();
      const notalar = { dogru: [660, 880], yanlis: [220, 160], kombo: [523, 659, 784, 1047], tik: [900], bitis: [784, 659, 523], tus: [500] }[tip] || [500];
      notalar.forEach((f, i) => {
        const o = ses_ctx.createOscillator(), g = ses_ctx.createGain(), t = ses_ctx.currentTime + i * 0.09;
        o.type = tip === "yanlis" ? "sawtooth" : "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(tip === "tik" ? 0.05 : 0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(ses_ctx.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (e) {}
  }
  const titre = ms => { if (ayar.titresim && navigator.vibrate) navigator.vibrate(ms); };

  /* ---------- hesaplar ve veri ---------- */
  let hesaplar = oku("kk_hesaplar", {});
  let oturum = oku("kk_oturum", null);  // e-posta | "misafir" | null
  let V = null;                          // aktif oyuncu verisi

  function yeniVeri(ad) {
    return { ad: ad || "Misafir", avatar: 0, unvan: null, altin: 300, kalp: MAKS_KALP, kalpZaman: Date.now(), xp: 0,
      dogru: 0, yanlis: 0, oyun: 0, cevapMs: 0, cevapSayi: 0, kat: {}, hatalar: [], gunluk: null, gunlukSeri: 0, sonGunluk: null,
      rozetler: [], puanGun: {}, sonGiris: null, tanitim: false };
  }
  const veriAnahtar = () => "kk_veri_" + (oturum || "misafir");
  function veriYukle() { V = Object.assign(yeniVeri(), oku(veriAnahtar(), {})); kalpGuncelle(); }
  function kaydet() { if (V) yaz(veriAnahtar(), V); }
  function oturumAc(k) { oturum = k; yaz("kk_oturum", k); veriYukle(); }

  function kalpGuncelle() {
    const per = KALP_DK * 60000, simdi = Date.now();
    if (V.kalp >= MAKS_KALP) { V.kalpZaman = simdi; return; }
    while (V.kalp < MAKS_KALP && simdi - V.kalpZaman >= per) { V.kalp++; V.kalpZaman += per; }
    if (V.kalp >= MAKS_KALP) V.kalpZaman = simdi;
  }
  function kalpKalan() { const ms = KALP_DK * 60000 - (Date.now() - V.kalpZaman); const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }

  function seviye(xp) { let sv = 1, ger = 750, kal = xp; while (kal >= ger) { kal -= ger; sv++; ger += 250; } return { sv, kal, ger }; }
  const katVeri = id => (V.kat[id] = V.kat[id] || { dogru: 0, yanlis: 0, rekor: 0, oyun: 0 });

  /* ---------- avatarlar ---------- */
  const TEN = ["#F6D3B3", "#E9B48A", "#C98C5E", "#8D5A3B"];
  const SAC = ["#2B1B12", "#5A3A22", "#C8A24A", "#A7A7A7", "#151515"];
  const GOMLEK = ["#2F80D1", "#E8503A", "#19C3B5", "#7DB33F", "#8E44AD", "#FF9F1C", "#34495E", "#D63A6E"];
  // [ten, saç rengi, gömlek, stil, kilit seviyesi]
  const AVATARLAR = [null,
    [0, 0, 0, "kisa", 1], [1, 1, 1, "tesettur", 1], [1, 0, 2, "sakal", 1], [0, 2, 3, "uzun", 1],
    [2, 4, 4, "kisa", 1], [0, 1, 5, "tesettur", 1], [3, 4, 6, "dalgali", 1], [1, 3, 7, "sakal", 1],
    [2, 0, 3, "uzun", 2], [0, 4, 1, "dalgali", 2], [3, 1, 0, "tesettur", 3], [1, 4, 5, "kel", 3],
    [2, 1, 7, "sakal", 4], [0, 0, 6, "tesettur", 5], [1, 2, 2, "dalgali", 6], [3, 0, 4, "kisa", 8]];
  function avatarSVG(i) {
    const a = AVATARLAR[i];
    if (!a) return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#E9ECF8"/><circle cx="50" cy="40" r="18" fill="#C7CBE0"/><path d="M18 100 Q18 64 50 64 Q82 64 82 100Z" fill="#C7CBE0"/></svg>`;
    const [t, s, g, stil] = a, ten = TEN[t], sac = SAC[s], gm = GOMLEK[g];
    let arka = "", on = "", yuzR = 21;
    if (stil === "uzun") arka = `<path d="M25 46 Q25 17 50 17 Q75 17 75 46 L78 78 L22 78Z" fill="${sac}"/>`;
    if (stil === "tesettur") { arka = `<path d="M21 52 Q21 13 50 13 Q79 13 79 52 L84 100 L16 100Z" fill="${gm}"/>`; yuzR = 18; }
    if (stil === "kisa" || stil === "sakal") on = `<path d="M29 42 Q28 19 50 19 Q72 19 71 42 Q66 30 50 30 Q34 30 29 42Z" fill="${sac}"/>`;
    if (stil === "uzun") on = `<path d="M29 40 Q30 20 50 20 Q70 20 71 40 Q62 28 47 31 Q37 33 29 40Z" fill="${sac}"/>`;
    if (stil === "dalgali") on = `<path d="M27 44 Q24 22 40 19 Q46 13 56 18 Q72 17 73 44 Q70 32 62 31 Q58 26 50 30 Q42 26 36 32 Q30 34 27 44Z" fill="${sac}"/>`;
    if (stil === "kel") on = `<path d="M29 44 Q29 36 32 36 L32 48Z M71 44 Q71 36 68 36 L68 48Z" fill="${sac}"/>`;
    const sakal = stil === "sakal" ? `<path d="M30 47 Q31 72 50 72 Q69 72 70 47 Q66 61 50 61 Q34 61 30 47Z" fill="${sac}"/>` : "";
    const govde = stil === "tesettur" ? "" : `<path d="M16 100 Q16 70 50 70 Q84 70 84 100Z" fill="${gm}"/><rect x="43" y="58" width="14" height="14" fill="${ten}"/>`;
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#E9ECF8"/>${arka}${govde}<circle cx="50" cy="46" r="${yuzR}" fill="${ten}"/>${sakal}${on}
      <circle cx="42" cy="46" r="2.6" fill="#1E1E2E"/><circle cx="58" cy="46" r="2.6" fill="#1E1E2E"/><path d="M42 55 Q50 61 58 55" stroke="#7A3B2A" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  }
  const avatar = (i, b = 64) => `<div class="avatar" style="width:${b}px;height:${b}px">${avatarSVG(i)}</div>`;

  /* ---------- ünvan ve rozetler ---------- */
  const UNVAN_ESIK = [25, 100, 300];
  function unvanlar() {
    const l = [];
    KATLAR.forEach(k => k.unvanlar.forEach((u, s) => l.push({ id: k.id + ":" + s, ad: u, kat: k, esik: UNVAN_ESIK[s], acik: (V.kat[k.id]?.dogru || 0) >= UNVAN_ESIK[s] })));
    return l;
  }
  function unvanAd() { if (!V.unvan) return ""; const u = unvanlar().find(x => x.id === V.unvan); return u ? u.ad : ""; }
  const ROZETLER = [
    { id: "ilkadim", ad: "İlk Adım", e: "🎯", acik: "İlk oyununu bitir" },
    { id: "kombo", ad: "Kombo Ustası", e: "⚡", acik: "7 soruyu üst üste bil" },
    { id: "yuz", ad: "Yüz Doğru", e: "💯", acik: "Toplam 100 doğru cevap" },
    { id: "bin", ad: "Bin Doğru", e: "🏆", acik: "Toplam 1000 doğru cevap" },
    { id: "rekor20", ad: "Roket", e: "🚀", acik: "Bir turda 20 doğru" },
    { id: "hatasiz", ad: "Hatasız", e: "🎖️", acik: "Bir turda 10+ doğru, hiç yanlış yok" },
    { id: "gunluk5", ad: "Tam İsabet", e: "🌟", acik: "Günlük Soru'da 5/5" },
    { id: "seri3", ad: "Ateşli Seri", e: "🔥", acik: "3 gün üst üste Günlük Soru" },
    { id: "gezgin", ad: "Kategori Gezgini", e: "🧭", acik: "Bütün kategorilerde oyna" }
  ];
  function rozetVer(id) { if (V.rozetler.includes(id)) return null; V.rozetler.push(id); return ROZETLER.find(r => r.id === id); }

  /* ---------- ekran yönetimi ---------- */
  function goster(html, geri) {
    clearInterval(zamanlayici); zamanlayici = null;
    geriHedef = geri || null;
    app.innerHTML = `<div class="ekran ${html.cls || ""}">${html.icerik || html}</div>`;
    window.scrollTo(0, 0);
  }
  const ustBaslik = (baslik, geri = "K.ana()") => `<div class="ust"><button class="geri" onclick="${geri}" aria-label="Geri">‹</button><h2>${baslik}</h2></div>`;
  function modal(icerik, kapanabilir = true) {
    modalRoot.innerHTML = `<div class="perde" ${kapanabilir ? 'onclick="if(event.target===this)K.kapat()"' : ""}><div class="mkutu">${icerik}</div></div>`;
  }
  function kapat() { modalRoot.innerHTML = ""; }
  const modalAcik = () => !!modalRoot.innerHTML;

  /* ---------- açılış ---------- */
  function acilis() {
    app.innerHTML = `<div class="ekran splash"><img src="assets/logo.jpg" alt="Kafa Kafaya"><div class="yukleme"><div id="yb"></div></div><p class="soluk" id="yy">Sorular hazırlanıyor…</p></div>`;
    let p = 0;
    const z = setInterval(() => {
      p += 7 + Math.random() * 12; $("#yb").style.width = Math.min(p, 100) + "%";
      if (p > 55) $("#yy").textContent = "Rakipler ısınıyor…";
      if (p >= 100) { clearInterval(z); setTimeout(() => oturum ? (veriYukle(), girisBonusu(), ana()) : hosgeldin(), 250); }
    }, 110);
  }
  function girisBonusu() {
    if (V.sonGiris !== bugun()) { const ilk = !V.sonGiris; V.sonGiris = bugun(); if (!ilk) { V.altin += 50; setTimeout(() => toast("🎁 Günlük giriş hediyesi: +50 altın"), 500); } kaydet(); }
  }

  /* ---------- hoş geldin / kayıt / giriş ---------- */
  function hosgeldin() {
    kapat();
    goster({ cls: "hosgeldin", icerik: `<img src="assets/logo.jpg" alt="Kafa Kafaya">
      <p>Deneyimini <b style="color:var(--altin)">Kafa Kafaya Hesabı</b> ile kişiselleştir</p>
      <div class="dugmeler"><button class="btn btn-beyaz" onclick="K.kayit()">Kayıt Ol</button><button class="btn btn-cizgi" onclick="K.giris()">Giriş Yap</button></div>
      <button class="atla" onclick="K.misafir()">Atla →</button>` });
  }
  function misafir() { oturumAc("misafir"); girisBonusu(); ana(); }

  function kayit() {
    goster({ cls: "", icerik: `${ustBaslik("", "K.hosgeldin()")}
      <div class="form">
        <h1><span>Kafa Kafaya</span> Hesabı'na üye ol</h1>
        <p class="orta soluk" style="margin-bottom:6px">İlerlemen, rozetlerin ve ünvanların hesabında saklansın.</p>
        <input class="alan" id="f-eposta" type="email" placeholder="E-posta" autocomplete="email">
        <input class="alan" id="f-ad" placeholder="Kullanıcı adı" maxlength="20">
        <input class="alan" id="f-sifre" type="password" placeholder="Şifre (en az 6 karakter)" autocomplete="new-password">
        <label class="onay"><input type="checkbox" id="f-bilgi"><span>Yeni kategoriler, etkinlikler ve güncellemelerden haberdar olmak istiyorum. (İsteğe bağlı)</span></label>
        <label class="onay"><input type="checkbox" id="f-gizlilik"><span><a onclick="event.preventDefault();K.metin('gizlilik')">Gizlilik Politikası ve Aydınlatma Metni</a>'ni okudum ve kabul ediyorum.</span></label>
        <label class="onay"><input type="checkbox" id="f-kosul"><span><a onclick="event.preventDefault();K.metin('kosul')">Kullanım Koşulları</a>'nı okudum ve kabul ediyorum.</span></label>
        <div class="hata" id="f-hata"></div>
        <button class="btn btn-altin" onclick="K.kayitOl()">Kayıt Ol</button>
        <div class="ayrac">veya</div>
        <button class="btn btn-beyaz" onclick="K.yakinda('Google ile kayıt')" style="opacity:.75">Google ile Kayıt Ol <small>(yakında)</small></button>
        <p class="not">Hesabın şimdilik bu cihazda saklanır. Çevrimiçi modlar gelince hesabın buluta taşınacak.</p>
        <p class="orta" style="margin-top:6px">Zaten hesabın var mı? <a class="link" onclick="K.giris()">Giriş yap →</a></p>
      </div>` }, "K.hosgeldin()");
  }
  async function kayitOl() {
    const e = $("#f-eposta").value.trim().toLowerCase(), ad = $("#f-ad").value.trim(), s = $("#f-sifre").value, h = $("#f-hata");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return h.textContent = "Geçerli bir e-posta yaz.";
    if (ad.length < 2) return h.textContent = "Kullanıcı adı en az 2 karakter olmalı.";
    if (s.length < 6) return h.textContent = "Şifre en az 6 karakter olmalı.";
    if (!$("#f-gizlilik").checked || !$("#f-kosul").checked) return h.textContent = "Devam etmek için gizlilik metnini ve kullanım koşullarını kabul etmelisin.";
    if (hesaplar[e]) return h.textContent = "Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.";
    hesaplar[e] = { ad, hash: await ozet(s), olusturma: Date.now(), bilgi: $("#f-bilgi").checked };
    yaz("kk_hesaplar", hesaplar);
    const eski = oturum === "misafir" ? Object.assign(yeniVeri(), oku("kk_veri_misafir", {})) : null;
    oturum = e; yaz("kk_oturum", e);
    V = eski || yeniVeri(ad); V.ad = ad; kaydet(); if (eski) localStorage.removeItem("kk_veri_misafir");
    kalpGuncelle(); girisBonusu(); toast(`Hoş geldin ${ad}! 🎉`); ana();
  }
  function giris() {
    goster({ cls: "", icerik: `${ustBaslik("", "K.hosgeldin()")}
      <div class="form" style="margin-top:20px">
        <h1><span>Kafa Kafaya</span> Hesabı'na giriş yap</h1>
        <p class="orta soluk" style="margin-bottom:10px">Kaldığın yerden devam et.</p>
        <input class="alan" id="g-eposta" type="email" placeholder="E-posta" autocomplete="email">
        <input class="alan" id="g-sifre" type="password" placeholder="Şifre" autocomplete="current-password">
        <div class="hata" id="g-hata"></div>
        <button class="btn btn-altin" onclick="K.girisYap()">Giriş Yap</button>
        <div class="ayrac">veya</div>
        <button class="btn btn-beyaz" onclick="K.yakinda('Google ile giriş')" style="opacity:.75">Google ile Giriş Yap <small>(yakında)</small></button>
        <p class="orta" style="margin-top:14px">Hesabın yok mu? <a class="link" onclick="K.kayit()">Üye ol →</a></p>
      </div>` }, "K.hosgeldin()");
  }
  async function girisYap() {
    const e = $("#g-eposta").value.trim().toLowerCase(), s = $("#g-sifre").value, h = $("#g-hata");
    const hs = hesaplar[e];
    if (!hs) return h.textContent = "Bu e-postayla kayıtlı bir hesap bulunamadı.";
    if (hs.hash !== await ozet(s)) return h.textContent = "Şifre hatalı.";
    oturumAc(e); girisBonusu(); toast(`Tekrar hoş geldin ${V.ad}!`); ana();
  }

  /* ---------- ana menü ---------- */
  function haftaninKategorisi() { const h = Math.floor((Date.now() / 86400000 + 3) / 7); return KATLAR[h % KATLAR.length]; }
  function ustCubuk() {
    return `<div class="cubuk"><div class="rozet-sayac"><span class="ik ik-altin">🪙</span><span id="c-altin">${sayi(V.altin)}</span></div>
      <div class="rozet-sayac" onclick="K.kalpBilgi()"><span class="ik ik-kalp">${V.kalp}</span><span id="c-kalp">${V.kalp >= MAKS_KALP ? "DOLU" : kalpKalan()}</span></div></div>`;
  }
  function ana() {
    kapat(); kalpGuncelle();
    const s = seviye(V.xp), hk = haftaninKategorisi(), g = V.gunluk && V.gunluk.tarih === bugun() ? V.gunluk : null;
    const sonRozet = V.rozetler.length ? ROZETLER.find(r => r.id === V.rozetler[V.rozetler.length - 1]) : null;
    goster({ cls: "", icerik: `${ustCubuk()}
      <div class="profil">
        <div class="pkart" onclick="K.profil()">${avatar(V.avatar, 70)}
          <div class="pbilgi"><div class="pad">${esc(V.ad)}</div>${unvanAd() ? `<div class="punvan">${esc(unvanAd())}</div>` : ""}
            <div class="seviye"><div class="sv-yildiz">${s.sv}</div><div class="bar"><div style="width:${s.kal / s.ger * 100}%"></div><span>${sayi(V.xp)}</span></div></div>
            <div class="kalan">Sonraki seviyeye ${sayi(s.ger - s.kal)} puan</div></div></div>
        <button class="rkart" onclick="K.profil('rozet')"><b>Rozetler</b><span class="buyuk">${sonRozet ? sonRozet.e : "🎖️"}</span><b class="soluk">${V.rozetler.length}/${ROZETLER.length}</b></button>
      </div>
      <div class="karusel" id="karusel">
        <div class="kkart" style="background:linear-gradient(135deg,${hk.renk},#2A3380)"><span class="kemoji">${hk.ikon}</span>
          <span class="etiket">Haftanın Kategorisi</span><div class="kbaslik">${hk.ad}</div>
          <div class="kalt"><span>Bu hafta keşfet!</span><button class="koyna" onclick="K.basla('tek','${hk.id}')">OYNA</button></div></div>
        <div class="kkart" style="background:linear-gradient(135deg,#FF7A1A,#E8503A)"><span class="kemoji">📅</span>
          <span class="etiket">Günlük Soru</span><div class="kbaslik">${g ? `Bugün ${g.sonuc.filter(Boolean).length}/5` : "Bugünün 5 sorusu"}</div>
          <div class="kalt"><span>${g ? "Yarın yeni sorular" : `🔥 Seri: ${V.sonGunluk === dun() || V.sonGunluk === bugun() ? V.gunlukSeri : 0} gün`}</span><button class="koyna" onclick="K.gunluk()">${g ? "SONUÇ" : "OYNA"}</button></div></div>
        <div class="kkart" style="background:linear-gradient(135deg,#19C3B5,#2F80D1)"><span class="kemoji">🔀</span>
          <span class="etiket">Ortaya Karışık</span><div class="kbaslik">Her kategoriden</div>
          <div class="kalt"><span>Kendini dene!</span><button class="koyna" onclick="K.basla('karisik')">OYNA</button></div></div>
        <div class="kkart" style="background:linear-gradient(135deg,#8E44AD,#2A3380)"><span class="kemoji">⚔️</span>
          <span class="etiket">Rekabet Zamanı</span><div class="kbaslik">Kafa kafaya düello</div>
          <div class="kalt"><span>1vs1, özel oda, 5'li</span><button class="koyna" onclick="K.yakinda('Karşılıklı mod')">YAKINDA</button></div></div>
      </div>
      <div class="noktalar" id="noktalar"><i class="on"></i><i></i><i></i><i></i></div>
      <div class="anabtn"><button class="btn btn-altin" onclick="K.modlar()">▶ OYUN MODLARI</button></div>
      <div class="alt"><button class="altik" onclick="K.siralama()" aria-label="Sıralama">🏆</button><button class="altik" onclick="K.ayarlar()" aria-label="Ayarlar">⚙️</button></div>` });
    const kr = $("#karusel");
    kr.addEventListener("scroll", () => { const i = Math.round(kr.scrollLeft / (kr.scrollWidth / 4)); document.querySelectorAll("#noktalar i").forEach((n, j) => n.classList.toggle("on", j === i)); });
    zamanlayici = setInterval(() => { kalpGuncelle(); const k = $("#c-kalp"); if (k) { k.textContent = V.kalp >= MAKS_KALP ? "DOLU" : kalpKalan(); k.previousElementSibling.textContent = V.kalp; } }, 1000);
  }
  function kalpBilgi() {
    modal(`<h3>❤️ Canlar</h3><p class="orta">Her tek başına oyun 1 can harcar. Canın her ${KALP_DK} dakikada bir yenilenir (en fazla ${MAKS_KALP}).</p>
      <p class="orta"><b>Şu an: ${V.kalp}/${MAKS_KALP}</b>${V.kalp < MAKS_KALP ? ` · sonraki can ${kalpKalan()}` : ""}</p>
      ${V.kalp < MAKS_KALP ? `<button class="mbtn" onclick="K.kalpAl()">100 🪙 ile 1 can al</button>` : ""}<button class="mbtn" onclick="K.kapat()">Tamam</button>`);
  }
  function kalpAl() {
    if (V.altin < 100) return toast("Yeterli altının yok.");
    V.altin -= 100; V.kalp++; kaydet(); kapat(); toast("+1 can ❤️"); ana();
  }

  /* ---------- modlar ve kategoriler ---------- */
  function modlar() {
    const g = V.gunluk && V.gunluk.tarih === bugun();
    goster({ cls: "", icerik: `${ustBaslik("Oyun Modları")}
      <button class="mod" style="background:linear-gradient(135deg,#FFB347,#FF7A1A)" onclick="K.kategoriler()"><span class="memoji">🧠</span><h3>TEK BAŞINA</h3><p>${KATLAR.length} kategori, ${KATLAR.reduce((a, k) => a + k.sorular.length, 0)} soru. Kombo yap, rekor kır!</p></button>
      <button class="mod" style="background:linear-gradient(135deg,#19C3B5,#2F80D1)" onclick="K.gunluk()"><span class="memoji">📅</span><h3>GÜNLÜK SORU</h3><p>${g ? "Bugünkü soruları çözdün. Sonucunu paylaş!" : "Herkese aynı 5 soru. Sonucunu arkadaşlarınla paylaş."}</p></button>
      <button class="mod" style="background:linear-gradient(135deg,#E8503A,#A83279)" onclick="K.basla('hatalar')"><span class="memoji">🔁</span><h3>HATALARIM ${V.hatalar.length ? `<span class="sayi">${V.hatalar.length}</span>` : ""}</h3><p>Yanlış yaptığın soruları tekrar çöz. Bildiğin soru listeden çıkar.</p></button>
      <button class="mod kilit" style="background:linear-gradient(135deg,#5BB548,#1E8C5A)" onclick="K.yakinda('Karşılıklı mod')"><span class="yakinda">YAKINDA</span><span class="memoji">⚔️</span><h3>KARŞILIKLI</h3><p>1vs1, özel oda ve 5'li oyun. Arkadaşlarınla kafa kafaya!</p></button>
      <button class="mod kilit" style="background:linear-gradient(135deg,#8E44AD,#3D5BA9)" onclick="K.yakinda('Etkinlikler')"><span class="yakinda">YAKINDA</span><span class="memoji">🏅</span><h3>ETKİNLİKLER</h3><p>Süreli turnuvalar ve özel rozetler.</p></button>` });
  }
  function kategoriler(filtre = "") {
    const f = filtre.toLocaleLowerCase("tr");
    const kutu = k => { const r = V.kat[k.id]?.rekor; return `<button class="kat" style="background:${k.renk}" onclick="K.basla('tek','${k.id}')">${r ? `<span class="rek">🏅${r}</span>` : ""}<span class="em">${k.ikon}</span><b>${k.ad}</b></button>`; };
    let govde = "";
    if (f) {
      const l = KATLAR.filter(k => k.ad.toLocaleLowerCase("tr").includes(f));
      govde = l.length ? `<div class="izgara" style="margin-top:16px">${l.map(kutu).join("")}</div>` : `<p class="bos">"${esc(filtre)}" ile eşleşen kategori yok.</p>`;
    } else {
      govde = `<div class="izgara" style="margin-top:16px"><button class="kat" style="background:#3A3F66;grid-column:span 3;aspect-ratio:auto;padding:18px;flex-direction:row;gap:14px" onclick="K.basla('karisik')"><span class="em">🔀</span><b style="font-size:20px">KARIŞIK</b></button></div>` +
        BOLUMLER.map(b => { const l = KATLAR.filter(k => k.bolum === b); return l.length ? `<div class="bolum">${b}</div><div class="izgara">${l.map(kutu).join("")}</div>` : ""; }).join("");
    }
    goster({ cls: "", icerik: `<div class="ust"><button class="geri" onclick="K.modlar()">‹</button><input class="ara" id="ara" placeholder="Kategori ara…" value="${esc(filtre)}"></div><div id="katlar">${govde}</div>` }, "K.modlar()");
    const a = $("#ara"); a.addEventListener("input", () => { const p = a.selectionStart; kategoriler(a.value); const n = $("#ara"); n.focus(); n.setSelectionRange(p, p); });
  }

  /* ---------- oyun ---------- */
  let O = null;
  function havuzKur(mod, katId) {
    if (mod === "tek") return karistir(KAT[katId].sorular.map((_, i) => ({ k: katId, i })));
    if (mod === "karisik") return karistir(KATLAR.flatMap(k => k.sorular.map((_, i) => ({ k: k.id, i }))));
    if (mod === "hatalar") return karistir(V.hatalar.map(s => { const [k, i] = s.split(":"); return { k, i: +i }; }).filter(x => KAT[x.k] && KAT[x.k].sorular[x.i]));
    if (mod === "gunluk") { const r = tohum("kk-gunluk-" + bugun()); return karistir(KATLAR.flatMap(k => k.sorular.map((_, i) => ({ k: k.id, i }))), r).slice(0, 5); }
    return [];
  }
  function basla(mod, katId) {
    kapat(); kalpGuncelle();
    if (mod === "hatalar" && !V.hatalar.length) return toast("Hiç hatan yok, harika! 👏");
    const canli = mod === "tek" || mod === "karisik";
    if (canli && V.kalp < 1) return kalpBilgi();
    if (canli) { if (V.kalp >= MAKS_KALP) V.kalpZaman = Date.now(); V.kalp--; kaydet(); }
    O = { mod, katId, havuz: havuzKur(mod, katId), sira: 0, no: 0, kalan: (mod === "gunluk" ? 75 : TUR_SN) * 1000, dogru: 0, yanlis: 0, seri: 0, kombo: false, maxSeri: 0,
      yildiz: 0, altin: 0, cift: false, kilit: false, sonuc: [], durdu: false, soruBas: 0 };
    sonrakiSoru(true);
    if (!V.tanitim) ogretici(); else saatiBaslat();
  }
  function ogretici() {
    O.durdu = true;
    const adimlar = [
      `<h3>Her yanlışında serin sıfırlanır<br>ve <span class="kirmizi">4 sn</span> kaybedersin</h3><p class="soluk">Tur ${TUR_SN} saniye sürer. Süre bitene kadar olabildiğince çok soru bil!</p>`,
      `<h3>${KOMBO} soruyu üst üste bilirsen</h3><div class="buyuk">KOMBO!</div><h3>Sonraki her doğruda<br><span class="vurgu">2 kat ⭐ 2 kat 🪙 +4 sn</span></h3>`,
      `<h3>Zorlandığında <span class="vurgu">joker</span> kullan</h3><p class="soluk">Yarı Yarıya (${JOKER.yari} 🪙) · Çift Cevap (${JOKER.cift} 🪙) · Soru Değiştir (${JOKER.degis} 🪙)</p>`];
    let i = 0;
    const div = document.createElement("div"); div.className = "ogretici";
    const ciz = () => { div.innerHTML = adimlar[i] + `<button class="btn btn-altin" style="max-width:260px">${i < adimlar.length - 1 ? "Devam" : "Başla!"}</button>`; div.querySelector("button").onclick = ilerle; };
    const ilerle = () => { i++; if (i >= adimlar.length) { div.remove(); V.tanitim = true; kaydet(); O.durdu = false; saatiBaslat(); } else ciz(); };
    ciz(); document.body.appendChild(div);
  }
  function saatiBaslat() {
    let son = Date.now();
    zamanlayici = setInterval(() => {
      const s = Date.now(), d = s - son; son = s;
      if (!O || O.durdu || O.kilit) return;
      const once = Math.ceil(O.kalan / 1000);
      O.kalan -= d;
      const sn = Math.max(0, Math.ceil(O.kalan / 1000));
      const el = $("#sure"); if (el) { el.textContent = sn; el.classList.toggle("az", sn <= 10); }
      if (sn !== once && sn <= 5 && sn > 0) ses("tik");
      if (O.kalan <= 0) bitir();
    }, 100);
  }
  function sonrakiSoru(ilk) {
    if (O.mod === "gunluk" || O.mod === "hatalar") { if (O.sira >= O.havuz.length) return bitir(); }
    else if (O.sira >= O.havuz.length) { O.havuz = karistir(O.havuz); O.sira = 0; }
    const q = O.havuz[O.sira++], k = KAT[q.k], ham = k.sorular[q.i];
    O.soru = { q, k, metin: ham[0], dogru: ham[1], siklar: karistir(ham.slice(1)) };
    O.no++; O.cift = false; O.kilit = false; O.soruBas = Date.now();
    if (ilk) oyunEkrani(); else soruCiz();
  }
  function oyunEkrani() {
    const jok = O.mod !== "gunluk";
    goster({ cls: "oyun", icerik: `
      <div class="oust"><button class="geri" onclick="K.cikisSor()" aria-label="Çık">✕</button>
        <div class="mini">⭐ <span id="o-yildiz">0</span></div>${avatar(V.avatar, 54)}<div class="mini">🪙 <span id="o-altin">${sayi(V.altin)}</span></div></div>
      <div class="kombo" id="kombo">${O.mod === "gunluk" ? [1, 2, 3, 4, 5].map(n => `<i>${n}</i>`).join("") : Array.from({ length: KOMBO }, (_, i) => `<i>${i + 1}</i>`).join("")}</div>
      <div class="kombo-yazi" id="kyazi"></div>
      <div class="obilgi"><span class="sno" id="sno"></span><span class="okat" id="okat"></span><span class="sure" id="sure">${Math.ceil(O.kalan / 1000)}</span></div>
      <div class="soru" id="soru"></div>
      <div class="siklar" id="siklar"></div>
      ${jok ? `<div class="jokerler">
        <div class="jwrap"><span class="jfiyat">${JOKER.yari}</span><button class="joker" id="j-yari" onclick="K.joker('yari')">½</button><small>Yarı Yarıya</small></div>
        <div class="jwrap"><span class="jfiyat">${JOKER.cift}</span><button class="joker" id="j-cift" onclick="K.joker('cift')">×2</button><small>Çift Cevap</small></div>
        <div class="jwrap"><span class="jfiyat">${JOKER.degis}</span><button class="joker" id="j-degis" onclick="K.joker('degis')">⟳</button><small>Soru Değiştir</small></div></div>` : `<p class="not" style="margin-top:auto">Günlük Soru'da joker kullanılamaz.</p>`}` }, "K.cikisSor()");
    soruCiz();
  }
  function soruCiz() {
    const s = O.soru;
    $("#sno").textContent = O.mod === "gunluk" ? `${O.no}/5` : O.no + ".";
    $("#okat").innerHTML = `${s.k.ikon} ${s.k.ad}`;
    $("#soru").textContent = s.metin;
    $("#siklar").innerHTML = s.siklar.map((c, i) => `<button class="sik" data-i="${i}" onclick="K.cevap(${i})">${esc(c)}</button>`).join("");
    komboCiz(); jokerCiz();
  }
  function komboCiz() {
    const k = $("#kombo"); if (!k) return;
    if (O.mod === "gunluk") { [...k.children].forEach((n, i) => { const r = O.sonuc[i]; n.className = r === undefined ? "" : "on"; n.style.background = r === undefined ? "" : r ? "#5BD16B" : "#F0524F"; }); return; }
    k.classList.toggle("aktif", O.kombo);
    [...k.children].forEach((n, i) => n.classList.toggle("on", O.kombo || i < O.seri));
    $("#kyazi").textContent = O.kombo ? `⚡ KOMBO x2 · ${O.seri} SERİ` : "";
  }
  function jokerCiz() {
    ["yari", "cift", "degis"].forEach(j => { const b = $("#j-" + j); if (b) b.classList.toggle("kapali", V.altin < JOKER[j]); });
    const a = $("#o-altin"); if (a) a.textContent = sayi(V.altin);
  }
  function ucan(m, renk) { const d = document.createElement("div"); d.className = "ucan"; d.style.color = renk; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }

  function joker(j) {
    if (!O || O.kilit) return;
    if (V.altin < JOKER[j]) return toast(`Bu joker için ${JOKER[j]} altın gerekli.`);
    const butonlar = [...document.querySelectorAll(".sik")];
    if (j === "yari") {
      const yanlislar = butonlar.filter(b => O.soru.siklar[+b.dataset.i] !== O.soru.dogru && !b.classList.contains("gizli") && !b.classList.contains("yanlis"));
      if (yanlislar.length < 2) return toast("Bu soruda kullanılamaz.");
      karistir(yanlislar).slice(0, 2).forEach(b => b.classList.add("gizli"));
    } else if (j === "cift") {
      if (O.cift) return toast("Çift cevap zaten aktif.");
      O.cift = true; toast("Bu soruda iki hakkın var!");
    } else if (j === "degis") {
      V.altin -= JOKER[j]; kaydet(); O.no--; ses("tus"); return sonrakiSoru();
    }
    V.altin -= JOKER[j]; kaydet(); ses("tus"); jokerCiz();
  }

  function cevap(i) {
    if (!O || O.kilit || O.durdu) return;
    const s = O.soru, secilen = s.siklar[i], btn = document.querySelector(`.sik[data-i="${i}"]`);
    if (btn.classList.contains("yanlis") || btn.classList.contains("gizli")) return;
    const dogruMu = secilen === s.dogru, anahtar = s.q.k + ":" + s.q.i;
    V.cevapMs += Date.now() - O.soruBas; V.cevapSayi++;
    if (!dogruMu && O.cift) { O.cift = false; btn.classList.add("yanlis"); ses("yanlis"); titre(60); toast("Bir hakkın daha var!"); return; }
    O.kilit = true;
    const kv = katVeri(s.q.k);
    if (dogruMu) {
      btn.classList.add("dogru"); O.dogru++; O.seri++; O.maxSeri = Math.max(O.maxSeri, O.seri); V.dogru++; kv.dogru++;
      const carpan = O.kombo ? 2 : 1;
      if (O.mod !== "gunluk") { O.yildiz += 100 * carpan; O.altin += 20 * carpan; }
      if (O.kombo && O.mod !== "gunluk") { O.kalan += 4000; ucan("+4 sn", "#7CF08A"); }
      if (!O.kombo && O.seri >= KOMBO && O.mod !== "gunluk") { O.kombo = true; ses("kombo"); ucan("KOMBO!", "#FFC83D"); titre([40, 40, 80]); }
      else ses("dogru");
      V.hatalar = V.hatalar.filter(h => h !== anahtar);
    } else {
      btn.classList.add("yanlis"); O.yanlis++; V.yanlis++; kv.yanlis++;
      document.querySelectorAll(".sik").forEach(b => { if (s.siklar[+b.dataset.i] === s.dogru) b.classList.add("dogru"); });
      if (O.mod !== "gunluk") { O.kalan -= 4000; ucan("-4 sn", "#FF8A87"); }
      O.seri = 0; O.kombo = false; ses("yanlis"); titre(120);
      if (!V.hatalar.includes(anahtar)) { V.hatalar.push(anahtar); if (V.hatalar.length > 300) V.hatalar.shift(); }
    }
    O.sonuc.push(dogruMu);
    const y = $("#o-yildiz"); if (y) y.textContent = sayi(O.yildiz);
    komboCiz(); kaydet();
    setTimeout(() => { if (!O) return; if (O.kalan <= 0) return bitir(); sonrakiSoru(); }, dogruMu ? 650 : 1300);
  }
  function cikisSor() {
    if (!O) return ana();
    O.durdu = true;
    modal(`<div class="orta" style="font-size:54px">🚪</div><h3>Oyundan ayrılmak istediğine emin misin?</h3><p class="orta">${O.mod === "gunluk" ? "Günlük Soru hakkın yanacak." : "Bu turda kazandıkların kaydedilir."}</p>
      <div style="display:flex;gap:10px"><button class="mbtn" style="flex:1" onclick="K.devam()">Hayır</button><button class="mbtn" style="flex:1;background:#F0524F" onclick="K.kapat();K.bitir()">Evet</button></div>`, false);
  }
  function devam() { kapat(); if (O) O.durdu = false; }

  function bitir() {
    if (!O || O.bitti) return;
    O.bitti = true; clearInterval(zamanlayici); kapat(); ses("bitis");
    const o = O, yeniRozet = [];
    const ekle = id => { const r = rozetVer(id); if (r) yeniRozet.push(r); };
    let rekorMu = false;
    if (o.mod === "gunluk") {
      while (o.sonuc.length < 5) o.sonuc.push(false);
      V.gunlukSeri = V.sonGunluk === dun() ? V.gunlukSeri + 1 : 1; V.sonGunluk = bugun();
      V.gunluk = { tarih: bugun(), sonuc: o.sonuc.slice(0, 5) };
      const d = V.gunluk.sonuc.filter(Boolean).length; o.yildiz = d * 100; o.altin = d * 20;
      if (d === 5) ekle("gunluk5"); if (V.gunlukSeri >= 3) ekle("seri3");
    }
    V.xp += o.yildiz; V.altin += o.altin; V.oyun++;
    V.puanGun[bugun()] = (V.puanGun[bugun()] || 0) + o.yildiz;
    const gunler = Object.keys(V.puanGun).sort(); if (gunler.length > 60) gunler.slice(0, gunler.length - 60).forEach(g => delete V.puanGun[g]);
    if (o.mod === "tek") { const kv = katVeri(o.katId); kv.oyun++; if (o.dogru > kv.rekor) { rekorMu = kv.rekor > 0; kv.rekor = o.dogru; } }
    ekle("ilkadim");
    if (o.maxSeri >= KOMBO) ekle("kombo");
    if (V.dogru >= 100) ekle("yuz"); if (V.dogru >= 1000) ekle("bin");
    if (o.dogru >= 20) ekle("rekor20");
    if (o.dogru >= 10 && o.yanlis === 0) ekle("hatasiz");
    if (KATLAR.every(k => V.kat[k.id]?.oyun)) ekle("gezgin");
    kaydet(); O = null;
    sonuc(o, rekorMu, yeniRozet);
  }
  function sonuc(o, rekorMu, yeniRozet) {
    const baslik = o.mod === "tek" ? `${KAT[o.katId].ad} kategorisinde<br>${o.dogru} doğru cevap verdin.` : o.mod === "gunluk" ? `Günlük Soru'da<br>${o.dogru}/5 bildin!` : o.mod === "hatalar" ? `Hatalarından ${o.dogru} tanesini düzelttin!` : `Karışık turda<br>${o.dogru} doğru cevap verdin.`;
    const em = o.dogru >= 15 ? "🤯" : o.dogru >= 8 ? "🔥" : o.dogru >= 3 ? "😎" : "💪";
    const tekrar = o.mod === "tek" ? `K.basla('tek','${o.katId}')` : o.mod === "karisik" ? "K.basla('karisik')" : o.mod === "hatalar" ? "K.basla('hatalar')" : "K.paylas()";
    goster({ cls: "sonuc", icerik: `<div class="bemoji">${o.mod === "tek" ? KAT[o.katId].ikon : em}</div><h2>${baslik}</h2>
      ${rekorMu ? `<span class="rekor">🏅 Yeni rekor!</span>` : ""}
      ${o.mod === "gunluk" ? `<div class="paylas-kutu">${o.sonuc.map(x => x ? "🟩" : "🟥").join("")}</div>` : ""}
      <div class="odul"><div>⭐ ${sayi(o.yildiz)}</div><div>🪙 ${sayi(o.altin)}</div></div>
      ${o.maxSeri >= KOMBO ? `<p class="link">⚡ En uzun serin: ${o.maxSeri}</p>` : ""}
      ${yeniRozet.map(r => `<p style="background:rgba(255,255,255,.1);padding:10px 16px;border-radius:14px;font-weight:800">${r.e} Yeni rozet: ${r.ad}</p>`).join("")}
      <div class="sdugmeler">
        <button onclick="K.${o.mod === "gunluk" ? "modlar" : o.mod === "tek" ? "kategoriler" : "modlar"}()"><span class="yuv">☰</span>${o.mod === "tek" ? "Kategoriler" : "Modlar"}</button>
        <button onclick="K.ana()"><span class="yuv">🏠</span>Ana Menü</button>
        <button onclick="${tekrar}"><span class="yuv">${o.mod === "gunluk" ? "📤" : "↻"}</span>${o.mod === "gunluk" ? "Paylaş" : "Tekrar Oyna"}</button>
      </div>` });
    if (yeniRozet.length) titre([60, 60, 60]);
  }

  /* ---------- günlük soru ---------- */
  function gunluk() {
    if (V.gunluk && V.gunluk.tarih === bugun()) {
      const d = V.gunluk.sonuc.filter(Boolean).length;
      modal(`<h3>📅 Bugünün sonucu</h3><div class="orta" style="font-size:30px;letter-spacing:4px;margin:10px 0">${V.gunluk.sonuc.map(x => x ? "🟩" : "🟥").join("")}</div>
        <p class="orta"><b>${d}/5</b> · 🔥 ${V.gunlukSeri} günlük seri</p><p class="orta">Yeni sorular yarın seni bekliyor!</p>
        <button class="mbtn" onclick="K.paylas()">📤 Sonucu paylaş</button><button class="mbtn" style="background:#C9CDE3;color:#141B47" onclick="K.kapat()">Kapat</button>`);
      return;
    }
    basla("gunluk");
  }
  async function paylas() {
    if (!V.gunluk) return;
    const t = bugun().split("-").reverse().join(".");
    const metin = `Kafa Kafaya 🧠 Günlük Soru (${t})\n${V.gunluk.sonuc.map(x => x ? "🟩" : "🟥").join("")} ${V.gunluk.sonuc.filter(Boolean).length}/5 · 🔥${V.gunlukSeri}\nSen de dene: ${WEB_ADRES}`;
    const P = window.Capacitor && window.Capacitor.Plugins;
    try {
      if (P && P.Share) return await P.Share.share({ text: metin, dialogTitle: "Sonucunu paylaş" });
      if (navigator.share) return await navigator.share({ text: metin });
    } catch (e) { return; }
    disAc("https://wa.me/?text=" + encodeURIComponent(metin));
  }
  function disAc(url) { window.open(url, "_blank"); }

  /* ---------- profil ---------- */
  let profilSekme = "avatar", secAvatar = 0, secUnvan = null;
  function profil(sekme) {
    profilSekme = sekme || "avatar"; secAvatar = V.avatar; secUnvan = V.unvan; profilCiz();
  }
  function profilCiz() {
    const sv = seviye(V.xp).sv, adDeger = $("#p-ad") ? $("#p-ad").value : V.ad;
    let govde = "";
    if (profilSekme === "avatar") govde = `<div class="avlar">${AVATARLAR.map((a, i) => { const kilit = a && a[4] > sv; return `<button class="${i === secAvatar ? "sec" : ""} ${kilit ? "kilitli" : ""}" onclick="K.avSec(${i},${kilit ? a[4] : 0})">${avatarSVG(i)}</button>`; }).join("")}</div><p class="not" style="color:#6B7199;margin-top:8px">Soluk avatarlar ilerleyen seviyelerde açılır.</p>`;
    if (profilSekme === "unvan") govde = `<div class="unv"><button class="${!secUnvan ? "sec" : ""}" onclick="K.unvSec(null)">Ünvan gösterme</button>${unvanlar().map(u => `<button class="${u.id === secUnvan ? "sec" : ""} ${u.acik ? "" : "kilitli"}" onclick="K.unvSec('${u.id}',${u.acik})"><span>${u.kat.ikon} ${u.ad}</span><small>${u.acik ? "✓" : `${u.kat.ad}: ${V.kat[u.kat.id]?.dogru || 0}/${u.esik} doğru`}</small></button>`).join("")}</div>`;
    if (profilSekme === "rozet") govde = `<div class="rozetler">${ROZETLER.map((r, i) => `<div class="rz ${V.rozetler.includes(r.id) ? "" : "kilitli"}" onclick="K.rozetBilgi(${i})"><span class="re">${r.e}</span>${r.ad}</div>`).join("")}</div>`;
    modal(`<h3>Düzenle</h3><div style="display:flex;justify-content:center">${avatar(secAvatar, 110)}</div>
      <input class="alan" id="p-ad" style="margin-top:14px" maxlength="20" value="${esc(adDeger)}">
      <div class="sekmeler"><button class="${profilSekme === "avatar" ? "on" : ""}" onclick="K.pSekme('avatar')">Avatarlar</button><button class="${profilSekme === "unvan" ? "on" : ""}" onclick="K.pSekme('unvan')">Ünvanlar</button><button class="${profilSekme === "rozet" ? "on" : ""}" onclick="K.pSekme('rozet')">Rozetler</button></div>
      ${govde}<button class="mbtn" onclick="K.profilKaydet()">Kaydet</button>`);
  }
  function avSec(i, kilit) { if (kilit) return toast(`Bu avatar ${kilit}. seviyede açılır.`); secAvatar = i; profilCiz(); }
  function unvSec(id, acik) { if (id && !acik) return toast("Bu ünvanı henüz kazanmadın."); secUnvan = id; profilCiz(); }
  function pSekme(s) { profilSekme = s; profilCiz(); }
  function profilKaydet() {
    const ad = $("#p-ad").value.trim();
    if (ad.length < 2) return toast("İsim en az 2 karakter olmalı.");
    V.ad = ad; V.avatar = secAvatar; V.unvan = secUnvan; kaydet();
    if (oturum !== "misafir" && hesaplar[oturum]) { hesaplar[oturum].ad = ad; yaz("kk_hesaplar", hesaplar); }
    kapat(); toast("Profil kaydedildi ✓"); ana();
  }

  /* ---------- ayarlar ---------- */
  function ayarlar() {
    modal(`<h3>Ayarlar</h3><div class="liste">
      <button onclick="K.profil()">${avatar(V.avatar, 46)}<span>Profil Ayarları</span><span class="sag">›</span></button>
      <button onclick="K.hesapAyarlari()"><span class="lik">👤</span>Hesap Ayarları<span class="sag">›</span></button>
      <button onclick="K.istatistik()"><span class="lik">📊</span>İstatistik<span class="sag">›</span></button>
      <button onclick="K.ayarDegis('ses')"><span class="lik">🔊</span>Sesler<span class="anahtar ${ayar.ses ? "on" : ""}"></span></button>
      <button onclick="K.ayarDegis('titresim')"><span class="lik">📳</span>Titreşim<span class="anahtar ${ayar.titresim ? "on" : ""}"></span></button>
      <button onclick="K.sss()"><span class="lik">❓</span>S.S.S.<span class="sag">›</span></button>
      <button onclick="K.sorunBildir()"><span class="lik">📝</span>Sorun Bildir<span class="sag">›</span></button>
      <button onclick="K.cikis()"><span class="lik">🚪</span>${oturum === "misafir" ? "Hesaba Giriş Yap" : "Çıkış Yap"}</button>
      </div><button class="mbtn" onclick="K.kapat()">Geri</button><p class="surum" style="color:#9AA0C6">v${SURUM}</p>`);
  }
  function ayarDegis(k) { ayar[k] = !ayar[k]; yaz("kk_ayar", ayar); if (k === "titresim") titre(40); ses("tus"); ayarlar(); }
  function cikis() {
    if (oturum === "misafir") return hosgeldin();
    modal(`<h3>Çıkış yapılsın mı?</h3><p class="orta">İlerlemen bu cihazda hesabınla birlikte saklanır, tekrar giriş yaptığında kaldığın yerden devam edersin.</p>
      <div style="display:flex;gap:10px"><button class="mbtn" style="flex:1" onclick="K.ayarlar()">Vazgeç</button><button class="mbtn" style="flex:1;background:#F0524F" onclick="K.cikisYap()">Çıkış Yap</button></div>`);
  }
  function cikisYap() { oturum = null; yaz("kk_oturum", null); V = null; kapat(); hosgeldin(); }

  function hesapAyarlari() {
    modal(`<h3>Hesap Ayarları</h3><div class="liste">
      <button onclick="K.hesapBilgi()"><span class="lik">👤</span><span>Kafa Kafaya Hesabı Ayarları</span><span class="sag">›</span></button>
      <button onclick="K.metin('gizlilik')"><span class="lik">🗂️</span>KVKK ve Gizlilik<span class="sag">›</span></button>
      <button onclick="K.metin('kosul')"><span class="lik">📄</span>Kullanım Koşulları<span class="sag">›</span></button>
      <button onclick="K.hesapSilSor()" style="color:#D23B38"><span class="lik">🗑️</span>${oturum === "misafir" ? "İlerlemeyi Sıfırla" : "Hesabı Sil"}</button>
      </div><button class="mbtn" onclick="K.ayarlar()">Geri</button>`);
  }
  function hesapBilgi() {
    if (oturum === "misafir") {
      return modal(`<h3>Kafa Kafaya Hesabı</h3><p class="orta">Şu an <b>misafir</b> olarak oynuyorsun. Hesap oluşturursan şimdiye kadarki ilerlemen hesabına aktarılır.</p>
        <button class="mbtn" onclick="K.kapat();K.kayit()">Hesap Oluştur</button><button class="mbtn" style="background:#C9CDE3;color:#141B47" onclick="K.kapat();K.giris()">Giriş Yap</button><button class="mbtn" onclick="K.hesapAyarlari()">Geri</button>`);
    }
    const h = hesaplar[oturum];
    modal(`<h3>Kafa Kafaya Hesabı</h3>
      <p><b>E-posta:</b> ${esc(oturum)}</p><p><b>Üyelik:</b> ${new Date(h.olusturma).toLocaleDateString("tr-TR")}</p>
      <p style="margin-top:14px"><b>Şifre değiştir</b></p>
      <input class="alan" id="s-eski" type="password" placeholder="Mevcut şifre" style="margin-bottom:8px">
      <input class="alan" id="s-yeni" type="password" placeholder="Yeni şifre (en az 6 karakter)">
      <div class="hata" id="s-hata" style="color:#D23B38;margin-top:6px"></div>
      <button class="mbtn" onclick="K.sifreDegis()">Şifreyi Güncelle</button><button class="mbtn" style="background:#C9CDE3;color:#141B47" onclick="K.hesapAyarlari()">Geri</button>`);
  }
  async function sifreDegis() {
    const h = hesaplar[oturum], e = $("#s-eski").value, y = $("#s-yeni").value, er = $("#s-hata");
    if (h.hash !== await ozet(e)) return er.textContent = "Mevcut şifre hatalı.";
    if (y.length < 6) return er.textContent = "Yeni şifre en az 6 karakter olmalı.";
    h.hash = await ozet(y); yaz("kk_hesaplar", hesaplar); toast("Şifren güncellendi ✓"); hesapAyarlari();
  }
  function hesapSilSor() {
    const m = oturum === "misafir";
    modal(`<div class="orta" style="font-size:50px">⚠️</div><h3>${m ? "İlerleme sıfırlansın mı?" : "Hesabın silinsin mi?"}</h3>
      <p class="orta">${m ? "Bütün puanların, rozetlerin ve ayarların silinecek." : "Hesabın ve bütün ilerlemen (puan, rozet, ünvan, istatistik) kalıcı olarak silinecek."} Bu işlem geri alınamaz.</p>
      <div style="display:flex;gap:10px"><button class="mbtn" style="flex:1" onclick="K.hesapAyarlari()">Vazgeç</button><button class="mbtn" style="flex:1;background:#F0524F" onclick="K.hesapSil()">Sil</button></div>`);
  }
  function hesapSil() {
    localStorage.removeItem(veriAnahtar());
    if (oturum !== "misafir") { delete hesaplar[oturum]; yaz("kk_hesaplar", hesaplar); }
    oturum = null; yaz("kk_oturum", null); V = null; kapat(); toast("Silindi."); hosgeldin();
  }

  const METINLER = {
    gizlilik: ["KVKK ve Gizlilik", `<p>Kafa Kafaya, oyun deneyimini sunmak için yalnızca gerekli bilgileri kullanır.</p>
      <h4>Hangi bilgiler tutulur?</h4><p>E-posta adresin, kullanıcı adın, şifrenin tek yönlü şifrelenmiş hâli, seçtiğin avatar ve ünvan, oyun puanların, rozetlerin ve istatistiklerin.</p>
      <h4>Nerede saklanır?</h4><p>Bu sürümde bütün bilgiler yalnızca senin cihazında saklanır, hiçbir sunucuya gönderilmez. Çevrimiçi modlar geldiğinde hangi bilgilerin sunucuda tutulacağı bu metinde ayrıca belirtilecek ve onayın alınacaktır.</p>
      <h4>Kimlerle paylaşılır?</h4><p>Bilgilerin üçüncü kişilerle paylaşılmaz, satılmaz, reklam amacıyla kullanılmaz.</p>
      <h4>Hakların</h4><p>6698 sayılı KVKK kapsamında bilgilerine erişme, düzeltme ve silme hakkına sahipsin. Ayarlar → Hesap Ayarları → Hesabı Sil ile bütün bilgilerini istediğin an silebilirsin.</p>`],
    kosul: ["Kullanım Koşulları", `<p>Kafa Kafaya'yı kullanarak aşağıdaki koşulları kabul etmiş olursun.</p>
      <h4>Adil oyun</h4><p>Hile, otomatik araç veya başka kullanıcıları rahatsız edecek davranışlar yasaktır.</p>
      <h4>Kullanıcı adı</h4><p>Kullanıcı adın küfür, hakaret veya başkasını taklit eden ifadeler içeremez.</p>
      <h4>İçerik</h4><p>Sorular özenle hazırlanır. Hatalı bir soru görürsen Ayarlar → Sorun Bildir ile bize iletebilirsin.</p>
      <h4>Sanal öğeler</h4><p>Altın, can ve yıldızlar yalnızca oyun içinde geçerlidir, gerçek para karşılığı yoktur.</p>`]
  };
  function metin(t) {
    const [b, h] = METINLER[t], ayardan = modalAcik();
    modal(`<h3>${b}</h3><div style="color:#3A3F66">${h}</div><button class="mbtn" onclick="${ayardan ? "K.hesapAyarlari()" : "K.kapat()"}">Tamam</button>`);
  }
  function rozetBilgi(i) { const r = ROZETLER[i]; toast(`${r.e} ${r.ad}: ${r.acik}${V.rozetler.includes(r.id) ? " ✓" : ""}`); }

  function sss() {
    kapat();
    const s = [["Canlar nasıl dolar?", `Her ${KALP_DK} dakikada bir can dolar, en fazla ${MAKS_KALP} can birikir. 100 altınla anında can alabilirsin.`],
      ["Kombo nedir?", `${KOMBO} soruyu üst üste doğru bilirsen kombo başlar. Kombo sürerken her doğru cevap 2 kat yıldız, 2 kat altın ve +4 saniye kazandırır. Yanlış cevap komboyu bitirir.`],
      ["Altın nasıl kazanılır?", "Her doğru cevap 20 altın kazandırır (komboda 40). Her gün ilk girişinde 50 altın hediye alırsın."],
      ["Günlük Soru nedir?", "Her gün herkese aynı 5 soru gelir. Günde bir kez çözebilirsin, sonucunu arkadaşlarınla paylaşabilirsin. Üst üste günler seri oluşturur."],
      ["Ünvanları nasıl açarım?", `Bir kategoride ${UNVAN_ESIK.join(", ")} doğru cevaba ulaştıkça o kategorinin ünvanları açılır.`],
      ["Karşılıklı mod ne zaman gelecek?", "1vs1, özel oda ve 5'li oyun üzerinde çalışıyoruz. Çok yakında!"]];
    goster({ cls: "", icerik: `${ustBaslik("S.S.S.")}<div class="sss">${s.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>` });
  }
  function sorunBildir() {
    modal(`<h3>Sorun Bildir</h3><p class="orta" style="color:#6B7199">Hatalı bir soru, takılan bir ekran ya da önerin mi var? Yaz, GitHub üzerinden bize ulaşsın.</p>
      <textarea class="alan" id="sb" rows="6" maxlength="500" placeholder="Yaşadığın sorunu açıkla…" style="resize:none"></textarea>
      <button class="mbtn" onclick="K.sorunGonder()">Gönder</button><button class="mbtn" style="background:#C9CDE3;color:#141B47" onclick="K.ayarlar()">Geri</button>`);
  }
  function sorunGonder() {
    const t = $("#sb").value.trim(); if (t.length < 5) return toast("Biraz daha ayrıntı yazar mısın?");
    disAc(`${SORUN_ADRES}?title=${encodeURIComponent("Sorun bildirimi: " + t.slice(0, 50))}&body=${encodeURIComponent(t + `\n\n— Sürüm ${SURUM}`)}`);
    kapat(); toast("Teşekkürler! 🙏");
  }

  /* ---------- istatistik ---------- */
  let istSekme = "genel";
  function istatistik(sekme) {
    kapat(); istSekme = sekme || "genel";
    const top = V.dogru + V.yanlis, oran = top ? Math.round(V.dogru / top * 100) : 0;
    const ort = V.cevapSayi ? V.cevapMs / V.cevapSayi / 1000 : 0;
    const hiz = !V.cevapSayi ? ["—", "❔"] : ort < 3.5 ? ["Hızlı", "🐇"] : ort < 6.5 ? ["Orta", "🐢🐇"] : ["Yavaş", "🐢"];
    let govde;
    if (istSekme === "genel") {
      govde = top ? `<div class="pasta" style="background:conic-gradient(#5BD16B 0 ${oran}%,#F0524F ${oran}% 100%)"></div>
        <p class="orta" style="margin-bottom:14px"><b style="color:#5BD16B">● Doğru %${oran}</b> &nbsp; <b style="color:#F0524F">● Yanlış %${100 - oran}</b></p>
        <div class="isat"><div><b>${sayi(V.oyun)}</b><small>Oyun</small></div><div><b>${sayi(V.dogru)}</b><small>Doğru</small></div>
        <div><b>${sayi(V.yanlis)}</b><small>Yanlış</small></div><div><b>${hiz[1]}</b><small>Cevap hızı: ${hiz[0]}${V.cevapSayi ? ` (${ort.toFixed(1)} sn)` : ""}</small></div>
        <div><b>${V.rozetler.length}</b><small>Rozet</small></div><div><b>🔥 ${V.gunlukSeri}</b><small>Günlük seri</small></div></div>` : `<p class="bos">Henüz oyun oynamadın.<br>İlk oyununu oyna, istatistiklerin burada görünsün!</p>`;
    } else {
      const l = KATLAR.filter(k => V.kat[k.id] && (V.kat[k.id].dogru + V.kat[k.id].yanlis));
      govde = l.length ? `<div class="bilgi-kutu">${l.map(k => { const v = V.kat[k.id], o = Math.round(v.dogru / (v.dogru + v.yanlis) * 100); return `<div class="kbar"><span style="width:118px">${k.ikon} ${k.ad}</span><div class="bar"><div style="width:${o}%;background:${k.renk}"></div></div><span>%${o}</span></div>`; }).join("")}</div>`
        : `<p class="bos">Henüz bir kategoride oynamadın.</p>`;
    }
    goster({ cls: "", icerik: `${ustBaslik("İstatistik")}<div class="sekmeler"><button class="${istSekme === "genel" ? "on" : ""}" onclick="K.istatistik('genel')">Genel</button><button class="${istSekme === "kat" ? "on" : ""}" onclick="K.istatistik('kat')">Kategoriler</button></div>${govde}` });
  }

  /* ---------- sıralama ---------- */
  let sirSekme = "genel", sirDonem = "gun";
  function siralama(s, d) {
    kapat(); sirSekme = s || sirSekme; sirDonem = d || sirDonem;
    const puan = () => {
      if (sirDonem === "tum") return V.xp;
      const gunler = sirDonem === "gun" ? 1 : 7; let t = 0;
      for (let i = 0; i < gunler; i++) { const x = new Date(); x.setDate(x.getDate() - i); t += V.puanGun[bugun(x)] || 0; }
      return t;
    };
    let govde;
    if (sirSekme === "genel") {
      govde = `<div class="sekmeler" style="background:transparent"><button class="${sirDonem === "gun" ? "on" : ""}" onclick="K.siralama(0,'gun')">Günlük</button><button class="${sirDonem === "hafta" ? "on" : ""}" onclick="K.siralama(0,'hafta')">Haftalık</button><button class="${sirDonem === "tum" ? "on" : ""}" onclick="K.siralama(0,'tum')">Tümü</button></div>
        <div class="kursu">${avatar(V.avatar, 110)}</div>
        <div class="liderler"><div class="lsatir ben"><span>1</span>${avatar(V.avatar, 40)}<span class="ls-ad">${esc(V.ad)}</span><span>${sayi(puan())}</span></div></div>
        <p class="bos">🌐 Çevrimiçi sıralama, karşılıklı modlarla birlikte açılacak.<br>O zamana kadar kendi rekorlarını kır!</p>`;
    } else {
      const l = KATLAR.filter(k => V.kat[k.id]?.rekor).sort((a, b) => V.kat[b.id].rekor - V.kat[a.id].rekor);
      govde = l.length ? `<div class="liderler" style="margin-top:8px">${l.map(k => `<div class="lsatir"><span style="font-size:24px">${k.ikon}</span><span class="ls-ad">${k.ad}</span><span>🏅 ${V.kat[k.id].rekor}</span></div>`).join("")}</div><p class="not" style="margin-top:12px">Her kategoride tek turda en çok bildiğin soru sayısı.</p>`
        : `<p class="bos">Henüz kategori rekorun yok. Bir kategoride oyna, rekorun burada görünsün!</p>`;
    }
    goster({ cls: "", icerik: `${ustBaslik("Sıralama")}<div class="sekmeler"><button class="${sirSekme === "genel" ? "on" : ""}" onclick="K.siralama('genel')">Genel</button><button class="${sirSekme === "kat" ? "on" : ""}" onclick="K.siralama('kat')">Kategoriler</button></div>${govde}` });
  }

  function yakinda(n) { toast(`${n} çok yakında geliyor! 🚀`); }

  /* ---------- dışa açılan fonksiyonlar ---------- */
  window.K = { ana, hosgeldin, kayit, kayitOl, giris, girisYap, misafir, modlar, kategoriler, basla, cevap, joker, cikisSor, devam, bitir, gunluk, paylas,
    profil, avSec, unvSec, pSekme, profilKaydet, ayarlar, ayarDegis, cikis, cikisYap, hesapAyarlari, hesapBilgi, sifreDegis, hesapSilSor, hesapSil,
    metin, rozetBilgi, sss, sorunBildir, sorunGonder, istatistik, siralama, kalpBilgi, kalpAl, yakinda, kapat, toast };

  /* ---------- Android geri tuşu ---------- */
  function geriTusu() {
    if (document.querySelector(".ogretici")) return;
    if (modalAcik()) { if (O) devam(); else kapat(); return; }
    if (geriHedef) { new Function(geriHedef)(); return; }
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (V && app.querySelector(".anabtn")) { if (P && P.App) P.App.exitApp(); return; }
    if (V) ana(); else hosgeldin();
  }
  document.addEventListener("DOMContentLoaded", () => {
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (P && P.App) P.App.addListener("backButton", geriTusu);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && O && !O.durdu && !modalAcik()) cikisSor(); });

  acilis();
})();
