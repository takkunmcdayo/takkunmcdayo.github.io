import { createFFmpeg, fetchFile } from "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const fileInfo = document.getElementById('fileInfo');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const estTimeEl = document.getElementById('estTime');
const convertBtn = document.getElementById('convertBtn');
const previewBtn = document.getElementById('previewBtn');
const clearBtn = document.getElementById('clearBtn');
const bitrateSel = document.getElementById('bitrate');
const samplerateSel = document.getElementById('samplerate');
const progressEl = document.getElementById('progress');
const statusText = document.getElementById('statusText');
const percentText = document.getElementById('percent');
const historyEl = document.getElementById('history');
const downloadBtn = document.getElementById('downloadBtn');
const toast = document.getElementById('toast');
const logArea = document.getElementById('logArea');

let ffmpeg = null;
let currentFile = null;
let currentBlobUrl = null;
let isConverting = false;

function showToast(msg, t=3000){ toast.textContent = msg; toast.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(()=> toast.style.display='none', t); }

function humanFileSize(bytes){
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return bytes + ' B';
  const units = ['KB','MB','GB'];
  let u = -1;
  do { bytes /= thresh; ++u; } while(Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1)+' '+units[u];
}
function estimateTime(bytes){ const mb = bytes/(1024*1024); const sec = Math.max(5, Math.round(mb*0.8)); return `${sec} 秒（目安）`; }

/* ドラッグ＆ドロップ */
['dragenter','dragover'].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
['dragleave','drop'].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e=> { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
dropzone.addEventListener('keydown', e=> { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

/* 明示的選択 */
selectBtn.addEventListener('click', ()=> fileInput.click());
openFolderBtn.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', ()=> { if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]); });

clearBtn.addEventListener('click', ()=> { resetState(); showToast('選択をクリアしました'); });
previewBtn.addEventListener('click', ()=> {
  if (!currentFile) return;
  const url = URL.createObjectURL(currentFile);
  const w = window.open('', '_blank');
  w.document.title = currentFile.name;
  const video = w.document.createElement('video');
  video.controls = true; video.src = url; video.style.width = '100%';
  w.document.body.style.margin = '0'; w.document.body.appendChild(video);
});

/* ダウンロード */
downloadBtn.addEventListener('click', ()=> {
  if (!currentBlobUrl) return;
  const a = document.createElement('a');
  a.href = currentBlobUrl;
  a.download = (currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'output') + '.mp3';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

/* 変換ボタン */
convertBtn.addEventListener('click', async ()=> {
  if (!currentFile || isConverting) return;
  isConverting = true;
  convertBtn.disabled = true;
  clearBtn.disabled = true;
  previewBtn.disabled = true;
  statusText.textContent = 'FFmpeg を読み込み中…';
  percentText.textContent = '0%';
  progressEl.value = 0;
  logArea.hidden = true;
  try {
    await loadFFmpeg();
    await runConversion();
  } catch (err) {
    console.error(err);
    logArea.hidden = false;
    logArea.textContent = 'エラー: ' + (err.message || err);
    showToast('変換中にエラーが発生しました');
    statusText.textContent = 'エラー';
  } finally {
    isConverting = false;
    convertBtn.disabled = false;
    clearBtn.disabled = false;
    previewBtn.disabled = false;
  }
});

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js"
  });
  ffmpeg.setProgress(({ ratio }) => {
    const pct = Math.round(ratio * 100);
    progressEl.value = pct;
    percentText.textContent = pct + '%';
    statusText.textContent = `変換中 ${pct}%`;
  });
  ffmpeg.setLogger(({ type, message }) => {
    // ログを必要に応じて表示する場合はここを使う
  });
  await ffmpeg.load();
  return ffmpeg;
}

async function runConversion() {
  const inName = 'input' + getExtension(currentFile.name);
  const outName = 'output.mp3';
  statusText.textContent = 'ファイル読み込み中…';
  ffmpeg.FS('writeFile', inName, await fetchFile(currentFile));
  statusText.textContent = '変換コマンド実行中…';
  const bitrate = bitrateSel.value;
  const sr = samplerateSel.value;
  await ffmpeg.run('-i', inName, '-vn', '-ab', bitrate, '-ar', sr, outName);
  statusText.textContent = '出力取得中…';
  const data = ffmpeg.FS('readFile', outName);
  const mp3Blob = new Blob([data.buffer], { type: 'audio/mpeg' });
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(mp3Blob);
  downloadBtn.hidden = false;
  statusText.textContent = '完了';
  progressEl.value = 100;
  percentText.textContent = '100%';
  addHistoryItem(currentFile.name, currentBlobUrl, bitrate, sr);
  showToast('変換が完了しました');
}

function addHistoryItem(origName, blobUrl, bitrate, sr) {
  const item = document.createElement('div');
  item.className = 'history-item';
  const left = document.createElement('div');
  left.innerHTML = `<div style="font-weight:600">${escapeHtml(origName)}</div><div style="font-size:12px;color:#9aa4b2">ビットレート ${bitrate} ・ ${sr} Hz</div>`;
  const right = document.createElement('div');
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = origName.replace(/\.[^/.]+$/, '') + '.mp3';
  a.textContent = 'ダウンロード';
  a.addEventListener('click', ()=> showToast('ダウンロードを開始します'));
  right.appendChild(a);
  item.appendChild(left);
  item.appendChild(right);
  historyEl.appendChild(item);
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
function getExtension(name){ const i = name.lastIndexOf('.'); return i>=0 ? name.slice(i) : ''; }

function handleFile(file) {
  if (!file.type.startsWith('video') && !file.type.startsWith('audio')) {
    showToast('動画または音声ファイルを選択してください');
    return;
  }
  currentFile = file;
  fileInfo.hidden = false;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = humanFileSize(file.size);
  estTimeEl.textContent = estimateTime(file.size);
  convertBtn.disabled = false;
  previewBtn.disabled = false;
  logArea.hidden = true;
  statusText.textContent = 'ファイルが選択されました';
  downloadBtn.hidden = true;
}

function resetState() {
  currentFile = null;
  fileInfo.hidden = true;
  fileInput.value = '';
  convertBtn.disabled = true;
  previewBtn.disabled = true;
  statusText.textContent = '待機中';
  progressEl.value = 0;
  percentText.textContent = '0%';
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
  downloadBtn.hidden = true;
}

statusText.textContent = 'ファイルを選択してください';

// テスト用：ページ読み込み時に convertBtn を有効化（本番では削除）
document.addEventListener('DOMContentLoaded', () => {
  const cb = document.getElementById('convertBtn');
  if (cb) {
    cb.disabled = false;
    console.log('convertBtn forced enabled for testing');
  }
});
