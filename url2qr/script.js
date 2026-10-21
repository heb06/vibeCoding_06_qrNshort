document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('qr-form');
  const workspace = document.getElementById('workspace');
  const input = document.getElementById('url-input');
  const result = document.getElementById('qr-result');
  const qrHost = document.getElementById('qr-code');
  const resultUrl = document.getElementById('result-url');
  const status = document.getElementById('status-message');
  const downloadButton = document.getElementById('download-qr');
  let qr = null;

  document.addEventListener('pointermove', (event) => {
    document.documentElement.style.setProperty('--pointer-x', `${Math.round(event.clientX / window.innerWidth * 100)}%`);
    document.documentElement.style.setProperty('--pointer-y', `${Math.round(event.clientY / window.innerHeight * 100)}%`);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = '';
    let url;
    try { url = new URL(input.value.trim()); }
    catch { status.textContent = '올바른 웹사이트 URL을 입력해 주세요.'; return; }
    if (!['http:', 'https:'].includes(url.protocol)) {
      status.textContent = 'http:// 또는 https:// 주소를 입력해 주세요.'; return;
    }
    if (typeof QRCode === 'undefined') {
      status.textContent = 'QR 코드 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'; return;
    }
    qrHost.replaceChildren();
    qr = new QRCode(qrHost, {
      text: url.href,
      width: 240,
      height: 240,
      colorDark: '#111827',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    resultUrl.textContent = url.href;
    result.hidden = false;
    workspace.classList.add('has-result');
    downloadButton.focus({ preventScroll: true });
  });

  downloadButton.addEventListener('click', async () => {
    const canvas = qrHost.querySelector('canvas');
    const img = qrHost.querySelector('img');
    let sourceCanvas = canvas;
    if (!sourceCanvas && img && img.complete) {
      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.naturalWidth || 240;
      sourceCanvas.height = img.naturalHeight || 240;
      const context = sourceCanvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      context.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
    }
    if (!sourceCanvas) {
      document.getElementById('status-message').textContent = 'QR 코드가 준비된 뒤 다시 눌러 주세요.';
      return;
    }
    const anchor = document.createElement('a');
    anchor.download = 'qrcode.jpg';
    anchor.href = sourceCanvas.toDataURL('image/jpeg', 0.96);
    anchor.click();
  });
});
