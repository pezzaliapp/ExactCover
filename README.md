# Pentomino Exact Cover ♟️

![status](https://img.shields.io/badge/status-experimental-orange)
![license](https://img.shields.io/badge/license-MIT-green)
![pwa](https://img.shields.io/badge/PWA-ready-blue)

> “Un buon gioco non ti dice mai *cosa pensare*. Ti mostra come pensare.”  
> — liberamente ispirato a Bill Bernbach & Donald Knuth

---

## 🎯 Cos’è

**Pentomino Exact Cover** è una Progressive Web App (PWA) open source che porta sul tuo browser (desktop e mobile) uno dei puzzle matematici più eleganti di sempre:

- 12 pezzi diversi, i **Pentomini**  
- Ognuno formato da 5 quadrati  
- L’obiettivo: **coprire la griglia senza sovrapposizioni né spazi liberi**  

Dietro questo gioco apparentemente semplice, si nasconde la potenza dell’**Exact Cover Problem** di Donald Knuth e del suo celebre **Algorithm X**.

---

## 🧩 Come si gioca

1. Scegli una **griglia** (6×10, 5×12, 4×15, 3×20, 8×8 con fori).  
2. Trascina i pezzi dal pannello sulla griglia.  
3. Ruota ↻ o rifletti ⇋ i Pentomini per adattarli.  
4. Riempi tutto il rettangolo. Solo allora avrai trovato la soluzione.  

👉 **PC/laptop:** trascina con il mouse  
👉 **Smartphone/tablet:** *touch & drag* ottimizzato (ancora sperimentale su iOS)  

---

## ✨ Funzionalità

- 📐 **Griglie preimpostate** + griglie personalizzate  
- 🕳️ **Fori modificabili**: puoi “bucare” celle per creare puzzle nuovi  
- 🔄 **Rotazione e riflessione** dei pezzi  
- 📊 **Statistiche live**: area, copertura, pezzi usati  
- 📱 **PWA installabile**: aggiungila alla schermata Home e gioca offline  
- 🌗 **Dark mode** elegante di default  

---

## ⚠️ Limitazioni note

- Drag & drop su alcuni browser mobili (iOS Safari) è ancora **in fase sperimentale**  
- Le funzioni **“Suggerisci”** e **“Risolvi”** (solver completo) sono in sviluppo  
- Il ghost (anteprima pezzo) su mobile può essere meno fluido rispetto al desktop  

---

## 🚀 Installazione

Clona la repository o scarica lo ZIP:

```bash
git clone https://github.com/pezzaliapp/ExactCover.git
cd ExactCover

Apri index.html nel browser oppure pubblica su GitHub Pages/Netlify.
La PWA funziona completamente offline grazie al service worker.

⸻

🤝 Contribuire

Hai trovato un bug? Vuoi migliorare il drag su iPhone o aggiungere nuove varianti di puzzle?
Le pull request sono benvenute. Ogni contributo è un passo verso un puzzle più perfetto.

⸻

📜 Licenza

Distribuito sotto licenza MIT © 2025 PezzaliAPP

⸻

✍️ Una nota personale

I Pentomini non sono solo pezzi di plastica o pixel colorati.
Sono una metafora del pensiero creativo: incastri, simmetrie, errori, ripartenze.
Come nella vita, la soluzione non è mai data: va trovata, cella dopo cella.
