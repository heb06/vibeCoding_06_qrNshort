/* QRnShort URL Shortener - compatible with both course and project HTML IDs.
 * Supports either:
 *   (A) short-form / long-url / shorten-btn / short-url / copy-btn / message|status
 *   (B) urlInput / shortenBtn / shortUrlOutput / copyBtn / resultGroup / toast
 * Uses the is.gd JSONP API (documented callback support) and falls back to v.gd.
 */
(function () {
  function initQrNShort() {
    // The project has used two versions of element IDs; support both to prevent
    // an ID mismatch from leaving the submit button disabled and unresponsive.
    const form = document.getElementById('short-form');
    const urlInput = document.getElementById('long-url') || document.getElementById('urlInput');
    const shortenButton = document.getElementById('shorten-btn') || document.getElementById('shortenBtn');
    const shortUrlOutput = document.getElementById('short-url') || document.getElementById('shortUrlOutput');
    const copyButton = document.getElementById('copy-btn') || document.getElementById('copyBtn');
    const resultGroup = document.getElementById('resultGroup');
    const statusElement = document.getElementById('status') || document.getElementById('message');
    const toast = document.getElementById('toast');

    if (!urlInput || !shortenButton || !shortUrlOutput || !copyButton) {
      console.error('QRnShort: URL input, shorten button, output, or copy button is missing.');
      return;
    }

    let pending = false;
    let toastTimer = null;

    function ensureStatusElement() {
      if (statusElement) return statusElement;
      const el = document.createElement('p');
      el.id = 'qrnshort-status-fallback';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.marginTop = '12px';
      el.style.fontSize = '14px';
      (shortenButton.closest('form') || shortenButton.parentElement || document.body).appendChild(el);
      return el;
    }

    const status = ensureStatusElement();

    function showStatus(message, isError) {
      status.textContent = message;
      status.style.color = isError ? '#f09a9a' : '';
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
      }
    }

    function normalizeUrl(value) {
      let text = String(value || '').trim();
      if (!text) throw new Error('단축할 URL을 입력해 주세요.');
      if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
      let parsed;
      try { parsed = new URL(text); } catch (_) {
        throw new Error('https://를 포함한 올바른 URL을 입력해 주세요.');
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error('http:// 또는 https://로 시작하는 주소를 입력해 주세요.');
      }
      return parsed.href;
    }

    function updateButton() {
      shortenButton.disabled = pending || !urlInput.value.trim();
    }

    function callJsonp(host, originalUrl, timeoutMs) {
      return new Promise((resolve, reject) => {
        const callbackName = 'qrnShortCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const script = document.createElement('script');
        let settled = false;
        let timer = null;

        function finish(callback, value) {
          if (settled) return;
          settled = true;
          if (timer !== null) window.clearTimeout(timer);
          script.onerror = null;
          script.remove();
          try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
          callback(value);
        }

        window[callbackName] = (data) => {
          const shortUrl = data && (data.shorturl || data.short_url || data.shortUrl);
          if (typeof shortUrl === 'string') {
            try {
              const parsed = new URL(shortUrl.trim());
              if (['https:', 'http:'].includes(parsed.protocol) && parsed.hostname) {
                finish(resolve, parsed.href);
                return;
              }
            } catch (_) { /* report API error below */ }
          }
          const detail = data && (data.errormessage || data.error || data.message);
          finish(reject, new Error(detail ? String(detail) : host + '가 단축 URL을 반환하지 않았습니다.'));
        };

        script.async = true;
        script.onerror = () => finish(reject, new Error(host + ' 연결 실패'));
        timer = window.setTimeout(() => finish(reject, new Error(host + ' 응답 시간 초과')), timeoutMs);

        const params = new URLSearchParams({
          format: 'json',
          callback: callbackName,
          url: originalUrl
        });
        script.src = 'https://' + host + '/create.php?' + params.toString();
        document.head.appendChild(script);
      });
    }

    async function requestShortUrl(originalUrl) {
      let firstError;
      try {
        return await callJsonp('is.gd', originalUrl, 10000);
      } catch (error) {
        firstError = error;
        showStatus('첫 번째 단축 서비스 연결 실패. 다른 서비스로 다시 시도합니다…');
      }
      try {
        return await callJsonp('v.gd', originalUrl, 10000);
      } catch (secondError) {
        throw new Error('단축 서비스에 연결하지 못했습니다. (' + firstError.message + '; ' + secondError.message + ')');
      }
    }

    async function handleShorten(event) {
      if (event) event.preventDefault();
      if (pending) return;

      let originalUrl;
      try {
        originalUrl = normalizeUrl(urlInput.value);
      } catch (error) {
        showStatus(error.message, true);
        urlInput.focus();
        return;
      }

      pending = true;
      shortenButton.disabled = true;
      shortenButton.textContent = '단축 중…';
      shortUrlOutput.value = '';
      copyButton.disabled = true;
      if (resultGroup) resultGroup.classList.remove('active');
      showStatus('단축 URL을 요청하고 있습니다…');

      try {
        const result = await requestShortUrl(originalUrl);
        shortUrlOutput.value = result;
        copyButton.disabled = false;
        if (resultGroup) resultGroup.classList.add('active');
        showStatus('단축 URL 생성이 완료되었습니다.');
      } catch (error) {
        console.error('QRnShort URL shortener error:', error);
        showStatus('단축에 실패했습니다: ' + error.message, true);
      } finally {
        pending = false;
        shortenButton.textContent = '단축하기';
        updateButton();
      }
    }

    async function handleCopy() {
      const value = shortUrlOutput.value.trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
      } catch (_) {
        shortUrlOutput.focus();
        shortUrlOutput.select();
        const ok = document.execCommand('copy');
        if (!ok) {
          showStatus('복사에 실패했습니다. 결과 URL을 직접 선택해 복사해 주세요.', true);
          return;
        }
      }
      showStatus('복사하였습니다!');
    }

    urlInput.addEventListener('input', () => {
      updateButton();
      if (!pending) showStatus('');
    });

    // HTML with a form uses submit (also supports pressing Enter).
    // The original course HTML had no form, so bind directly to its button.
    if (form) {
      form.addEventListener('submit', handleShorten);
    } else {
      shortenButton.addEventListener('click', handleShorten);
    }

    copyButton.addEventListener('click', handleCopy);
    updateButton();
    copyButton.disabled = !shortUrlOutput.value.trim();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQrNShort, { once: true });
  } else {
    initQrNShort();
  }
})();
