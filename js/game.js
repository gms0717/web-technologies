let randomNumber = Math.floor(Math.random() * 100) + 1;
let attempts = 0;

document.getElementById('guessBtn').addEventListener('click', () => {
    const userGuess = parseInt(document.getElementById('guessInput').value);
    const messageEl = document.getElementById('message');
    attempts++;
    document.getElementById('attempts').innerText = attempts;

    if (isNaN(userGuess) || userGuess < 1 || userGuess > 100) {
        messageEl.innerText = "Please enter a valid number between 1 and 100!";
        messageEl.style.color = "orange";
        return;
    }

    if (userGuess === randomNumber) {
        messageEl.innerText = `Congratulations! You guessed it! The number was ${randomNumber}. You took ${attempts} attempts.`;
        messageEl.style.color = "green";
    } else if (userGuess > randomNumber) {
        messageEl.innerText = "Too high! Try again.";
        messageEl.style.color = "red";
    } else {
        messageEl.innerText = "Too low! Try again.";
        messageEl.style.color = "red";
    }
});