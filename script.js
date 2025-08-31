(() => {
  'use strict';

  // --- Random utilities for diversity ---
  let RNG_SEED = Math.floor(Math.random()*1e9);
  function seedRand(seed){ RNG_SEED = seed>>>0; }
  function rand(){ // xorshift32
    let x = RNG_SEED || 123456789;
    x ^= x << 13; x ^= x >> 17; x ^= x << 5;
    RNG_SEED = x>>>0;
    return (RNG_SEED & 0xffffffff) / 0x100000000;
  }
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }


  // --- Pentomino definitions (canonical) ---
  // Coordinates normalized with (row,col), top-left origin, 5 cells each.
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
  const PIECE_ORDER = Object.keys(PENTOMINOES); // 12

  // --- DOM ---
  const boardEl = document.getElementById('board');
  const presetSel = document.getElementById('preset');
  const wInput = document.getElementById('w');
  const hInput = document.getElementById('h');
  const newBtn = document.getElementById('newBtn');
  const holesBtn = document.getElementById('holesBtn');
  const resetBtn = document.getElementById('resetBtn');
  const checkBtn = document.getElementById('checkBtn');
  const hintBtn = document.getElementById('hintBtn');
  const solveOneBtn = document.getElementById('solveOneBtn');
  const findAllBtn = document.getElementById('findAllBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const applyBtn = document.getElementById('applyBtn');

  const statSize = document.getElementById('statSize');
  const statCells = document.getElementById('statCells');
  const statPieces = document.getElementById('statPieces');
  const statSolutions = document.getElementById('statSolutions');
  const statCapped = document.getElementById('statCapped');
  const statusEl = document.getElementById('status');
  const piecesPanel = document.getElementById('piecesPanel');

  const githubLink = document.getElementById('githubLink');
  githubLink.href = "https://github.com/pezzaliapp/ExactCover";

  // --- State ---
  let W = 10, H = 6;
  let holes = new Set(); // store index r*W+c
  let editHoles = false;

  let enabledPieces = new Set(PIECE_ORDER); // start with all 12
  const MAX_SOL = 50; // raise if needed

  let solutions = []; // each solution is array of placement rows (objects)
  let solIdx = -1;
  let capped = false;

  // --- Utility ---
  const idx = (r,c)=> r*W + c;

  function setStatus(msg){ statusEl.textContent = msg; }

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
        if (colormap && colormap.has(k)) {
          cell.classList.add('piece');
          cell.style.background = pieceColor(colormap.get(k));
        }
        cell.addEventListener('click', ()=>{
          if (!editHoles) return;
          if (holes.has(k)) holes.delete(k); else holes.add(k);
          solutions=[]; solIdx=-1; capped=false;
          updateStats();
          renderBoard(colormap);
        });
        boardEl.appendChild(cell);
      }
    }
  }

  function pieceColor(letter){
    // deterministic pastel from letter
    const seed = letter.charCodeAt(0);
    const h = (seed*37) % 360;
    return `hsl(${h} 45% 26%)`;
  }

  function updateStats(){
    statSize.textContent = `${H}×${W}`;
    const validCells = H*W - holes.size;
    statCells.textContent = String(validCells);
    statPieces.textContent = `${enabledPieces.size}`;
    statSolutions.textContent = String(solutions.length);
    statCapped.textContent = capped ? '(limite raggiunto)' : '';
  }

  // --- Presets ---
  function applyPreset(name){
    let w=W,h=H; holes.clear();
    if (name==='6x10'){ w=10; h=6; }
    else if (name==='5x12'){ w=12; h=5; }
    else if (name==='4x15'){ w=15; h=4; }
    else if (name==='3x20'){ w=20; h=3; }
    else if (name==='8x8h'){ w=8; h=8; // 4 holes
      holes.add(idx(0,0));
      holes.add(idx(0,1));
      holes.add(idx(1,0));
      holes.add(idx(1,1));
    }
    W=w; H=h;
    wInput.value = W; hInput.value = H;
    solutions=[]; solIdx=-1; capped=false;
    renderBoard();
    updateStats();
    setStatus('Preset applicato.');
  }

  // --- Pieces UI ---
  function renderPiecesPanel(){
    piecesPanel.innerHTML = '';
    for (const p of PIECE_ORDER){
      const label = document.createElement('label');
      label.className = 'piece-toggle';
      const cb = document.createElement('input');
      cb.type='checkbox';
      cb.checked = enabledPieces.has(p);
      cb.addEventListener('change', ()=>{
        if (cb.checked) enabledPieces.add(p); else enabledPieces.delete(p);
        solutions=[]; solIdx=-1; capped=false;
        updateStats();
      });
      const span = document.createElement('span');
      span.textContent = p;
      label.appendChild(cb); label.appendChild(span);
      piecesPanel.appendChild(label);
    }
  }

  // --- Geometry helpers ---
  function normalize(cells){
    let minr = Math.min(...cells.map(p=>p[0]));
    let minc = Math.min(...cells.map(p=>p[1]));
    const moved = cells.map(([r,c])=>[r-minr, c-minc]);
    moved.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
    return moved;
  }
  function rotate(cells){ // 90°
    const rot = cells.map(([r,c])=>[c, -r]);
    return normalize(rot);
  }
  function reflect(cells){ // mirror horizontally
    const refl = cells.map(([r,c])=>[r, -c]);
    return normalize(refl);
  }
  function orientations(cells){
    // generate unique orientations (up to 8)
    const seen = new Set();
    let forms = [];
    let cur = normalize(cells);
    for (let i=0;i<4;i++){
      const a = normalize(cur);
      const b = normalize(reflect(cur));
      const keyA = JSON.stringify(a);
      const keyB = JSON.stringify(b);
      if (!seen.has(keyA)){ seen.add(keyA); forms.push(a); }
      if (!seen.has(keyB)){ seen.add(keyB); forms.push(b); }
      cur = rotate(cur);
    }
    return forms;
  }

  // --- Placements ---
  function generatePlacements(){
    // Columns: one for each valid cell + one for each enabled piece (use exactly once)
    const validCellList = [];
    const cellToCol = new Map();
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const k = idx(r,c);
        if (holes.has(k)) continue;
        cellToCol.set(k, validCellList.length);
        validCellList.push(k);
      }
    }
    const pieceCols = {};
    let colIndex = validCellList.length;
    for (const p of PIECE_ORDER){
      if (enabledPieces.has(p)){
        pieceCols[p] = colIndex++;
      }
    }
    const numCols = colIndex;

    // Rows: each placement covers exactly 5 cell-cols + the piece-col
    const rows = [];
    const placements = []; // for reconstruction
    for (const p of PIECE_ORDER){
      if (!enabledPieces.has(p)) continue;
      for (const shape of orientations(PENTOMINOES[p])){
        // determine bounding box
        const maxr = Math.max(...shape.map(s=>s[0]));
        const maxc = Math.max(...shape.map(s=>s[1]));
        for (let r0=0; r0+maxr < H; r0++){
          for (let c0=0; c0+maxc < W; c0++){
            const cover = [];
            let ok = true;
            for (const [dr,dc] of shape){
              const rr = r0+dr, cc = c0+dc;
              const k = idx(rr,cc);
              if (holes.has(k)){ ok=false; break; }
              const col = cellToCol.get(k);
              if (col===undefined){ ok=false; break; }
              cover.push(col);
            }
            if (!ok) continue;
            // create row vector as sorted unique
            cover.sort((a,b)=>a-b);
            const row = new Set(cover);
            row.add(pieceCols[p]);
            rows.push(Array.from(row));
            placements.push({piece:p, cells: cover.map(ci => validCellList[ci])});
            }
        }
      }
    }

    // randomize row traversal order for diversity
    const order = Array.from({length: rows.length}, (_,i)=>i);
    shuffle(order);
    const rows2 = order.map(i=>rows[i]);
    const placements2 = order.map(i=>placements[i]);
    return {numCols, validCellList, pieceCols, rows: rows2, placements: placements2};
  }

  // --- Algorithm X (set-based) ---
  function exactCoverSolve(limit=1){
    const {numCols, validCellList, pieceCols, rows, placements} = generatePlacements();

    // Build column -> rows map
    const colToRows = Array.from({length:numCols}, ()=> new Set());
    rows.forEach((row, rIndex)=>{
      row.forEach(col => colToRows[col].add(rIndex));
    });
    // Active rows/cols
    let activeRows = new Set(rows.map((_,i)=>i));
    let activeCols = new Set([...Array(numCols).keys()]);

    const solution = [];
    const solutions = [];

    function chooseCol(){
      // heuristic: pick the column with fewest active rows
      let bestCol = null, bestCount = 1e9;
      for (const c of activeCols){
        const count = [...colToRows[c]].filter(r => activeRows.has(r)).length;
        if (count < bestCount){ bestCount = count; bestCol = c; if (bestCount<=1) break; }
      }
      return bestCol;
    }

    function cover(col){
      // remove column
      activeCols.delete(col);
      // for each row that uses it, remove conflicting rows from all other columns in that row
      const rowsUsing = [...colToRows[col]].filter(r => activeRows.has(r));
      for (const r of rowsUsing){
        activeRows.delete(r);
        for (const c2 of rows[r]){
          if (c2 === col) continue;
          // remove r from other columns
          colToRows[c2].delete(r);
        }
      }
      return rowsUsing;
    }

    function uncover(col, removedRows){
      // restore rows into other columns
      for (const r of removedRows){
        for (const c2 of rows[r]){
          if (c2 === col) continue;
          colToRows[c2].add(r);
        }
        activeRows.add(r);
      }
      activeCols.add(col);
    }

    function search(){
      if (activeCols.size === 0){
        solutions.push(solution.slice());
        return;
      }
      const col = chooseCol();
      if (col === null) return;
      let candidates = [...colToRows[col]].filter(r => activeRows.has(r));
      shuffle(candidates);
      if (candidates.length === 0) return;

      // Save snapshot
      const saved = {activeRows: new Set(activeRows), activeCols: new Set(activeCols), colToRows: colToRows.map(s=>new Set(s))};

      for (const r of candidates){
        // rows to cover: all columns in this row
        const colsInRow = [...rows[r]];
        const removedRecords = [];
        let fail = false;
        for (const c of colsInRow){
          const removedRows = cover(c);
          removedRecords.push([c, removedRows]);
          if ([...colToRows[c]].filter(rr=>activeRows.has(rr)).length === 0 && activeCols.has(c)){
            // no remaining rows can fill this required column
            // (not strictly necessary with this cover design, but keep heuristic)
          }
        }

        solution.push(r);
        search();
        if (solutions.length >= limit) return;

        solution.pop();
        // uncover in reverse
        for (let i=removedRecords.length-1;i>=0;i--){
          uncover(removedRecords[i][0], removedRecords[i][1]);
        }
        // restore snapshot to be safe
        activeRows = new Set(saved.activeRows);
        activeCols = new Set(saved.activeCols);
        for (let i=0;i<colToRows.length;i++){ colToRows[i] = new Set(saved.colToRows[i]); }
      }
    }

    search();

    // Map solution rows to placement objects
    const mapped = solutions.map(solRows => solRows.map(r => placements[r]));
    return mapped;
  }

  // --- UI actions ---
  function checkFeasible(){
    const needArea = enabledPieces.size * 5;
    const validCells = H*W - holes.size;
    if (needArea !== validCells){
      setStatus(`⚠️ Area non coerente: celle valide=${validCells}, richieste=${needArea}.`);
      return false;
    }
    setStatus('Area coerente. Pronto per la ricerca.');
    return true;
  }

  function colorizeSolution(sol){
    // sol: array of {piece, cells:[cellIndex ...]}
    const cmap = new Map();
    sol.forEach(pl => {
      pl.cells.forEach(k => cmap.set(k, pl.piece));
    });
    return cmap;
  }

  function applySolution(sol){
    renderBoard(colorizeSolution(sol));
  }

  // controls
  presetSel.addEventListener('change', ()=>{
    const v = presetSel.value;
    if (v==='custom'){ setStatus('Imposta larghezza/altezza e premi "Nuova Griglia".'); return; }
    applyPreset(v);
  });

  newBtn.addEventListener('click', ()=>{
    W = Math.max(3, Math.min(20, wInput.valueAsNumber || W));
    H = Math.max(3, Math.min(20, hInput.valueAsNumber || H));
    holes.clear();
    solutions=[]; solIdx=-1; capped=false;
    renderBoard();
    updateStats();
    setStatus('Nuova griglia.');
  });

  holesBtn.addEventListener('click', ()=>{
    editHoles = !editHoles;
    holesBtn.textContent = editHoles ? 'Fine Modifica Fori' : 'Modifica Fori';
    setStatus(editHoles ? 'Modalità modifica fori attiva: clicca sulle celle.' : 'Modalità fori disattivata.');
  });

  resetBtn.addEventListener('click', ()=>{
    holes.clear();
    solutions=[]; solIdx=-1; capped=false;
    renderBoard();
    updateStats();
    setStatus('Fori rimossi.');
  });

  checkBtn.addEventListener('click', ()=>{
    checkFeasible();
  });

  hintBtn.addEventListener('click', ()=>{
    if (!checkFeasible()) return;
    setStatus('Calcolo suggerimento…');
    setTimeout(()=>{
      const sols = exactCoverSolve(1);
      if (sols.length === 0){ setStatus('Nessuna soluzione trovata.'); return; }
      // place first placement only as hint: overlay partial (first piece)
      const firstPiece = sols[0][0];
      renderBoard(colorizeSolution([firstPiece]));
      setStatus(`Suggerimento: posiziona il pezzo ${firstPiece.piece}.`);
    }, 20);
  });

  solveOneBtn.addEventListener('click', ()=>{
    if (!checkFeasible()) return;
    setStatus('Ricerca in corso…');
    setTimeout(()=>{
      const sols = exactCoverSolve(1);
      solutions = sols;
      solIdx = sols.length ? 0 : -1;
      capped = false;
      updateStats();
      if (solIdx>=0){
        applySolution(solutions[0]);
        setStatus('Soluzione trovata e applicata.');
        prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = (solutions.length===0);
      } else {
        setStatus('Nessuna soluzione trovata.');
      }
    }, 20);
  });

  findAllBtn.addEventListener('click', ()=>{
    if (!checkFeasible()) return;
    setStatus('Ricerca di soluzioni in corso…');
    setTimeout(()=>{
      // naive approach: repeatedly call solver with limit 1 won't enumerate unique solutions.
      // Instead, slightly modify exactCoverSolve to return up to MAX_SOL solutions by increasing limit.
      const sols = exactCoverSolve(MAX_SOL);
      solutions = sols;
      solIdx = sols.length ? 0 : -1;
      capped = sols.length >= MAX_SOL;
      updateStats();
      if (solIdx>=0){
        renderBoard(colorizeSolution(solutions[0]));
        setStatus(`Trovate ${solutions.length} soluzioni${capped?' (limite raggiunto)':''}.`);
        prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = false;
      } else {
        setStatus('Nessuna soluzione.');
      }
    }, 20);
  });

  prevBtn.addEventListener('click', ()=>{
    if (!solutions.length) return;
    solIdx = (solIdx - 1 + solutions.length) % solutions.length;
    renderBoard(colorizeSolution(solutions[solIdx]));
    setStatus(`Anteprima soluzione ${solIdx+1} / ${solutions.length}.`);
  });
  nextBtn.addEventListener('click', ()=>{
    if (!solutions.length) return;
    solIdx = (solIdx + 1) % solutions.length;
    renderBoard(colorizeSolution(solutions[solIdx]));
    setStatus(`Anteprima soluzione ${solIdx+1} / ${solutions.length}.`);
  });
  applyBtn.addEventListener('click', ()=>{
    if (!solutions.length) return;
    applySolution(solutions[solIdx]);
    setStatus('Soluzione applicata.');
  });

  // PWA install prompt
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  // init
  renderPiecesPanel();
  applyPreset('6x10');
  updateStats();
  renderBoard();
  setStatus('Pronto.');
})();

  // Shuffle button: new random seed and clear cached solutions
  shuffleBtn?.addEventListener('click', ()=>{
    seedRand(Math.floor(Math.random()*1e9));
    solutions=[]; solIdx=-1; capped=false;
    setStatus('Ordine di ricerca mescolato. Pronto a trovare soluzioni diverse.');
  });
