package com.mitturkey.asistan;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Metni Gemini'nin yapay zekâ sesiyle sese çevirir (24 kHz, mono, 16 bit PCM). */
public class GeminiSes {
    public static final int RATE = 24000;
    private static volatile AudioTrack calan;
    private static int sonRate = RATE;
    /** Kota dolunca bir süre hiç denemeyelim, görüşme beklemesin. */
    private static volatile long kotaDoluKadar = 0;

    /** Sabit cümleler: bir kere üretilip saklanır. */
    public static final String[] SABIT = {
            "Sizi duyamadım, tekrar söyler misiniz?",
            "Sizi duyamıyorum. Daha sonra tekrar arayabilirsiniz. Hoşça kalın.",
            "Notunuzu aldım. Hoşça kalın.",
            "Bir sorun oluştu, kusura bakmayın. Hoşça kalın.",
            "Görüşme süresi doldu, notunuzu ilettim. Hoşça kalın."};

    /** Açılış ve sabit cümleleri arka planda önceden hazırlar. */
    public static void onceHazirla(Context ctx, Ayar ayar) {
        if (!ayar.geminiSes() || ayar.apiKey().isEmpty()) return;
        new Thread(() -> {
            al(ctx, ayar, ayar.selam());
            for (String s : SABIT) { if (System.currentTimeMillis() < kotaDoluKadar) return; al(ctx, ayar, s); }
        }).start();
    }

