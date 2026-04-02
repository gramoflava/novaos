// LocalStorage-backed Virtual File System
const FS_KEY = 'nova_os_vfs_v1';

class FileSystem {
    constructor() {
        this.tree = this.load() || this.createDefaultStructure();
    }

    load() {
        try {
            const data = localStorage.getItem(FS_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('FS Load Error:', e);
            return null;
        }
    }

    save() {
        try {
            localStorage.setItem(FS_KEY, JSON.stringify(this.tree));
            Bus.emit('fs:updated', this.tree);
        } catch (e) {
            console.error('FS Save Error:', e);
            if (e.name === 'QuotaExceededError') {
                alert('Storage limit reached! Please delete some files.');
            }
        }
    }

    createDefaultStructure() {
        const defaultTree = {
            id: 'root',
            name: '/',
            type: 'dir',
            children: [
                {
                    id: 'desktop',
                    name: 'Desktop',
                    type: 'dir',
                    children: [
                        {
                            id: 'welcome',
                            name: 'Welcome to Nova.txt',
                            type: 'file',
                            content: 'Welcome to Nova OS.\nThis is a totally reimagined web desktop experience.\nFeatures:\n- Infinite panning space canvas\n- Deep dark glassmorphism\n- Seamless transitions\n\nEnjoy exploring space.',
                            createdAt: Date.now()
                        }
                    ]
                },
                { id: 'documents', name: 'Documents', type: 'dir', children: [] },
                { id: 'system', name: 'System', type: 'dir', children: [] }
            ]
        };
        return defaultTree;
    }

    // Helper to find a node by logic path (simplified for demo)
    // Actually, we'll use a unique ID system for simplicity and resilience
    getNodeById(id, current = this.tree) {
        if (current.id === id) return current;
        if (current.type === 'dir' && current.children) {
            for (let child of current.children) {
                const found = this.getNodeById(id, child);
                if (found) return found;
            }
        }
        return null;
    }

    readFile(id) {
        const node = this.getNodeById(id);
        if (node && node.type === 'file') return node;
        throw new Error('File not found or is a directory');
    }

    writeFile(parentId, name, content) {
        const parent = this.getNodeById(parentId);
        if (!parent || parent.type !== 'dir') throw new Error('Parent directory not found');
        
        // Update if exists
        const existing = parent.children.find(c => c.name === name);
        if (existing) {
            if (existing.type !== 'file') throw new Error('Cannot overwrite directory with file');
            existing.content = content;
            existing.updatedAt = Date.now();
        } else {
            parent.children.push({
                id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name,
                type: 'file',
                content,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }
        this.save();
    }

    readDir(id) {
        const node = this.getNodeById(id);
        if (node && node.type === 'dir') return node.children;
        throw new Error('Directory not found');
    }

    deleteNode(id) {
        if (id === 'root') throw new Error('Cannot delete root');
        
        const removeRecursive = (current) => {
            if (current.type === 'dir') {
                const index = current.children.findIndex(c => c.id === id);
                if (index > -1) {
                    current.children.splice(index, 1);
                    return true;
                }
                for (let child of current.children) {
                    if (removeRecursive(child)) return true;
                }
            }
            return false;
        };

        if (removeRecursive(this.tree)) {
            this.save();
            return true;
        }
        return false;
    }

    factoryReset() {
        localStorage.removeItem(FS_KEY);
        this.tree = this.createDefaultStructure();
        this.save();
        location.reload();
    }
}

window.FS = new FileSystem();
