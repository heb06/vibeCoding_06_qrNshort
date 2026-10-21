/* QRnShort - URL Shortener
 * Course layout/element IDs follow the instructor's public project.
 * The lesson notes identify clck.ru's browser CORS error, so this version
 * uses the CORS-enabled Shrtr API documented at https://shrtr.top/api.
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const shortenBtn = document.getElementById('shortenBtn');
  const shortUrlOutput = document.getElementById('shortUrlOutput');
  const copyBtn = document.getElementById('copyBtn');
  const resultGroup = document.getElementById('resultGroup');
  const toast = document.getElementById('toast');

  if (!urlInput || !shortenBtn || !shortUrlOutput || !copyBtn || !resultGroup || !toast) {
    console.error('QRnShort: expected course HTML elements were not found.');
    return;
  }

  let pending = false;
  let toastTimer = null;

  function showToast(message = '복사하였습니다!') {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function normalizeUrl(value) {
    let candidate = value.trim();
    if (candidate && !/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error('http:// 또는 https://로 시작하는 올바른 URL을 입력해 주세요.');
    }
    return parsed.href;
  }

  urlInput.addEventListener('input', () => {
    shortenBtn.disabled = pending || !urlInput.value.trim();
  });

  shortenBtn.addEventListener('click', async () => {
    if (pending) return;

    let originalUrl;
    try {
      originalUrl = normalizeUrl(urlInput.value);
    } catch (error) {
      alert(error.message || '올바른 URL을 입력해 주세요.');
      return;
    }

    pending = true;
    shortenBtn.disabled = true;
    shortenBtn.textContent = '단축 중...';
    shortUrlOutput.value = '';
    copyBtn.disabled = true;
    resultGroup.classList.remove('active');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://shrtr.top/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl }),
        signal: controller.signal
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('단축 서비스에서 읽을 수 있는 응답을 받지 못했습니다.');
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('요청이 많아 잠시 제한되었습니다. 잠시 기다린 뒤 다시 시도해 주세요.');
        }
        throw new Error(data.detail || data.title || data.error || `요청 실패 (${response.status})`);
      }

      if (typeof data.short_url !== 'string' || !/^https?:\/\//i.test(data.short_url)) {
        throw new Error('단축 서비스가 올바른 URL을 반환하지 않았습니다.');
      }

      shortUrlOutput.value = data.short_url;
      copyBtn.disabled = false;
      resultGroup.classList.add('active');
    } catch (error) {
      console.error('QRnShort URL shortening failed:', error);
      let message;
      if (error.name === 'AbortError') {
        message = '단축 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (error instanceof TypeError) {
        message = '단축 서비스 연결 또는 브라우저 보안(CORS) 문제입니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
      } else {
        message = error.message || 'URL 단축 중 오류가 발생했습니다.';
      }
      alert(message);
      resultGroup.classList.remove('active');
    } finally {
      window.clearTimeout(timeoutId);
      pending = false;
      shortenBtn.textContent = '단축하기';
      shortenBtn.disabled = !urlInput.value.trim();
    }
  });

  copyBtn.addEventListener('click', async () => {
    const value = shortUrlOutput.value.trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      shortUrlOutput.focus();
      shortUrlOutput.select();
      const copied = document.execCommand('copy');
      if (!copied) {
        alert('복사에 실패했습니다. 결과 URL을 직접 선택해 복사해 주세요.');
        return;
      }
    }
    showToast('복사하였습니다!');
  });
});
