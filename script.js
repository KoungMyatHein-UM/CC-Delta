/* =========================================================
   Typing-timing trainer – sentences edition with k-order
   ---------------------------------------------------------
   • Loads sentences from sentences.txt (one per line)
   • User picks how many sentences to type (5-15)
   • Tracks time between every consecutive keystroke,
     up to k-order contexts:
       – for k = 3, records:
         * char1→char2
         * char1,char2→char3
         * char1,char2,char3→char4
   • Applies filters:
     – ignores gaps ≥ GAP_MS (burst split)
     – ignores gaps > MAX_MS (hard cap)
     – ignores any context containing Enter
   • “Skip” jumps to next sentence
   • “Save” downloads pair-timings JSON
   ========================================================= */

/* ---------- tunables ---------- */
const MAX_MS     = 1500;   // hard cap: discard gaps > 1500 ms
const GAP_MS     = 1000;   // burst split: drop gaps ≥ 1000 ms
const CONTEXT_K  = 5;      // max context length (k)

/* ---------- element handles ---------- */
const inputArea      = document.getElementById("input-area");
const restartBtn     = document.getElementById("restart-btn");
const saveBtn        = document.getElementById("save-btn");
const skipBtn        = document.getElementById("skip-btn");

const pairOut        = document.getElementById("pair-output");
const typedOut       = document.getElementById("typed-words");

const currentLineEl  = document.getElementById("current-word");
const lineNumEl      = document.getElementById("word-number");
const totalLinesEl   = document.getElementById("total-lines");

const slider         = document.getElementById("count-slider");
const countDisp      = document.getElementById("count-display");

const SEP = "\u001F";

/* ---------- dynamic state ---------- */
let sentences       = [];      // full list from file
let targetLines     = [];      // lines chosen for this run
let linesToType     = Number(slider.value);

let idx             = 0;       // 0-based index of current prompt
let typedLines      = [];      // what the user actually typed / skipped

let pairTimes       = {};      // { "a->b": [...], "a,b->c": [...], ... }

let prevStamp       = null;    // timestamp of previous key
let prevCharsBuf    = [];      // buffer of last up to CONTEXT_K chars

let ended           = false;

/* =========================================================
   Utility: pick n random lines (Fisher-Yates)
   ========================================================= */
function pickRandomLines(n) {
    const arr = sentences.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
}

/* =========================================================
   Update prompt display (X of N)
   ========================================================= */
function updatePromptDisplay() {
    lineNumEl.textContent   = idx + 1;
    totalLinesEl.textContent= linesToType;
    currentLineEl.textContent = targetLines[idx] ?? "—";
}

/* =========================================================
   Slider – live update of sentence count
   ========================================================= */
slider.addEventListener("input", () => {
    linesToType = Number(slider.value);
    countDisp.textContent   = linesToType;
    totalLinesEl.textContent= linesToType;
    if (!ended && idx >= linesToType) finishSession();
});

/* =========================================================
   Keystroke tracking with k-order contexts
   ========================================================= */
inputArea.addEventListener("keydown", e => {
    if (ended) return;

    // normalize key
    let key = e.key === "Enter" ? "\n"
        : e.key === "Backspace" ? "␈"
            : e.key;

    const now = performance.now();

    if (prevCharsBuf.length > 0 && prevStamp !== null) {
        const gap = now - prevStamp;
        const sameBurst = gap < GAP_MS;
        const withinCap = gap <= MAX_MS;

        // for each context length j = 1..CONTEXT_K
        for (let j = 1; j <= CONTEXT_K; j++) {
            if (prevCharsBuf.length >= j) {
                const context = prevCharsBuf.slice(-j);
                // skip if any in context or current key is Enter
                if (context.includes("\n") || key === "\n") continue;
                if (!sameBurst || !withinCap) continue;

                const ctxKey = context.join(SEP);
                const pairKey = `${ctxKey}${SEP}${key}`;

                (pairTimes[pairKey] ||= []).push(Math.round(gap));
            }
        }
    }

    // push this key into buffer
    prevCharsBuf.push(key);
    if (prevCharsBuf.length > CONTEXT_K) prevCharsBuf.shift();
    prevStamp = now;

    // handle Enter as end-of-line
    if (e.key === "Enter") {
        e.preventDefault();
        typedLines.push(inputArea.value.trim());
        idx++;
        // reset buffer so no huge gap pollutes next line
        prevCharsBuf = [];
        prevStamp = null;

        if (idx >= linesToType) finishSession();
        else {
            inputArea.value = "";
            updatePromptDisplay();
        }
    }
});

/* =========================================================
   Skip button
   ========================================================= */
skipBtn.addEventListener("click", () => {
    if (ended) return;
    typedLines.push("[skipped]");
    idx++;
    prevCharsBuf = [];
    prevStamp = null;
    if (idx >= linesToType) finishSession();
    else {
        inputArea.value = "";
        updatePromptDisplay();
    }
});

/* =========================================================
   Restart button
   ========================================================= */
restartBtn.addEventListener("click", startNewSession);

function startNewSession() {
    pairTimes       = {};
    typedLines      = [];
    prevCharsBuf    = [];
    prevStamp       = null;
    idx             = 0;
    ended           = false;

    linesToType     = Number(slider.value);
    countDisp.textContent   = linesToType;
    totalLinesEl.textContent= linesToType;

    targetLines     = pickRandomLines(linesToType);
    updatePromptDisplay();

    inputArea.disabled = false;
    inputArea.value    = "";
    pairOut.textContent= "— will appear when done —";
    typedOut.textContent="— will appear when done —";
    inputArea.focus();
}

/* =========================================================
   Save JSON
   ========================================================= */
saveBtn.addEventListener("click", () => {
    const blob = new Blob(
        [ JSON.stringify(pairTimes, null, 2) ],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
        href: url,
        download: "typing-pair-timings.json"
    });
    document.body.appendChild(a).click();
    a.remove();
    URL.revokeObjectURL(url);
});

/* =========================================================
   Finish and display results
   ========================================================= */
function finishSession() {
    ended = true;
    inputArea.disabled = true;
    pairOut.textContent  = JSON.stringify(pairTimes, null, 2);
    typedOut.textContent = typedLines.join("\n");
}

/* =========================================================
   Startup: load sentences.txt then kick off
   ========================================================= */
(async () => {
    try {
        const res = await fetch("sentences.txt");
        const txt = await res.text();
        sentences = txt.split(/\r?\n/).filter(Boolean);
        if (sentences.length === 0) {
            currentLineEl.textContent = "No sentences found.";
            inputArea.disabled = true;
            return;
        }
        startNewSession();
    } catch (err) {
        currentLineEl.textContent = "Error loading sentences.";
        console.error(err);
    }
})();
