
(() => {
  'use strict';

// Prevent text selection on long-press within board/palette (iOS)
try {
  boardEl?.addEventListener('selectstart', e => e.preventDefault());
  document.getElementById('palette')?.addEventListener('selectstart', e => e.preventDefault());
} catch {}


  // --- Shapes ---
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

  // --- DOM ---
  const boardEl = document.getElementById('board');
  const presetSel = document.getElementById('preset');
  const wInput = document.getElementById('w');
  const hInput = document.getElementById('h');
  const newBtn = document.getElementById('newBtn');
  const holesBtn = document.getElementById('holesBtn');
  const resetHolesBtn = document.getElementById('resetHolesBtn');

  const checkBtn = document.getElementById('checkBtn');
  const suggestBtn = document.getElementById('suggestBtn');
  const solveOneBtn = document.getElementById('solveOneBtn');
  const findAllBtn = document.getElementById('findAllBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const applyBtn = document.getElementById('applyBtn');

  const pieceSelect = document.getElementById('pieceSelect');
  const rotBtn = document.getElementById('rotBtn');
  const flipBtn = document.getElementById('flipBtn');
  const removeBtn = document.getElementById('removeBtn');
  const clearPlacedBtn = document.getElementById('clearPlacedBtn');
  const palette = document.getElementById('palette');

  const statSize = document.getElementById('statSize');
  const statCells = document.getElementById('statCells');
  const statPieces = document.getElementById('statPieces');
  const statCover = document.getElementById('statCover');
  const statSolutions = document.getElementById('statSolutions');
  const statCapped = document.getElementById('statCapped');
  const statusEl = document.getElementById('status');
  const piecesPanel = document.getElementById('piecesPanel');

  // --- State ---
  let W = 10, H = 6;
  let holes = new Set(); // r*W+c
  let editHoles = false;

  let enabledPieces = new Set(PIECE_ORDER);
  const MAX_SOL = 50;

  let orient = {}; // letter -> oriented shape
  let placed = new Map(); // letter -> {cells, shape, r0, c0}
  let foundSolutions = [];
  let solIdx = -1, capped = false;

  // --- Utils ---
  const idx = (r,c)=> r*W + c;
  const rc = (k)=> [Math.floor(k/W), k%W];
  function setStatus(msg){ statusEl.textContent = msg; }

  function normalize(cells){
    let minr = Math.min(...cells.map(p=>p[0]));
    let minc = Math.min(...cells.map(p=>p[1]));
    const moved = cells.map(([r,c])=>[r-minr, c-minc]);
    moved.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
    return moved;
  }
  function rotate(cells){ return normalize(cells.map(([r,c])=>[c, -r])); }
  function reflect(cells){ return normalize(cells.map(([r,c])=>[r, -c])); }
  function orientations(cells){
    const seen = new Set(); const forms = [];
    let cur = normalize(cells);
    for (let i=0;i<4;i++){
      const a = normalize(cur), b = normalize(reflect(cur));
      const ka = JSON.stringify(a), kb = JSON.stringify(b);
      if (!seen.has(ka)){ seen.add(ka); forms.push(a); }
      if (!seen.has(kb)){ seen.add(kb); forms.push(b); }
      cur = rotate(cur);
    }
    return forms;
  }
  
// Larger drag ghost (for mobile visibility)
function createDragImage(shape, letter){
  const SQ = 24; // pixel size of each square in the ghost
  const pad = 3;
  const maxr = Math.max(...shape.map(s=>s[0])), maxc = Math.max(...shape.map(s=>s[1]));
  const w = (maxc+1)*SQ + pad*2;
  const h = (maxr+1)*SQ + pad*2;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // body
  ctx.fillStyle = pieceColor ? pieceColor(letter) : '#1e90ff';
  for (const [r,c] of shape){
    ctx.fillRect(pad + c*SQ, pad + r*SQ, SQ, SQ);
  }
  // grid outline
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 1;
  for (const [r,c] of shape){
    ctx.strokeRect(0.5 + pad + c*SQ, 0.5 + pad + r*SQ, SQ-1, SQ-1);
  }
  return {img: canvas, ox: w/2, oy: h/2};
}
function pieceColor(letter){
    const seed = letter.charCodeAt(0);
    const h = (seed*37) % 360;
    return `hsl(${h} 45% 26%)`;
  }

  // --- Render board ---
  function renderBoard(colormap=null){
    boardEl.style.setProperty('--w', W);
    boardEl.style.setProperty('--h', H);
    boardEl.innerHTML = '';
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (((r+c)%2===1)?' dark':'');
        const k = idx(r,c);
        if (holes.has(k)) cell.classList.add('hole');
        if (colormap && colormap.has(k)){
          cell.classList.add('piece');
          cell.style.background = pieceColor(colormap.get(k));
        }
        // Click to toggle hole or remove piece
        cell.addEventListener('click', ()=>{
          if (editHoles){
            if (holes.has(k)) holes.delete(k); else holes.add(k);
            foundSolutions=[]; solIdx=-1; capped=false;
            renderBoard(currentColorMap());
          } else {
            // remove piece that owns this cell
            for (const [L, obj] of placed.entries()){
              if (obj.cells.includes(k)){
                placed.delete(L); renderBoard(currentColorMap()); setStatus(`Rimosso ${L}.`); break;
              }
            }
          }
        });
        // Drag start from board (move existing piece)
        cell.draggable = true;
        cell.addEventListener('dragstart', (e)=>{
      // determine owner
      for (const [L, obj] of placed.entries()){
        if (obj.cells.includes(k)){
          const [r0, c0] = [obj.r0, obj.c0];
          const [rClick, cClick] = [r, c];
          e.dataTransfer.setData('text/plain', JSON.stringify({move:true, L, offR:rClick-r0, offC:cClick-c0}));
          try{
            const shape = obj.shape || (orient[L]||normalize(PENTOMINOES[L]));
            const g = createDragImage(shape, L);
            if (e.dataTransfer && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(g.img, g.ox, g.oy);
          } catch {}
          return;
        }
      }
      // if no owner, cancel drag
      e.preventDefault();
    });boardEl.appendChild(cell);
      }
    }
    prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = (foundSolutions.length===0);
    updateStats();
  }

  function currentColorMap(){
    const cmap = new Map();
    for (const [L, obj] of placed.entries()){
      obj.cells.forEach(k => cmap.set(k, L));
    }
    return cmap;
  }

  function updateStats(){
    const valid = H*W - holes.size;
    const covered = new Set([].concat(...[...placed.values()].map(o=>o.cells))).size;
    statSize.textContent = `${H}×${W}`;
    statCells.textContent = String(valid);
    statPieces.textContent = `${enabledPieces.size}`;
    statCover.textContent = `${covered}/${valid}`;
    statSolutions.textContent = String(foundSolutions.length);
    statCapped.textContent = capped ? '(limite raggiunto)' : '';
  }

  // --- Palette & DnD ---
  function renderPalette(){
    palette.innerHTML = '';
    for (const L of PIECE_ORDER){
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.draggable = true;
      const ctrls = document.createElement('div');
      ctrls.className = 'ctrls';
      const bR = document.createElement('button'); bR.textContent='↻'; bR.title='Ruota';
      const bF = document.createElement('button'); bF.textContent='⇋'; bF.title='Specchia';
      bR.addEventListener('click', (e)=>{ e.stopPropagation(); orient[L] = rotate(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      bF.addEventListener('click', (e)=>{ e.stopPropagation(); orient[L] = reflect(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      ctrls.appendChild(bR); ctrls.appendChild(bF);
      tile.appendChild(ctrls);

      const mini = document.createElement('div'); mini.className='mini';
      const shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
      const on = new Set(shape.map(([r,c])=>`${r},${c}`));
      for (let r=0;r<5;r++){
        for (let c=0;c<5;c++){
          const m = document.createElement('div');
          m.className = 'cell' + (on.has(`${r},${c}`)?' on':'');
          mini.appendChild(m);
        }
      }
      const label = document.createElement('div'); label.textContent=L; label.style.textAlign='center'; label.style.fontWeight='700';
      tile.appendChild(mini);
      tile.appendChild(label);

      tile.addEventListener('dragstart', (e)=>{
      e.dataTransfer.setData('text/plain', JSON.stringify({L}));
      try {
        const shape = orient[L] || (orient[L] = normalize(PENTOMINOES[L]));
        const g = createDragImage(shape, L);
        if (e.dataTransfer && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(g.img, g.ox, g.oy);
      } catch {}
    });

      palette.appendChild(tile);
    }
    // selector options
    pieceSelect.innerHTML='';
    for (const p of PIECE_ORDER){
      const opt=document.createElement('option'); opt.value=p; opt.textContent=p; pieceSelect.appendChild(opt);
    }
  }

  boardEl.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  boardEl.addEventListener('drop', (e)=>{
    e.preventDefault();
    const payload = e.dataTransfer.getData('text/plain');
    if (!payload) return;
    let data; try{ data = JSON.parse(payload); } catch{ return; }
    const rect = boardEl.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    const col = Math.min(W-1, Math.max(0, Math.floor((x-rect.left)/ (rect.width/W))));
    const row = Math.min(H-1, Math.max(0, Math.floor((y-rect.top)/ (rect.height/H))));

    let L, shape, r0=row, c0=col;
    if (data.move){
      L = data.L;
      if (!placed.has(L)) return;
      shape = placed.get(L).shape;
      r0 = row - data.offR; c0 = col - data.offC;
    } else {
      L = data.L;
      shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
    }

    // try place
    const cells = [];
    for (const [dr,dc] of shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr<0||rr>=H||cc<0||cc>=W){ setStatus('⛔ Fuori griglia.'); return; }
      const k = idx(rr,cc);
      if (holes.has(k)){ setStatus('⛔ Copre un foro.'); return; }
      // overlap check (ignore previous cells of same L if moving)
      for (const [L2, obj2] of placed){
        if (L2===L) continue;
        if (obj2.cells.includes(k)){ setStatus('⛔ Sovrapposizione.'); return; }
      }
      cells.push(k);
    }
    placed.set(L, {cells, shape, r0, c0});
    renderBoard(currentColorMap());
    setStatus(`Pezzo ${L} posizionato.`);
  });

  // --- Pieces panel ---
  function renderPiecesPanel(){
    piecesPanel.innerHTML='';
    for (const p of PIECE_ORDER){
      const label = document.createElement('label'); label.className='piece-toggle';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = enabledPieces.has(p);
      cb.addEventListener('change', ()=>{
        if (cb.checked) enabledPieces.add(p); else { enabledPieces.delete(p); placed.delete(p); }
        foundSolutions=[]; solIdx=-1; capped=false;
        renderBoard(currentColorMap());
      });
      const span = document.createElement('span'); span.textContent=p;
      label.appendChild(cb); label.appendChild(span);
      piecesPanel.appendChild(label);
    }
  }

  // --- Presets ---
  function applyPreset(name){
    holes.clear();
    if (name==='6x10'){ W=10; H=6; }
    else if (name==='5x12'){ W=12; H=5; }
    else if (name==='4x15'){ W=15; H=4; }
    else if (name==='3x20'){ W=20; H=3; }
    else if (name==='8x8h'){ W=8; H=8; holes.add(idx(0,0)); holes.add(idx(0,1)); holes.add(idx(1,0)); holes.add(idx(1,1)); }
    placed.clear(); foundSolutions=[]; solIdx=-1; capped=false;
    wInput.value = W; hInput.value = H;
    renderBoard();
    setStatus('Preset applicato.');
  }

  // --- Controls ---
  presetSel.addEventListener('change', ()=>{
    const v = presetSel.value;
    if (v==='custom'){ setStatus('Imposta larghezza/altezza e premi "Nuova Griglia".'); return; }
    applyPreset(v);
  });
  newBtn.addEventListener('click', ()=>{
    W = Math.max(3, Math.min(20, wInput.valueAsNumber || W));
    H = Math.max(3, Math.min(20, hInput.valueAsNumber || H));
    holes.clear(); placed.clear(); foundSolutions=[]; solIdx=-1; capped=false;
    renderBoard();
    setStatus('Nuova griglia.');
  });
  holesBtn.addEventListener('click', ()=>{
    editHoles = !editHoles;
    holesBtn.textContent = editHoles ? 'Fine Modifica Fori' : 'Modifica Fori';
    setStatus(editHoles ? 'Modalità fori attiva: clicca per creare/rimuovere fori.' : 'Modalità fori disattivata.');
  });
  resetHolesBtn.addEventListener('click', ()=>{ holes.clear(); renderBoard(currentColorMap()); setStatus('Fori rimossi.'); });

  rotBtn.addEventListener('click', ()=>{
    const L = pieceSelect.value; if (!L) return;
    orient[L] = rotate(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); setStatus(`Ruotato ${L}.`);
  });
  flipBtn.addEventListener('click', ()=>{
    const L = pieceSelect.value; if (!L) return;
    orient[L] = reflect(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); setStatus(`Specchiato ${L}.`);
  });
  removeBtn.addEventListener('click', ()=>{
    const L = pieceSelect.value; if (!L) return;
    placed.delete(L); renderBoard(currentColorMap()); setStatus(`Rimosso ${L}.`);
  });
  clearPlacedBtn.addEventListener('click', ()=>{ placed.clear(); renderBoard(); setStatus('Posizionamenti manuali rimossi.'); });

  // --- DLX Exact Cover ---
  function generatePlacements(){
    const validCells = []; const cellToCol = new Map();
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const k = idx(r,c);
        if (holes.has(k)) continue;
        cellToCol.set(k, validCells.length); validCells.push(k);
      }
    }
    const pieceCols = {}; let colIndex = validCells.length;
    for (const p of PIECE_ORDER){ if (enabledPieces.has(p)) pieceCols[p] = colIndex++; }
    const rows = []; const placements = [];
    for (const p of PIECE_ORDER){
      if (!enabledPieces.has(p)) continue;
      for (const shape of orientations(PENTOMINOES[p])){
        const maxr = Math.max(...shape.map(s=>s[0]));
        const maxc = Math.max(...shape.map(s=>s[1]));
        for (let r0=0; r0+maxr < H; r0++){
          for (let c0=0; c0+maxc < W; c0++){
            const cols=[]; const cells=[]; let ok=true;
            for (const [dr,dc] of shape){
              const rr=r0+dr, cc=c0+dc;
              const k = idx(rr,cc);
              if (holes.has(k)){ ok=false; break; }
              const col = cellToCol.get(k); if (col===undefined){ ok=false; break; }
              cols.push(col); cells.push(k);
            }
            if (!ok) continue;
            cols.sort((a,b)=>a-b);
            cols.push(pieceCols[p]);
            rows.push(cols);
            placements.push({piece:p, cells});
          }
        }
      }
    }
    return {numCols: colIndex, rows, placements};
  }

  function exactCoverSolve(limit=1, preselectRows=null){
    const {numCols, rows, placements} = generatePlacements();

    // Build DLX structure
    const header = {L:null,R:null,U:null,D:null,C:null,S:0};
    header.L = header.R = header;
    const cols = [];
    function linkLR(a,b){ a.R=b; b.L=a; }
    function linkUD(a,b){ a.D=b; b.U=a; }

    for (let i=0;i<numCols;i++){
      const col = {L:null,R:null,U:null,D:null,C:null,S:0,name:i};
      col.U=col.D=col; col.C=col;
      linkLR(header.L||header, col); linkLR(col, header);
      cols.push(col);
    }

    const rowNodes=[];
    for (let r=0;r<rows.length;r++){
      const colsInRow = rows[r];
      let first=null;
      for (let j=0;j<colsInRow.length;j++){
        const cidx = colsInRow[j];
        const col = cols[cidx];
        const node = {L:null,R:null,U:null,D:null,C:col,row:r};
        linkUD(col.U, node); linkUD(node, col); col.S++;
        if (first){ linkLR(first.L, node); linkLR(node, first); } else { first=node; first.L=first.R=first; }
      }
      rowNodes.push(first);
    }

    function cover(col){
      col.R.L = col.L; col.L.R = col.R;
      for (let i=col.D; i!==col; i=i.D){
        for (let j=i.R; j!==i; j=j.R){
          j.D.U = j.U; j.U.D = j.D; j.C.S--;
        }
      }
    }
    function uncover(col){
      for (let i=col.U; i!==col; i=i.U){
        for (let j=i.L; j!==i; j=j.L){
          j.C.S++; j.D.U = j; j.U.D = j;
        }
      }
      col.R.L = col; col.L.R = col;
    }
    function chooseColumn(){
      let best=null, s=Infinity;
      for (let c=header.R; c!==header; c=c.R){ if (c.S < s){ s=c.S; best=c; if (s<=1) break; } }
      return best;
    }

    const solution=[]; const solutions=[];

    // Preselect manual placements
    if (preselectRows && preselectRows.length){
      for (const rIndex of preselectRows){
        const rnode = rowNodes[rIndex];
        for (let j=rnode; ; j=j.R){ cover(j.C); if (j.R===rnode) break; }
        solution.push(rIndex);
      }
    }

    function search(){
      if (header.R===header){ solutions.push(solution.slice().map(r=>placements[r])); return; }
      const col = chooseColumn(); if (!col || col.S===0) return;
      cover(col);
      for (let r=col.D; r!==col; r=r.D){
        solution.push(r.row);
        for (let j=r.R; j!==r; j=j.R) cover(j.C);
        search();
        for (let j=r.L; j!==r; j=j.L) uncover(j.C);
        solution.pop();
        if (solutions.length>=limit){ uncover(col); return; }
      }
      uncover(col);
    }

    search();
    return solutions;
  }

  function preselectRowsForPlaced(){
    const {rows, placements} = generatePlacements();
    const keyToIdx = new Map();
    placements.forEach((pl, i)=>{
      const key = pl.piece + ':' + JSON.stringify(pl.cells.slice().sort((a,b)=>a-b));
      keyToIdx.set(key, i);
    });
    const need = [];
    for (const [L, obj] of placed.entries()){
      const key = L + ':' + JSON.stringify(obj.cells.slice().sort((a,b)=>a-b));
      const idx = keyToIdx.get(key);
      if (idx===undefined) return null;
      need.push(idx);
    }
    return need;
  }

  // --- Actions using solver ---
  checkBtn.addEventListener('click', ()=>{
    const need = enabledPieces.size * 5;
    const valid = H*W - holes.size;
    if (need !== valid){ setStatus(`⚠️ Area non coerente: celle valide=${valid}, richieste=${need}.`); }
    else setStatus('Area coerente. Puoi risolvere o posizionare a mano.');
  });

  suggestBtn.addEventListener('click', ()=>{
    const pre = preselectRowsForPlaced();
    if (pre===null){ setStatus('⛔ Posizionamenti manuali incoerenti.'); return; }
    const sols = exactCoverSolve(1, pre);
    if (!sols.length){ setStatus('Nessuna soluzione compatibile.'); return; }
    const sol = sols[0];
    const placedSet = new Set(placed.keys());
    const next = sol.find(pl => !placedSet.has(pl.piece));
    if (!next){ setStatus('Tutti i pezzi già posizionati.'); return; }
    placed.set(next.piece, {cells: next.cells.slice(), shape: null, r0:0, c0:0});
    renderBoard(currentColorMap());
    setStatus(`Suggerimento applicato: pezzo ${next.piece}.`);
  });

  solveOneBtn.addEventListener('click', ()=>{
    const pre = preselectRowsForPlaced();
    if (pre===null){ setStatus('⛔ Posizionamenti manuali incoerenti.'); return; }
    const sols = exactCoverSolve(1, pre);
    foundSolutions = sols; solIdx = sols.length?0:-1; capped=false;
    if (!sols.length){ renderBoard(currentColorMap()); setStatus('Nessuna soluzione trovata.'); updateStats(); return; }
    const cmap = new Map(); sols[0].forEach(pl => pl.cells.forEach(k => cmap.set(k, pl.piece)));
    renderBoard(cmap); setStatus('Soluzione applicata.');
  });

  findAllBtn.addEventListener('click', ()=>{
    const pre = preselectRowsForPlaced();
    if (pre===null){ setStatus('⛔ Posizionamenti manuali incoerenti.'); return; }
    const sols = exactCoverSolve(MAX_SOL, pre);
    foundSolutions = sols; solIdx = sols.length?0:-1; capped = sols.length>=MAX_SOL;
    if (!sols.length){ renderBoard(currentColorMap()); setStatus('Nessuna soluzione.'); updateStats(); return; }
    previewSolution(solIdx); setStatus(`Trovate ${sols.length} soluzioni${capped?' (limite)':''}.`);
  });

  function previewSolution(i){
    const sol = foundSolutions[i]; const cmap = new Map();
    sol.forEach(pl => pl.cells.forEach(k => cmap.set(k, pl.piece)));
    renderBoard(cmap);
    prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = false;
  }
  prevBtn.addEventListener('click', ()=>{
    if (!foundSolutions.length) return;
    solIdx = (solIdx - 1 + foundSolutions.length) % foundSolutions.length;
    previewSolution(solIdx); setStatus(`Anteprima ${solIdx+1}/${foundSolutions.length}.`);
  });
  nextBtn.addEventListener('click', ()=>{
    if (!foundSolutions.length) return;
    solIdx = (solIdx + 1) % foundSolutions.length;
    previewSolution(solIdx); setStatus(`Anteprima ${solIdx+1}/${foundSolutions.length}.`);
  });
  applyBtn.addEventListener('click', ()=>{
    if (!foundSolutions.length) return;
    previewSolution(solIdx); setStatus('Soluzione applicata.');
  });

  // --- Init UI ---
  function renderPiecesSelect(){ pieceSelect.innerHTML=''; for (const p of PIECE_ORDER){ const o=document.createElement('option'); o.value=p; o.textContent=p; pieceSelect.appendChild(o);} }
  renderPiecesSelect();
  renderPiecesPanel();
  renderPalette();
  applyPreset('6x10');

  // PWA install
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; installBtn.hidden = False;
  });
  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true;
  });

})();


