document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById('navbar');
    if (header) {
        header.innerHTML = `
            <nav style="display: flex; gap: 20px; padding: 20px; background: #333; color: white;">
                <a href="index.html" style="color: white; text-decoration: none;">Home</a>
                <a href="quotes.html" style="color: white; text-decoration: none;">Quotes</a>
                <a href="projects.html" style="color: white; text-decoration: none;">Projects</a>
                <a href="machine.html" style="color: white; text-decoration: none;">Game</a>
            </nav>
        `;
    }
});