/* QRnShort URL Shortener
 * Matches the current urlShort/index.html element IDs.
 * Uses is.gd JSONP (officially supports callback= for cross-domain use),
 * then tries v.gd if the first host fails.
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('short-form');
  const longUrl = document.getElementById('long-url');
  const shortUrl = document.getElementById('short-url');
  const shortenButton = document.getElementById('shorten-btn');
  const copyButton = document.getElementById('copy-btn');
  const message = document.getElementById('message');

  if (!form || !longUrl || !shortUrl || !shortenButton || !copyButton || !message) {
    console.error('QRnShort: 필요한 HTML 요소를 찾을 수 없습니다.');
    return;
  }

  let pending = false;
  const CACHE_KEY = 'qrnshort-url-cache-v1';

  function readCache(originalUrl) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return typeof cache[originalUrl] === 'string' ? cache[originalUrl] : '';
    } catch {
      return '';
    }
  }

  function writeCache(originalUrl, tinyUrl) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[originalUrl] = tinyUrl;
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // URL shortening still works when browser storage is unavailable.
    }
  }

  function callJsonp(host, originalUrl, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = `qrnShortCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      let timerId;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timerId);
        script.onerror = null;
        script.remove();
        try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
      };

      timerId = window.setTimeout(() => {
        cleanup();
        reject(new Error(`${host} 응답 시간 초과`));
      }, timeoutMs);

      window[callbackName] = (data) => {
        if (settled) return;
        cleanup();
        if (data && typeof data.shorturl === 'string') {
          let returned;
          try { returned = new URL(data.shorturl); } catch {
            reject(new Error(`${host}가 올바른 단축 URL을 반환하지 않았습니다.`));
            return;
          }
          if (returned.protocol === 'https:' || returned.protocol === 'http:') {
            resolve(returned.href);
            return;
          }
        }
        const apiMessage = data && typeof data.errormessage === 'string'
          ? data.errormessage
          : '단축 서비스에서 오류 응답을 반환했습니다.';
        reject(new Error(`${host}: ${apiMessage}`));
      };

      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error(`${host} 연결 실패`));
      };

      const params = new URLSearchParams({
        format: 'json',
        callback: callbackName,
        url: originalUrl
      });
      script.src = `https://${host}/create.php?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function shorten(originalUrl) {
    try {
      return await callJsonp('is.gd', originalUrl);
    } catch (firstError) {
      message.textContent = `is.gd 요청 실패 (${firstError.message}). 다른 주소로 재시도합니다...`;
      return await callJsonp('v.gd', originalUrl);
    }
  }

  longUrl.addEventListener('input', () => {
    shortenButton.disabled = !longUrl.value.trim() || pending;
    if (!pending) message.textContent = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;

    let parsed;
    try {
      parsed = new URL(longUrl.value.trim());
    } catch {
      message.textContent = 'https://를 포함한 올바른 URL을 입력해 주세요.';
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      message.textContent = 'http:// 또는 https://로 시작하는 주소를 입력해 주세요.';
      return;
    }

    const originalUrl = parsed.href;
    const cached = readCache(originalUrl);
    if (cached) {
      shortUrl.value = cached;
      copyButton.disabled = false;
      message.textContent = '이전에 생성한 단축 URL을 불러왔습니다.';
      return;
    }

    pending = true;
    shortenButton.disabled = true;
    shortenButton.textContent = '단축 중...';
    shortUrl.value = '';
    copyButton.disabled = true;
    message.textContent = 'URL 단축 서비스를 요청하고 있습니다...';

    try {
      const result = await shorten(originalUrl);
      shortUrl.value = result;
      copyButton.disabled = false;
      writeCache(originalUrl, result);
      message.textContent = '단축 URL 생성이 완료되었습니다.';
    } catch (error) {
      console.error('QRnShort URL shortening failed:', error);
      message.textContent = `단축 실패: ${error.message}. 잠시 후 다시 시도해 주세요.`;
    } finally {
      pending = false;
      shortenButton.textContent = '단축하기';
      shortenButton.disabled = !longUrl.value.trim();
    }
  });

  copyButton.addEventListener('click', async () => {
    if (!shortUrl.value) return;
    try {
      await navigator.clipboard.writeText(shortUrl.value);
      message.textContent = '단축 URL을 복사했습니다.';
    } catch {
      shortUrl.focus();
      shortUrl.select();
      const copied = document.execCommand('copy');
      message.textContent = copied
        ? '단축 URL을 복사했습니다.'
        : '복사가 되지 않았습니다. 결과 주소를 직접 선택해 복사해 주세요.';
    }
  });
});
