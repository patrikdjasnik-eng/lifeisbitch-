package cz.rabbithollow.lifeisbitch;

import android.Manifest;
import android.content.pm.PackageManager;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineGameTest {
  private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<String> result = new AtomicReference<>("");
    scenario.onActivity(activity -> {
      WebView web = (WebView)((ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
      web.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); });
    });
    assertTrue("WebView callback timeout", latch.await(10, TimeUnit.SECONDS));
    return result.get();
  }

  private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
    for (int attempt = 0; attempt < 60; attempt++) {
      if ("true".equals(evaluate(scenario, "!!document.getElementById('mobileSettings') && typeof started !== 'undefined'"))) return;
      Thread.sleep(500);
    }
    fail("Offline game failed to initialize");
  }

  @Test public void offlineCharacterPersistsAndControlsWork() throws Exception {
    try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
      ready(scenario);
      scenario.onActivity(activity -> assertEquals(PackageManager.PERMISSION_DENIED,
        activity.checkSelfPermission(Manifest.permission.INTERNET)));
      assertEquals("true", evaluate(scenario, "!document.getElementById('accountButton') && !!document.getElementById('betaBadge')"));
      assertEquals("true", evaluate(scenario, "document.getElementById('characterName').value='Android Tester';document.getElementById('start').click();started"));
      assertEquals("true", evaluate(scenario, "document.querySelectorAll('.touch button').length >= 10"));
      assertEquals("true", evaluate(scenario, "document.querySelector('#mobileSettings button').click();!document.getElementById('mobilePrivacy').hidden"));
      String profile = evaluate(scenario, "localStorage.getItem('street-life-character-v1')");
      assertTrue(profile.contains("Android Tester"));
      scenario.recreate();
      ready(scenario);
      assertEquals(profile, evaluate(scenario, "localStorage.getItem('street-life-character-v1')"));
      assertEquals("true", evaluate(scenario, "document.getElementById('characterName').value === 'Android Tester'"));
    }
  }
}
