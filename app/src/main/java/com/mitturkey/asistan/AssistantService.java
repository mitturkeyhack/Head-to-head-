package com.mitturkey.asistan;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.telecom.TelecomManager;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;

/**
 * Arka planda çalışır. Telefon çalınca bekler, sahibi açmazsa aramayı açar,
 * hoparlörü açar ve Sohbet'i başlatır.
 */
public class AssistantService extends Service {
    public static final String TEST = "test";
    private static final String KANAL = "asistan";
    private static final String KANAL_NOT = "notlar";
    private static AssistantService calisan;

    private final Handler h = new Handler(Looper.getMainLooper());
    private TelephonyManager tm;
    private Cagri cagri;
    private Runnable acZamanlayici;
    private boolean bizAcdik = false;
    private Sohbet sohbet;
    private PowerManager.WakeLock wl;

    public static boolean calisiyor() { return calisan != null; }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        calisan = this;
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(KANAL, "Asistan çalışıyor", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(KANAL_NOT, "Arama notları", NotificationManager.IMPORTANCE_HIGH));
        startForeground(1, bildirim("Asistan açık: aramaları " + new Ayar(this).bekle() + " sn sonra cevaplar"),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        tm = getSystemService(TelephonyManager.class);
        cagri = new Cagri();
        try {
            tm.registerTelephonyCallback(getMainExecutor(), cagri);
            Log2.add(this, "✅ Asistan açıldı, aramalar bekleniyor.");
        } catch (SecurityException e) {
            Log2.add(this, "Telefon durumu izni yok!");
        }
    }

    @Override public int onStartCommand(Intent i, int f, int id) {
        startForeground(1, bildirim("Asistan açık: aramaları " + new Ayar(this).bekle() + " sn sonra cevaplar"),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        if (i != null && i.getBooleanExtra(TEST, false)) testBaslat();
        return START_STICKY;
    }

    @Override public void onDestroy() {
        try { tm.unregisterTelephonyCallback(cagri); } catch (Exception ignored) {}
        if (sohbet != null) sohbet.durdur();
        hoparlor(false);
        calisan = null;
        Log2.add(this, "⛔ Asistan kapatıldı.");
        super.onDestroy();
    }

    private Notification bildirim(String metin) {
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, KANAL).setContentTitle("Sesli Asistan").setContentText(metin)
                .setSmallIcon(android.R.drawable.sym_action_call).setContentIntent(pi).setOngoing(true).build();
    }

    private class Cagri extends TelephonyCallback implements TelephonyCallback.CallStateListener {
        @Override public void onCallStateChanged(int durum) {
            if (durum == TelephonyManager.CALL_STATE_RINGING) caliyor();
            else if (durum == TelephonyManager.CALL_STATE_OFFHOOK) acildi();
            else if (durum == TelephonyManager.CALL_STATE_IDLE) kapandi();
        }
    }

    private void caliyor() {
        int sn = new Ayar(this).bekle();
        Log2.add(this, "📞 Telefon çalıyor. " + sn + " sn içinde açmazsan asistan açacak.");
        iptal();
        acZamanlayici = this::ac;
        h.postDelayed(acZamanlayici, sn * 1000L);
    }

    @SuppressLint("MissingPermission")
    private void ac() {
        acZamanlayici = null;
        try {
            TelecomManager t = getSystemService(TelecomManager.class);
            bizAcdik = true;
            t.acceptRingingCall();
            Log2.add(this, "🤖 Aramayı asistan açtı.");
        } catch (Exception e) {
            bizAcdik = false;
            Log2.add(this, "Arama açılamadı: " + e.getMessage());
        }
    }

    private void acildi() {
        if (acZamanlayici != null) { // sahibi kendisi açtı
            iptal();
            Log2.add(this, "Aramayı sen açtın, asistan karışmıyor.");
            return;
        }
        if (!bizAcdik || sohbet != null) return;
        h.postDelayed(() -> { hoparlor(true); sohbetBaslat(true); }, 1200);
    }

    private void kapandi() {
        iptal();
        bizAcdik = false;
        if (sohbet != null) { sohbet.durdur(); Log2.add(this, "Arama kapandı."); }
        hoparlor(false);
    }

    private void iptal() {
        if (acZamanlayici != null) { h.removeCallbacks(acZamanlayici); acZamanlayici = null; }
    }

    private void testBaslat() {
        if (sohbet != null) return;
        Log2.add(this, "🧪 TEST: Arama olmadan asistanla konuş. Telefona doğru konuş.");
        sohbetBaslat(false);
    }

    private void sohbetBaslat(boolean gercekArama) {
        wakeLock(true);
        sohbet = new Sohbet(this);
        sohbet.baslat((kapat, ozet) -> h.post(() -> {
            sohbet = null;
            wakeLock(false);
            if (ozet != null && !ozet.isEmpty()) {
                Log2.add(this, "📝 NOT: " + ozet);
                notBildir(ozet);
            }
            if (gercekArama && kapat) h.postDelayed(this::kapat, 600);
            Log2.add(this, "Sohbet bitti.");
        }));
    }

    @SuppressLint("MissingPermission")
    @SuppressWarnings("deprecation")
    private void kapat() {
        try {
            TelecomManager t = getSystemService(TelecomManager.class);
            t.endCall();
        } catch (Exception e) { Log2.add(this, "Arama kapatılamadı: " + e.getMessage()); }
    }

    private void notBildir(String ozet) {
        Notification n = new Notification.Builder(this, KANAL_NOT).setContentTitle("📝 Asistan not aldı")
                .setContentText(ozet).setStyle(new Notification.BigTextStyle().bigText(ozet))
                .setSmallIcon(android.R.drawable.ic_dialog_info).setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE))
                .build();
        getSystemService(NotificationManager.class).notify((int) (System.currentTimeMillis() % 100000), n);
    }

    @SuppressWarnings("deprecation")
    private void hoparlor(boolean ac) {
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        try {
            if (ac) {
                boolean ok = false;
                for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                    if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) { ok = am.setCommunicationDevice(d); break; }
                }
                am.setSpeakerphoneOn(true);
                Log2.add(this, ok ? "🔊 Hoparlör açıldı." : "🔊 Hoparlör açılmaya çalışıldı (açılmadıysa elle aç).");
            } else {
                am.clearCommunicationDevice();
                am.setSpeakerphoneOn(false);
            }
        } catch (Exception e) { Log2.add(this, "Hoparlör hatası: " + e.getMessage()); }
    }

    private void wakeLock(boolean al) {
        try {
            if (al) {
                if (wl == null) wl = getSystemService(PowerManager.class)
                        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "asistan:sohbet");
                if (!wl.isHeld()) wl.acquire(6 * 60 * 1000L);
            } else if (wl != null && wl.isHeld()) wl.release();
        } catch (Exception ignored) {}
    }
}
