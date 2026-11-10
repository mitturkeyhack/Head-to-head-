package com.mitturkey.asistan;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity implements Log2.Listener {
    private EditText key, model, ad, selam, bilgi, bekle;
    private Spinner ses, motor;
    private EditText sesAdi, sesModel;
    private Button acKapa, erisimB;
    private TextView log;
    private ProgressBar seviye;
    private Ayar ayar;

    private static final String[] IZINLER = {
            Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS,
            Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS};

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        ayar = new Ayar(this);
        int pad = dp(14);

        LinearLayout k = new LinearLayout(this);
        k.setOrientation(LinearLayout.VERTICAL);
        k.setPadding(pad, dp(28), pad, pad);

        TextView baslik = new TextView(this);
        baslik.setText("🤖 Sesli Asistan");
        baslik.setTextSize(24); baslik.setTypeface(null, Typeface.BOLD);
        k.addView(baslik);
        k.addView(yazi("Sen açmazsan aramayı açar, hoparlörden yapay zekâ konuşur ve not alır."));

        acKapa = new Button(this);
        acKapa.setTextSize(18);
        acKapa.setOnClickListener(v -> acKapaTikla());
        k.addView(acKapa);

        erisimB = new Button(this);
        erisimB.setOnClickListener(v -> {
            Toast.makeText(this, "Listede 'Sesli Asistan mikrofonu'nu bul ve aç", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        });
        k.addView(erisimB);
        k.addView(yazi("Açamıyorsan: Ayarlar > Uygulamalar > Sesli Asistan > sağ üst ⋮ > 'Kısıtlı ayarlara izin ver', sonra tekrar dene."));

        Button test = new Button(this);
        test.setText("🧪 Arama olmadan test et");
        test.setOnClickListener(v -> { kaydet(); if (izinVar()) baslat(true); });
        k.addView(test);

        k.addView(etiket("Mikrofon seviyesi (aramada hareket etmiyorsa mikrofon kapalıdır)"));
        seviye = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        seviye.setMax(3000);
        k.addView(seviye);

        k.addView(etiket("Gemini API anahtarı (ücretsiz: aistudio.google.com)"));
        key = alan(ayar.apiKey(), false);
        key.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        k.addView(key);

        k.addView(etiket("Adın (asistan seni böyle anar)"));
        ad = alan(ayar.ad(), false); k.addView(ad);

        k.addView(etiket("Kaç saniye çaldıktan sonra açsın"));
        bekle = alan(String.valueOf(ayar.bekle()), false);
        bekle.setInputType(InputType.TYPE_CLASS_NUMBER); k.addView(bekle);

        k.addView(etiket("Açılış cümlesi"));
        selam = alan(ayar.selam(), true); k.addView(selam);

        k.addView(etiket("Asistanın bilmesi gerekenler (ör. tereyağı fiyatı, ne zaman müsait olduğun)"));
        bilgi = alan(ayar.bilgi(), true); k.addView(bilgi);

        k.addView(etiket("Asistanın sesi"));
        motor = new Spinner(this);
        motor.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{"Gemini yapay zekâ sesi (doğal)", "Telefonun kendi sesi"}));
        motor.setSelection(ayar.geminiSes() ? 0 : 1);
        k.addView(motor);
        k.addView(etiket("Gemini ses adı"));
        k.addView(yazi("Erkek: Charon, Puck, Orus, Fenrir, Iapetus  •  Kadın: Kore, Aoede, Leda, Sulafat"));
        sesAdi = alan(ayar.sesAdi(), false); k.addView(sesAdi);
        Button dene = new Button(this);
        dene.setText("🔈 Sesi dene");
        dene.setOnClickListener(v -> sesiDene());
        k.addView(dene);

        k.addView(etiket("Asistan sesi hangi kanaldan çıksın (karşı taraf duymazsa değiştir)"));
        ses = new Spinner(this);
        ses.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{"Medya", "Alarm", "Arama sesi"}));
        ses.setSelection(ayar.sesTuru());
        k.addView(ses);

        k.addView(etiket("Gemini modeli (genelde değiştirme)"));
        model = alan(ayar.model(), false); k.addView(model);
        k.addView(etiket("Gemini ses modeli (genelde değiştirme)"));
        sesModel = alan(ayar.sesModel(), false); k.addView(sesModel);

        Button kaydetB = new Button(this);
        kaydetB.setText("💾 Ayarları kaydet");
        kaydetB.setOnClickListener(v -> { kaydet(); Toast.makeText(this, "Kaydedildi", Toast.LENGTH_SHORT).show(); });
        k.addView(kaydetB);

        Button pil = new Button(this);
        pil.setText("🔋 Pil kısıtlamasını kaldır (önemli)");
        pil.setOnClickListener(v -> pilAyari());
        k.addView(pil);

        LinearLayout satir = new LinearLayout(this);
        TextView lb = etiket("Kayıtlar");
        satir.addView(lb, new LinearLayout.LayoutParams(0, -2, 1));
        Button temizle = new Button(this);
        temizle.setText("Temizle");
        temizle.setOnClickListener(v -> Log2.clear(this));
        satir.addView(temizle);
        k.addView(satir);

        log = new TextView(this);
        log.setTextIsSelectable(true);
        log.setTypeface(Typeface.MONOSPACE);
        log.setTextSize(12);
        log.setBackgroundColor(Color.rgb(240, 240, 240));
        log.setPadding(dp(8), dp(8), dp(8), dp(8));
        k.addView(log);

        ScrollView sv = new ScrollView(this);
        sv.addView(k);
        setContentView(sv);
    }

    @Override protected void onResume() {
        super.onResume();
        Log2.setListener(this);
        onLog(Log2.get(this));
        guncelle();
    }

    @Override protected void onPause() { super.onPause(); Log2.setListener(null); }

    @Override public void onLog(String all) {
        String[] satirlar = all.split("\n");
        StringBuilder sb = new StringBuilder();
        for (int i = satirlar.length - 1; i >= 0 && i >= satirlar.length - 80; i--) sb.append(satirlar[i]).append('\n');
        log.setText(sb.length() == 0 ? "(henüz kayıt yok)" : sb.toString());
        guncelle();
    }

    @Override public void onLevel(int lv) { seviye.setProgress(Math.min(lv, 3000)); }

    private void acKapaTikla() {
        kaydet();
        if (AssistantService.calisiyor()) {
            stopService(new Intent(this, AssistantService.class));
            ayar.setAcik(false);
        } else {
            if (!izinVar()) return;
            if (ayar.apiKey().isEmpty()) { Toast.makeText(this, "Önce Gemini API anahtarını gir", Toast.LENGTH_LONG).show(); return; }
            baslat(false);
            ayar.setAcik(true);
        }
        acKapa.postDelayed(this::guncelle, 400);
    }

    private void baslat(boolean test) {
        Intent i = new Intent(this, AssistantService.class);
        if (test) i.putExtra(AssistantService.TEST, true);
        startForegroundService(i);
    }

    private void guncelle() {
        boolean c = AssistantService.calisiyor();
        acKapa.setText(c ? "⛔ Asistanı KAPAT" : "▶️ Asistanı AÇ");
        acKapa.setBackgroundColor(c ? Color.rgb(198, 40, 40) : Color.rgb(46, 125, 50));
        acKapa.setTextColor(Color.WHITE);
        String en = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        boolean e = Erisim.acik() || (en != null && en.contains(getPackageName()));
        erisimB.setText(e ? "♿ Aramada mikrofon izni: AÇIK ✅" : "♿ Aramada mikrofon izni: KAPALI ❌ (aç)");
    }

    private boolean izinVar() {
        List<String> eksik = new ArrayList<>();
        for (String p : IZINLER) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) eksik.add(p);
        if (eksik.isEmpty()) return true;
        requestPermissions(eksik.toArray(new String[0]), 5);
        Toast.makeText(this, "İzinleri verip tekrar bas", Toast.LENGTH_LONG).show();
        return false;
    }

    private void pilAyari() {
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm.isIgnoringBatteryOptimizations(getPackageName())) {
            Toast.makeText(this, "Zaten kısıtlamasız ✅", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
    }

    private void kaydet() {
        int sn;
        try { sn = Math.max(0, Math.min(60, Integer.parseInt(bekle.getText().toString().trim()))); } catch (Exception e) { sn = 10; }
        String m = model.getText().toString().trim();
        ayar.kaydet(key.getText().toString().trim(), m.isEmpty() ? "gemini-3.5-flash" : m,
                ad.getText().toString(), selam.getText().toString(), bilgi.getText().toString(),
                sn, ses.getSelectedItemPosition());
        ayar.sesKaydet(motor.getSelectedItemPosition() == 0, sesAdi.getText().toString().trim(),
                sesModel.getText().toString().trim());
    }

    private void sesiDene() {
        kaydet();
        if (ayar.apiKey().isEmpty()) { Toast.makeText(this, "Önce Gemini API anahtarını gir", Toast.LENGTH_LONG).show(); return; }
        Toast.makeText(this, "Ses hazırlanıyor...", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            String metin = "Merhaba, ben yapay zekâ asistanıyım. Size nasıl yardımcı olabilirim?";
            byte[] pcm = GeminiSes.al(this, ayar, metin);
            if (pcm == null) { runOnUiThread(() -> Toast.makeText(this, "Ses alınamadı, kayıtlara bak", Toast.LENGTH_LONG).show()); return; }
            GeminiSes.cal(pcm, android.media.AudioAttributes.USAGE_MEDIA);
        }).start();
    }

    private TextView etiket(String s) {
        TextView t = new TextView(this);
        t.setText(s); t.setTypeface(null, Typeface.BOLD);
        t.setPadding(0, dp(12), 0, dp(2));
        return t;
    }
    private TextView yazi(String s) { TextView t = new TextView(this); t.setText(s); t.setPadding(0, dp(4), 0, dp(10)); return t; }
    private EditText alan(String deger, boolean cokSatir) {
        EditText e = new EditText(this);
        e.setText(deger);
        if (cokSatir) { e.setMinLines(2); e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); }
        else e.setSingleLine(true);
        return e;
    }
    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }
}
