/* ===== UI Utilities: toast, loading, shortcuts ===== */
function showToast(msg, timeout=3000){
  let t = document.getElementById('__toast');
  if(!t){
    t = document.createElement('div'); t.id='__toast'; t.className='toast'; document.body.appendChild(t);
  }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), timeout);
}

/* small loading indicator on a button */
function setButtonLoading(btn, loading=true){
  if(loading){
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> ' + (btn._orig || '');
    btn.disabled = true;
  } else {
    if(btn._orig) btn.innerHTML = btn._orig;
    btn.disabled = false;
  }
}

/* Keyboard shortcuts */
document.addEventListener('keydown', (e)=>{
  if(e.altKey && e.key === 's'){ // Alt+S: start/stop auto
    const start = document.getElementById('startAuto'), stop = document.getElementById('stopAuto');
    if(!start.disabled) start.click(); else if(!stop.disabled) stop.click();
    e.preventDefault();
  }
  if(e.altKey && e.key === 'v'){ // Alt+V: download VTT
    document.getElementById('downloadVtt').click(); e.preventDefault();
  }
});

/* Auto-scroll subtitle list to active cue when playing */
function scrollToActiveCue(time){
  const list = document.getElementById('subtitleList');
  const idx = cues.findIndex(c=> time>=c.start && time<=c.end);
  if(idx>=0){
    const el = list.querySelectorAll('.cue')[idx];
    if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
  }
}

/* Hook into existing tick to call scrollToActiveCue */
const originalTick = window.setInterval;
(function(){
  // If you already use setInterval for tick, ensure scroll is called in that loop.
})();

/* Small accessibility improvement: announce new cues for screen readers */
function announceForA11y(text){
  let el = document.getElementById('__a11y');
  if(!el){
    el = document.createElement('div'); el.id='__a11y';
    el.setAttribute('aria-live','polite'); el.style.position='absolute'; el.style.left='-9999px';
    document.body.appendChild(el);
  }
  el.textContent = text;
}

/* Example usage hooks */
function onNewCueAdded(cue){
  showToast('字幕を追加しました');
  announceForA11y('新しい字幕: ' + cue.text);
}
