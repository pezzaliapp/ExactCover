
(() => {
  'use strict';

  // ===== RNG / shuffle =====
  let RNG_SEED = Math.floor(Math.random()*1e9);
  function seedRand(seed){ RNG_SEED = (seed>>>0)||123456789; }
  function rand(){ let x = RNG_SEED||123456789; x^=x<<13; x^=x>>17; x^=x<<5; RNG_SEED=x>>>0; return (RNG_SEED&0xffffffff)/0x100000000; }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // ===== Shapes =====
  const PENT = {
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
  const ORDER = Object.keys(PENT);

  // ===== DOM =====
  const boardEl = document.getElementById('board');
  const palette = document.getElementById('palette');
  const presetSel = document.getElementById('preset');
  const newBtn = document.getElementById('newBtn');
  const holesBtn = document.getElementById('holesBtn');
  const resetHolesBtn = document.getElementById('resetHolesBtn');
  const checkBtn = document.getElementById('checkBtn');
  const suggestBtn = document.getElementById('suggestBtn');
  const solveBtn = document.getElementById('solveBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');

  const statSize = document.getElementById('statSize');
  const statCells = document.getElementById('statCells');
  const statPieces = document.getElementById('statPieces');
  const statCover = document.getElementById('statCover');
  const statusEl = document.getElementById('status');
  const piecesPanel = document.getElementById('piecesPanel');

  // ===== State =====
  let W=10, H=6;
  let holes = new Set();
  let editHoles = false;
  let enabled = new Set(ORDER);
  let orient = {};   // L -> current normalized shape
  let placed = new Map(); // L -> {cells,r0,c0,shape}
  let DRAG = null;   // {L,shape,src,anchor:{r,c},preview:{set,bad}}
  let lastEndAt = 0;

  // ===== Utils =====
  const idx = (r,c)=> r*W+c;
  function setStatus(s){ statusEl.textContent = s; }
  function normalize(c){ let minr=Math.min(...c.map(p=>p[0])), minc=Math.min(...c.map(p=>p[1])); const m=c.map(([r,cc])=>[r-minr,cc-minc]); m.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); return m; }
  function rotate(c){ return normalize(c.map(([r,c])=>[c,-r])); }
  function reflect(c){ return normalize(c.map(([r,c])=>[r,-c])); }
  function orientations(c){ const seen=new Set(), forms=[]; let cur=normalize(c); for(let i=0;i<4;i++){ const a=normalize(cur), b=normalize(reflect(cur)); const ka=JSON.stringify(a), kb=JSON.stringify(b); if(!seen.has(ka)){seen.add(ka); forms.push(a);} if(!seen.has(kb)){seen.add(kb); forms.push(b);} cur=rotate(cur);} return forms; }
  function pieceColor(L){ const h=(L.charCodeAt(0)*37)%360; return `hsl(${h} 45% 26%)`; }

  function canPlaceAt(shape,r0,c0,ignore=null){
    const cells=[];
    for (const [dr,dc] of shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr<0||rr>=H||cc<0||cc>=W) return {ok:false,cells:[]};
      const k=idx(rr,cc);
      if (holes.has(k)) return {ok:false,cells:[]};
      for (const [L,obj] of placed){
        if (ignore && L===ignore) continue;
        if (obj.cells.includes(k)) return {ok:false,cells:[]};
      }
      cells.push(k);
    }
    return {ok:true,cells};
  }

  // ===== Render board =====
  function renderBoard(cmap=null){
    boardEl.style.setProperty('--w', W);
    boardEl.style.setProperty('--h', H);
    boardEl.innerHTML='';
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const k=idx(r,c);
        const cell=document.createElement('div');
        cell.className='cell'+(((r+c)%2)?' dark':'');
        if (holes.has(k)) cell.classList.add('hole');

        if (cmap){
          if (cmap.has(k)){ cell.classList.add('piece'); cell.style.background=pieceColor(cmap.get(k)); }
        } else {
          for (const [L,obj] of placed){ if (obj.cells.includes(k)){ cell.classList.add('piece'); cell.style.background=pieceColor(L); break; } }
        }

        if (DRAG && DRAG.preview){
          const set=DRAG.preview.set, bad=DRAG.preview.bad;
          if (set.has(k)){ cell.classList.add('preview'); if (bad) cell.classList.add('bad'); }
        }

        // Toggle hole or remove piece on click
        cell.addEventListener('pointerdown', (e)=>{
          if (Date.now()-lastEndAt<150) return;
          if (editHoles){ holes.has(k)?holes.delete(k):holes.add(k); placed.clear(); setStatus('Foro modificato.'); renderBoard(); return; }
          for (const [L,obj] of placed){ if (obj.cells.includes(k)){ placed.delete(L); renderBoard(); setStatus(`Rimosso ${L}.`); return; } }
        });

        // Drag from board (only if piece)
        cell.addEventListener('pointerdown', (e)=>{
          if (!cell.classList.contains('piece')) return;
          const entry = [...placed.entries()].find(([L,obj])=>obj.cells.includes(k)); if (!entry) return;
          const [L,obj] = entry;
          DRAG = { L, shape:(obj.shape||orient[L]||normalize(PENT[L])).map(x=>x.slice()), src:'board',
                   anchor:{ r: r-obj.r0, c: c-obj.c0 } };
          if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
          updatePreviewFromEvent(e);
        });

        boardEl.appendChild(cell);
      }
    }
    updateStats();
  }

  function updateStats(){
    const valid = W*H - holes.size;
    const covered = new Set([].concat(...[...placed.values()].map(o=>o.cells))).size;
    statSize.textContent = `${H}×${W}`;
    statCells.textContent = `${valid}`;
    statPieces.textContent = `${enabled.size}`;
    statCover.textContent = `${covered}/${valid}`;
  }

  // ===== Palette =====
  function renderPalette(){
    palette.innerHTML='';
    for (const L of ORDER){
      const t=document.createElement('div'); t.className='tile'; const mini=document.createElement('div'); mini.className='mini';
      const shape = orient[L] || (orient[L]=normalize(PENT[L]));
      const on=new Set(shape.map(([r,c])=>`${r},${c}`));
      for (let r=0;r<5;r++){ for (let c=0;c<5;c++){ const d=document.createElement('div'); d.className='c'+(on.has(`${r},${c}`)?' on':''); mini.appendChild(d);} }
      const lbl=document.createElement('div'); lbl.textContent=L; lbl.style.textAlign='center'; lbl.style.fontWeight='700'; lbl.style.marginTop='.25rem';
      t.appendChild(mini); t.appendChild(lbl);

      t.addEventListener('pointerdown', (e)=>{
        const shape = orient[L] || (orient[L]=normalize(PENT[L]));
        DRAG = { L, shape: shape.map(x=>x.slice()), src:'palette', anchor:{r:0,c:0} };
        if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        updatePreviewFromEvent(e);
      });

      palette.appendChild(t);
    }
  }

  // ===== Pointer logic =====
  function eventToCell(e){
    const rect = boardEl.getBoundingClientRect();
    const col = Math.min(W-1, Math.max(0, Math.floor((e.clientX-rect.left)/(rect.width/W))));
    const row = Math.min(H-1, Math.max(0, Math.floor((e.clientY-rect.top)/(rect.height/H))));
    return {row,col};
  }
  function updatePreviewFromEvent(e){
    if (!DRAG) return;
    const {row,col} = eventToCell(e);
    const r0 = row - DRAG.anchor.r;
    const c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceAt(DRAG.shape, r0, c0, ignore);
    const set = new Set();
    for (const [dr,dc] of DRAG.shape){
      const rr=r0+dr, cc=c0+dc;
      if (rr>=0 && rr<H && cc>=0 && cc<W) set.add(idx(rr,cc));
    }
    DRAG.preview = {set, bad: !probe.ok};
    renderBoard();
  }
  function commitFromEvent(e){
    if (!DRAG) return;
    const {row,col} = eventToCell(e);
    const r0 = row - DRAG.anchor.r;
    const c0 = col - DRAG.anchor.c;
    const ignore = (DRAG.src==='board') ? DRAG.L : null;
    const probe = canPlaceAt(DRAG.shape, r0, c0, ignore);
    if (!probe.ok){ setStatus('⛔ Posizione non valida.'); DRAG=null; renderBoard(); return; }
    placed.set(DRAG.L, {cells:probe.cells, r0, c0, shape:DRAG.shape.map(x=>x.slice())});
    DRAG=null; renderBoard(); setStatus('Pezzo posizionato.');
  }
  boardEl.addEventListener('pointermove', (e)=>{ if (DRAG) updatePreviewFromEvent(e); });
  boardEl.addEventListener('pointerup', (e)=>{ if (DRAG){ commitFromEvent(e); lastEndAt=Date.now(); } });
  window.addEventListener('pointerup', (e)=>{ if (DRAG){ DRAG=null; renderBoard(); } });

  window.addEventListener('keydown',(e)=>{
    if (!DRAG) return;
    if (e.key==='r'||e.key==='R'){ DRAG.shape = rotate(DRAG.shape); e.preventDefault(); }
    if (e.key==='f'||e.key==='F'){ DRAG.shape = reflect(DRAG.shape); e.preventDefault(); }
  });

  // ===== Pieces panel =====
  function renderPiecesPanel(){
    piecesPanel.innerHTML='';
    for (const L of ORDER){
      const label=document.createElement('label'); label.className='piece-toggle';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=enabled.has(L);
      cb.addEventListener('change', ()=>{ if (cb.checked) enabled.add(L); else { enabled.delete(L); placed.delete(L);} renderBoard(); });
      const span=document.createElement('span'); span.textContent=L;
      label.appendChild(cb); label.appendChild(span); piecesPanel.appendChild(label);
    }
  }

  // ===== Presets & controls =====
  function applyPreset(p){
    holes.clear();
    if (p==='6x10'){ W=10; H=6; }
    else if(p==='5x12'){ W=12; H=5; }
    else if(p==='4x15'){ W=15; H=4; }
    else if(p==='3x20'){ W=20; H=3; }
    else if(p==='8x8h'){ W=8; H=8; holes.add(0); holes.add(1); holes.add(8); holes.add(9); }
    placed.clear(); renderBoard(); setStatus('Preset applicato.');
  }

  presetSel.addEventListener('change', ()=>applyPreset(presetSel.value));
  newBtn.addEventListener('click', ()=>applyPreset(presetSel.value));
  holesBtn.addEventListener('click', ()=>{ editHoles=!editHoles; holesBtn.textContent=editHoles?'Fine Modifica Fori':'Modifica Fori'; setStatus(editHoles?'Modalità fori attiva.':'Modalità fori disattivata.'); });
  resetHolesBtn.addEventListener('click', ()=>{ holes.clear(); renderBoard(); setStatus('Fori rimossi.'); });

  checkBtn.addEventListener('click', ()=>{
    const need = enabled.size*5, valid=W*H-holes.size;
    if (need!==valid) setStatus(`⚠️ Area non coerente: celle valide=${valid}, richieste=${need}.`);
    else setStatus('Area coerente.');
  });

  shuffleBtn.addEventListener('click', ()=>{ seedRand(Math.floor(Math.random()*1e9)); setStatus('Ordine di ricerca mescolato.'); });

  // ===== DLX solver with forced placements =====
  function generatePlacements(){
    const valid=[], cellToCol=new Map();
    for (let r=0;r<H;r++) for (let c=0;c<W;c++){ const k=idx(r,c); if (!holes.has(k)){ cellToCol.set(k,valid.length); valid.push(k);} }
    const pieceCol={}, baseCols=valid.length; let numCols=baseCols;
    for (const L of ORDER){ if (enabled.has(L)) pieceCol[L]=numCols++; }

    const forced = new Map();
    for (const [L,obj] of placed) forced.set(L, new Set(obj.cells.slice().sort((a,b)=>a-b)));

    const rows=[], placements=[];
    for (const L of ORDER){
      if (!enabled.has(L)) continue;
      const forcedCells = forced.get(L);
      for (const shape of orientations(PENT[L])){
        const maxr=Math.max(...shape.map(p=>p[0])); const maxc=Math.max(...shape.map(p=>p[1]));
        for (let r0=0; r0+maxr < H; r0++){
          for (let c0=0; c0+maxc < W; c0++){
            let ok=true; const cols=[], cells=[];
            for (const [dr,dc] of shape){
              const rr=r0+dr, cc=c0+dc; const k=idx(rr,cc);
              if (holes.has(k)){ ok=false; break; }
              // prevent overlap with forced of other pieces
              for (const [L2,obj2] of placed){ if (L2!==L && obj2.cells.includes(k)){ ok=false; break; } }
              if (!ok) break;
              cols.push(cellToCol.get(k)); cells.push(k);
            }
            if (!ok || cols.some(v=>v===undefined)) continue;
            if (forcedCells){
              const sorted=cells.slice().sort((a,b)=>a-b);
              if (sorted.length!==forcedCells.size) continue;
              let all=true; for (let i=0;i<sorted.length;i++){ if (!forcedCells.has(sorted[i])) {all=false; break;} }
              if (!all) continue;
            }
            cols.sort((a,b)=>a-b); cols.push(pieceCol[L]);
            rows.push(cols); placements.push({piece:L, cells});
          }
        }
      }
    }
    return {numCols, rows, placements};
  }

  function exactCover(limit=1){
    const {numCols, rows, placements} = generatePlacements();
    // DLX build
    const Hdr={L:null,R:null,U:null,D:null,C:null,S:0}; Hdr.L=Hdr.R=Hdr;
    function linkLR(a,b){ a.R=b; b.L=a; }
    function linkUD(a,b){ a.D=b; b.U=a; }
    const Col=[];
    for (let i=0;i<numCols;i++){ const c={L:null,R:null,U:null,D:null,C:null,S:0}; c.U=c.D=c; c.C=c; linkLR(Hdr.L||Hdr,c); linkLR(c,Hdr); Col.push(c); }
    const RowFirst=[];
    for (let r=0;r<rows.length;r++){ const cols=rows[r]; let first=null;
      for (const ci of cols){ const col=Col[ci]; const node={L:null,R:null,U:null,D:null,C:col,row:r};
        linkUD(col.U,node); linkUD(node,col); col.S++; if(first){ linkLR(first.L,node); linkLR(node,first);} else { first=node; first.L=first.R=first; } }
      RowFirst.push(first);
    }
    function cover(c){ c.R.L=c.L; c.L.R=c.R; for(let i=c.D;i!==c;i=i.D){ for(let j=i.R;j!==i;j=j.R){ j.D.U=j.U; j.U.D=j.D; j.C.S--; } } }
    function uncover(c){ for(let i=c.U;i!==c;i=i.U){ for(let j=i.L;j!==i;j=j.L){ j.C.S++; j.D.U=j; j.U.D=j; } } c.R.L=c; c.L.R=c; }
    function choose(){ let best=null,s=1e9; for(let c=Hdr.R;c!==Hdr;c=c.R){ if (c.S<s){ s=c.S; best=c; if (s<=1) break; } } return best; }
    const solution=[], out=[];
    function search(){
      if (Hdr.R===Hdr){ out.push(solution.slice().map(r=>placements[r])); return; }
      const c=choose(); if (!c || c.S===0) return; cover(c);
      const cand=[]; for(let r=c.D;r!==c;r=r.D) cand.push(r); shuffle(cand);
      for (const r of cand){
        solution.push(r.row); for(let j=r.R;j!==r;j=j.R) cover(j.C);
        search();
        for(let j=r.L;j!==r;j=j.L) uncover(j.C);
        solution.pop();
        if (out.length>=limit){ uncover(c); return; }
      }
      uncover(c);
    }
    search();
    return out;
  }

  // ===== Actions =====
  suggestBtn.addEventListener('click', ()=>{
    const need=enabled.size*5, valid=W*H-holes.size;
    if (need!==valid){ setStatus(`⛔ Area incoerente: celle valide=${valid}, richieste=${need}.`); return; }
    const sols = exactCover(1);
    if (!sols.length){ setStatus('Nessuna estensione possibile con i pezzi posati.'); return; }
    const placedSet=new Set(placed.keys());
    const next = sols[0].find(pl=>!placedSet.has(pl.piece));
    if (!next){ setStatus('Tutti i pezzi già posizionati.'); return; }
    placed.set(next.piece, {cells:next.cells.slice(), r0:0, c0:0, shape:null});
    renderBoard(); setStatus(`Suggerimento: posato ${next.piece}.`);
  });

  solveBtn.addEventListener('click', ()=>{
    const need=enabled.size*5, valid=W*H-holes.size;
    if (need!==valid){ setStatus(`⛔ Area incoerente: celle valide=${valid}, richieste=${need}.`); return; }
    const sols = exactCover(1);
    if (!sols.length){ setStatus('Nessuna soluzione trovata (con i vincoli attuali).'); return; }
    placed.clear();
    for (const pl of sols[0]) placed.set(pl.piece, {cells:pl.cells.slice(), r0:0, c0:0, shape:null});
    renderBoard(); setStatus('Soluzione applicata.');
  });

  // ===== Init =====
  function renderPiecesPanel(){
    piecesPanel.innerHTML='';
    for (const L of ORDER){
      const label=document.createElement('label'); label.className='piece-toggle';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=enabled.has(L);
      cb.addEventListener('change', ()=>{ if (cb.checked) enabled.add(L); else { enabled.delete(L); placed.delete(L);} renderBoard(); });
      const span=document.createElement('span'); span.textContent=L;
      label.appendChild(cb); label.appendChild(span); piecesPanel.appendChild(label);
    }
  }
  renderPiecesPanel();
  renderPalette();
  applyPreset('6x10');
  setStatus('Pronto. Trascina un pezzo o premi Risolvi.');

})();