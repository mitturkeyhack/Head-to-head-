package com.mitturkey.asistan;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Bir konuşmayı yürütür: selam ver -> dinle -> Gemini'ye gönder -> cevabı seslendir -> tekrar.
 * Ayrı bir thread'de çalışır.
 */
public class Sohbet {
    public interface Bitti { void bitti(boolean kapat, String ozet); }

    private static final int RATE = 16000;
    private static final int MAX_TUR = 10;
    private static final long MAX_SURE_MS = 4 * 60 * 1000;

    private final Context ctx;
    private final Ayar ayar;
    private volatile boolean dur = false;
    private TextToSpeech tts;
    private int usage = AudioAttributes.USAGE_MEDIA;
    private final JSONArray gecmis = new JSONArray();
    private String ozet = "";

    public Sohbet(Context c) { ctx = c.getApplicationContext(); ayar = new Ayar(c); }

    public void durdur() {
        dur = true;
        GeminiSes.durdur();
        try { if (tts != null) tts.stop(); } catch (Exception ignored) {}
    }

    public void baslat(Bitti cb) {
        new Thread(() -> {
            boolean kapat = false;
            try { kapat = calis(); }
            catch (Exception e) { Log2.add(ctx, "HATA: " + e); }
            finally {
                try { if (tts != null) tts.shutdown(); } catch (Exception ignored) {}
                cb.bitti(kapat, ozet);
            }
        }, "sohbet").start();
    }

    private boolean calis() throws Exception {
        if (!ttsHazirla()) { Log2.add(ctx, "Türkçe ses motoru açılamadı."); return false; }
        long basla = System.currentTimeMillis();

        konus(ayar.selam());
        gecmisEkle("model", ayar.selam());

        int sessiz = 0;
        for (int tur = 0; tur < MAX_TUR && !dur; tur++) {
            if (System.currentTimeMillis() - basla > MAX_SURE_MS) { konus("Görüşme süresi doldu, notunuzu ilettim. Hoşça kalın."); return true; }
            Log2.add(ctx, "🎤 Dinliyorum...");
            byte[] pcm = dinle();
            if (dur) return false;
            if (pcm == null) {
                sessiz++;
                Log2.add(ctx, "(ses gelmedi)");
                if (sessiz >= 2) { konus("Sizi duyamıyorum. Daha sonra tekrar arayabilirsiniz. Hoşça kalın."); return true; }
                konus("Sizi duyamadım, tekrar söyler misiniz?");
                continue;
            }
            sessiz = 0;
            Log2.add(ctx, "⏳ Düşünüyorum...");
            JSONObject c = gemini(wav(pcm));
            if (dur) return false;
            if (c == null) { konus("Bir sorun oluştu, kusura bakmayın. Hoşça kalın."); return true; }

            String duydu = c.optString("duydugum", "");
            String cevap = c.optString("cevap", "");
            ozet = c.optString("ozet", ozet);
            boolean bitir = c.optBoolean("bitir", false);
            Log2.add(ctx, "👤 Arayan: " + duydu);
            Log2.add(ctx, "🤖 Asistan: " + cevap);
            gecmisEkle("user", "(Arayanın söylediği) " + duydu);
            gecmisEkle("model", cevap);
            if (!cevap.isEmpty()) konus(cevap);
            if (bitir) return true;
        }
        if (!dur) { konus("Notunuzu aldım. Hoşça kalın."); return true; }
        return false;
    }

    // ---------------- Ses çıkışı (TTS) ----------------

    private boolean ttsHazirla() throws InterruptedException {
        CountDownLatch l = new CountDownLatch(1);
        final int[] durum = {TextToSpeech.ERROR};
        tts = new TextToSpeech(ctx, s -> { durum[0] = s; l.countDown(); });
        l.await(8, TimeUnit.SECONDS);
        if (durum[0] != TextToSpeech.SUCCESS) return false;
        int r = tts.setLanguage(new Locale("tr", "TR"));
        if (r < 0) Log2.add(ctx, "Uyarı: Türkçe ses paketi eksik olabilir (Ayarlar > Metin okuma).");
        int tur = ayar.hoparlorModu() == 1 ? 1 : ayar.sesTuru();
        switch (tur) {
            case 1: usage = AudioAttributes.USAGE_ALARM; break;
            case 2: usage = AudioAttributes.USAGE_VOICE_COMMUNICATION; break;
            default: usage = AudioAttributes.USAGE_MEDIA;
        }
        tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(usage)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        tts.setSpeechRate(1.0f);
        sesiAc();
        return true;
    }

