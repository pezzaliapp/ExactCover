
(() => {
  'use strict';

  // ----- RNG + shuffle -----
  let RNG_SEED = Math.floor(Math.random()*1e9);
  function seedRand(seed){ RNG_SEED = (seed>>>0)||123456789; }
  function rand(){ let x = RNG_SEED||123456789; x^=x<<13; x^=x>>17; x^=x<<5; RNG_SEED=x>>>0; return (RNG_SEED&0xffffffff)/0x100000000; }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // ----- Shapes -----
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

  // ----- DOM -----
  const boardEl = document.getElementById('board');
  const overlayEl = document.getElementById('overlay');
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
  const shuffleBtn = document.getElementById('shuffleBtn');

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

  // ----- State -----
  let W = 10, H = 6;
  let holes = new Set();
  let editHoles = false;
  let enabledPieces = new Set(PIECE_ORDER);
  const MAX_SOL = 50;

  let orient = {}; // letter -> oriented shape
  let placed = new Map(); // letter -> {cells, shape, r0, c0}
  let foundSolutions = [];
  let solIdx = -1, capped = false;

  // Custom DnD (pointer-based, robust)
  let DRAG = null; // {L, shape, src:'palette'|'board', anchor:{r,c}, from:{r0,c0,cells?}, preview:{set,bad}}
  let lastEndAt = 0;

  // ----- Utils -----
  const idx = (r,c)=> r*W + c;
  function setStatus(msg){ statusEl.textContent = msg; }
  function normalize(c){ let minr=Math.min(...c.map(p=>p[0])), minc=Math.min(...c.map(p=>p[1])); const m=c.map(([r,cc])=>[r-minr,cc-minc]); m.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); return m; }
  function rotate(c){ return normalize(c.map(([r,c])=>[c,-r])); }
  function reflect(c){ return normalize(c.map(([r,c])=>[r,-c])); }
  function orientations(c){ const seen=new Set(), forms=[]; let cur=normalize(c); for(let i=0;i<4;i++){ const a=normalize(cur), b=normalize(reflect(cur)); const ka=JSON.stringify(a), kb=JSON.stringify(b); if(!seen.has(ka)){seen.add(ka); forms.push(a);} if(!seen.has(kb)){seen.add(kb); forms.push(b);} cur=rotate(cur);} return forms; }
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

  // ----- Render -----
  function renderBoard(colormap=null){
    boardEl.style.setProperty('--w', W);
    boardEl.style.setProperty('--h', H);
    boardEl.innerHTML='';
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const cell=document.createElement('div');
        cell.className='cell'+(((r+c)%2===1)?' dark':'');
        const k=idx(r,c);
        if (holes.has(k)) cell.classList.add('hole');

        if (colormap){
          if (colormap.has(k)){
            cell.classList.add('piece');
            cell.style.background = pieceColor(colormap.get(k));
          }
        } else {
          for (const [L, obj] of placed){
            if (obj.cells.includes(k)){ cell.classList.add('piece'); cell.style.background = pieceColor(L); break; }
          }
        }

        // preview overlay
        if (DRAG && DRAG.preview){
          const set = DRAG.preview.set;
          const bad = DRAG.preview.bad;
          if (set.has(k)){ cell.classList.add('preview'); if (bad) cell.classList.add('bad'); }
        }

        // click: toggle hole OR remove piece
        cell.addEventListener('pointerdown', (e)=>{
          // suppress stray clicks right after ending a drag
          if (Date.now()-lastEndAt < 120) return;
          if (editHoles){
            if (holes.has(k)) holes.delete(k); else holes.add(k);
            foundSolutions=[]; solIdx=-1; capped=false;
            renderBoard();
          } else {
            for (const [L, obj] of placed.entries()){
              if (obj.cells.includes(k)){ placed.delete(L); renderBoard(); setStatus(`Rimosso ${L}.`); break; }
            }
          }
        });

        // start dragging from board (on piece)
        cell.addEventListener('pointerdown', (e)=>{
          if (!cell.classList.contains('piece')) return;
          const targetPiece = [...placed.entries()].find(([L,obj])=>obj.cells.includes(k));
          if (!targetPiece) return;
          const [L, obj] = targetPiece;
          const r0=obj.r0, c0=obj.c0;
          const rClick = r, cClick = c;
          DRAG = {
            L, shape: (obj.shape || (orient[L]||normalize(PENTOMINOES[L]))).map(x=>x.slice()),
            src:'board', anchor:{r:rClick-r0, c:cClick-c0},
            from:{r0, c0, cells:obj.cells.slice()}
          };
          if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
          updatePreviewFromEvent(e);
        });

        boardEl.appendChild(cell);
      }
    }
    prevBtn.disabled = nextBtn.disabled = applyBtn.disabled = (foundSolutions.length===0);
    updateStats();
  }

  function currentColorMap(){
    const cmap=new Map();
    for (const [L, obj] of placed.entries()){ obj.cells.forEach(k=>cmap.set(k,L)); }
    return cmap;
  }

  function updateStats(){
    const valid = W*H - holes.size;
    const covered = new Set([].concat(...[...placed.values()].map(o=>o.cells))).size;
    statSize.textContent = `${H}×${W}`;
    statCells.textContent = String(valid);
    statPieces.textContent = `${enabledPieces.size}`;
    statCover.textContent = `${covered}/${valid}`;
    statSolutions.textContent = String(foundSolutions.length);
    statCapped.textContent = capped ? '(limite raggiunto)' : '';
  }

  // ----- Palette -----
  function renderPiecesSelect(){ pieceSelect.innerHTML=''; for (const p of PIECE_ORDER){ const o=document.createElement('option'); o.value=p; o.textContent=p; pieceSelect.appendChild(o);} }
  function renderPalette(){
    palette.innerHTML='';
    for (const L of PIECE_ORDER){
      const tile=document.createElement('div'); tile.className='tile';
      const ctrls=document.createElement('div'); ctrls.className='ctrls';
      const bR=document.createElement('button'); bR.textContent='↻'; bR.title='Ruota';
      const bF=document.createElement('button'); bF.textContent='⇋'; bF.title='Specchia';
      bR.addEventListener('click',(e)=>{ e.stopPropagation(); orient[L] = rotate(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      bF.addEventListener('click',(e)=>{ e.stopPropagation(); orient[L] = reflect(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); });
      ctrls.appendChild(bR); ctrls.appendChild(bF); tile.appendChild(ctrls);
      const mini=document.createElement('div'); mini.className='mini';
      const shape=orient[L]|| (orient[L]=normalize(PENTOMINOES[L]));
      const on=new Set(shape.map(([r,c])=>`${r},${c}`));
      for (let r=0;r<5;r++){ for (let c=0;c<5;c++){ const m=document.createElement('div'); m.className='cell'+(on.has(`${r},${c}`)?' on':''); mini.appendChild(m);} }
      const label=document.createElement('div'); label.textContent=L; label.style.textAlign='center'; label.style.fontWeight='700';
      tile.appendChild(mini); tile.appendChild(label);

      // start drag from palette
      tile.addEventListener('pointerdown', (e)=>{
        const shape=orient[L]||(orient[L]=normalize(PENTOMINOES[L]));
        DRAG = { L, shape: shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
        if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        updatePreviewFromEvent(e);
      });

      palette.appendChild(tile);
    }
  }

  // ----- Pointer-driven drag workflow -----
  function eventToCell(e){
    const rect = boardEl.getBoundingClientRect();
    const col = Math.min(W-1, Math.max(0, Math.floor((e.clientX-rect.left)/(rect.width/W))));
    const row = Math.min(H-1, Math.max(0, Math.floor((e.clientY-rect.top)/(rect.height/H))));
    return {row, col};
  }
  function updatePreviewFromEvent(e){
    if (!DRAG) return;
    const {row, col} = eventToCell(e);
    let r0 = row - DRAG.anchor.r;
    let c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
    const set = new Set();
    for (const [dr,dc] of DRAG.shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr>=0 && rr<H && cc>=0 && cc<W) set.add(idx(rr,cc));
    }
    DRAG.preview = {set, bad: !probe.ok};
    renderBoard();
  }
  function commitFromEvent(e){
    const {row, col} = eventToCell(e);
    let r0 = row - DRAG.anchor.r;
    let c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceShapeAt(DRAG.shape, r0, c0, ignore);
    if (!probe.ok){ setStatus('⛔ Posizione non valida.'); DRAG=null; renderBoard(); return; }
    placed.set(DRAG.L, {cells:probe.cells, shape:DRAG.shape.map(x=>x.slice()), r0, c0});
    DRAG=null; renderBoard(); setStatus('Pezzo posizionato.');
  }

  boardEl.addEventListener('pointermove', (e)=>{ if (DRAG) updatePreviewFromEvent(e); });
  boardEl.addEventListener('pointerup', (e)=>{
    if (!DRAG) return;
    commitFromEvent(e);
    lastEndAt = Date.now();
  });
  window.addEventListener('pointerup', (e)=>{
    // If pointer is released outside board while dragging, try to commit if over board area; otherwise cancel.
    if (!DRAG) return;
    const rect = boardEl.getBoundingClientRect();
    if (e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom){
      commitFromEvent(e);
    } else {
      DRAG=null; renderBoard(); setStatus('Posizionamento annullato.');
    }
    lastEndAt = Date.now();
  });

  // Keyboard rotate/flip during drag
  window.addEventListener('keydown',(e)=>{
    if (!DRAG) return;
    if (e.key==='r' || e.key==='R'){ DRAG.shape = rotate(DRAG.shape); updatePreviewFromEvent({clientX:window.lastX||0, clientY:window.lastY||0, ...e}); e.preventDefault(); }
    if (e.key==='f' || e.key==='F'){ DRAG.shape = reflect(DRAG.shape); updatePreviewFromEvent({clientX:window.lastX||0, clientY:window.lastY||0, ...e}); e.preventDefault(); }
  });
  window.addEventListener('mousemove',(e)=>{ window.lastX=e.clientX; window.lastY=e.clientY; });

  // ----- Pieces panel -----
  function renderPiecesPanel(){
    piecesPanel.innerHTML='';
    for (const p of PIECE_ORDER){
      const label=document.createElement('label'); label.className='piece-toggle';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=enabledPieces.has(p);
      cb.addEventListener('change', ()=>{ if (cb.checked) enabledPieces.add(p); else { enabledPieces.delete(p); placed.delete(p);} foundSolutions=[]; solIdx=-1; capped=false; renderBoard(); });
      const span=document.createElement('span'); span.textContent=p;
      label.appendChild(cb); label.appendChild(span); piecesPanel.appendChild(label);
    }
  }

  // ----- Presets -----
  function applyPreset(name){
    holes.clear();
    if (name==='6x10'){ W=10; H=6; }
    else if (name==='5x12'){ W=12; H=5; }
    else if (name==='4x15'){ W=15; H=4; }
    else if (name==='3x20'){ W=20; H=3; }
    else if (name==='8x8h'){ W=8; H=8; holes.add(0); holes.add(1); holes.add(8); holes.add(9); }
    placed.clear(); foundSolutions=[]; solIdx=-1; capped=false;
    wInput.value=W; hInput.value=H;
    renderBoard(); setStatus('Preset applicato.');
  }

  // ----- Controls -----
  presetSel.addEventListener('change', ()=>{ const v=presetSel.value; if (v==='custom'){ setStatus('Imposta larghezza/altezza e premi "Nuova Griglia".'); return; } applyPreset(v); });
  newBtn.addEventListener('click', ()=>{ W=Math.max(3,Math.min(20,wInput.valueAsNumber||W)); H=Math.max(3,Math.min(20,hInput.valueAsNumber||H)); holes.clear(); placed.clear(); foundSolutions=[]; solIdx=-1; capped=false; renderBoard(); setStatus('Nuova griglia.'); });
  holesBtn.addEventListener('click', ()=>{ editHoles=!editHoles; holesBtn.textContent = editHoles ? 'Fine Modifica Fori' : 'Modifica Fori'; setStatus(editHoles?'Modalità fori attiva.':'Modalità fori disattivata.'); });
  resetHolesBtn.addEventListener('click', ()=>{ holes.clear(); renderBoard(); setStatus('Fori rimossi.'); });

  rotBtn.addEventListener('click', ()=>{ const L=pieceSelect.value; if(!L) return; orient[L]=rotate(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); setStatus(`Ruotato ${L}.`); });
  flipBtn.addEventListener('click', ()=>{ const L=pieceSelect.value; if(!L) return; orient[L]=reflect(orient[L]||normalize(PENTOMINOES[L])); renderPalette(); setStatus(`Specchiato ${L}.`); });
  removeBtn.addEventListener('click', ()=>{ const L=pieceSelect.value; if(!L) return; placed.delete(L); renderBoard(); setStatus(`Rimosso ${L}.`); });
  clearPlacedBtn.addEventListener('click', ()=>{ placed.clear(); renderBoard(); setStatus('Posizionamenti manuali rimossi.'); });

  checkBtn.addEventListener('click', ()=>{ const need=enabledPieces.size*5; const valid=W*H-holes.size; if (need!==valid) setStatus(`⚠️ Area non coerente: celle valide=${valid}, richieste=${need}.`); else setStatus('Area coerente.'); });

  // ----- DLX exact cover (randomized) -----
  function generatePlacements(){
    const validCells=[]; const cellToCol=new Map();
    for (let r=0;r<H;r++){ for (let c=0;c<W;c++){ const k=idx(r,c); if (holes.has(k)) continue; cellToCol.set(k, validCells.length); validCells.push(k);} }
    const pieceCols={}; let colIndex=validCells.length;
    for (const p of PIECE_ORDER){ if (enabledPieces.has(p)) pieceCols[p]=colIndex++; }
    const rows=[]; const placements=[];
    for (const p of PIECE_ORDER){
      if (!enabledPieces.has(p)) continue;
      for (const shape of orientations(PENTOMINOES[p])){
        const maxr=Math.max(...shape.map(s=>s[0])); const maxc=Math.max(...shape.map(s=>s[1]));
        for (let r0=0; r0+maxr < H; r0++){
          for (let c0=0; c0+maxc < W; c0++){
            const cols=[]; const cells=[]; let ok=true;
            for (const [dr,dc] of shape){
              const rr=r0+dr, cc=c0+dc; const k=idx(rr,cc);
              if (holes.has(k)){ ok=false; break; }
              const col=cellToCol.get(k); if (col===undefined){ ok=false; break; }
              cols.push(col); cells.push(k);
            }
            if (!ok) continue;
            cols.sort((a,b)=>a-b); cols.push(pieceCols[p]);
            rows.push(cols); placements.push({piece:p, cells});
          }
        }
      }
    }
    return {numCols: colIndex, rows, placements};
  }

  function exactCoverSolve(limit=1, preselectRows=null){
    const {numCols, rows, placements} = generatePlacements();
    const header = {L:null,R:null,U:null,D:null,C:null,S:0}; header.L=header.R=header;
    const cols=[];
    function linkLR(a,b){ a.R=b; b.L=a; }
    function linkUD(a,b){ a.D=b; b.U=a; }
    for (let i=0;i<numCols;i++){ const col={L:null,R:null,U:null,D:null,C:null,S:0,name:i}; col.U=col.D=col; col.C=col; linkLR(header.L||header, col); linkLR(col, header); cols.push(col); }
    const rowNodes=[];
    for (let r=0;r<rows.length;r++){ const colsInRow=rows[r]; let first=null;
      for (let j=0;j<colsInRow.length;j++){ const cidx=colsInRow[j]; const col=cols[cidx]; const node={L:null,R:null,U:null,D:null,C:col,row:r};
        linkUD(col.U,node); linkUD(node,col); col.S++; if(first){ linkLR(first.L,node); linkLR(node,first);} else { first=node; first.L=first.R=first; } }
      rowNodes.push(first);
    }
    function cover(col){ col.R.L=col.L; col.L.R=col.R; for (let i=col.D; i!==col; i=i.D){ for (let j=i.R; j!==i; j=j.R){ j.D.U=j.U; j.U.D=j.D; j.C.S--; } } }
    function uncover(col){ for (let i=col.U; i!==col; i=i.U){ for (let j=i.L; j!==i; j=j.L){ j.C.S++; j.D.U=j; j.U.D=j; } } col.R.L=col; col.L.R=col; }
    function chooseColumn(){ let best=null, s=Infinity; for (let c=header.R; c!==header; c=c.R){ if (c.S<s){ s=c.S; best=c; if (s<=1) break; } } return best; }
    const solution=[]; const solutions=[];

    if (preselectRows && preselectRows.length){
      for (const rIndex of preselectRows){
        const rnode=rowNodes[rIndex];
        for (let j=rnode; ; j=j.R){ cover(j.C); if (j.R===rnode) break; }
        solution.push(rIndex);
      }
    }

    function search(){
      if (header.R===header){ solutions.push(solution.slice().map(r=>placements[r])); return; }
      const col = chooseColumn(); if (!col || col.S===0) return;
      cover(col);
      const cand=[]; for (let r=col.D; r!==col; r=r.D) cand.push(r);
      shuffle(cand);
      for (const r of cand){
        solution.push(r.row); for (let j=r.R; j!==r; j=j.R) cover(j.C);
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
    const keyToIdx=new Map();
    placements.forEach((pl,i)=>{ const key=pl.piece+':'+JSON.stringify(pl.cells.slice().sort((a,b)=>a-b)); keyToIdx.set(key,i); });
    const need=[];
    for (const [L, obj] of placed.entries()){
      const key=L+':'+JSON.stringify(obj.cells.slice().sort((a,b)=>a-b)); const i=keyToIdx.get(key);
      if (i===undefined) return null; need.push(i);
    }
    return need;
  }

  // ----- Actions -----
  shuffleBtn.addEventListener('click', ()=>{ seedRand(Math.floor(Math.random()*1e9)); setStatus('Ordine di ricerca mescolato. Usa “Trova tutte”.'); });

  /* suggestBtn disabilitato */
renderBoard(); setStatus(`Suggerimento: posato ${next.piece}.`);
  });

  /* solveOneBtn disabilitato */
}
    renderBoard();
    setStatus('Soluzione applicata (ordine di ricerca mescolato).');
  });

  findAllBtn.addEventListener('click', ()=>{
    const need=enabledPieces.size*5; const valid=W*H-holes.size;
    if (need!==valid){ setStatus(`⛔ Area incoerente: celle valide=${valid}, richieste=${need}.`); return; }
    const pre=preselectRowsForPlaced(); if(pre===null){ setStatus('⛔ Posizionamenti manuali incoerenti.'); return; }
    const sols=exactCoverSolve(MAX_SOL, pre); foundSolutions=sols; solIdx=sols.length?0:-1; capped=sols.length>=MAX_SOL;
    if(!sols.length){ renderBoard(); setStatus('Nessuna soluzione.'); updateStats(); return; }
    previewSolution(solIdx);
    setStatus(`Trovate ${sols.length} soluzioni${capped?' (limite)':''}. Anteprima 1/${sols.length}.`);
    renderGallery(12);
  });

  function previewSolution(i){
    const sol=foundSolutions[i]; const cmap=new Map();
    sol.forEach(pl=>pl.cells.forEach(k=>cmap.set(k, pl.piece)));
    renderBoard(cmap); prevBtn.disabled=nextBtn.disabled=applyBtn.disabled=false;
  }
  function renderGallery(maxThumbs=12){
    const el=document.getElementById('gallery'); el.innerHTML='';
    const n=Math.min(foundSolutions.length, maxThumbs);
    for (let t=0;t<n;t++){
      const sol=foundSolutions[t];
      const wrap=document.createElement('div'); wrap.className='thumb';
      const mini=document.createElement('div'); mini.className='mini'; mini.style.setProperty('--w', W);
      for (let r=0;r<H;r++){ for (let c=0;c<W;c++){ const div=document.createElement('div'); div.className='c'; const k=r*W+c;
        for (const pl of sol){ if (pl.cells.includes(k)){ div.classList.add('p'); div.style.background = thumbColor(pl.piece); break; } }
        if (holes.has(k)) div.style.background = '#1b0f0f'; mini.appendChild(div);
      } }
      const cap=document.createElement('div'); cap.className='cap'; cap.textContent = `#${t+1}`;
      wrap.appendChild(mini); wrap.appendChild(cap); el.appendChild(wrap);
    }
  }
  prevBtn.addEventListener('click', ()=>{ if(!foundSolutions.length) return; solIdx=(solIdx-1+foundSolutions.length)%foundSolutions.length; previewSolution(solIdx); setStatus(`Anteprima ${solIdx+1}/${foundSolutions.length}.`); });
  nextBtn.addEventListener('click', ()=>{ if(!foundSolutions.length) return; solIdx=(solIdx+1)%foundSolutions.length; previewSolution(solIdx); setStatus(`Anteprima ${solIdx+1}/${foundSolutions.length}.`); });
  applyBtn.addEventListener('click', ()=>{ if(!foundSolutions.length) return; placed.clear(); for (const pl of foundSolutions[solIdx]) placed.set(pl.piece,{cells:pl.cells.slice(),shape:null,r0:0,c0:0}); renderBoard(); setStatus('Soluzione applicata.'); });

  // ----- Init -----
  function renderPiecesSelect(){ pieceSelect.innerHTML=''; for (const p of PIECE_ORDER){ const o=document.createElement('option'); o.value=p; o.textContent=p; pieceSelect.appendChild(o);} }
  renderPiecesSelect();
  renderPiecesPanel();
  renderPalette();
  applyPreset('6x10');

  // PWA install button
  let deferredPrompt=null;
  const installBtn=document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; if (installBtn) installBtn.hidden=false; });
  installBtn?.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true; });

})();