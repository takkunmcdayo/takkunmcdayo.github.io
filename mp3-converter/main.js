// main.js
import { createFFmpeg, fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.1/dist/ffmpeg.min.js';

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const droptext = document.getElementById('droptext');
const convertBtn = document.getElementById('convertBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadFill = document.getElementById('uploadFill');
const uploadText = document.getElementById('uploadText');
const stageText = document.getElementById('stageText');
const etaText = document.getElementById('etaText');
const logEl = document.getElementById('log');
const downloadLink = document.getElementById('downloadLink');
const bitrateSelect = document.getElementById('bitrate');
const maxSizeInput = document.getElementById('maxSize');

let ffmpeg = null;
let currentFile = null;
let isConverting = false;
let aborted = false;
let conversionStartTime = null;
let lastRatio = 0;

// 推奨: 同一オリジンに core を置く場合のパス
const CORE_PATH = './ffmpeg-core/ffmpeg-core.js';

function log(msg){
  console.log(msg);
  logEl.hidden = false;
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function setStage(text){
  stageText.textContent = `ステージ: ${text}`;
}

function setETA(seconds){
  if(!isFinite(seconds) || seconds < 0) { etaText.textContent = 'ETA: -'; return; }
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  etaText.textContent = `ETA: ${m}m ${sec}s`;
}

async function ensureFFmpeg(){
  if(ffmpeg) return ffmpeg;
  ffmpeg = createFFmpeg({
    log: true,
    corePath: CORE_PATH
  });

  ffmpeg.setProgress(({ ratio }) => {
    // ratio: 0..1
    const pct = Math.min(1, Math.max(0, ratio));
    progressFill.style.width = `${(pct*100).toFixed(1)}%`;
    progressText.textContent = `${(pct*100).toFixed(1)}%`;

    // ETA 推定
    if(conversionStartTime){
      const now = Date.now();
      const elapsed = (now - conversionStartTime) / 1000; // 秒
      if(pct > 0.001 && pct > lastRatio){
        const estimatedTotal = elapsed / pct;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        setETA(remaining);
      }
      lastRatio = pct;
    }
  });

  ffmpeg.setLogger(({ type, message }) => {
    if(type === 'fferr' || type === 'ffout') log(message);
  });

  try {
    setStage('ffmpeg 読み込み中');
    progressText.textContent = 'ffmpeg 読み込み中...';
    await ffmpeg.load();
    setStage('準備完了');
    progressText.textContent = '準備完了';
    return ffmpeg;
  } catch (e) {
    log('ローカル core の読み込みに失敗しました。CDN を試します。');
    ffmpeg = createFFmpeg({ log:true });
    ffmpeg.setProgress(({ ratio }) => {
      const pct = Math.min(1, Math.max(0, ratio));
      progressFill.style.width = `${(pct*100).toFixed(1)}%`;
      progressText.textContent = `${(pct*100).toFixed(1)}%`;
    });
    ffmpeg.setLogger(({ message }) => log(message));
    setStage('ffmpeg 読み込み中 (CDN)');
    await ffmpeg.load();
    setStage('準備完了');
    progressText.textContent = '準備完了';
    return ffmpeg;
  }
}

function resetUI(){
  isConverting = false;
  aborted = false;
  convertBtn.disabled = false;
  cancelBtn.disabled = true;
  progressFill.style.width = '0%';
  uploadFill.style.width = '0%';
  progressText.textContent = '待機中';
  uploadText.textContent = '0%';
  setStage('待機中');
  setETA(-1);
  conversionStartTime = null;
  lastRatio = 0;
}

function humanFileSize(bytes){
  const units = ['B','KB','MB','GB'];
  let i=0;
  while(bytes>=1024 && i<units.length-1){ bytes/=1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

// drag & drop
['dragenter','dragover'].forEach(ev=>{
  dropzone.addEventListener(ev, e=>{
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(ev=>{
  dropzone.addEventListener(ev, e=>{
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', e=>{
  const f = e.dataTransfer.files[0];
  if(f) handleFileSelected(f);
});
fileInput.addEventListener('change', e=>{
  const f = e.target.files[0];
  if(f) handleFileSelected(f);
});

function handleFileSelected(file){
  currentFile = file;
  droptext.textContent = `${file.name} (${humanFileSize(file.size)}) が選択されました`;
  downloadLink.hidden = true;
  logEl.hidden = true;
  logEl.textContent = '';
  // reset upload bar
  uploadFill.style.width = '0%';
  uploadText.textContent = '0%';
  setStage('ファイル選択済み');
  setETA(-1);
}

cancelBtn.addEventListener('click', () => {
  if(!isConverting) return;
  aborted = true;
  progressText.textContent = 'キャンセル中...';
  setStage('キャンセル中');
  try {
    ffmpeg.exit();
  } catch(e){
    log('キャンセル要求を送信しました');
  }
});

convertBtn.addEventListener('click', async () => {
  if(!currentFile) return alert('ファイルを選択してください');
  const maxMB = Number(maxSizeInput.value) || 200;
  if(currentFile.size > maxMB * 1024 * 1024){
    if(!confirm(`ファイルサイズが ${maxMB} MB を超えています。続行しますか？`)) return;
  }

  convertBtn.disabled = true;
  cancelBtn.disabled = false;
  isConverting = true;
  aborted = false;
  progressText.textContent = '準備中...';
  logEl.hidden = true;
  logEl.textContent = '';

  try {
    // 1) 読み込み（FileReader）で進捗を表示
    setStage('ファイル読み込み中');
    const arrayBuffer = await readFileWithProgress(currentFile, (loaded, total) => {
      const pct = total ? (loaded / total) : 0;
      uploadFill.style.width = `${(pct*100).toFixed(1)}%`;
      uploadText.textContent = `${(pct*100).toFixed(1)}%`;
    });

    if(aborted){
      resetUI();
      log('読み込みはキャンセルされました');
      return;
    }

    // 2) ffmpeg 準備
    await ensureFFmpeg();

    const inName = 'input.mp4';
    const outName = 'output.mp3';
    setStage('ファイルを仮想FSへ書き込み');
    progressText.textContent = 'ファイル書き込み中...';
    // writeFile は同期的に動くため大きいと時間がかかる。ここでは進捗は FileReader 側で表示済み。
    ffmpeg.FS('writeFile', inName, new Uint8Array(arrayBuffer));

    if(aborted){
      resetUI();
      log('処理はキャンセルされました');
      return;
    }

    // 3) 変換開始
    const bitrate = bitrateSelect.value || '192k';
    setStage('変換中');
    progressText.textContent = '変換中...';
    conversionStartTime = Date.now();
    lastRatio = 0;

    // 実行
    await ffmpeg.run('-i', inName, '-vn', '-acodec', 'libmp3lame', '-b:a', bitrate, outName);

    if(aborted){
      resetUI();
      log('処理はキャンセルされました');
      return;
    }

    // 4) 出力読み取り
    setStage('出力準備中');
    progressText.textContent = '出力を読み込み中...';
    const data = ffmpeg.FS('readFile', outName);
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    downloadLink.download = `${baseName}.mp3`;
    downloadLink.hidden = false;
    progressFill.style.width = '100%';
    progressText.textContent = '完了';
    setStage('完了');
    setETA(0);
    log('変換が完了しました');
  } catch (err) {
    console.error(err);
    log('エラー: ' + (err.message || err));
    progressText.textContent = 'エラーが発生しました';
    setStage('エラー');
    alert('変換中にエラーが発生しました。ログを確認してください。');
  } finally {
    resetUI();
  }
});

// FileReader で読み込み進捗を取得するユーティリティ
function readFileWithProgress(file, onProgress){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if(e.lengthComputable && typeof onProgress === 'function'){
        onProgress(e.loaded, e.total);
      }
    };
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('ファイル読み込みに失敗しました'));
    reader.onabort = () => reject(new Error('ファイル読み込みが中断されました'));
    reader.readAsArrayBuffer(file);
  });
}

// 初期化
resetUI();
