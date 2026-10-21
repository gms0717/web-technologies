let randomNumber = Math.floor(Math.random() * 100) + 1;
let attempts = 0;

document.getElementById('guessBtn').addEventListener('click', () => {
    const userGuess = parseInt(document.getElementById('guessInput').value);
    const messageEl = document.getElementById('message');
    attempts++;
    document.getElementById('attempts').innerText = attempts;

    if (isNaN(userGuess) || userGuess < 1 || userGuess > 100) {
        messageEl.innerText = "请输入 1 到 100 之间的有效数字！";
        messageEl.style.color = "orange";
        return;
    }

    if (userGuess === randomNumber) {
        messageEl.innerText = `恭喜你！猜对了！数字就是 ${randomNumber}。你一共猜了 ${attempts} 次。`;
        messageEl.style.color = "green";
    } else if (userGuess > randomNumber) {
        messageEl.innerText = "太大了！再试试。";
        messageEl.style.color = "red";
    } else {
        messageEl.innerText = "太小了！再试试。";
        messageEl.style.color = "red";
    }
});