Apps.register({
    id: 'textedit',
    name: 'TextEdit',
    iconId: 'textedit',
    category: 'productivity',
    keepInDock: true,
    launch: (args = {}) => {
        const winId = 'textedit-' + Date.now();
        let fileId = args.fileId || null;
        let fileNode = null;
        
        if (fileId) {
            try { fileNode = FS.readFile(fileId); } catch(e) {}
        }
        
        const content = fileNode ? fileNode.content : '';
        const title = fileNode ? fileNode.name : 'Untitled.txt';

        const html = `
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="padding: 8px 16px; border-bottom: 1px solid var(--border-glass); background: rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center;">
                    <input type="text" id="te-title-${winId}" value="${title}" style="background: transparent; border: none; color: var(--text-primary); font-family: var(--font-sans); font-size: 14px; font-weight: 500; outline: none; width: 200px;">
                    <button id="te-save-${winId}" style="background: var(--accent-primary); border: none; color: #fff; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">Save</button>
                </div>
                <textarea id="te-content-${winId}" style="flex: 1; background: transparent; border: none; padding: 16px; color: var(--text-primary); font-family: var(--font-mono); font-size: 14px; line-height: 1.6; resize: none; outline: none;">${content}</textarea>
            </div>
        `;

        WindowManager.create({
            id: winId,
            appId: 'textedit',
            title: 'TextEdit',
            width: 500,
            height: 400,
            content: html
        });

        const saveBtn = document.getElementById(`te-save-${winId}`);
        saveBtn.onclick = () => {
            const newTitle = document.getElementById(`te-title-${winId}`).value || 'Untitled.txt';
            const newContent = document.getElementById(`te-content-${winId}`).value;
            
            // For demo: save to root/desktop if new
            try {
                FS.writeFile('desktop', newTitle, newContent);
                saveBtn.textContent = 'Saved!';
                setTimeout(() => saveBtn.textContent = 'Save', 2000);
            } catch(e) {
                alert('Error saving:' + e.message);
            }
        };
    }
});