    private void sesiAc() {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        int[] st = {AudioManager.STREAM_MUSIC, AudioManager.STREAM_ALARM, AudioManager.STREAM_VOICE_CALL};
        for (int s : st) {
            try { am.setStreamVolume(s, am.getStreamMaxVolume(s), 0); } catch (Exception ignored) {}
        }
    }

    /** Önce Gemini sesiyle dener, olmazsa telefonun sesiyle söyler. */
    private void konus(String metin) throws InterruptedException {
        if (dur || metin == null || metin.isEmpty()) return;
        if (ayar.geminiSes()) {
            byte[] pcm = GeminiSes.al(ctx, ayar, metin);
            if (pcm != null && !dur) { GeminiSes.cal(pcm, usage); Thread.sleep(250); return; }
            if (dur) return;
        }
        telefonKonus(metin);
    }

    private void telefonKonus(String metin) throws InterruptedException {
        CountDownLatch l = new CountDownLatch(1);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { l.countDown(); }
            @Override public void onError(String id) { l.countDown(); }
        });
        Bundle b = new Bundle();
        b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
        tts.speak(metin, TextToSpeech.QUEUE_FLUSH, b, "u" + System.nanoTime());
        l.await(40, TimeUnit.SECONDS);
        Thread.sleep(250); // hoparlör yankısı sönsün
    }

    // ---------------- Dinleme ----------------

    /** Konuşma başlayınca kaydeder, 1.3 sn sessizlikte durur. Hiç konuşma yoksa null döner. */
    @SuppressLint("MissingPermission")
    private byte[] dinle() {
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioRecord rec = null;
        int[] kaynaklar = {MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC};
        for (int k : kaynaklar) {
            try {
                rec = new AudioRecord(k, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, RATE));
                if (rec.getState() == AudioRecord.STATE_INITIALIZED) break;
                rec.release(); rec = null;
            } catch (Exception e) { rec = null; }
        }
        if (rec == null) { Log2.add(ctx, "Mikrofon açılamadı!"); return null; }
        if (!Erisim.acik()) Log2.add(ctx, "⚠️ Erişilebilirlik hizmeti kapalı: aramada mikrofon sessiz kalabilir.");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        short[] buf = new short[RATE / 10]; // 100 ms
        byte[] bb = new byte[buf.length * 2];
        double taban = 0; int tabanSay = 0;
        boolean konusuyor = false;
        int sessizMs = 0, toplamMs = 0, enYuksek = 0;
        try {
            rec.startRecording();
            while (!dur) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                double sum = 0;
                for (int i = 0; i < n; i++) sum += (double) buf[i] * buf[i];
                int rms = (int) Math.sqrt(sum / n);
                enYuksek = Math.max(enYuksek, rms);
                Log2.level(rms);
                toplamMs += 100;

                if (tabanSay < 3) { taban += rms; tabanSay++; if (tabanSay == 3) taban /= 3; continue; }
                double esik = Math.max(300, Math.min(taban, 1200) * 2.0);

                if (rms > esik) { konusuyor = true; sessizMs = 0; }
                else if (konusuyor) sessizMs += 100;

                if (konusuyor) {
                    for (int i = 0; i < n; i++) { bb[2 * i] = (byte) buf[i]; bb[2 * i + 1] = (byte) (buf[i] >> 8); }
                    out.write(bb, 0, n * 2);
                }
                if (konusuyor && sessizMs >= 1300) break;
                if (out.size() > RATE * 2 * 15) break;          // en fazla 15 sn
                if (!konusuyor && toplamMs > 8000) break;        // 8 sn hiç ses yok
            }
        } finally {
            try { rec.stop(); } catch (Exception ignored) {}
            rec.release();
        }
        Log2.add(ctx, "Mikrofon en yüksek seviye: " + enYuksek + (enYuksek < 60 ? "  ⚠️ (mikrofon kapalı olabilir)" : ""));
        if (!konusuyor || out.size() < RATE * 2 * 3 / 10) return null; // 0.3 sn'den kısa
        return out.toByteArray();
    }

    private static byte[] wav(byte[] pcm) {
        int len = pcm.length;
        byte[] h = new byte[44];
        System.arraycopy("RIFF".getBytes(), 0, h, 0, 4);
        le32(h, 4, 36 + len);
        System.arraycopy("WAVEfmt ".getBytes(), 0, h, 8, 8);
        le32(h, 16, 16); le16(h, 20, 1); le16(h, 22, 1);
        le32(h, 24, RATE); le32(h, 28, RATE * 2); le16(h, 32, 2); le16(h, 34, 16);
        System.arraycopy("data".getBytes(), 0, h, 36, 4);
        le32(h, 40, len);
        byte[] r = new byte[44 + len];
        System.arraycopy(h, 0, r, 0, 44);
        System.arraycopy(pcm, 0, r, 44, len);
        return r;
    }
    private static void le32(byte[] b, int o, int v) { for (int i = 0; i < 4; i++) b[o + i] = (byte) (v >> (8 * i)); }
    private static void le16(byte[] b, int o, int v) { b[o] = (byte) v; b[o + 1] = (byte) (v >> 8); }

    // ---------------- Gemini ----------------

    private void gecmisEkle(String rol, String metin) {
        try {
            gecmis.put(new JSONObject().put("role", rol)
                    .put("parts", new JSONArray().put(new JSONObject().put("text", metin))));
        } catch (Exception ignored) {}
    }

    private String sistem() {
        String ad = ayar.ad().isEmpty() ? "telefon sahibi" : ayar.ad();
        return "Sen " + ad + " adlı kişinin telefon asistanısın ve bir yapay zekâsın. " +
                "Şu an bir telefon görüşmesindesin; senin sesin hoparlörden çıkıyor, arayanın sesi mikrofondan sana ses kaydı olarak geliyor. " +
                "Selamlamayı zaten yaptın ve yapay zekâ olduğunu söyledin. " +
                "Görevin: arayanın kim olduğunu ve ne istediğini kibarca öğrenmek, not almak, gerekirse aşağıdaki bilgilerle cevap vermek. " +
                "Her cevabın çok kısa olsun (en fazla 2 cümle), sade ve samimi Türkçe konuş, emoji ve özel işaret kullanma. " +
                "Bilmediğin şeyleri uydurma; '" + ad + "'a iletirim' de. Söz verme, randevu kesinleştirme, para işi onaylama. " +
                "Arayan vedalaşırsa ya da not alınacak her şey alındıysa kısa bir vedayla bitir=true yap. " +
                "Ses anlaşılmıyorsa tekrar etmesini iste.\n\n" +
                "Sahibinin verdiği ek bilgiler: " + (ayar.bilgi().isEmpty() ? "(yok)" : ayar.bilgi()) + "\n\n" +
                "SADECE şu JSON ile cevap ver: {\"duydugum\": \"arayanın son söylediğinin yazıya dökümü\", " +
                "\"cevap\": \"seslendirilecek cevabın\", \"bitir\": true/false, " +
                "\"ozet\": \"şu ana kadarki görüşmenin sahibine gidecek tek cümlelik notu (kim aradı, ne istedi)\"}";
    }

    private JSONObject gemini(byte[] wav) {
        if (ayar.apiKey().isEmpty()) { Log2.add(ctx, "Gemini API anahtarı girilmemiş!"); return null; }
        try {
            JSONArray contents = new JSONArray(gecmis.toString());
            contents.put(new JSONObject().put("role", "user").put("parts", new JSONArray()
                    .put(new JSONObject().put("text", "Arayanın yeni söylediği ses kaydı:"))
                    .put(new JSONObject().put("inline_data", new JSONObject()
                            .put("mime_type", "audio/wav")
                            .put("data", Base64.encodeToString(wav, Base64.NO_WRAP))))));
            JSONObject body = new JSONObject()
                    .put("system_instruction", new JSONObject().put("parts",
                            new JSONArray().put(new JSONObject().put("text", sistem()))))
                    .put("contents", contents)
                    .put("generationConfig", new JSONObject()
                            .put("responseMimeType", "application/json")
                            .put("temperature", 0.5));

            URL url = new URL("https://generativelanguage.googleapis.com/v1beta/models/" + ayar.model() + ":generateContent");
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(10000);
            con.setReadTimeout(30000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("x-goog-api-key", ayar.apiKey());
            try (OutputStream os = con.getOutputStream()) { os.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = con.getResponseCode();
            InputStream is = code < 400 ? con.getInputStream() : con.getErrorStream();
            String resp = oku(is);
            if (code >= 400) { Log2.add(ctx, "Gemini hata " + code + ": " + kisalt(resp)); return null; }

            String txt = new JSONObject(resp).getJSONArray("candidates").getJSONObject(0)
                    .getJSONObject("content").getJSONArray("parts").getJSONObject(0).getString("text");
            txt = txt.trim();
            if (txt.startsWith("```")) txt = txt.replaceAll("^```(json)?", "").replaceAll("```$", "").trim();
            return new JSONObject(txt);
        } catch (Exception e) {
            Log2.add(ctx, "Gemini bağlantı hatası: " + e.getMessage());
            return null;
        }
    }

    private static String oku(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[4096]; int n;
        while ((n = is.read(b)) > 0) o.write(b, 0, n);
        return o.toString("UTF-8");
    }
    private static String kisalt(String s) { return s.length() > 300 ? s.substring(0, 300) + "..." : s; }
}
