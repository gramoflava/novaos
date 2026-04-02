Apps.register({
    id: 'finder',
    name: 'Files',
    iconId: 'finder',
    category: 'system',
    keepInDock: true,
    launch: () => {
        const winId = 'finder-' + Date.now();
        const initialPathId = 'root'; // using ID
        
        let currentDirId = initialPathId;

        const renderFs = (dirId) => {
            currentDirId = dirId;
            let html = `
            <div style="display:flex; height:100%; font-family:var(--font-sans);">
                <!-- Sidebar -->
                <div style="width: 200px; background: rgba(0,0,0,0.3); border-right: 1px solid var(--border-glass); padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 8px;">Locations</div>
                    <div class="sidebar-item" onclick="document.getElementById('${winId}')._navigate('root')" style="padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; gap: 12px; align-items: center; transition: background 0.2s;">
                        <span style="width: 16px; height: 16px;">${Icons.get('folder')}</span> Primary Drive
                    </div>
                </div>
                <!-- Main Content -->
                <div style="flex: 1; display:flex; flex-direction: column;">
                    <div style="padding: 16px; border-bottom: 1px solid var(--border-glass); display:flex; gap: 16px; background: rgba(255,255,255,0.02);">
                        <button onclick="document.getElementById('${winId}')._navigate('root')" style="background: none; border: none; color: var(--text-primary); font-size: 18px; font-weight: 500; cursor: pointer;">
                            Root /
                        </button>
                    </div>
                    <!-- Grid -->
                    <div style="flex: 1; padding: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 24px; align-content: flex-start; overflow-y: auto;">
            `;

            try {
                const nodes = FS.readDir(dirId);
                nodes.forEach(node => {
                    const isDir = node.type === 'dir';
                    html += `
                        <div class="fs-item" onclick="document.getElementById('${winId}')._handleNode('${node.id}', '${node.type}')" style="display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; padding: 12px; border-radius: 12px; transition: background 0.2s;">
                            <div style="width: 48px; height: 48px; color: ${isDir ? '#6366F1' : '#EC4899'}; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); transition: transform 0.2s var(--curve-spring);">
                                ${Icons.get(isDir ? 'folder' : 'file')}
                            </div>
                            <div style="font-size: 13px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${node.name}</div>
                        </div>
                    `;
                });
            } catch (e) {
                html += `<div style="padding: 24px; color: #EF4444;">Error reading directory: ${e.message}</div>`;
            }

            html += `
                    </div>
                </div>
            </div>
            <style>
                .sidebar-item:hover { background: rgba(255,255,255,0.1); }
                .fs-item:hover { background: rgba(255,255,255,0.05); }
                .fs-item:hover div:first-child { transform: scale(1.1); }
            </style>
            `;
            return html;
        };

        WindowManager.create({
            id: winId,
            appId: 'finder',
            title: 'Files',
            width: 800,
            height: 500,
            content: renderFs(initialPathId)
        });

        // Add internal Navigation methods to the DOM element
        const el = document.getElementById(winId);
        el._navigate = (id) => {
            WindowManager.updateContent(winId, renderFs(id));
        };
        el._handleNode = (id, type) => {
            if (type === 'dir') {
                el._navigate(id);
            } else {
                Apps.launch('textedit', { fileId: id });
            }
        };
    }
});
