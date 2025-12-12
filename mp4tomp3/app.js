import { createFFmpeg, fetchFile } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js";

const fileInput = document.getElementById('fileInput');
const startBtn = document.getElementById('startBtn');
const uploadBar = document.getElementById('uploadBar');
const convertBar = document.getElementById('convertBar');
const uploadText = document.getElementById('uploadText');
const convertText = document.getElementById('convertText');
const statusEl = document.getElementById('status');
const bitrateEl = document.getElementById('bitrate');
const resultEl = document.getElementById('result');
const audioPlayer = document.getElementById('audioPlayer');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;
let ffmpeg = null;
let isConverting = false;

fileInput.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) {
    selectedFile = null;
    startBtn.disabled = true;
    statusEl.textContent = 'ファイルを選択してください。';
    return;
  }
  selectedFile = f;
  startBtn.disabled = false;
  statusEl.textContent = `選択: ${f.name} (${Math.round(f.size/1024/1024)} MB)`;
  resetProgress();
});

startBtn.addEventListener('click', async () => {
  if (!selectedFile || isConverting) return;
  isConverting = true;
  startBtn.disabled = true;
  resultEl.classList.add('hidden');
  setUploadProgress(0, '読み込み開始…');

  try {
    // 1) ファイルをチャンクで読み込む（読み込み進捗を表示）
    const fileData = await readFileWithProgress(selectedFile, (loaded, total) => {
      const pct = total ? Math.round((loaded/total)*100) : 0;
      setUploadProgress(pct, `読み込み: ${pct}%`);
    });

    setUploadProgress(100, '読み込み完了');

    // 2) FFmpegを準備
    await ensureFFmpeg();

    // 3) FFmpegにファイルを書き込む
    const inName = 'input' + getExtension(selectedFile.name);
    const outName = 'output.mp3';
    ffmpeg.FS('writeFile', inName, fileData);

    // 4) 変換進捗を受け取る
    ffmpeg.setProgress(({ ratio }) => {
      const pct = Math.min(100, Math.round(ratio * 100));
      setConvertProgress(pct, `変換: ${pct}%`);
    });

    setConvertProgress(0, '変換開始…');

    // 5) 実行
    const bitrate = bitrateEl.value || '192k';
    await ffmpeg.run(
      '-i', inName,
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', bitrate,
      outName
    );

    // 6) 出力を取得してダウンロード用に準備
    const data = ffmpeg.FS('readFile', outName);
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    audioPlayer.src = url;
    downloadLink.href = url;
    downloadLink.download = selectedFile.name.replace(/\.[^.]+$/, '') + '.mp3';

    resultEl.classList.remove('hidden');
    setConvertProgress(100, '変換完了');
    statusEl.textContent = '完了：ダウンロード可能です。';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'エラーが発生しました。コンソールを確認してください。';
    setConvertProgress(0, 'エラー');
  } finally {
    isConverting = false;
    startBtn.disabled = false;
  }
});

/* ヘルパー関数 */

function resetProgress() {
  setUploadProgress(0, '未開始');
  setConvertProgress(0, '未開始');
  statusEl.textContent = '';
}

function setUploadProgress(pct, text) {
  uploadBar.style.width = pct + '%';
  uploadText.textContent = text;
}

function setConvertProgress(pct, text) {
  convertBar.style.width = pct + '%';
  convertText.textContent = text;
}

function getExtension(name) {
  const m = name.match(/\.[^.]+$/);
  return m ? m[0] : '';
}

// ファイルをチャンクで読み込み、進捗コールバックを呼ぶ
async function readFileWithProgress(file, onProgress) {
  // ブラウザの File.stream() を使う（対応ブラウザで動作）
  if (file.stream) {
    const reader = file.stream().getReader();
    const chunks = [];
    let loaded = 0;
    const total = file.size;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
    // 結合してUint8Arrayにする
    const result = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  // フォールバック：FileReader（進捗イベントあり）
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    fr.onload = () => {
      onProgress(file.size, file.size);
      resolve(new Uint8Array(fr.result));
    };
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });
}

async function ensureFFmpeg() {
  if (ffmpeg) return ffmpeg;
  statusEl.textContent = 'FFmpegを読み込み中…（初回は数十MB）';
  ffmpeg = createFFmpeg({ log: true, corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js" });
  await ffmpeg.load();
  statusEl.textContent = 'FFmpeg準備完了';
  return ffmpeg;
}
