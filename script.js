document.addEventListener('DOMContentLoaded', () => {
  'use strict';

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
  const pieceSelect = document.getElementById('pieceSelect');
  const rotBtn = document.getElementById('rotBtn');
  const flipBtn = document.getElementById('flipBtn');
  const removeBtn = document.getElementById('removeBtn');
  const clearPlacedBtn = document.getElementById('clearPlacedBtn');
  const palette = document.getElementById('palette');
  const statSize = document.getElementById('statSize');
  const statCells = document.getElementById('statCells');
  const statCover = document.getElementById('statCover');
  const statusEl = document.getElementById('status');

  // --- State ---
  let W = 10, H = 6;
  let holes = new Set();
  let editHoles = false;
  let placed = new Map();
  let orient = {};

  // --- Utils ---
  const idx = (r, c) => r * W + c;
  function setStatus(msg) { statusEl.textContent = msg; }

  function normalize(cells) {
    const minr = Math.min(...cells.map(p => p[0]));
    const minc = Math.min(...cells.map(p => p[1]));
    return cells
      .map(([r, c]) => [r - minr, c - minc])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  function rotate(cells) { return normalize(cells.map(([r, c]) => [c, -r])); }
  function reflect(cells) { return normalize(cells.map(([r, c]) => [r, -c])); }
  function pieceColor(L) {
    const h = (L.charCodeAt(0) * 37) % 360;
    return `hsl(${h} 45% 26%)`;
  }

  // --- Render ---
  function renderBoard() {
    boardEl.style.setProperty('--w', W);
    boardEl.style.setProperty('--h', H);
    boardEl.innerHTML = '';
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const k = idx(r, c);
        const cell = document.createElement('div');
        cell.className = 'cell' + (((r + c) % 2) ? ' dark' : '');
        if (holes.has(k)) cell.classList.add('hole');
        for (const [L, obj] of placed) {
          if (obj.cells.includes(k)) {
            cell.classList.add('piece');
            cell.style.background = pieceColor(L);
            break;
          }
        }
        // Click: foro o rimuovi
        cell.addEventListener('click', () => {
          if (editHoles) {
            holes.has(k) ? holes.delete(k) : holes.add(k);
            renderBoard();
          } else {
            for (const [L, obj] of placed) {
              if (obj.cells.includes(k)) {
                placed.delete(L);
                renderBoard();
                setStatus(`Rimosso ${L}.`);
                return;
              }
            }
          }
        });
        // Trascina da griglia
        cell.addEventListener('pointerdown', (e) => {
          if (editHoles || !cell.classList.contains('piece')) return;
          for (const [L, obj] of placed) {
            if (obj.cells.includes(k)) {
              DRAG = {
                type: 'move',
                L,
                shape: obj.shape,
                offR: r - obj.r0,
                offC: c - obj.c0
              };
              boardEl.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
          }
        });
        boardEl.appendChild(cell);
      }
    }
    updateStats();
  }

  function updateStats() {
    const valid = W * H - holes.size;
    const covered = new Set([...placed.values()].flatMap(o => o.cells)).size;
    statSize.textContent = `${H}×${W}`;
    statCells.textContent = String(valid);
    statCover.textContent = `${covered}/${valid}`;
  }

  // --- Palette ---
  function renderPalette() {
    palette.innerHTML = '';
    for (const L of PIECE_ORDER) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.piece = L;
      tile.style.setProperty('color', pieceColor(L));

      const mini = document.createElement('div');
      mini.className = 'mini';
      const shape = orient[L] || (orient[L] = normalize(PENTOMINOES[L]));
      const on = new Set(shape.map(([r, c]) => `${r},${c}`));
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const m = document.createElement('div');
          m.className = 'cell' + (on.has(`${r},${c}`) ? ' on' : '');
          mini.appendChild(m);
        }
      }
      tile.appendChild(mini);
      tile.appendChild(document.createTextNode(L));

      // Trascina da palette
      tile.addEventListener('pointerdown', (e) => {
        DRAG = {
          type: 'new',
          L,
          shape: (orient[L] || normalize(PENTOMINOES[L])).map(x => x.slice())
        };
        boardEl.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      palette.appendChild(tile);
    }
    pieceSelect.innerHTML = '';
    PIECE_ORDER.forEach(L => {
      const opt = document.createElement('option');
      opt.value = L;
      opt.textContent = L;
      pieceSelect.appendChild(opt);
    });
  }

  // --- Drag system ---
  let DRAG = null;

  boardEl.addEventListener('pointermove', (e) => {
    if (!DRAG) return;
    const rect = boardEl.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / (rect.width / W));
    const r = Math.floor((e.clientY - rect.top) / (rect.height / H));
    let r0 = r, c0 = c;
    if (DRAG.type === 'move') {
      r0 = r - DRAG.offR;
      c0 = c - DRAG.offC;
    }
    const cells = [];
    let valid = true;
    for (const [dr, dc] of DRAG.shape) {
      const rr = r0 + dr, cc = c0 + dc;
      if (rr < 0 || rr >= H || cc < 0 || cc >= W) valid = false;
      const k = idx(rr, cc);
      if (holes.has(k)) valid = false;
      for (const [L2, obj2] of placed) {
        if (DRAG.L === L2) continue;
        if (obj2.cells.includes(k)) valid = false;
      }
      cells.push(k);
    }
    DRAG.preview = { r0, c0, cells, valid };
    renderBoard();
  });

  window.addEventListener('pointerup', (e) => {
    if (!DRAG || !DRAG.preview || !DRAG.preview.valid) {
      DRAG = null;
      renderBoard();
      return;
    }
    const { r0, c0, cells } = DRAG.preview;
    placed.set(DRAG.L, { cells, shape: DRAG.shape, r0, c0 });
    DRAG = null;
    renderBoard();
    setStatus(`Pezzo ${DRAG.L} posizionato.`);
  });

  // --- Controls ---
  function applyPreset(name) {
    holes.clear();
    if (name === '6x10') { W = 10; H = 6; }
    else if (name === '5x12') { W = 12; H = 5; }
    else if (name === '4x15') { W = 15; H = 4; }
    else if (name === '3x20') { W = 20; H = 3; }
    else if (name === '8x8h') { W = 8; H = 8; [0,1,8,9].forEach(k => holes.add(k)); }
    placed.clear();
    renderBoard();
    wInput.value = W;
    hInput.value = H;
    setStatus('Preset applicato.');
  }

  presetSel.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'custom') return;
    applyPreset(v);
  });
  newBtn.addEventListener('click', () => {
    W = Math.max(3, Math.min(20, wInput.valueAsNumber || 10));
    H = Math.max(3, Math.min(20, hInput.valueAsNumber || 6));
    holes.clear();
    placed.clear();
    renderBoard();
    setStatus('Griglia creata.');
  });
  holesBtn.addEventListener('click', () => {
    editHoles = !editHoles;
    holesBtn.textContent = editHoles ? 'Fine Modifica' : 'Modifica Fori';
    setStatus(editHoles ? 'Clicca per creare/rimuovere fori.' : 'Modalità fori disattivata.');
  });
  resetHolesBtn.addEventListener('click', () => {
    holes.clear();
    renderBoard();
    setStatus('Fori rimossi.');
  });

  rotBtn.addEventListener('click', () => {
    const L = pieceSelect.value;
    if (!L) return;
    orient[L] = rotate(orient[L] || normalize(PENTOMINOES[L]));
    renderPalette();
    setStatus(`Ruotato ${L}.`);
  });
  flipBtn.addEventListener('click', () => {
    const L = pieceSelect.value;
    if (!L) return;
    orient[L] = reflect(orient[L] || normalize(PENTOMINOES[L]));
    renderPalette();
    setStatus(`Specchiato ${L}.`);
  });
  removeBtn.addEventListener('click', () => {
    const L = pieceSelect.value;
    if (!L) return;
    placed.delete(L);
    renderBoard();
    setStatus(`Rimosso ${L}.`);
  });
  clearPlacedBtn.addEventListener('click', () => {
    placed.clear();
    renderBoard();
    setStatus('Tutti i pezzi rimossi.');
  });

  // --- Init ---
  renderPalette();
  applyPreset('6x10');
});
