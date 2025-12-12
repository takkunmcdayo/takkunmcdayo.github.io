import { createFFmpeg, fetchFile } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js";

const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");
const bitrateEl = document.getElementById("bitrate");
const resultEl = document.getElementById("result");
const audioPlayer = document.getElementById("audioPlayer");
const downloadLink = document.getElementById("downloadLink");

let selectedFile = null;
let ffmpeg;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function enableConvert(enabled) {
  convertBtn.disabled = !enabled;
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault(); dropzone.classList.add("drag");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("drag");
  const file = e.dataTransfer.files?.[0];
  if (file) onFileSelected(file);
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) onFileSelected(file);
});

function onFileSelected(file) {
  selectedFile = file;
  enableConvert(true);
  setStatus(`選択: ${file.name}（${Math.round(file.size / 1024 / 1024)} MB）`);
}

async function ensureFFmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
  });
  setStatus("FFmpegを読み込み中…（初回のみ数十MB）");
  await ffmpeg.load();
  return ffmpeg;
}

convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  enableConvert(false);
  resultEl.classList.add("hidden");

  try {
    await ensureFFmpeg();

    const inputName = selectedFile.name;
    const inName = "input";
    const outName = "output.mp3";
    const bitrate = bitrateEl.value;

    ffmpeg.FS("writeFile", inName, await fetchFile(selectedFile));

    setStatus("音声抽出とエンコード中…");
    // -vn: 映像無効, -acodec libmp3lame: MP3, -b:a: ビットレート設定
    await ffmpeg.run(
      "-i", inName,
      "-vn",
      "-acodec", "libmp3lame",
      "-b:a", bitrate,
      outName
    );

    const data = ffmpeg.FS("readFile", outName);
    const blob = new Blob([data.buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    audioPlayer.src = url;
    downloadLink.href = url;
    downloadLink.download = inputName.replace(/\.[^.]+$/, "") + ".mp3";

    resultEl.classList.remove("hidden");
    setStatus("完了。ダウンロード可能です。");
  } catch (err) {
    console.error(err);
    setStatus("変換中にエラーが発生しました。ファイル形式を確認してください。");
  } finally {
    enableConvert(true);
  }
});
