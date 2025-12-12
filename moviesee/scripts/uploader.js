(function () {
  const input = document.getElementById('videoInput');
  const openBtn = document.getElementById('openPlayerBtn');

  let objectUrl = null;
  let fileName = null;

  // Enable the button only when a file is chosen
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      openBtn.disabled = true;
      return;
    }
    // Create Blob URL for the selected file
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    fileName = file.name;
    openBtn.disabled = false;
  });

  openBtn.addEventListener('click', () => {
    const file = input.files?.[0];
    if (!file || !objectUrl) return;

    // Pass the Blob URL and filename via query parameters
    const url = new URL(window.location.origin + window.location.pathname.replace('index.html', '') + 'player.html');
    url.searchParams.set('src', objectUrl);
    url.searchParams.set('name', fileName);

    // Open the player page (same tab)
    window.location.href = url.toString();
  });

  // Initially disabled
  openBtn.disabled = true;
})();
