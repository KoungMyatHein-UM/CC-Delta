/* ==== CONFIG ===== */
const LINES_TO_TYPE = 10;      // how many sentences the user will type
const MAX_MS = 1500;           // option 1 – hard cap
const GAP_MS = 1000;           // option 2 – burst split

/* ==== ELEMENTS ==== */
const inputArea     = document.getElementById("input-area");
const restartBtn    = document.getElementById("restart-btn");
const saveBtn       = document.getElementById("save-btn");
const pairOut       = document.getElementById("pair-output");
const typedOut      = document.getElementById("typed-words");
const currentLineEl = document.getElementById("current-word");   // re‑use the span
const lineNumEl     = document.getElementById("word-number");    // re‑use the span
const skipBtn       = document.getElementById("skip-btn");

/* ==== STATE ==== */
let allLines   = [];          // loaded from sentences.txt
let targetLines= [];
let idx        = 0;
let typedLines = [];

let pairTimes  = {};
let prevChar   = null;
let prevStamp  = null;
let ended      = false;

/* ==== utilities ==== */
function randomLines(n) {
    const picked = [];
    while (picked.length < n && allLines.length) {
        const i = Math.floor(Math.random() * allLines.length);
        picked.push(allLines.splice(i, 1)[0]);
    }
    return picked;
}
function showCurrent() {
    lineNumEl.textContent = idx + 1;
    currentLineEl.textContent = targetLines[idx] || "—";
}

/* ==== key handling ==== */
inputArea.addEventListener("keydown", e => {
    if (ended) return;

    let k = e.key === "Enter" ? "\n"
        : e.key === "Backspace" ? "␈"
            : e.key;

    const now = performance.now();

    if (prevChar !== null) {
        const d = now - prevStamp;
        const sameBurst   = d < GAP_MS;
        const touchesLF   = (prevChar === "\n" || k === "\n");
        const withinCap   = d <= MAX_MS;

        if (sameBurst && !touchesLF && withinCap) {
            const pair = `${prevChar}->${k}`;
            (pairTimes[pair] ||= []).push(Math.round(d));
        }
    }
    prevChar = k;
    prevStamp = now;

    /* submit on Enter */
    if (e.key === "Enter") {
        e.preventDefault();                    // keep textarea single‑line
        typedLines.push(inputArea.value.trim());
        idx++;

        if (idx >= LINES_TO_TYPE) finish();
        else {
            inputArea.value = "";
            showCurrent();
        }
    }
});

/* ---------- skip handler ---------- */
function skipLine() {
    if (ended) return;

    typedLines.push("[skipped]");
    idx++;

    /* clear timing state so the long gap doesn’t pollute data */
    prevChar = prevStamp = null;

    if (idx >= LINES_TO_TYPE) {
        finish();
    } else {
        inputArea.value = "";
        showCurrent();
    }
}

skipBtn.addEventListener("click", skipLine);

/* ==== finish / restart ==== */
function finish() {
    ended = true;
    inputArea.disabled = true;
    pairOut.textContent  = JSON.stringify(pairTimes, null, 2);
    typedOut.textContent = typedLines.join("\n");
}
restartBtn.addEventListener("click", () => {
    pairTimes = {}; typedLines = [];
    prevChar = prevStamp = null;
    idx = 0; ended = false;

    /* re‑pick lines (allow repeats if you restart often) */
    targetLines = randomLines(LINES_TO_TYPE);
    showCurrent();

    inputArea.value = "";
    inputArea.disabled = false;
    pairOut.textContent  = "— will appear when done —";
    typedOut.textContent = "— will appear when done —";
    inputArea.focus();
});
saveBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(pairTimes, null, 2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {href:url, download:"typing-pair-timings.json"});
    document.body.appendChild(a).click(); a.remove();
    URL.revokeObjectURL(url);
});

/* ==== load sentence list then start ==== */
(async () => {
    const res = await fetch("sentences.txt");
    const txt = await res.text();
    allLines = txt.split(/\r?\n/).filter(Boolean);
    targetLines = randomLines(LINES_TO_TYPE);
    showCurrent();
})();
