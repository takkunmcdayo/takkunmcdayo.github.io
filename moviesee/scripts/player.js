(function () {
  const videoEl = document.getElementById('player');
  const statusEl = document.getElementById('status');
  const backBtn = document.getElementById('backBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  const name = params.get('name') || 'video.mp4';

  if (!src) {
    statusEl.textContent = '動画ソースが見つかりません。アップロードページからやり直してください。';
    videoEl.removeAttribute('controls');
    return;
  }

  // Load the video
  videoEl.src = src;

  // Helpful status
  videoEl.addEventListener('loadedmetadata', () => {
    statusEl.textContent = `読み込み完了: ${name}（${Math.round(videoEl.duration)}秒）`;
  });

  videoEl.addEventListener('error', () => {
    statusEl.textContent = '動画の読み込みに失敗しました。アップロードページで再選択してください。';
  });

  // Navigation
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Allow user to “download” the in-memory video (saves to device)
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // When leaving the page, revoke the Blob URL
  window.addEventListener('pagehide', () => {
    try { URL.revokeObjectURL(src); } catch {}
  });
})();
