// Nova OS Main Initialization

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Singletons that need DOM
    window.NovaIsland = new Island();
    window.NovaSpotlight = new SpotlightSearch();
    window.NovaShelf = new Shelf();
    
    // 2. Trigger initial Shelf render
    NovaShelf.render();

    // 3. Start Boot Sequence
    Boot.start();
});
