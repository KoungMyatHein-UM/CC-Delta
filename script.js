/* =========================================================
   Typing-timing trainer – sentences edition with full capture
   ---------------------------------------------------------
   • Loads sentences from sentences.txt (one per line)
   • User picks how many sentences to type (5-15)
   • Tracks:
     – dwell times      (how long each key is held down)
     – flight times     (time between keyUp and next keyDown)
     – k-order n-gram delays (time between successive keyDowns,
                             for contexts of length 1…CONTEXT_K)
   • Applies filters to n-grams:
     – ignores gaps ≥ GAP_MS    (burst split)
     – ignores gaps > MAX_MS    (hard cap)
     – does *not* drop Enter or navigation keys — captures everything
   • “Skip” jumps to next sentence
   • “Save” downloads JSON:
       {
         "ngram_times":  { "[a]->[b]": [...], "[ab]->[c]": [...] },
         "dwell_times":  { "a": [...], "ArrowLeft": [...], … },
         "flight_times": { "[a]->[b]": […], … }
       }
   ========================================================= */

/* ---------- tunables ---------- */
const MAX_MS     = 1500;   // hard cap: discard delays > 1500 ms
const GAP_MS     = 1000;   // burst split: drop delays ≥ 1000 ms
const CONTEXT_K  = 5;      // max n-gram context length

/* ---------- element handles ---------- */
const inputArea     = document.getElementById("input-area");
const restartBtn    = document.getElementById("restart-btn");
const saveBtn       = document.getElementById("save-btn");
const skipBtn       = document.getElementById("skip-btn");

const pairOut       = document.getElementById("pair-output");
const typedOut      = document.getElementById("typed-words");

const currentLineEl = document.getElementById("current-word");
const lineNumEl     = document.getElementById("word-number");
const totalLinesEl  = document.getElementById("total-lines");

const slider        = document.getElementById("count-slider");
const countDisp     = document.getElementById("count-display");

/* ---------- dynamic state ---------- */
let sentences       = [];    // loaded from sentences.txt
let targetLines     = [];    // chosen prompts this session
let linesToType     = Number(slider.value);

let idx             = 0;     // which line we’re on (0-based)
let typedLines      = [];    // what user actually typed / skipped

let prevCharsBuf    = [];    // last up to CONTEXT_K keys (for n-grams)
let prevStamp       = null;  // timestamp of last keyDown

// data stores
let ngramTimes      = {};    // { "[a]->[b]": [...], "[ab]->[c]": [...] }
let dwellTimes      = {};    // { "a": [...], "ArrowLeft": [...], … }
let flightTimes     = {};    // { "[a]->[b]": […], … }

// for dwell/flight tracking
let dwellStartTimes = {};    // when each key was pressed
let lastKeyUpStamp  = null;  // timestamp of last keyUp
let lastKeyUpKey    = null;  // which key was released

let ended           = false; // session over?

/* =========================================================
   pick n random lines (Fisher-Yates + slice)
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
   update the “Sentence X of N” prompt
   ========================================================= */
function updatePromptDisplay() {
    lineNumEl.textContent    = idx + 1;
    totalLinesEl.textContent = linesToType;
    currentLineEl.textContent= targetLines[idx] ?? "—";
}

/* =========================================================
   slider: adjust linesToType live & maybe finish
   ========================================================= */
slider.addEventListener("input", () => {
    linesToType = Number(slider.value);
    countDisp.textContent     = linesToType;
    totalLinesEl.textContent  = linesToType;
    if (!ended && idx >= linesToType) finishSession();
});

/* =========================================================
   keyDown: record flight, n-gram; start dwell
   ========================================================= */
