import { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// المفتاح العامّ (Site Key) من Cloudflare Turnstile — آمن في كود التطبيق.
const SITE_KEY = '0x4AAAAAADqiznIUKeXLhvFR';

// صفحة HTML صغيرة تحمّل Turnstile وتُرسل الرمز للتطبيق عبر postMessage.
const buildHtml = (siteKey) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>
  html,body{margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;min-height:70px;}
  .cf{transform:scale(1);}
</style>
</head>
<body>
<div class="cf" id="cf"></div>
<script>
  function send(msg){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  window.onloadTurnstileCallback = function () {
    turnstile.render('#cf', {
      sitekey: '${siteKey}',
      callback: function (token) { send({ type: 'token', token: token }); },
      'error-callback': function () { send({ type: 'error' }); },
      'expired-callback': function () { send({ type: 'expired' }); },
    });
  };
  // في حال حُمّل السكربت قبل تعريف الدالّة
  document.addEventListener('DOMContentLoaded', function(){
    if (window.turnstile && !document.querySelector('#cf iframe')) {
      try { window.onloadTurnstileCallback(); } catch(e){}
    }
  });
</script>
<script>
  // إعادة المحاولة بعد تحميل api.js
  var t = setInterval(function(){
    if (window.turnstile) { clearInterval(t); try{ window.onloadTurnstileCallback(); }catch(e){} }
  }, 300);
  setTimeout(function(){ clearInterval(t); }, 10000);
</script>
</body>
</html>`;

export default function TurnstileWidget({ onToken, onError }) {
  const handledRef = useRef(false);

  const onMessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
    if (msg.type === 'token' && msg.token && !handledRef.current) {
      handledRef.current = true;
      onToken && onToken(msg.token);
    } else if (msg.type === 'error' || msg.type === 'expired') {
      handledRef.current = false;
      onError && onError(msg.type);
    }
  };

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(SITE_KEY), baseUrl: 'https://mizan.app' }}
        onMessage={onMessage}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 90, width: '100%', overflow: 'hidden' },
  web: { backgroundColor: 'transparent', flex: 1 },
});
