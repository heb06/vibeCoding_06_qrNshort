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
    if (pending) return;

    let original;
    try {
      original = new URL(longUrl.value.trim());
    } catch {
      message.textContent = 'https://를 포함한 올바른 URL을 입력해 주세요.';
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
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      // 수업 예제 저장소와 동일한 clck.ru API 패턴을 사용합니다.
      const endpoint = `https://clck.ru/--?url=${encodeURIComponent(original.href)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`단축 서비스에서 오류 응답을 받았습니다 (${response.status}).`);
      }

      const result = (await response.text()).trim();
      let parsed;
      try {
        parsed = new URL(result);
      } catch {
        throw new Error('단축 서비스가 올바른 URL을 반환하지 않았습니다. 다른 주소로 다시 시도해 주세요.');
      }

      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
        throw new Error('단축 서비스가 올바른 URL을 반환하지 않았습니다.');
      }

      shortUrl.value = parsed.href;
      copyButton.disabled = false;
      message.textContent = '단축 URL 생성이 완료되었습니다.';
    } catch (error) {
      if (error.name === 'AbortError') {
        message.textContent = '단축 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      } else if (error instanceof TypeError) {
        message.textContent = '단축 서비스 연결 또는 브라우저 보안(CORS) 문제입니다. 잠시 후 다시 시도해 주세요.';
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
      message.textContent = '복사하였습니다.';
    } catch {
      shortUrl.focus();
      shortUrl.select();
      const copied = document.execCommand('copy');
      message.textContent = copied
        ? '복사하였습니다.'
        : '복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.';
    }
  });
});
