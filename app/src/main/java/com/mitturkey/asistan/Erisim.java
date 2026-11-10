package com.mitturkey.asistan;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

/**
 * Boş bir erişilebilirlik hizmeti. Tek amacı: Android arama sırasında mikrofonu sadece
 * erişilebilirlik hizmetlerine açık bırakıyor. Bu hizmet açıkken uygulamamız arayanı duyabilir.
 */
public class Erisim extends AccessibilityService {
    private static volatile boolean acik = false;
    public static boolean acik() { return acik; }

    @Override protected void onServiceConnected() { acik = true; Log2.add(this, "♿ Erişilebilirlik hizmeti açık (aramada mikrofon izni)."); }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) {}
    @Override public void onInterrupt() {}
    @Override public void onDestroy() { acik = false; super.onDestroy(); }
}
