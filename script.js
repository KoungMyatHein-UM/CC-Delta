const wordList = [
    "ability","able","about","above","absent","absorb","abstract","absurd","abuse","access",
    "accident","account","accuse","achieve","acid","acoustic","acquire","across","act","action",
    "actor","actress","actual","adapt","add","addict","address","adjust","admit","adult"
];

const sampleTextElem = document.getElementById("sample-text");
const inputArea      = document.getElementById("input-area");
const wpmDisplay     = document.getElementById("wpm");
const accuracyDisplay= document.getElementById("accuracy");
const restartBtn     = document.getElementById("restart-btn");
const pairOutput     = document.getElementById("pair-output");

let sampleText = "";
let startTime  = null;
let ended      = false;

const pairTimes = {};
let prevChar  = null;
let prevStamp = null;

function getRandomWords(n = 10) {
    const words = [];
    for (let i = 0; i < n; i++) {
        words.push(wordList[Math.floor(Math.random() * wordList.length)]);
    }
    return words.join(" ");
}

function setNewSampleText() {
    sampleText = getRandomWords();
    sampleTextElem.textContent = sampleText;
}

// handle all keypresses
inputArea.addEventListener("keydown", (e) => {
    let key = e.key;

    if (key === "Enter") {
        key = "\n";
    } else if (key === "Backspace") {
        key = "␈"; // visual symbol for backspace
    }

    const now = performance.now();

    if (prevChar !== null) {
        const pair = `${prevChar}->${key}`;
        const delta = now - prevStamp;

        if (!pairTimes[pair]) pairTimes[pair] = [];
        pairTimes[pair].push(Math.round(delta));
    }

    prevChar  = key;
    prevStamp = now;

    if (!startTime) startTime = now;
});

inputArea.addEventListener("input", () => {
    const input = inputArea.value;
    const len   = input.length;

    let correct = 0;
    for (let i = 0; i < len; i++) {
        if (input[i] === sampleText[i]) correct++;
    }

    const acc = len ? (correct / len * 100).toFixed(0) : "100";
    accuracyDisplay.textContent = acc;

    if (len >= sampleText.length) endTest();
});

function endTest() {
    if (ended) return;
    ended = true;

    const minutes = (performance.now() - startTime) / 1000 / 60;
    const wordsTyped = inputArea.value.trim().split(/\s+/).length;
    const wpm = Math.round(wordsTyped / minutes) || 0;
    wpmDisplay.textContent = wpm;

    inputArea.disabled = true;
    pairOutput.textContent = JSON.stringify(pairTimes, null, 2);
}

restartBtn.addEventListener("click", () => {
    inputArea.value = "";
    inputArea.disabled = false;
    wpmDisplay.textContent = "0";
    accuracyDisplay.textContent = "100";
    pairOutput.textContent = "— will appear when done —";

    startTime = null;
    ended     = false;
    prevChar  = null;
    prevStamp = null;
    for (const k in pairTimes) delete pairTimes[k];

    setNewSampleText();
    inputArea.focus();
});

setNewSampleText();
