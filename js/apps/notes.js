Apps.register({
    id: 'notes',
    name: 'Notes',
    iconId: 'notes',
    category: 'productivity',
    keepInDock: true,
    launch: () => {
        const winId = 'notes-' + Date.now();
        const html = `
            <div style="display: flex; height: 100%;">
                <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(255,160,0,0.1); padding: 16px;">
                    <h3 style="margin-bottom: 16px; font-weight: 500; font-size: 18px;">Notes</h3>
                    <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--accent-warm);">
                        Idea: Space Desktop
                    </div>
                </div>
                <div style="flex: 1; padding: 24px; background: rgba(0,0,0,0.2);">
                    <textarea style="width: 100%; height: 100%; background: transparent; border: none; color: var(--text-primary); font-family: var(--font-sans); font-size: 20px; outline: none; resize: none;">Idea: Space Desktop

Build an infinite panning UI where apps float in a vast grid-less void. Use dark neon glass aesthetics.</textarea>
                </div>
            </div>
        `;
        WindowManager.create({ id: winId, appId: 'notes', title: 'Notes', width: 600, height: 400, content: html });
    }
});
