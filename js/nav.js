document.addEventListener("DOMContentLoaded", () => {
    // 假设每个页面都有一个 <header id="navbar"></header>
    const header = document.getElementById('navbar');
    if (header) {
        header.innerHTML = `
            <nav style="display: flex; gap: 20px; padding: 20px; background: #333; color: white;">
                <a href="index.html" style="color: white; text-decoration: none;">首页</a>
                <a href="quotes.html" style="color: white; text-decoration: none;">名言</a>
                <a href="projects.html" style="color: white; text-decoration: none;">项目</a>
                <a href="machine.html" style="color: white; text-decoration: none;">游戏</a>
            </nav>
        `;
    }
});