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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let original;
    try { original = new URL(longUrl.value.trim()); }
    catch { message.textContent = '올바른 URL을 입력해 주세요.'; return; }
    if (!['http:', 'https:'].includes(original.protocol)) {
      message.textContent = 'http:// 또는 https:// 주소를 입력해 주세요.'; return;
    }

    pending = true;
    shortenButton.disabled = true;
    shortenButton.textContent = '단축 중...';
    message.textContent = '';
    shortUrl.value = '';
    copyButton.disabled = true;

    const callbackName = `isgdCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      script.remove();
      delete window[callbackName];
      pending = false;
      shortenButton.textContent = '단축하기';
      shortenButton.disabled = !longUrl.value.trim();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      message.textContent = '응답 시간이 초과되었습니다. 잠시 뒤 다시 시도해 주세요.';
    }, 15000);

    window[callbackName] = (data) => {
      window.clearTimeout(timer);
      cleanup();
      if (data && data.shorturl) {
        shortUrl.value = data.shorturl;
        copyButton.disabled = false;
        message.textContent = '단축 URL 생성이 완료되었습니다.';
      } else {
        message.textContent = data?.errormessage || 'URL 단축 중 오류가 발생했습니다.';
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      message.textContent = '네트워크 오류가 발생했습니다. 잠시 뒤 다시 시도해 주세요.';
    };
    script.src = `https://is.gd/create.php?format=json&callback=${encodeURIComponent(callbackName)}&url=${encodeURIComponent(original.href)}`;
    document.body.appendChild(script);
  });

  copyButton.addEventListener('click', async () => {
    if (!shortUrl.value) return;
    try {
      await navigator.clipboard.writeText(shortUrl.value);
    } catch {
      shortUrl.focus();
      shortUrl.select();
      const copied = document.execCommand('copy');
      if (!copied) { message.textContent = '복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.'; return; }
    }
    alert('복사하였습니다');
  });
});
