Apps.register({
    id: 'codeedit',
    name: 'Code',
    iconId: 'codeedit',
    category: 'productivity',
    keepInDock: true,
    launch: () => {
        const winId = 'codeedit-' + Date.now();
        const html = `
            <div style="display: flex; height: 100%;">
                <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary);">Explorer</div>
                    <div style="font-size: 13px; color: var(--accent-primary);">index.js</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">styles.css</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.5);">
                    <div style="height: 40px; border-bottom: 1px solid var(--border-glass); display: flex; align-items: center; padding: 0 16px; font-size: 13px;">
                        index.js
                    </div>
                    <textarea style="flex: 1; background: transparent; border: none; padding: 16px; color: var(--text-primary); font-family: var(--font-mono); font-size: 14px; outline: none; resize: none;">function initNova() {
  console.log("Welcome to Nova OS");
  document.body.style.background = "#0A0A0C";
}

initNova();</textarea>
                </div>
            </div>
        `;
        WindowManager.create({ id: winId, appId: 'codeedit', title: 'Code Editor', width: 700, height: 450, content: html });
    }
});
