package com.mitturkey.asistan;

import android.content.Context;
import android.content.SharedPreferences;

/** Kullanıcı ayarları. */
public class Ayar {
    public static final String DEF_GREETING =
            "Merhaba, ben yapay zekâ asistanıyım. Şu an telefona bakamıyorum. " +
            "Kim olduğunuzu ve ne için aradığınızı söylerseniz not alıp iletirim.";

    private final SharedPreferences p;
    public Ayar(Context c) { p = c.getSharedPreferences("ayar", 0); }

    public String apiKey()   { return p.getString("key", "").trim(); }
    public String model()    { return p.getString("model", "gemini-3.5-flash").trim(); }
    public String ad()       { return p.getString("ad", "").trim(); }
    public String selam()    { String s = p.getString("selam", "").trim(); return s.isEmpty() ? DEF_GREETING : s; }
    public String bilgi()    { return p.getString("bilgi", "").trim(); }
    public int bekle()       { return p.getInt("bekle", 10); }
    /** 0 = medya, 1 = alarm, 2 = sesli arama */
    public int sesTuru()     { return p.getInt("ses", 0); }
    /** true = Gemini sesi, false = telefonun sesi */
    public boolean geminiSes() { return p.getBoolean("gses", true); }
    public String sesAdi()   { String s = p.getString("sesadi", "").trim(); return s.isEmpty() ? "Charon" : s; }
    public String sesModel() { String s = p.getString("sesmodel", "").trim(); return s.isEmpty() ? "gemini-3.1-flash-tts-preview" : s; }
    public void sesKaydet(boolean g, String ad, String model) {
        p.edit().putBoolean("gses", g).putString("sesadi", ad).putString("sesmodel", model).apply();
    }
    public boolean acik()    { return p.getBoolean("acik", false); }

    public void kaydet(String key, String model, String ad, String selam, String bilgi, int bekle, int ses) {
        p.edit().putString("key", key).putString("model", model).putString("ad", ad)
                .putString("selam", selam).putString("bilgi", bilgi)
                .putInt("bekle", bekle).putInt("ses", ses).apply();
    }
    public void setAcik(boolean b) { p.edit().putBoolean("acik", b).apply(); }
}
