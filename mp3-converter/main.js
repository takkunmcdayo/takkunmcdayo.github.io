// main.js
import { createFFmpeg, fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.1/dist/ffmpeg.min.js';

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const droptext = document.getElementById('droptext');
const convertBtn = document.getElementById('convertBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const logEl = document.getElementById('log');
const downloadLink = document.getElementById('downloadLink');
const bitrateSelect = document.getElementById('bitrate');
const maxSizeInput = document.getElementById('maxSize');

let ffmpeg = null;
let currentFile = null;
let isConverting = false;
let aborted = false;

// Recommended: place ffmpeg-core files under ./ffmpeg-core/ to avoid COOP/COEP issues on GitHub Pages
const CORE_PATH = './ffmpeg-core/ffmpeg-core.js';

function log(msg){
  console.log(msg);
  logEl.hidden = false;
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

async function ensureFFmpeg(){
  if(ffmpeg) return ffmpeg;
  ffmpeg = createFFmpeg({
    log: true,
    corePath: CORE_PATH // try local core first
  });

  ffmpeg.setProgress(({ ratio }) => {
    const pct = Math.min(1, Math.max(0, ratio));
    progressFill.style.width = `${(pct*100).toFixed(1)}%`;
    progressText.textContent = `処理中 ${(pct*100).toFixed(1)}%`;
  });

  ffmpeg.setLogger(({ type, message }) => {
    // keep logs concise
    if(type === 'fferr' || type === 'ffout') log(message);
  });

  try {
    progressText.textContent = 'ffmpeg を読み込み中...';
    await ffmpeg.load();
    progressText.textContent = '準備完了';
    return ffmpeg;
  } catch (e) {
    // fallback: try CDN core (may fail due to COOP/COEP)
    log('ローカル core の読み込みに失敗しました。CDN を試します。');
    ffmpeg = createFFmpeg({ log:true }); // default corePath to CDN
    ffmpeg.setProgress(({ ratio }) => {
      progressFill.style.width = `${(ratio*100).toFixed(1)}%`;
      progressText.textContent = `処理中 ${(ratio*100).toFixed(1)}%`;
    });
    ffmpeg.setLogger(({ message }) => log(message));
    await ffmpeg.load();
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
  progressText.textContent = '待機中';
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
}

cancelBtn.addEventListener('click', () => {
  if(!isConverting) return;
  aborted = true;
  progressText.textContent = 'キャンセル中...';
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
    await ensureFFmpeg();

    const inName = 'input.mp4';
    const outName = 'output.mp3';
    log(`ファイルを読み込み: ${currentFile.name}`);
    ffmpeg.FS('writeFile', inName, await fetchFile(currentFile));

    const bitrate = bitrateSelect.value || '192k';
    // run ffmpeg: extract audio, convert to mp3 with selected bitrate
    progressText.textContent = '変換中...';
    // Example args: -i input.mp4 -vn -acodec libmp3lame -b:a 192k output.mp3
    await ffmpeg.run('-i', inName, '-vn', '-acodec', 'libmp3lame', '-b:a', bitrate, outName);

    if(aborted){
      resetUI();
      log('処理はキャンセルされました');
      return;
    }

    const data = ffmpeg.FS('readFile', outName);
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    downloadLink.download = `${baseName}.mp3`;
    downloadLink.hidden = false;
    progressFill.style.width = '100%';
    progressText.textContent = '完了';
    log('変換が完了しました');
  } catch (err) {
    console.error(err);
    log('エラー: ' + (err.message || err));
    progressText.textContent = 'エラーが発生しました';
    alert('変換中にエラーが発生しました。ログを確認してください。');
  } finally {
    resetUI();
  }
});

// initial UI state
resetUI();
