Apps.register({
    id: 'settings',
    name: 'Settings',
    iconId: 'settings',
    category: 'system',
    keepInDock: true,
    launch: () => {
        const winId = 'settings-' + Date.now();
        
        const html = `
            <div style="padding: 32px; display: flex; flex-direction: column; gap: 32px; height: 100%; font-family: var(--font-sans);">
                <div>
                    <h2 style="margin-bottom: 8px; font-weight: 300;">Nova Settings</h2>
                    <p style="color: var(--text-secondary); font-size: 14px;">Configure your infinite space desktop.</p>
                </div>
                
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 12px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <div style="font-weight: 500;">Factory Reset</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">Clear all storage and restore defaults.</div>
                        </div>
                        <button onclick="if(confirm('Are you sure you want to completely clear the filesystem?')) FS.factoryReset();" style="background: #EF4444; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 500;">Reset</button>
                    </div>
                </div>

                <div style="margin-top: auto; text-align: center; font-size: 12px; color: var(--text-disabled);">
                    Nova OS v1.0<br>
                    Running on JS FileSystem
                </div>
            </div>
        `;

        WindowManager.create({
            id: winId,
            appId: 'settings',
            title: 'Settings',
            width: 480,
            height: 380,
            content: html
        });
    }
});
