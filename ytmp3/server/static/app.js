const fileEl = document.getElementById('file');
const bitrateEl = document.getElementById('bitrate');
const submitBtn = document.getElementById('submit');
const statusEl = document.getElementById('status');

submitBtn.addEventListener('click', async () => {
  const file = fileEl.files[0];
  if (!file) {
    statusEl.textContent = 'ファイルを選択してください。';
    return;
  }
  const form = new FormData();
  form.append('file', file);
  form.append('bitrate', bitrateEl.value);

  statusEl.textContent = '変換中…';
  try {
    const res = await fetch('/convert', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = 'エラー: ' + (err.error || res.statusText);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.mp3';
    a.click();
    statusEl.textContent = '完了。ダウンロードが開始されました。';
  } catch (e) {
    statusEl.textContent = '通信エラーが発生しました。';
  }
});
