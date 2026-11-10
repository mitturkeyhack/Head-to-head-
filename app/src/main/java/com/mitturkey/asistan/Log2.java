package com.mitturkey.asistan;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Ekranda gösterilen basit kayıt defteri. Son ~12000 karakteri saklar. */
public class Log2 {
    public interface Listener { void onLog(String all); void onLevel(int level); }

    private static Listener listener;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static StringBuilder buf;

    public static void setListener(Listener l) { listener = l; }

    private static SharedPreferences p(Context c) { return c.getSharedPreferences("log", 0); }

    public static synchronized String get(Context c) {
        if (buf == null) buf = new StringBuilder(p(c).getString("t", ""));
        return buf.toString();
    }

    public static synchronized void add(Context c, String line) {
        get(c);
        String t = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        buf.append(t).append("  ").append(line).append('\n');
        if (buf.length() > 12000) buf.delete(0, buf.length() - 12000);
        final String all = buf.toString();
        p(c).edit().putString("t", all).apply();
        main.post(() -> { if (listener != null) listener.onLog(all); });
    }

    public static synchronized void clear(Context c) {
        buf = new StringBuilder();
        p(c).edit().putString("t", "").apply();
        main.post(() -> { if (listener != null) listener.onLog(""); });
    }

    public static void level(int lv) {
        main.post(() -> { if (listener != null) listener.onLevel(lv); });
    }
}