inputArea.addEventListener("keydown", e => {
    if (ended) return;

    // normalise key name
    let key = e.key === "Enter"     ? "\\n"
        : e.key === "Backspace" ? "␈"
            : e.key;

    const now = performance.now();

    /* —— flight time —— */
    if (lastKeyUpStamp !== null) {
        const flight = now - lastKeyUpStamp;
        const fk = `[${lastKeyUpKey}]->[${key}]`;
        (flightTimes[fk] ||= []).push(Math.round(flight));
    }

    /* —— n-gram timings —— */
    if (prevCharsBuf.length > 0 && prevStamp !== null) {
        const gap = now - prevStamp;
        const sameBurst = gap < GAP_MS;
        const withinCap = gap <= MAX_MS;

        for (let j = 1; j <= CONTEXT_K; j++) {
            if (prevCharsBuf.length >= j) {
                if (!sameBurst || !withinCap) continue;

                const ctxArr = prevCharsBuf.slice(-j);
                const ctxStr = ctxArr.join('');                   // no commas
                const pk     = `[${ctxStr}]->[${key}]`;
                (ngramTimes[pk] ||= []).push(Math.round(gap));
            }
        }
    }

    /* —— start dwell timer for this key —— */
    dwellStartTimes[key] = now;

    /* —— update buffer & timestamp —— */
    prevCharsBuf.push(key);
    if (prevCharsBuf.length > CONTEXT_K) prevCharsBuf.shift();
    prevStamp = now;

    /* —— Enter = end of sentence —— */
    if (e.key === "Enter") {
        e.preventDefault();
        typedLines.push(inputArea.value.trim());
        idx++;
        prevCharsBuf = [];
        prevStamp    = null;
        if (idx >= linesToType) finishSession();
        else {
            inputArea.value = "";
            updatePromptDisplay();
        }
    }
});

/* =========================================================
   keyUp: record dwell time & mark lastKeyUp
   ========================================================= */
inputArea.addEventListener("keyup", e => {
    if (ended) return;

    let key = e.key === "Enter"     ? "\n"
        : e.key === "Backspace" ? "␈"
            : e.key;

    const nowUp = performance.now();

    // record dwell
    if (dwellStartTimes[key] != null) {
        const dwell = nowUp - dwellStartTimes[key];
        (dwellTimes[key] ||= []).push(Math.round(dwell));
        delete dwellStartTimes[key];
    }

    // prepare for next flight
    lastKeyUpStamp = nowUp;
    lastKeyUpKey   = key;
});

/* =========================================================
   Skip button
   ========================================================= */
skipBtn.addEventListener("click", () => {
    if (ended) return;
    typedLines.push("[skipped]");
    idx++;
    prevCharsBuf = [];
    prevStamp    = null;
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
    // reset all data
    ngramTimes      = {};
    dwellTimes      = {};
    flightTimes     = {};
    dwellStartTimes = {};
    lastKeyUpStamp  = null;
    lastKeyUpKey    = null;

    typedLines      = [];
    prevCharsBuf    = [];
    prevStamp       = null;
    idx             = 0;
    ended           = false;

    linesToType     = Number(slider.value);
    countDisp.textContent     = linesToType;
    totalLinesEl.textContent  = linesToType;

    targetLines     = pickRandomLines(linesToType);
    updatePromptDisplay();

    inputArea.disabled  = false;
    inputArea.value     = "";
    pairOut.textContent = "— will appear when done —";
    typedOut.textContent= "— will appear when done —";
    inputArea.focus();
}

/* =========================================================
   Finish & display results
   ========================================================= */
function finishSession() {
    ended = true;
    inputArea.disabled = true;
    pairOut.textContent = "(see saved JSON for timings)";
    typedOut.textContent = typedLines.join("\n");
}

/* =========================================================
   Save JSON
   ========================================================= */
saveBtn.addEventListener("click", () => {
    const out = {
        ngram_times:  ngramTimes,
        dwell_times:  dwellTimes,
        flight_times: flightTimes
    };
    const blob = new Blob(
        [JSON.stringify(out, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement("a"), {
        href: url,
        download: "typing-timings.json"
    });
    document.body.appendChild(a).click();
    a.remove();
    URL.revokeObjectURL(url);
});

/* =========================================================
   Init: load sentences.txt then start
   ========================================================= */
(async () => {
    try {
        const res = await fetch("sentences.txt");
        const txt = await res.text();
        sentences = txt.split(/\r?\n/).filter(Boolean);
        if (!sentences.length) {
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
