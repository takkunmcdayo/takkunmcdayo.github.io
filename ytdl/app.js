// Utility: Validate and extract YouTube video ID
function extractYouTubeId(url) {
  try {
    const u = new URL(url.trim());
    // youtu.be/xxxx
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
    // www.youtube.com/watch?v=xxxx
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        return u.searchParams.get("v");
      }
      // share formats like /shorts/ID or /live/ID -> treat similarly if exists
      const pathParts = u.pathname.split("/").filter(Boolean);
      if (pathParts.length === 2 && (pathParts[0] === "shorts" || pathParts[0] === "live")) {
        return pathParts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// oEmbed fetch for metadata (title, author)
async function fetchOEmbed(url) {
  const endpoint = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url);
  const res = await fetch(endpoint, { method: "GET" });
  if (!res.ok) throw new Error("oEmbedの取得に失敗しました");
  return res.json();
}

const ytInput = document.getElementById("yt-url");
const previewBtn = document.getElementById("preview-btn");
const previewArea = document.getElementById("preview-area");
const metaEl = document.getElementById("meta");

const fileInput = document.getElementById("video-file");
const nameInput = document.getElementById("download-name");
const prepareBtn = document.getElementById("prepare-btn");
const downloadLink = document.getElementById("download-link");
const fileInfo = document.getElementById("file-info");

// Render preview iframe (privacy enhanced)
function renderPreview(videoId) {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}`;
  previewArea.innerHTML = `<iframe src="${src}" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
}

// Handle preview
previewBtn.addEventListener("click", async () => {
  const url = ytInput.value;
  const id = extractYouTubeId(url);
  metaEl.textContent = "";
  if (!id) {
    previewArea.innerHTML = `<span style="color: var(--danger)">有効なYouTube動画URLではありません</span>`;
    return;
  }
  renderPreview(id);
  try {
    const data = await fetchOEmbed(url);
    metaEl.innerHTML = `タイトル: <strong>${data.title}</strong> ｜ チャンネル: <strong>${data.author_name}</strong>`;
    // Suggest file name if empty
    if (!nameInput.value) {
      // sanitize title for filename
      const safeTitle = data.title.replace(/[\\/:*?"<>|]/g, "").trim();
      nameInput.value = `${safeTitle || id}.mp4`;
    }
  } catch {
    metaEl.textContent = "メタ情報の取得に失敗しました";
  }
});

// Prepare blob download for local file
prepareBtn.addEventListener("click", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    fileInfo.textContent = "動画ファイルを選択してください";
    fileInfo.style.color = "var(--danger)";
    return;
  }
  const preferredName = (nameInput.value || file.name).trim();
  // Create object URL
  const url = URL.createObjectURL(file);
  downloadLink.href = url;
  // Set a safe filename (browser may respect it)
  downloadLink.download = preferredName;
  downloadLink.style.display = "inline-block";
  fileInfo.style.color = "var(--ok)";
  fileInfo.textContent = `準備完了: ${preferredName}（${(file.size / (1024 * 1024)).toFixed(2)} MB）`;
});

// Cleanup blob URL when leaving page
window.addEventListener("beforeunload", () => {
  if (downloadLink.href.startsWith("blob:")) {
    try { URL.revokeObjectURL(downloadLink.href); } catch {}
  }
});
