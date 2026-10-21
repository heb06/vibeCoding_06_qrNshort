/* QRnShort URL shortener — GitHub Pages / course HTML compatible.
 * API: Shrtr POST JSON API. No API key; CORS is documented by the provider.
 */
(function () {
  'use strict';

  function init() {
    const form = document.getElementById('short-form');
    const input = document.getElementById('long-url') || document.getElementById('urlInput');
    const shortenButton = document.getElementById('shorten-btn') || document.getElementById('shortenBtn');
    const output = document.getElementById('short-url') || document.getElementById('shortUrlOutput');
    const copyButton = document.getElementById('copy-btn') || document.getElementById('copyBtn');
    const status = document.getElementById('message') || document.getElementById('status');
    const resultGroup = document.getElementById('resultGroup');
    const toast = document.getElementById('toast');

    if (!input || !shortenButton || !output || !copyButton) {
      console.error('QRnShort: 필요한 HTML 요소를 찾을 수 없습니다.');
      if (status) status.textContent = '페이지 요소를 찾을 수 없습니다. HTML 파일과 script.js를 함께 확인해 주세요.';
      return;
    }

    let busy = false;
    let toastTimer = null;

    function showStatus(message, isError) {
      if (status) {
        status.textContent = message;
        status.style.color = isError ? '#f09a9a' : '';
      }
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3500);
      }
    }

    function normalizeUrl(raw) {
      let value = String(raw || '').trim();
      if (!value) throw new Error('단축할 URL을 입력해 주세요.');
      if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
      let parsed;
      try { parsed = new URL(value); }
      catch (_) { throw new Error('올바른 웹 주소를 입력해 주세요.'); }
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
        throw new Error('http:// 또는 https://로 시작하는 주소를 입력해 주세요.');
      }
      return parsed.href;
    }

    function updateButton() {
      shortenButton.disabled = busy || !input.value.trim();
    }

    async function shorten(event) {
      if (event) event.preventDefault();
      if (busy) return;

      let originalUrl;
      try {
        originalUrl = normalizeUrl(input.value);
      } catch (error) {
        showStatus(error.message, true);
        input.focus();
        return;
      }

      busy = true;
      shortenButton.disabled = true;
      shortenButton.textContent = '단축 중...';
      output.value = '';
      copyButton.disabled = true;
      if (resultGroup) resultGroup.classList.remove('active');
      showStatus('URL 단축 서비스에 요청 중입니다...');

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://shrtr.top/api/v1/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: originalUrl }),
          signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 429) {
            const wait = response.headers.get('Retry-After');
            throw new Error(data.detail || ('요청 횟수 제한에 도달했습니다.' + (wait ? ' ' + wait + '초 후 다시 시도해 주세요.' : ' 잠시 후 다시 시도해 주세요.')));
          }
          throw new Error(data.detail || data.title || ('단축 서비스 오류 (HTTP ' + response.status + ')'));
        }

        const shortUrl = String(data.short_url || '').trim();
        let parsedShort;
        try { parsedShort = new URL(shortUrl); }
        catch (_) { throw new Error('단축 서비스에서 올바른 단축 URL을 받지 못했습니다.'); }
        if (parsedShort.protocol !== 'https:' && parsedShort.protocol !== 'http:') {
          throw new Error('단축 서비스 응답 형식이 올바르지 않습니다.');
        }

        output.value = parsedShort.href;
        copyButton.disabled = false;
        if (resultGroup) resultGroup.classList.add('active');
        showStatus('단축 URL 생성이 완료되었습니다.');
      } catch (error) {
        console.error('QRnShort URL shortener error:', error);
        if (error && error.name === 'AbortError') {
          showStatus('단축 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.', true);
        } else {
          showStatus('단축 실패: ' + (error && error.message ? error.message : '알 수 없는 오류'), true);
        }
      } finally {
        window.clearTimeout(timer);
        busy = false;
        shortenButton.textContent = '단축하기';
        updateButton();
      }
    }

    async function copyResult() {
      const value = output.value.trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
      } catch (_) {
        output.focus();
        output.select();
        const copied = document.execCommand('copy');
        if (!copied) {
          showStatus('복사에 실패했습니다. 결과 URL을 직접 선택해 복사해 주세요.', true);
          return;
        }
      }
      showStatus('복사하였습니다!');
    }

    input.addEventListener('input', updateButton);
    if (form) form.addEventListener('submit', shorten);
    else shortenButton.addEventListener('click', shorten);
    copyButton.addEventListener('click', copyResult);
    updateButton();
    copyButton.disabled = !output.value.trim();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
