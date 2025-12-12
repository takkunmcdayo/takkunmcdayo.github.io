(function () {
  const input = document.getElementById('videoInput');
  const openBtn = document.getElementById('openPlayerBtn');
  const dropZone = document.getElementById('dropZone');

  let objectUrl = null;
  let fileName = null;

  function handleFile(file) {
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    fileName = file.name;
    openBtn.disabled = false;
  }

  // ファイル選択
  input.addEventListener('change', () => {
    handleFile(input.files?.[0]);
  });

  // ドラッグ＆ドロップ
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  });

  // プレイヤーへ遷移
  openBtn.addEventListener('click', () => {
    if (!objectUrl) return;
    const url = new URL('player.html', window.location.href);
    url.searchParams.set('src', objectUrl);
    url.searchParams.set('name', fileName);
    window.location.href = url.toString();
  });

  openBtn.disabled = true;
})();
