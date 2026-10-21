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

  // JSONP 요청이 시간 초과되거나 네트워크에서 실패하면 retryable 오류로 처리합니다.
  function requestShortener(domain, url) {
    return new Promise((resolve, reject) => {
      const callbackName = `shortenerCallback_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      const script = document.createElement('script');
      let finished = false;

      const cleanup = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        script.remove();
        delete window[callbackName];
      };

      const timer = window.setTimeout(() => {
        cleanup();
        const error = new Error(`${domain} 응답 시간 초과`);
        error.retryable = true;
        reject(error);
      }, 12000);

      window[callbackName] = (data) => {
        cleanup();
        if (data && data.shorturl) {
          resolve(data.shorturl);
          return;
        }
        const error = new Error(data?.errormessage || `${domain}에서 URL 단축에 실패했습니다.`);
        // API가 명시적으로 오류를 반환한 경우에는 재요청을 반복하지 않습니다.
        error.retryable = false;
        reject(error);
      };

      script.onerror = () => {
        cleanup();
        const error = new Error(`${domain} 연결 오류`);
        error.retryable = true;
        reject(error);
      };

      const query = new URLSearchParams({
        format: 'json',
        callback: callbackName,
        url
      });
      script.src = `https://${domain}/create.php?${query.toString()}`;
      document.body.appendChild(script);
    });
  }

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

    try {
      let result;
      try {
        result = await requestShortener('is.gd', original.href);
      } catch (firstError) {
        if (!firstError.retryable) throw firstError;
        message.textContent = '첫 번째 서비스 응답이 없어 다른 서비스로 다시 시도하고 있습니다.';
        result = await requestShortener('v.gd', original.href);
      }
      shortUrl.value = result;
      copyButton.disabled = false;
      message.textContent = '단축 URL 생성이 완료되었습니다.';
    } catch (error) {
      if (error.retryable) {
        message.textContent = 'URL 단축 서비스가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.';
      } else {
        message.textContent = error.message || 'URL 단축 중 오류가 발생했습니다.';
      }
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
    } catch {
      shortUrl.focus();
      shortUrl.select();
      const copied = document.execCommand('copy');
      if (!copied) {
        message.textContent = '복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.';
        return;
      }
    }
    alert('복사하였습니다');
  });
});
