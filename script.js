const sampleText = document.getElementById('sample-text').innerText;
const inputArea = document.getElementById('input-area');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const restartBtn = document.getElementById('restart-btn');

let startTime;
let ended = false;

inputArea.addEventListener('input', () => {
    if (!startTime) {
        startTime = new Date();
    }

    const input = inputArea.value;
    const len = input.length;

    if (len >= sampleText.length) {
        endTest();
        return;
    }

    let correctChars = 0;
    for (let i = 0; i < len; i++) {
        if (input[i] === sampleText[i]) correctChars++;
    }

    const accuracy = ((correctChars / len) * 100).toFixed(0);
    accuracyDisplay.innerText = isNaN(accuracy) ? '100' : accuracy;
});

function endTest() {
    if (ended) return;
    ended = true;

    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000 / 60; // in minutes
    const wordsTyped = inputArea.value.trim().split(/\s+/).length;
    const wpm = Math.round(wordsTyped / timeTaken);

    wpmDisplay.innerText = isNaN(wpm) ? '0' : wpm;
    inputArea.disabled = true;
}

restartBtn.addEventListener('click', () => {
    inputArea.value = '';
    inputArea.disabled = false;
    wpmDisplay.innerText = '0';
    accuracyDisplay.innerText = '100';
    startTime = null;
    ended = false;
    inputArea.focus();
});
