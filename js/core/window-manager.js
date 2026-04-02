// Infinite Space Window Manager
class WindowManagerClass {
    constructor() {
        this.windows = new Map();
        this.container = document.getElementById('desktop-content');
        this.container.style.transformOrigin = '0 0'; // Simplifies zoom math
        this.activeWindowId = null;
        this.zIndexCounter = 100;
        
        // Infinite Canvas properties
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZ = 1; // zoom scale
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // Space Background parallax
        this.backgroundLayer = document.getElementById('nova-background');
        
        this.initCanvasControls();
    }

    initCanvasControls() {
        // Handle infinite canvas panning
        // We bind to document body but only initiate if the target isn't an interactive window element
        document.body.addEventListener('mousedown', (e) => {
            // Ignore if clicking on UI elements like island, shelf, or interactive window parts
            if (e.target.closest('#nova-island-container') || 
                e.target.closest('#nova-shelf-container') ||
                e.target.closest('.nova-window')) {
                return;
            }

            this.isPanning = true;
            this.panStartX = e.clientX - this.cameraX;
            this.panStartY = e.clientY - this.cameraY;
            document.body.style.cursor = 'grabbing';
        });

        document.body.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            
            this.cameraX = e.clientX - this.panStartX;
            this.cameraY = e.clientY - this.panStartY;
            
            this.applyCameraTransform();
        });

        document.body.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                document.body.style.cursor = 'default';
            }
        });

        // Trackpad panning & pinch-to-zoom
        document.body.addEventListener('wheel', (e) => {
            // Ignore if scrolling inside a window content area that has scrolling
            const content = e.target.closest('.window-content');
            if (content && (content.scrollHeight > content.clientHeight || content.scrollWidth > content.clientWidth) && !e.ctrlKey) {
                return;
            }
            // Ignore if we are scrolling in spotlight results
            const spotlight = e.target.closest('.spotlight-results');
            if (spotlight && spotlight.scrollHeight > spotlight.clientHeight) return;

            e.preventDefault();

            if (e.ctrlKey) {
                // Pinch to zoom
                this.cameraZ -= e.deltaY * 0.01;
                this.cameraZ = Math.max(0.2, Math.min(this.cameraZ, 3));
            } else {
                // Trackpad pan
                this.cameraX -= e.deltaX;
                this.cameraY -= e.deltaY;
            }

            this.applyCameraTransform();
        }, { passive: false });
    }

    applyCameraTransform() {
        this.container.style.transform = `translate3d(${this.cameraX}px, ${this.cameraY}px, 0) scale(${this.cameraZ})`;
        if (this.backgroundLayer) {
            this.backgroundLayer.style.transform = `translate3d(${this.cameraX * 0.05}px, ${this.cameraY * 0.05}px, 0)`;
        }
    }

    animateCameraTo(targetX, targetY) {
        // Simple spring or ease animation to center camera
        const startX = this.cameraX;
        const startY = this.cameraY;
        const startTime = performance.now();
        const duration = 500; // ms

        const animate = (time) => {
            let p = (time - startTime) / duration;
            if (p > 1) p = 1;
            // ease-out cubic
            const ease = 1 - Math.pow(1 - p, 3);
            
            this.cameraX = startX + (targetX - startX) * ease;
            this.cameraY = startY + (targetY - startY) * ease;
            
            this.applyCameraTransform();

            if (p < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    create(options) {
        const id = options.id || 'win_' + Date.now();
        if (this.windows.has(id)) {
            this.focus(id);
            return id;
        }

        const width = options.width || 600;
        const height = options.height || 400;
        
        let left = options.x;
        let top = options.y;

        if (left === undefined || top === undefined) {
            const localViewportCenterX = (window.innerWidth / 2 - this.cameraX) / this.cameraZ;
            const localViewportCenterY = (window.innerHeight / 2 - this.cameraY) / this.cameraZ;
            
            if (this.windows.size === 0) {
                left = localViewportCenterX - (width / 2);
                top = localViewportCenterY - (height / 2);
            } else {
                let maxX = -Infinity;
                let topAtMaxX = 0;
                this.windows.forEach(w => {
                    const wx = parseFloat(w.el.dataset.x);
                    const ww = parseFloat(w.el.dataset.w);
                    if (wx + ww > maxX) {
                        maxX = wx + ww;
                        topAtMaxX = parseFloat(w.el.dataset.y);
                    }
                });
                left = maxX + 40; // place to the right with 40px gap
                top = topAtMaxX;
            }
        }

        // Animate camera to center this new window
        const targetCameraX = (window.innerWidth / 2) - (left + width / 2) * this.cameraZ;
        const targetCameraY = (window.innerHeight / 2) - (top + height / 2) * this.cameraZ;
        this.animateCameraTo(targetCameraX, targetCameraY);

        const winEl = document.createElement('div');
        winEl.className = 'nova-window';
        winEl.id = id;
        winEl.style.width = width + 'px';
        winEl.style.height = height + 'px';
        
        // Use left and top so it survives CSS scale animation
        winEl.style.left = left + 'px';
        winEl.style.top = top + 'px';
        
        // Custom attribute to track actual logical coords
        winEl.dataset.x = left;
        winEl.dataset.y = top;
        winEl.dataset.w = width;
        winEl.dataset.h = height;
        winEl.dataset.appId = options.appId || '';

        const titlebar = document.createElement('div');
        titlebar.className = 'window-titlebar';
        
        // Window Controls
        const controls = document.createElement('div');
        controls.className = 'window-controls';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'window-btn close';
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(id); };
        
        const minBtn = document.createElement('button');
        minBtn.className = 'window-btn minimize';
        minBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
        
        const maxBtn = document.createElement('button');
        maxBtn.className = 'window-btn maximize';
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

        controls.appendChild(closeBtn);
        controls.appendChild(minBtn);
        controls.appendChild(maxBtn);

        const title = document.createElement('div');
        title.className = 'window-title';
        title.textContent = options.title || '';

        const placeholder = document.createElement('div');
        placeholder.className = 'window-placeholder';

        titlebar.appendChild(controls);
        titlebar.appendChild(title);
        titlebar.appendChild(placeholder);

        const content = document.createElement('div');
        content.className = 'window-content';
        content.innerHTML = options.content || '';

        // Add resize handles
        const resizeE = document.createElement('div'); resizeE.className = 'resize-handle resize-e';
        const resizeS = document.createElement('div'); resizeS.className = 'resize-handle resize-s';
        const resizeSE = document.createElement('div'); resizeSE.className = 'resize-handle resize-se';

        winEl.appendChild(titlebar);
        winEl.appendChild(content);
        winEl.appendChild(resizeE);
        winEl.appendChild(resizeS);
        winEl.appendChild(resizeSE);

        this.container.appendChild(winEl);

        const winObj = {
            id,
            el: winEl,
            appId: options.appId,
            titlebar,
            content
        };

        this.windows.set(id, winObj);
        this.setupInteractions(winObj);
        
        // Wait for next frame so animation plays
        requestAnimationFrame(() => {
            this.focus(id);
        });

        // Setup custom styles if any
        if (options.css) {
            content.style.cssText += options.css;
        }

        return id;
    }

    setupInteractions(win) {
        win.el.addEventListener('mousedown', () => this.focus(win.id));

        // Dragging
        let isDragging = false;
        let startClientX, startClientY;
        let startWinX, startWinY;

        win.titlebar.addEventListener('mousedown', (e) => {
            // Ignore if clicking window controls
            if (e.target.closest('.window-btn')) return;
            
            isDragging = true;
            this.focus(win.id);
            
            startClientX = e.clientX;
            startClientY = e.clientY;
            startWinX = parseFloat(win.el.dataset.x);
            startWinY = parseFloat(win.el.dataset.y);
            
            document.body.style.cursor = 'grabbing';
        });

        // Use global mouse handlers for dragging to prevent losing drag when mouse moves fast
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            // Adjust delta by camera zoom to move perfectly with the mouse
            const deltaX = (e.clientX - startClientX) / this.cameraZ;
            const deltaY = (e.clientY - startClientY) / this.cameraZ;
            
            const newX = startWinX + deltaX;
            const newY = startWinY + deltaY;
            
            win.el.dataset.x = newX;
            win.el.dataset.y = newY;
            win.el.style.left = newX + 'px';
            win.el.style.top = newY + 'px';
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Store listeners so we can clean up if window closes
        win.cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    focus(id) {
        if (!this.windows.has(id)) return;
        
        // Blur all
        this.windows.forEach(w => w.el.classList.remove('is-active'));
        
        this.zIndexCounter++;
        const win = this.windows.get(id);
        win.el.style.zIndex = this.zIndexCounter;
        win.el.classList.add('is-active');
        
        this.activeWindowId = id;
    }

    close(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        if (win.cleanup) win.cleanup();
        
        win.el.classList.add('is-closing');
        setTimeout(() => {
            if (win.el.parentNode) {
                win.el.parentNode.removeChild(win.el);
            }
            this.windows.delete(id);
            
            // If it belongs to an app, check if we should mark app as closed
            if (win.appId) {
                let hasMore = false;
                this.windows.forEach(w => {
                    if (w.appId === win.appId) hasMore = true;
                });
                if (!hasMore && window.Apps) {
                    Apps.markClosed(win.appId);
                }
            }
        }, 300); // Wait for close animation
    }

    updateContent(id, html) {
        const win = this.windows.get(id);
        if (win) {
            win.content.innerHTML = html;
        }
    }
}

window.WindowManager = new WindowManagerClass();
