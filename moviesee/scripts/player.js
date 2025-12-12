(function () {
  const videoEl = document.getElementById('player');
  const statusEl = document.getElementById('status');
  const backBtn = document.getElementById('backBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const shareBtn = document.getElementById('shareBtn');

  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  const name = params.get('name') || 'video.mp4';

  if (!src) {
    statusEl.textContent = '動画ソースが見つかりません。アップロードページからやり直してください。';
    return;
  }

  videoEl.src = src;

  videoEl.addEventListener('loadedmetadata', () => {
    statusEl.textContent = `読み込み完了: ${name}`;
  });

  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    a.click();
  });

  // URLシェア機能
  shareBtn.addEventListener('click', async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      statusEl.textContent = 'URLをコピーしました！';
    } catch {
      statusEl.textContent = 'コピーに失敗しました。';
    }
  });
})();