// === Pointer-based Drag & Drop (works on mobile + desktop) ===
(function(){
  try{
    if (typeof boardEl === 'undefined' || !boardEl) return;
    // state shared with existing code
    window.__PEZZALI_DRAG = window.__PEZZALI_DRAG || null;
    const getIdx = (r,c)=> r*W + c;

    function eventToCell(e){
      const rect = boardEl.getBoundingClientRect();
      const col = Math.min(W-1, Math.max(0, Math.floor((e.clientX-rect.left)/(rect.width/W))));
      const row = Math.min(H-1, Math.max(0, Math.floor((e.clientY-rect.top)/(rect.height/H))));
      return {row, col};
    }

    function canPlaceShapeAt(shape, r0, c0, ignoreLetter=null){
      const cells=[];
      for (const [dr,dc] of shape){
        const rr=r0+dr, cc=c0+dc;
        if (rr<0||rr>=H||cc<0||cc>=W) return {ok:false,cells:[]};
        const k=getIdx(rr,cc);
        if (holes.has(k)) return {ok:false,cells:[]};
        for (const [L2,obj2] of placed){
          if (ignoreLetter && L2===ignoreLetter) continue;
          if (obj2.cells.includes(k)) return {ok:false,cells:[]};
        }
        cells.push(k);
      }
      return {ok:true,cells};
    }

    function updatePreviewFromEvent(e){
      const DRAG = window.__PEZZALI_DRAG; if (!DRAG) return;
      const {row,col} = eventToCell(e);
      const r0 = row - DRAG.anchor.r;
      const c0 = col - DRAG.anchor.c;
      const ignore = (DRAG.src==='board') ? DRAG.L : null;
      const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
      const set = new Set();
      for (const [dr,dc] of DRAG.shape){
        const rr=r0+dr, cc=c0+dc;
        if (rr>=0 && rr<H && cc>=0 && cc<W) set.add(getIdx(rr,cc));
      }
      window.__PEZZALI_DRAG.preview = {set, bad: !probe.ok};
      // re-render if renderBoard exists
      if (typeof renderBoard === 'function') renderBoard();
    }

    function commitFromEvent(e){
      const DRAG = window.__PEZZALI_DRAG; if (!DRAG) return;
      const {row,col} = eventToCell(e);
      const r0 = row - DRAG.anchor.r;
      const c0 = col - DRAG.anchor.c;
      const ignore = (DRAG.src==='board') ? DRAG.L : null;
      const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
      if (!probe.ok){ window.__PEZZALI_DRAG=null; if (typeof setStatus==='function') setStatus('⛔ Posizione non valida.'); if (typeof renderBoard==='function') renderBoard(); return; }
      placed.set(DRAG.L, {cells:probe.cells, r0, c0, shape: DRAG.shape.map(x=>x.slice())});
      window.__PEZZALI_DRAG=null; if (typeof renderBoard==='function') renderBoard(); if (typeof setStatus==='function') setStatus('Pezzo posizionato.');
    }

    // Attach pointer handlers to palette tiles and board cells after each render
    const __origRenderPalette = (typeof renderPalette==='function') ? renderPalette : null;
    const __origRenderBoard   = (typeof renderBoard==='function') ? renderBoard : null;

    if (__origRenderPalette){
      window.renderPalette = function(){
        __origRenderPalette();
        // attach pointerdown to each tile
        document.querySelectorAll('#palette .tile').forEach(tile => {
          const L = tile.querySelector('div:last-child')?.textContent?.trim();
          if (!L) return;
          tile.setAttribute('draggable','false');
          tile.addEventListener('pointerdown', (e)=>{ e.preventDefault();
            const shape = orient[L] || (orient[L] = normalize(PENTOMINOES[L]));
            window.__PEZZALI_DRAG = { L, shape: shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
            tile.setPointerCapture?.(e.pointerId);
          });
        });
      }
    }

    if (__origRenderBoard){
      window.renderBoard = function(colormap){
        __origRenderBoard(colormap);
        // attach pointer handlers to cells
        const cells = boardEl.querySelectorAll('.cell');
        cells.forEach((cell, i) => {
          const r = Math.floor(i/W), c = i%W;
          // start dragging from piece
          cell.addEventListener('pointerdown', (e)=>{ e.preventDefault();
            if (!cell.classList.contains('piece')) return;
            const hit = [...placed.entries()].find(([L,obj])=>obj.cells.includes(r*W+c));
            if (!hit) return;
            const [L, obj] = hit;
            window.__PEZZALI_DRAG = { L, shape: (obj.shape || orient[L] || normalize(PENTOMINOES[L])).map(x=>x.slice()), src:'board', anchor:{r:r-obj.r0, c:c-obj.c0} };
            cell.setPointerCapture?.(e.pointerId);
          });
        });
      }
      // global move/up
      window.addEventListener('pointermove', (e)=>{ if (window.__PEZZALI_DRAG) updatePreviewFromEvent(e); }, {passive:true});
      boardEl.addEventListener('pointerup',   (e)=>{ if (window.__PEZZALI_DRAG) commitFromEvent(e); });
      window.addEventListener('pointerup', (e)=>{
        if (!window.__PEZZALI_DRAG) return;
        const rect = boardEl.getBoundingClientRect();
        if (e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom){
          commitFromEvent(e);
        } else {
          window.__PEZZALI_DRAG=null;
          if (typeof setStatus==='function') setStatus('Posizionamento annullato.');
          if (typeof renderBoard==='function') renderBoard();
        }
      });
    }
  }catch(e){ console.error('Pointer DnD init error', e); }
})();

// Mark dynamically created cells as not draggable (avoid native iOS DnD/text selection)
(function(){
  const o = window.renderBoard;
  if (!o) return;
  window.renderBoard = function(arg){
    o(arg);
    document.querySelectorAll('.cell').forEach(c => c.setAttribute('draggable','false'));
  }
})();


// === Touch fallback for iOS (when pointer events are flaky) ===
(function(){
  try{
    if (typeof boardEl === 'undefined' || !boardEl) return;
    const paletteEl = document.getElementById('palette');
    let preventScroll = false;
    function onTouchMoveBlock(e){ if (preventScroll) e.preventDefault(); }
    window.addEventListener('touchmove', onTouchMoveBlock, {passive:false});

    function tEventToCell(t){
      const rect = boardEl.getBoundingClientRect();
      const col = Math.min(W-1, Math.max(0, Math.floor((t.clientX-rect.left)/(rect.width/W))));
      const row = Math.min(H-1, Math.max(0, Math.floor((t.clientY-rect.top)/(rect.height/H))));
      return {row,col};
    }
    function tUpdatePreview(t){
      const DRAG = window.__PEZZALI_DRAG; if (!DRAG) return;
      const {row,col} = tEventToCell(t);
      const r0=row-DRAG.anchor.r, c0=col-DRAG.anchor.c;
      const ignore = (DRAG.src==='board') ? DRAG.L : null;
      const probe = (typeof canPlaceShapeAt==='function')
        ? canPlaceShapeAt(DRAG.shape, r0, c0, ignore)
        : {ok:true,cells:[]};
      const set = new Set();
      for (const [dr,dc] of DRAG.shape){
        const rr=r0+dr, cc=c0+dc;
        if (rr>=0 && rr<H && cc>=0 && cc<W) set.add(rr*W+cc);
      }
      window.__PEZZALI_DRAG.preview = {set, bad: !probe.ok};
      if (typeof renderBoard==='function') renderBoard();
    }
    function tCommit(t){
      const DRAG = window.__PEZZALI_DRAG; if (!DRAG) return;
      const {row,col} = tEventToCell(t);
      const r0=row-DRAG.anchor.r, c0=col-DRAG.anchor.c;
      const ignore = (DRAG.src==='board') ? DRAG.L : null;
      const probe = (typeof canPlaceShapeAt==='function')
        ? canPlaceShapeAt(DRAG.shape, r0, c0, ignore)
        : {ok:false,cells:[]};
      preventScroll=false;
      if (!probe.ok){ window.__PEZZALI_DRAG=null; if (typeof renderBoard==='function') renderBoard(); if (typeof setStatus==='function') setStatus('⛔ Posizione non valida.'); return; }
      placed.set(DRAG.L, {cells:probe.cells, r0, c0, shape:DRAG.shape.map(x=>x.slice())});
      window.__PEZZALI_DRAG=null; if (typeof renderBoard==='function') renderBoard(); if (typeof setStatus==='function') setStatus('Pezzo posizionato.');
    }

    function attachTileTouch(tile){
      const L = tile.querySelector('div:last-child')?.textContent?.trim();
      if (!L) return;
      tile.setAttribute('draggable','false');
      tile.addEventListener('touchstart', (e)=>{
        const t=e.changedTouches[0]; if (!t) return;
        e.preventDefault(); e.stopPropagation();
        const shape = orient[L] || (orient[L]=normalize(PENTOMINOES[L]));
        window.__PEZZALI_DRAG = { L, shape: shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
        preventScroll=true;
        tUpdatePreview(t);
      }, {passive:false});
    }

    function attachCellTouch(cell, r, c){
      cell.setAttribute('draggable','false');
      cell.addEventListener('touchstart', (e)=>{
        if (!cell.classList.contains('piece')) return;
        const t=e.changedTouches[0]; if (!t) return;
        e.preventDefault(); e.stopPropagation();
        const hit=[...placed.entries()].find(([L,obj])=>obj.cells.includes(r*W+c));
        if (!hit) return;
        const [L,obj]=hit;
        window.__PEZZALI_DRAG = { L, shape:(obj.shape||orient[L]||normalize(PENTOMINOES[L])).map(x=>x.slice()), src:'board', anchor:{r:r-obj.r0,c:c-obj.c0} };
        preventScroll=true;
        tUpdatePreview(t);
      }, {passive:false});
    }

    // Wire up after render
    const _origPal = window.renderPalette;
    if (_origPal){
      window.renderPalette = function(){
        _origPal();
        document.querySelectorAll('#palette .tile').forEach(attachTileTouch);
      }
    }
    const _origBoard = window.renderBoard;
    if (_origBoard){
      window.renderBoard = function(colormap){
        _origBoard(colormap);
        const cells = boardEl.querySelectorAll('.cell');
        cells.forEach((cell,i)=> attachCellTouch(cell, Math.floor(i/W), i%W));
      }
    }
    // Global trackers
    window.addEventListener('touchmove', (e)=>{
      if (!window.__PEZZALI_DRAG) return;
      const t=e.changedTouches[0]; if (!t) return;
      tUpdatePreview(t);
    }, {passive:false});
    window.addEventListener('touchend', (e)=>{
      if (!window.__PEZZALI_DRAG) return;
      const t=e.changedTouches[0]; if (!t) return;
      // commit only if over board
      const rect=boardEl.getBoundingClientRect();
      if (t.clientX>=rect.left && t.clientX<=rect.right && t.clientY>=rect.top && t.clientY<=rect.bottom){
        tCommit(t);
      } else {
        preventScroll=false; window.__PEZZALI_DRAG=null;
        if (typeof renderBoard==='function') renderBoard();
        if (typeof setStatus==='function') setStatus('Posizionamento annullato.');
      }
    }, {passive:false});
    window.addEventListener('touchcancel', ()=>{ preventScroll=false; window.__PEZZALI_DRAG=null; if (typeof renderBoard==='function') renderBoard(); }, {passive:false});
  }catch(err){ console.error('Touch fallback init error', err); }
})();