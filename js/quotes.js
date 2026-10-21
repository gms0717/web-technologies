const quotes = [
    { text: "Code is like humor. When you have to explain it, it’s bad.", author: "Cory House" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde" },
    { text: "Java is to JavaScript what car is to Carpet.", author: "Chris Heilmann" },
    { text: "Knowledge is power.", author: "Francis Bacon" },
    { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
    { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson" },
    { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
    { text: "Programming isn't about what you know; it's about what you can figure out.", author: "Chris Pine" },
    { text: "The only way to learn a new programming language is by writing programs in it.", author: "Dennis Ritchie" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
    { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
    { text: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" }
];

// Render Random Quote in Hero
const randomIndex = Math.floor(Math.random() * quotes.length);
document.getElementById('quote-text').innerText = `"${quotes[randomIndex].text}"`;
document.getElementById('quote-author').innerText = `- ${quotes[randomIndex].author}`;

// Render All Quotes List
const listElement = document.getElementById('all-quotes-list');
quotes.forEach(q => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>"${q.text}"</strong> - ${q.author}`;
    listElement.appendChild(li);
});