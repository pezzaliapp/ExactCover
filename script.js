// script.js — ExactCover (Pentomino) con drag mobile + anteprima chiara + flash al drop
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ---------- Riferimenti DOM (tutti opzionali: nessun early-return) ----------
  const boardEl        = document.getElementById('board');
  const presetSel      = document.getElementById('preset');
  const wInput         = document.getElementById('w');
  const hInput         = document.getElementById('h');
  const newBtn         = document.getElementById('newBtn');
  const holesBtn       = document.getElementById('holesBtn');
  const resetHolesBtn  = document.getElementById('resetHolesBtn');
  const checkBtn       = document.getElementById('checkBtn');
  const findAllBtn     = document.getElementById('findAllBtn');   // se presente
  const prevBtn        = document.getElementById('prevBtn');       // se presente
  const nextBtn        = document.getElementById('nextBtn');       // se presente
  const applyBtn       = document.getElementById('applyBtn');      // se presente
  const shuffleBtn     = document.getElementById('shuffleBtn');    // se presente
  const pieceSelect    = document.getElementById('pieceSelect');
  const rotBtn         = document.getElementById('rotBtn');
  const flipBtn        = document.getElementById('flipBtn');
  const removeBtn      = document.getElementById('removeBtn');
  const clearPlacedBtn = document.getElementById('clearPlacedBtn');
  const palette        = document.getElementById('palette');
  const statusEl       = document.getElementById('status');
  const piecesPanel    = document.getElementById('piecesPanel');   // se presente
  // stats opzionali
  const statSize       = document.getElementById('statSize');
  const statCells      = document.getElementById('statCells');
  const statPieces     = document.getElementById('statPieces');
  const statCover      = document.getElementById('statCover');
  const statSolutions  = document.getElementById('statSolutions');
  const statCapped     = document.getElementById('statCapped');
  const galleryEl      = document.getElementById('gallery');       // se presente

  // ---------- Pentomini ----------
  const PENTOMINOES = {
    F: [[0,1],[1,0],[1,1],[1,2],[2,2]],
    I: [[0,0],[1,0],[2,0],[3,0],[4,0]],
    L: [[0,0],[1,0],[2,0],[3,0],[3,1]],
    P: [[0,0],[0,1],[1,0],[1,1],[2,0]],
    N: [[0,1],[1,1],[2,1],[3,1],[3,0]],
    T: [[0,0],[0,1],[0,2],[1,1],[2,1]],
    U: [[0,0],[0,2],[1,0],[1,1],[1,2]],
    V: [[0,0],[1,0],[2,0],[2,1],[2,2]],
    W: [[0,0],[1,0],[1,1],[2,1],[2,2]],
    X: [[0,1],[1,0],[1,1],[1,2],[2,1]],
    Y: [[0,0],[1,0],[2,0],[3,0],[2,1]],
    Z: [[0,0],[0,1],[1,1],[2,1],[2,2]]
  };
  const PIECE_ORDER = Object.keys(PENTOMINOES);

  // ---------- Stato ----------
  let W = 10, H = 6;
  let holes = new Set();
  let editHoles = false;
  let enabledPieces = new Set(PIECE_ORDER);

  let orient = {};           // lettera -> shape normalizzato scelto in palette
  let placed = new Map();    // lettera -> {cells:[], r0,c0, shape}
  let DRAG = null;           // stato drag {L, shape, src, anchor:{r,c}, preview:{set,bad,r0,c0}}
  let lastEndAt = 0;

  // opzionale (solver)
  let foundSolutions = [];
  let solIdx = -1, capped = false;

  // ---------- Utilità ----------
  const idx = (r,c) => r * W + c;
  function setStatus(msg){ if (statusEl) statusEl.textContent = msg; }

  function normalize(cells){
    let minr = Math.min(...cells.map(p=>p[0])), minc = Math.min(...cells.map(p=>p[1]));
    const m = cells.map(([r,c])=>[r-minr, c-minc]);
    m.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
    return m;
  }
  function rotate(cells){ return normalize(cells.map(([r,c])=>[c,-r])); }
  function reflect(cells){ return normalize(cells.map(([r,c])=>[r,-c])); }

  function pieceColor(L){ const h=(L.charCodeAt(0)*37)%360; return `hsl(${h} 45% 26%)`; }
  function thumbColor(L){ const h=(L.charCodeAt(0)*37)%360; return `hsl(${h} 45% 30%)`; }

  function canPlaceShapeAt(shape, r0, c0, ignoreLetter=null){
    const cells = [];
    for (const [dr,dc] of shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr<0||rr>=H||cc<0||cc>=W) return {ok:false, cells:[]};
      const k = idx(rr,cc);
      if (holes.has(k)) return {ok:false, cells:[]};
      for (const [L2, obj2] of placed){
        if (ignoreLetter && L2===ignoreLetter) continue;
        if (obj2.cells.includes(k)) return {ok:false, cells:[]};
      }
      cells.push(k);
    }
    return {ok:true, cells};
  }

  // Evidenzia brevemente le celle posate (flash verde)
  function flashCells(cells){
    if (!boardEl) return;
    const cellNodes = boardEl.querySelectorAll('.cell');
    const set = new Set(cells);
    set.forEach(k=>{
      const node = cellNodes[k];
      if (node){
        node.classList.add('flash');
        setTimeout(()=> node.classList.remove('flash'), 220);
      }
    });
  }

  // ---------- Render ----------
  function renderBoard(colormap=null){
    if (!boardEl) return;
    boardEl.style.setProperty('--w', W);
    boardEl.style.setProperty('--h', H);
    boardEl.innerHTML = '';

    for (let r=0; r<H; r++){
      for (let c=0; c<W; c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (((r+c)%2===1)?' dark':'');
        const k = idx(r,c);

        // fori
        if (holes.has(k)) cell.classList.add('hole');

        // pezzi posati
        if (!colormap){
          for (const [L,obj] of placed){
            if (obj.cells.includes(k)){
              cell.classList.add('piece');
              cell.style.background = pieceColor(L);
              break;
            }
          }
        } else {
          if (colormap.has(k)){
            cell.classList.add('piece');
            cell.style.background = pieceColor(colormap.get(k));
          }
        }

        // GHOST / ANTEPRIMA (verde/rosso)
        if (DRAG && DRAG.preview){
          const set = DRAG.preview.set;
          const bad = DRAG.preview.bad;
          if (set && set.has(k)){
            cell.classList.add('preview');
            if (bad) cell.classList.add('bad');
          }
        }

        // click: gestisci fori solo quando in modalità "Modifica Fori"
        cell.addEventListener('click', ()=>{
          if (!editHoles) return;
          if (holes.has(k)) holes.delete(k); else holes.add(k);
          foundSolutions=[]; solIdx=-1; capped=false;
          renderBoard();
        }, { passive:true });

        // start drag da board (sposta pezzo già posato)
        cell.addEventListener('pointerdown', (e)=>{
          if (!cell.classList.contains('piece')) return;
          e.preventDefault();
          const hit = [...placed.entries()].find(([L,obj])=> obj.cells.includes(k));
          if (!hit) return;
          const [L,obj] = hit;
          const shape = (obj.shape || (orient[L]||normalize(PENTOMINOES[L]))).map(x=>x.slice());
          DRAG = { L, shape, src:'board', anchor:{ r: r-obj.r0, c: c-obj.c0 } };
          if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
          updatePreviewFromEvent(e);
        }, {passive:false});

        // touch fallback (iOS vecchi)
        cell.addEventListener('touchstart', (e)=>{
          if (!cell.classList.contains('piece')) return;
          const t=e.touches?.[0]; if (!t) return;
          e.preventDefault();
          const hit = [...placed.entries()].find(([L,obj])=> obj.cells.includes(k));
          if (!hit) return;
          const [L,obj] = hit;
          const shape = (obj.shape || (orient[L]||normalize(PENTOMINOES[L]))).map(x=>x.slice());
          DRAG = { L, shape, src:'board', anchor:{ r: r-obj.r0, c: c-obj.c0 } };
          updatePreviewFromPoint({x:t.clientX, y:t.clientY});
        }, {passive:false});

        boardEl.appendChild(cell);
      }
    }

    if (prevBtn && nextBtn && applyBtn){
      prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = (foundSolutions.length===0);
    }
    updateStats();
  }

  function currentColorMap(){
    const cmap = new Map();
    for (const [L,obj] of placed) obj.cells.forEach(k=>cmap.set(k, L));
    return cmap;
  }

  function updateStats(){
    const valid = W*H - holes.size;
    const covered = new Set([].concat(...[...placed.values()].map(o=>o.cells))).size;
    if (statSize)      statSize.textContent = `${H}×${W}`;
    if (statCells)     statCells.textContent = String(valid);
    if (statPieces)    statPieces.textContent = `${enabledPieces.size}`;
    if (statCover)     statCover.textContent = `${covered}/${valid}`;
    if (statSolutions) statSolutions.textContent = String(foundSolutions.length);
    if (statCapped)    statCapped.textContent = capped ? '(limite raggiunto)' : '';
  }

  // ---------- Palette ----------
  function renderPiecesSelect(){
    if (!pieceSelect) return;
    pieceSelect.innerHTML='';
    for (const p of PIECE_ORDER){
      const o=document.createElement('option');
      o.value=p; o.textContent=p;
      pieceSelect.appendChild(o);
    }
  }

  function renderPalette(){
    if (!palette) return;
    palette.innerHTML='';
    for (const L of PIECE_ORDER){
      if (!enabledPieces.has(L)) continue;

      const tile = document.createElement('div'); tile.className='tile';
      // controlli rapidi (ruota/specchia) nella tile
      const ctrls = document.createElement('div'); ctrls.className='ctrls';
      const bR = document.createElement('button'); bR.textContent='↻'; bR.title='Ruota';
      const bF = document.createElement('button'); bF.textContent='⇋'; bF.title='Specchia';
      bR.addEventListener('click', (e)=>{ e.stopPropagation(); orient[L]=rotate(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      bF.addEventListener('click', (e)=>{ e.stopPropagation(); orient[L]=reflect(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      ctrls.appendChild(bR); ctrls.appendChild(bF); tile.appendChild(ctrls);

      // mini 5x5
      const mini=document.createElement('div'); mini.className='mini';
      const shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
      const on=new Set(shape.map(([r,c])=>`${r},${c}`));
      for (let r=0;r<5;r++){
        for(let c=0;c<5;c++){
          const m=document.createElement('div');
          m.className = 'cell' + (on.has(`${r},${c}`)?' on':'');
          mini.appendChild(m);
        }
      }
      const label=document.createElement('div'); label.textContent=L; label.style.textAlign='center'; label.style.fontWeight='700';
      tile.appendChild(mini); tile.appendChild(label);
      palette.appendChild(tile);

      // start drag da palette
      tile.setAttribute('draggable','false');
      tile.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        const shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
        DRAG = { L, shape:shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
        if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        updatePreviewFromEvent(e);
      }, {passive:false});

      tile.addEventListener('touchstart', (e)=>{
        const t=e.touches?.[0]; if (!t) return;
        e.preventDefault();
        const shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
        DRAG = { L, shape:shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
        updatePreviewFromPoint({x:t.clientX, y:t.clientY});
      }, {passive:false});
    }
  }

  // ---------- Drag Mobile (Pointer + Touch) ----------
  function eventToCell(e){
    const rect = boardEl.getBoundingClientRect();
    const col = Math.min(W-1, Math.max(0, Math.floor((e.clientX-rect.left)/(rect.width/W))));
    const row = Math.min(H-1, Math.max(0, Math.floor((e.clientY-rect.top)/(rect.height/H))));
    return {row, col};
  }
  function pointToCell(pt){
    const rect = boardEl.getBoundingClientRect();
    const col = Math.min(W-1, Math.max(0, Math.floor((pt.x-rect.left)/(rect.width/W))));
    const row = Math.min(H-1, Math.max(0, Math.floor((pt.y-rect.top)/(rect.height/H))));
    return {row, col};
  }

  function updatePreviewFromEvent(e){
    if (!DRAG || !boardEl) return;
    const {row,col} = eventToCell(e);
    const r0 = row - DRAG.anchor.r;
    const c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
    const set = new Set();
    for (const [dr,dc] of DRAG.shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr>=0&&rr<H&&cc>=0&&cc<W) set.add(idx(rr,cc));
    }
    DRAG.preview = { set, bad: !probe.ok, r0, c0 };
    renderBoard();
  }
  function updatePreviewFromPoint(pt){
    if (!DRAG || !boardEl) return;
    const {row,col} = pointToCell(pt);
    const r0 = row - DRAG.anchor.r;
    const c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
    const set = new Set();
    for (const [dr,dc] of DRAG.shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr>=0&&rr<H&&cc>=0&&cc<W) set.add(idx(rr,cc));
    }
    DRAG.preview = { set, bad: !probe.ok, r0, c0 };
    renderBoard();
  }
  function commitFromEvent(){
    if (!DRAG || !DRAG.preview) return;
    const { r0, c0 } = DRAG.preview;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
    if (!probe.ok){
      setStatus('⛔ Posizione non valida.');
      DRAG=null; renderBoard();
      return;
    }
    const placedLetter = DRAG.L;
    const placedShape  = DRAG.shape.map(x=>x.slice());
    const justCells    = probe.cells.slice();
    placed.set(placedLetter, { cells: justCells, shape: placedShape, r0, c0 });
    DRAG=null; renderBoard();
    flashCells(justCells);
    setStatus(`Pezzo ${placedLetter} posizionato.`);
  }

  // global move/up (seguono dito/mouse ovunque)
  window.addEventListener('pointermove', (e)=>{ if (DRAG) updatePreviewFromEvent(e); }, {passive:true});
  window.addEventListener('pointerup',   ()=>{ if (DRAG) commitFromEvent(); lastEndAt=Date.now(); }, {passive:true});
  window.addEventListener('touchmove',   (e)=>{
    if (!DRAG) return;
    e.preventDefault();
    const t=e.touches?.[0]; if (!t) return;
    updatePreviewFromPoint({x:t.clientX, y:t.clientY});
  }, {passive:false});
  window.addEventListener('touchend', ()=>{
    if (DRAG) commitFromEvent();
    lastEndAt=Date.now();
  }, {passive:false});
  window.addEventListener('touchcancel', ()=>{ if (DRAG){ DRAG=null; renderBoard(); } }, {passive:false});

  // ---------- Pannello pezzi abilitati (facoltativo) ----------
  function renderPiecesPanel(){
    if (!piecesPanel) return;
    piecesPanel.innerHTML='';
    for (const p of PIECE_ORDER){
      const label=document.createElement('label'); label.className='piece-toggle';
      const cb=document.createElement('input'); cb.type='checkbox';
      cb.checked = enabledPieces.has(p);
      cb.addEventListener('change', ()=>{
        if (cb.checked) enabledPieces.add(p);
        else { enabledPieces.delete(p); placed.delete(p); }
        foundSolutions=[]; solIdx=-1; capped=false;
        renderPalette(); renderBoard();
      });
      const span=document.createElement('span'); span.textContent=p;
      label.appendChild(cb); label.appendChild(span);
      piecesPanel.appendChild(label);
    }
  }

  // ---------- Preset ----------
  function applyPreset(name){
    holes.clear();
    if (name==='6x10'){ W=10; H=6; }
    else if (name==='5x12'){ W=12; H=5; }
    else if (name==='4x15'){ W=15; H=4; }
    else if (name==='3x20'){ W=20; H=3; }
    else if (name==='8x8h'){ W=8; H=8; holes.add(0); holes.add(1); holes.add(8); holes.add(9); }
    placed.clear(); foundSolutions=[]; solIdx=-1; capped=false;
    if (wInput) wInput.value = W;
    if (hInput) hInput.value = H;
    renderBoard(); setStatus('Preset applicato.');
  }

  // ---------- Controlli base ----------
  if (presetSel){
    presetSel.addEventListener('change', ()=>{
      const v=presetSel.value;
      if (v==='custom'){ setStatus('Imposta L×H e premi “Nuova Griglia”.'); return; }
      applyPreset(v);
    });
  }

  if (newBtn){
    newBtn.addEventListener('click', ()=>{
      W = Math.max(3, Math.min(20, wInput?.valueAsNumber || W));
      H = Math.max(3, Math.min(20, hInput?.valueAsNumber || H));
      holes.clear(); placed.clear(); foundSolutions=[]; solIdx=-1; capped=false;
      renderBoard(); setStatus('Nuova griglia.');
    });
  }

  if (holesBtn){
    holesBtn.addEventListener('click', ()=>{
      editHoles = !editHoles;
      holesBtn.textContent = editHoles ? 'Fine Modifica Fori' : 'Modifica Fori';
      setStatus(editHoles ? 'Modalità fori attiva.' : 'Modalità fori disattivata.');
    });
  }

  if (resetHolesBtn){
    resetHolesBtn.addEventListener('click', ()=>{
      holes.clear(); renderBoard(); setStatus('Fori rimossi.');
    });
  }

  if (rotBtn){
    rotBtn.addEventListener('click', ()=>{
      const L = pieceSelect?.value; if (!L) return;
      orient[L] = rotate(orient[L] || normalize(PENTOMINOES[L]));
      renderPalette(); setStatus(`Ruotato ${L}.`);
    });
  }

  if (flipBtn){
    flipBtn.addEventListener('click', ()=>{
      const L = pieceSelect?.value; if (!L) return;
      orient[L] = reflect(orient[L] || normalize(PENTOMINOES[L]));
      renderPalette(); setStatus(`Specchiato ${L}.`);
    });
  }

  if (removeBtn){
    removeBtn.addEventListener('click', ()=>{
      const L = pieceSelect?.value; if (!L) return;
      placed.delete(L); renderBoard(); setStatus(`Rimosso ${L}.`);
    });
  }

  if (clearPlacedBtn){
    clearPlacedBtn.addEventListener('click', ()=>{
      placed.clear(); renderBoard(); setStatus('Posizionamenti manuali rimossi.');
    });
  }

  if (checkBtn){
    checkBtn.addEventListener('click', ()=>{
      const need  = [...enabledPieces].length * 5;
      const valid = W*H - holes.size;
      if (need !== valid) setStatus(`⚠️ Area non coerente: celle valide=${valid}, richieste=${need}.`);
      else setStatus('Area coerente.');
    });
  }

  if (shuffleBtn){
    shuffleBtn.addEventListener('click', ()=>{
      setStatus('Ordine casuale impostato (effetto sui solver, se attivi).');
    });
  }

  // ---------- Init ----------
  renderPiecesSelect();
  renderPiecesPanel();
  renderPalette();
  applyPreset('6x10'); // preset iniziale

  // PWA install (opzionale)
  const installBtn = document.getElementById('installBtn');
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); deferredPrompt=e; if (installBtn) installBtn.hidden=false;
  });
  installBtn?.addEventListener('click', async ()=>{
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice;
    deferredPrompt=null; installBtn.hidden=true;
  });
});
