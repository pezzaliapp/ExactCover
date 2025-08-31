# ExactCover — Pentomino PWA (PezzaliAPP)

Il **più difficile** della serie: un puzzle di **Exact Cover** con i 12 pentomino (F, I, L, P, N, T, U, V, W, X, Y, Z).  
Obiettivo: coprire tutte le celle **una volta sola** usando ogni pezzo **una volta sola** — senza sovrapposizioni.

## ✨ Funzioni
- Preset classici: **6×10, 5×12, 4×15, 3×20** e **8×8 con 4 fori**
- Modalità **fori** per personalizzare la griglia
- Abilita/disabilita singoli pezzi
- **Solver Exact Cover** (Algorithm X) con:
  - **Suggerisci** (primo pezzo utile)
  - **Risolvi (1)** (applica una soluzione)
  - **Trova tutte** (fino a 50, per non appesantire)
- PWA: **installabile** e **offline**

## 🚀 Avvio rapido
- Metti i file su un hosting statico (GitHub Pages, Netlify, Vercel)  
- Apri `index.html` (HTTPS o localhost per il Service Worker)

## 📂 Struttura
```
ExactCover/
├─ index.html
├─ style.css
├─ script.js
├─ manifest.json
├─ service-worker.js
├─ icons/
│  ├─ icon-192.png
│  ├─ icon-512.png
│  └─ favicon.ico
├─ README.md
└─ LICENSE
```

## 🧠 Note tecniche
- Rappresentazione come **Exact Cover**: colonne = celle + vincoli di uso dei pezzi; righe = ogni possibile posizionamento (5 celle + 1 pezzo)
- Backtracking stile **Algorithm X** (versione set-based); limite soluzioni = 50 per garantire reattività in browser
- Orientazioni generate da rotazioni/riflessioni con deduplica

## ⚠️ Coerenza area
Celle valide devono essere = `5 × #pezzi attivi` (es. 60 per i 12 pentomino). Se non coincide, il solver non parte.

## 📜 Licenza
MIT © 2025 Alessandro Pezzali — PezzaliAPP