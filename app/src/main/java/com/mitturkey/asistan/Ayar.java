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
    public String model()    { return p.getString("model", "gemini-flash-latest").trim(); }
    public String ad()       { return p.getString("ad", "").trim(); }
    public String selam()    { String s = p.getString("selam", "").trim(); return s.isEmpty() ? DEF_GREETING : s; }
    public String bilgi()    { return p.getString("bilgi", "").trim(); }
    public int bekle()       { return p.getInt("bekle", 10); }
    /** 0 = medya, 1 = alarm, 2 = sesli arama */
    public int sesTuru()     { return p.getInt("ses", 0); }
    public boolean acik()    { return p.getBoolean("acik", false); }

    public void kaydet(String key, String model, String ad, String selam, String bilgi, int bekle, int ses) {
        p.edit().putString("key", key).putString("model", model).putString("ad", ad)
                .putString("selam", selam).putString("bilgi", bilgi)
                .putInt("bekle", bekle).putInt("ses", ses).apply();
    }
    public void setAcik(boolean b) { p.edit().putBoolean("acik", b).apply(); }
}