    /** PCM ses döner, hata olursa null. Aynı cümleyi bir daha istemesin diye önbelleğe kaydeder. */
    public static byte[] al(Context ctx, Ayar ayar, String metin) {
        if (ayar.apiKey().isEmpty()) return null;
        String model = ayar.sesModel(), ses = ayar.sesAdi();
        File dosya = new File(ctx.getCacheDir(), "ses_" + Integer.toHexString((model + "|" + ses + "|" + metin).hashCode()) + ".pcm");
        if (dosya.exists() && dosya.length() > 1000) {
            try (FileInputStream in = new FileInputStream(dosya)) { sonRate = RATE; return oku(in); } catch (Exception ignored) {}
        }
        if (System.currentTimeMillis() < kotaDoluKadar) return null;
        try {
            JSONObject voiceConfig = ses.startsWith("voice")   // kopyalanmış/özel ses kimliği (voice_... / voicekey_...)
                    ? new JSONObject().put("voice", ses)
                    : new JSONObject().put("prebuiltVoiceConfig", new JSONObject().put("voiceName", ses));
            String istem = "Bunu doğal, sıcak ve samimi bir Türkçe telefon konuşması tonunda, net ve normal hızda söyle: " + metin;
            JSONObject body = new JSONObject()
                    .put("contents", new JSONArray().put(new JSONObject().put("role", "user")
                            .put("parts", new JSONArray().put(new JSONObject().put("text", istem)))))
                    .put("generationConfig", new JSONObject()
                            .put("responseModalities", new JSONArray().put("AUDIO"))
                            .put("speechConfig", new JSONObject().put("voiceConfig", voiceConfig)));

            HttpURLConnection con = (HttpURLConnection) new URL(
                    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent").openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(10000);
            con.setReadTimeout(40000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("x-goog-api-key", ayar.apiKey());
            try (OutputStream os = con.getOutputStream()) { os.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = con.getResponseCode();
            String resp = new String(oku(code < 400 ? con.getInputStream() : con.getErrorStream()), StandardCharsets.UTF_8);
            if (code == 429) {
                kotaDoluKadar = System.currentTimeMillis() + 15 * 60 * 1000L;
                Log2.add(ctx, "Gemini ses kotası doldu, 15 dk telefonun sesi kullanılacak.");
                return null;
            }
            if (code >= 400) {
                Log2.add(ctx, "Gemini ses hatası " + code + ": " + (resp.length() > 250 ? resp.substring(0, 250) : resp));
                return null;
            }
            JSONArray parts = new JSONObject(resp).getJSONArray("candidates").getJSONObject(0)
                    .getJSONObject("content").getJSONArray("parts");
            for (int i = 0; i < parts.length(); i++) {
                JSONObject pt = parts.getJSONObject(i);
                JSONObject inl = pt.optJSONObject("inlineData");
                if (inl == null) inl = pt.optJSONObject("inline_data");
                if (inl == null) continue;
                String mime = inl.optString("mimeType", inl.optString("mime_type", ""));
                byte[] ham = Base64.decode(inl.getString("data"), Base64.DEFAULT);
                int rate = RATE;
                int ri = mime.indexOf("rate=");
                if (ri >= 0) try { rate = Integer.parseInt(mime.substring(ri + 5).replaceAll("[^0-9].*$", "")); } catch (Exception ignored) {}
                byte[] pcm = wavIseAyikla(ham);
                if (pcm != ham) rate = wavRate(ham, rate);
                sonRate = rate;
                if (rate == RATE) try (FileOutputStream fo = new FileOutputStream(dosya)) { fo.write(pcm); } catch (Exception ignored) {}
                return pcm;
            }
            Log2.add(ctx, "Gemini ses cevabında ses yok.");
        } catch (Exception e) {
            Log2.add(ctx, "Gemini ses bağlantı hatası: " + e.getMessage());
        }
        return null;
    }

    /** Sesi çalar ve bitene kadar bekler. */
    public static void cal(byte[] pcm, int usage) {
        int rate = sonRate;
        int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioTrack at = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(usage)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(rate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setBufferSizeInBytes(Math.max(min, rate))
                .setTransferMode(AudioTrack.MODE_STREAM).build();
        calan = at;
        try {
            at.play();
            int off = 0;
            while (off < pcm.length && calan == at) {
                int n = at.write(pcm, off, Math.min(4096, pcm.length - off));
                if (n <= 0) break;
                off += n;
            }
            // tamponda kalan sesin bitmesini bekle
            long kalanMs = 1000L * (pcm.length / 2) / rate;
            long bitis = System.currentTimeMillis() + Math.min(kalanMs, 3000) + 200;
            while (calan == at && at.getPlaybackHeadPosition() < pcm.length / 2 && System.currentTimeMillis() < bitis) {
                try { Thread.sleep(50); } catch (InterruptedException e) { break; }
            }
        } catch (Exception ignored) {
        } finally {
            try { at.stop(); } catch (Exception ignored) {}
            at.release();
            if (calan == at) calan = null;
        }
    }

    public static void durdur() {
        AudioTrack at = calan;
        calan = null;
        if (at != null) try { at.pause(); at.flush(); } catch (Exception ignored) {}
    }

    private static byte[] wavIseAyikla(byte[] b) {
        if (b.length < 44 || b[0] != 'R' || b[1] != 'I' || b[2] != 'F' || b[3] != 'F') return b;
        int i = 12;
        while (i + 8 <= b.length) {
            int len = (b[i + 4] & 0xff) | (b[i + 5] & 0xff) << 8 | (b[i + 6] & 0xff) << 16 | (b[i + 7] & 0xff) << 24;
            if (b[i] == 'd' && b[i + 1] == 'a' && b[i + 2] == 't' && b[i + 3] == 'a') {
                int bas = i + 8, son = Math.min(b.length, bas + Math.max(0, len));
                byte[] r = new byte[son - bas];
                System.arraycopy(b, bas, r, 0, r.length);
                return r;
            }
            i += 8 + Math.max(0, len);
        }
        byte[] r = new byte[b.length - 44];
        System.arraycopy(b, 44, r, 0, r.length);
        return r;
    }

    private static int wavRate(byte[] b, int def) {
        if (b.length < 28) return def;
        int r = (b[24] & 0xff) | (b[25] & 0xff) << 8 | (b[26] & 0xff) << 16 | (b[27] & 0xff) << 24;
        return r > 4000 && r < 100000 ? r : def;
    }

    private static byte[] oku(InputStream is) throws Exception {
        if (is == null) return new byte[0];
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[8192]; int n;
        while ((n = is.read(b)) > 0) o.write(b, 0, n);
        is.close();
        return o.toByteArray();
    }
}
