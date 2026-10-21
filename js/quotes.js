const quotes = [
    { text: "代码写得好，下班回家早。", author: "程序员名言" },
    { text: "人生苦短，我用 Python。", author: "Bruce Eckel" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    { text: "不积跬步，无以至千里。", author: "荀子" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "任何傻瓜都能写出计算机能理解的代码。好的程序员编写人类能理解的代码。", author: "Martin Fowler" },
    { text: "先让它跑起来，再让它跑对，最后让它跑快。", author: "Kent Beck" },
    { text: "求知若饥，虚心若愚。", author: "乔布斯" },
    { text: "程序是写给人读的，只是偶尔让计算机执行一下。", author: "Donald Knuth" },
    { text: "学而不思则罔，思而不学则殆。", author: "孔子" },
    { text: "简单是可靠的前提。", author: "Edsger Dijkstra" },
    { text: "如果你的代码没有 bug，那它就不是代码。", author: "匿名" },
    { text: "重复的代码是万恶之源。", author: "DRY 原则" },
    { text: "永远不要相信用户的输入。", author: "前端铁律" },
    { text: "生活不止眼前的苟且，还有改不完的 Bug。", author: "码农" }
];

// 渲染 Hero 随机名言
const randomIndex = Math.floor(Math.random() * quotes.length);
document.getElementById('quote-text').innerText = `"${quotes[randomIndex].text}"`;
document.getElementById('quote-author').innerText = `- ${quotes[randomIndex].author}`;

// 渲染全部列表
const listElement = document.getElementById('all-quotes-list');
quotes.forEach(q => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>"${q.text}"</strong> - ${q.author}`;
    listElement.appendChild(li);
});