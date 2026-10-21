document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('short-form');
  const longUrl = document.getElementById('long-url');
  const shortUrl = document.getElementById('short-url');
  const shortenButton = document.getElementById('shorten-btn');
  const copyButton = document.getElementById('copy-btn');
  const message = document.getElementById('message');
  let pending = false;

  longUrl.addEventListener('input', () => {
    shortenButton.disabled = !longUrl.value.trim() || pending;
    message.textContent = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let original;
    try {
      original = new URL(longUrl.value.trim());
    } catch {
      message.textContent = '올바른 URL을 입력해 주세요.';
      return;
    }
    if (!['http:', 'https:'].includes(original.protocol)) {
      message.textContent = 'http:// 또는 https:// 주소를 입력해 주세요.';
      return;
    }

    pending = true;
    shortenButton.disabled = true;
    shortenButton.textContent = '단축 중...';
    message.textContent = 'URL 단축 서비스에 연결하고 있습니다.';
    shortUrl.value = '';
    copyButton.disabled = true;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      // Shrtr API: JSON POST, browser CORS supported; does not require an API key.
      const response = await fetch('https://shrtr.top/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: original.href }),
        signal: controller.signal
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error('단축 서비스에서 올바른 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('단축 요청이 많아 잠시 제한되었습니다. 잠시 기다린 뒤 다시 시도해 주세요.');
        }
        throw new Error(data.detail || data.title || data.error || `단축 요청 실패 (${response.status})`);
      }

      if (!data.short_url) {
        throw new Error('응답에 단축 URL이 없습니다. 잠시 후 다시 시도해 주세요.');
      }

      shortUrl.value = data.short_url;
      copyButton.disabled = false;
      message.textContent = '단축 URL 생성이 완료되었습니다.';
    } catch (error) {
      if (error.name === 'AbortError') {
        message.textContent = '응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (error instanceof TypeError) {
        message.textContent = '단축 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      } else {
        message.textContent = error.message || 'URL 단축 중 오류가 발생했습니다.';
      }
    } finally {
      window.clearTimeout(timeoutId);
      pending = false;
      shortenButton.textContent = '단축하기';
      shortenButton.disabled = !longUrl.value.trim();
    }
  });

  copyButton.addEventListener('click', async () => {
    if (!shortUrl.value) return;
    try {
      await navigator.clipboard.writeText(shortUrl.value);
    } catch {
      shortUrl.focus();
      shortUrl.select();
      const copied = document.execCommand('copy');
      if (!copied) {
        message.textContent = '복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.';
        return;
      }
    }
    message.textContent = '단축 URL을 복사했습니다.';
  });
});
