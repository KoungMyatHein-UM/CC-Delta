/* =========================================================
   Typing‑timing trainer – sentences edition
   ---------------------------------------------------------
   • Loads sentences from sentences.txt (one per line)
   • Lets the user pick how many sentences to type (5‑15)
   • Tracks time between every consecutive keystroke, but
     – ignores gaps ≥ 1 s (burst split)           [option 2]
     – ignores gaps > 1.5 s (hard cap)            [option 1]
     – ignores pairs that include the Enter key    [option 4]
   • “Skip” button jumps to the next sentence
   • “Save” downloads pair‑timings JSON
   ========================================================= */

/* ---------- tunables ---------- */
const MAX_MS = 1500;     // option 1 – discard gaps > 1500 ms
const GAP_MS = 1000;     // option 2 – new burst if gap ≥ 1000 ms

/* ---------- element handles ---------- */
const inputArea      = document.getElementById("input-area");
const restartBtn     = document.getElementById("restart-btn");
const saveBtn        = document.getElementById("save-btn");
const skipBtn        = document.getElementById("skip-btn");

const pairOut        = document.getElementById("pair-output");
const typedOut       = document.getElementById("typed-words");

const currentLineEl  = document.getElementById("current-word");
const lineNumEl      = document.getElementById("word-number");

const slider         = document.getElementById("count-slider");
const countDisp      = document.getElementById("count-display");

const totalLinesEl = document.getElementById("total-lines");

/* ---------- dynamic state ---------- */
let sentences        = [];      // full list from file
let targetLines      = [];      // lines chosen for this run
let linesToType      = Number(slider.value);

let idx              = 0;       // 0‑based index of current prompt
let typedLines       = [];      // what the user actually typed / skipped

let pairTimes        = {};      // { "H->e": [34, 27, …], … }

let prevChar  = null;           // previous key pressed (normalised)
let prevStamp = null;           // timestamp of previous key
let ended     = false;

/* =========================================================
   Utility helpers
   ========================================================= */
function pickRandomLines(n) {
    /* return n random distinct lines (simple shuffle‑slice) */
    const arr = sentences.slice();                    // shallow copy
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
}

function updatePromptDisplay() {
    lineNumEl.textContent = idx + 1;
    currentLineEl.textContent = targetLines[idx] ?? "—";
    totalLinesEl.textContent  = linesToType;
}

/* =========================================================
   Slider – live update of sentence count
   ========================================================= */
slider.addEventListener("input", () => {
    linesToType = Number(slider.value);         // new limit
    countDisp.textContent = linesToType;
    totalLinesEl.textContent = linesToType;

    /* if we’ve already typed that many (or more) sentences,
       end the run right away                              */
    if (!ended && idx >= linesToType) {
        finishSession();
    }
});

/* =========================================================
   Keystroke tracking
   ========================================================= */
inputArea.addEventListener("keydown", e => {
    if (ended) return;

    /* normalise key into printable / symbolic form */
    let key = e.key === "Enter" ? "\n"
        : e.key === "Backspace" ? "␈"
            : e.key;

    const now = performance.now();

    if (prevChar !== null) {
        const gap = now - prevStamp;
        const sameBurst   = gap < GAP_MS;
        const withinCap   = gap <= MAX_MS;
        const touchesLF   = prevChar === "\n" || key === "\n";

        if (sameBurst && withinCap && !touchesLF) {
            const pair = `${prevChar}->${key}`;
            (pairTimes[pair] ||= []).push(Math.round(gap));
        }
    }
    prevChar  = key;
    prevStamp = now;

    /* submit current line on Enter */
    if (e.key === "Enter") {
        e.preventDefault();                // keep textarea single‑line

        typedLines.push(inputArea.value.trim());
        idx++;

        if (idx >= linesToType) {
            finishSession();
        } else {
            inputArea.value = "";
            updatePromptDisplay();
        }
    }
});

/* =========================================================
   Button: Skip
   ========================================================= */
skipBtn.addEventListener("click", () => {
    if (ended) return;

    typedLines.push("[skipped]");
    idx++;

    /* reset previous‑key tracking so long gap isn’t recorded */
    prevChar = prevStamp = null;

    if (idx >= linesToType) {
        finishSession();
    } else {
        inputArea.value = "";
        updatePromptDisplay();
    }
});

/* =========================================================
   Button: Restart
   ========================================================= */
restartBtn.addEventListener("click", startNewSession);

function startNewSession() {
    /* (re)‑initialise run‑time state */
    pairTimes   = {};
    typedLines  = [];
    prevChar = prevStamp = null;
    idx      = 0;
    ended    = false;

    linesToType = Number(slider.value);
    countDisp.textContent = linesToType;

    /* pick fresh prompts */
    targetLines = pickRandomLines(linesToType);
    updatePromptDisplay();

    /* reset UI */
    inputArea.disabled  = false;
    inputArea.value     = "";
    pairOut.textContent = "— will appear when done —";
    typedOut.textContent= "— will appear when done —";
    inputArea.focus();
}

/* =========================================================
   Button: Save JSON
   ========================================================= */
saveBtn.addEventListener("click", () => {
    const blob = new Blob(
        [JSON.stringify(pairTimes, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);

    const a = Object.assign(document.createElement("a"), {
        href: url, download: "typing-pair-timings.json"
    });
    document.body.appendChild(a).click();
    a.remove();
    URL.revokeObjectURL(url);
});

/* =========================================================
   Finish session
   ========================================================= */
function finishSession() {
    ended = true;
    inputArea.disabled = true;

    pairOut.textContent  = JSON.stringify(pairTimes, null, 2);
    typedOut.textContent = typedLines.join("\n");
}

/* =========================================================
   Startup: load sentence list then begin first run
   ========================================================= */
(async () => {
    try {
        const res = await fetch("sentences.txt");
        const txt = await res.text();
        sentences = txt.split(/\r?\n/).filter(Boolean);

        if (sentences.length === 0) {
            currentLineEl.textContent = "No sentences found in sentences.txt";
            inputArea.disabled = true;
            return;
        }

        startNewSession();
    } catch (err) {
        currentLineEl.textContent = "Failed to load sentences.txt";
        console.error(err);
    }
})();
