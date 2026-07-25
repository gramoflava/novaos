Apps.register({
    id: 'settings',
    name: 'Settings',
    iconId: 'settings',
    category: 'system',
    keepInDock: true,
    launch: () => {
        const winId = 'settings-' + Date.now();

        const html = `
            <div class="settings-app">
                <div>
                    <h2>Nova Settings</h2>
                    <p>Configure your infinite space desktop.</p>
                </div>

                <div class="settings-card">
                    <div class="settings-row">
                        <div>
                            <div class="settings-label">Factory Reset</div>
                            <div class="hint">Clear all storage and restore defaults.</div>
                        </div>
                        <button class="btn btn--danger" onclick="if(confirm('Are you sure you want to completely clear the filesystem?')) FS.factoryReset();">Reset</button>
                    </div>
                </div>

                <div class="settings-version">
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
