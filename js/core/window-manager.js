// Infinite Space Window Manager
class WindowManagerClass {
    constructor() {
        this.windows = new Map();
        this.container = document.getElementById('desktop-content');
        this.container.style.transformOrigin = '0 0'; // Simplifies zoom math
        this.activeWindowId = null;
        this.zIndexCounter = 100;
        this.activeBlackHoles = new Map();
        this.remnantCounter = 0;
        this.activeRemnants = new Set();
        
        // Infinite Canvas properties
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZ = 1; // zoom scale
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // Off-screen indicators
        this.indicatorsContainer = document.createElement('div');
        this.indicatorsContainer.id = 'window-indicators';
        this.indicatorsContainer.style.position = 'absolute';
        this.indicatorsContainer.style.top = '0';
        this.indicatorsContainer.style.left = '0';
        this.indicatorsContainer.style.width = '100%';
        this.indicatorsContainer.style.height = '100%';
        this.indicatorsContainer.style.pointerEvents = 'none';
        this.indicatorsContainer.style.zIndex = '8000';
        document.getElementById('desktop').appendChild(this.indicatorsContainer);
        
        // Black Hole Preview Tooltip
        this.bhPreview = document.createElement('div');
        this.bhPreview.className = 'bh-preview';
        document.body.appendChild(this.bhPreview);
        
        // Space Background parallax
        this.backgroundLayer = document.getElementById('nova-background');
        
        this.desktopContentStyle = getComputedStyle(document.getElementById('desktop'));
        this.initCanvasControls();
        this.startIndicatorsLoop();
    }

    startIndicatorsLoop() {
        const loop = () => {
            this.indicatorsContainer.innerHTML = '';
            
            const vW = window.innerWidth;
            const vH = window.innerHeight;

            this.windows.forEach(w => {
                const wx = parseFloat(w.el.dataset.x);
                const wy = parseFloat(w.el.dataset.y);
                const ww = parseFloat(w.el.style.width);
                const wh = parseFloat(w.el.style.height);
                
                const screenX = this.cameraX + wx * this.cameraZ;
                const screenY = this.cameraY + wy * this.cameraZ;
                const screenW = ww * this.cameraZ;
                const screenH = wh * this.cameraZ;

                // Check if completely off-screen
                if (screenX + screenW < 0 || screenX > vW || screenY + screenH < 0 || screenY > vH) {
                    const centerX = screenX + screenW/2;
                    const centerY = screenY + screenH/2;
                    const scX = vW / 2;
                    const scY = vH / 2;
                    const dx = centerX - scX;
                    const dy = centerY - scY;
                    
                    let edgeX = scX;
                    let edgeY = scY;
                    const slope = dy / dx;
                    const maxDX = vW/2 - 20;
                    const maxDY = vH/2 - 20;
                    
                    if (Math.abs(slope) < maxDY / maxDX) {
                        edgeX = dx > 0 ? vW - 20 : 20;
                        edgeY = scY + (edgeX - scX) * slope;
                    } else {
                        edgeY = dy > 0 ? vH - 20 : 20;
                        edgeX = scX + (edgeY - scY) / slope;
                    }

                    const ind = document.createElement('div');
                    ind.style.position = 'absolute';
                    ind.style.left = edgeX + 'px';
                    ind.style.top = edgeY + 'px';
                    ind.style.width = '6px';
                    ind.style.height = '6px';
                    ind.style.background = 'var(--text-primary)';
                    ind.style.boxShadow = '0 0 12px var(--text-primary)';
                    ind.style.borderRadius = '50%';
                    ind.style.transform = 'translate(-50%, -50%)';
                    ind.style.transition = 'opacity 0.2s';
                    
                    // Slightly point the diamond shape
                    if(w.appId === 'game2048' || w.appId === 'minesweeper' || w.appId === 'colorlines') {
                        ind.style.background = 'var(--accent-primary)';
                        ind.style.boxShadow = '0 0 12px var(--accent-primary)';
                    }
                    
                    this.indicatorsContainer.appendChild(ind);
                }
            });

            // Animate remnants
            this.activeRemnants.forEach(rem => {
                rem.currentDepth += (rem.targetDepth - rem.currentDepth) * 0.02;
                rem.currentOpacity += (rem.targetOpacity - rem.currentOpacity) * 0.02;
                
                rem.el.style.opacity = Math.max(0, rem.currentOpacity);
                
                const M = 0.95 * rem.currentDepth;
                const dx = (this.cameraX - rem.initCameraX);
                const dy = (this.cameraY - rem.initCameraY);
                
                const offsetX = -M * dx / this.cameraZ;
                const offsetY = -M * dy / this.cameraZ;

                rem.el.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${1 - rem.currentDepth * 0.3})`;
                
                if (rem.targetOpacity <= 0 && rem.currentOpacity <= 0.01) {
                    if (rem.el.parentNode) rem.el.remove();
                    this.activeRemnants.delete(rem);
                }
            });

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
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
            // Ignore and let native scroll take over if hovering any scrollable element
            if (!e.ctrlKey) {
                const hoveredWin = e.target.closest('.nova-window');
                if (!hoveredWin || hoveredWin.classList.contains('is-active')) {
                    let domNode = e.target;
                    let isScrollable = false;
                    while (domNode && domNode !== document.body && domNode !== document) {
                        if (domNode.scrollHeight > domNode.clientHeight || domNode.scrollWidth > domNode.clientWidth) {
                            const style = window.getComputedStyle(domNode);
                            if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                                style.overflowX === 'auto' || style.overflowX === 'scroll' ||
                                style.overflow === 'auto' || style.overflow === 'scroll') {
                                isScrollable = true;
                                break;
                            }
                        }
                        if (hoveredWin && domNode === hoveredWin) break;
                        domNode = domNode.parentNode;
                    }
                    if (isScrollable) return;
                }
            }

            e.preventDefault();

            if (e.ctrlKey) {
                // Pinch to zoom towards cursor
                const oldZ = this.cameraZ;
                this.cameraZ -= e.deltaY * 0.01;
                this.cameraZ = Math.max(0.2, Math.min(this.cameraZ, 3));

                // Maintain cursor world position
                const worldX = (e.clientX - this.cameraX) / oldZ;
                const worldY = (e.clientY - this.cameraY) / oldZ;

                this.cameraX = e.clientX - worldX * this.cameraZ;
                this.cameraY = e.clientY - worldY * this.cameraZ;
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
        this.activeRemnants.forEach(rem => {
            const M = 0.95 * rem.currentDepth;
            const dx = (this.cameraX - rem.initCameraX);
            const dy = (this.cameraY - rem.initCameraY);
            
            const offsetX = -M * dx / this.cameraZ;
            const offsetY = -M * dy / this.cameraZ;

            rem.el.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${1 - rem.currentDepth * 0.3})`;
        });
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
            
            // Randomly scatter avoiding overlap
            let attempts = 0;
            let found = false;
            while(!found && attempts < 50) {
                left = localViewportCenterX - (width / 2) + (Math.random() - 0.5) * window.innerWidth * 0.8 / this.cameraZ;
                top = localViewportCenterY - (height / 2) + (Math.random() - 0.5) * window.innerHeight * 0.8 / this.cameraZ;
                
                let overlap = false;
                this.windows.forEach(w => {
                    if (w.el.dataset.minimized === 'true') return;
                    const wx = parseFloat(w.el.dataset.x);
                    const wy = parseFloat(w.el.dataset.y);
                    const ww = parseFloat(w.el.dataset.w);
                    const wh = parseFloat(w.el.dataset.h);
                    
                    // Check intersection with padding
                    if (left < wx + ww + 20 && left + width > wx - 20 && top < wy + wh + 20 && top + height > wy - 20) {
                        overlap = true;
                    }
                });
                
                // Active blackholes are obstacles too
                this.activeBlackHoles.forEach(bh => {
                    const bx = parseFloat(bh.style.left) - 60; // 120px width/height container
                    const by = parseFloat(bh.style.top) - 60;
                    if (left < bx + 120 + 20 && left + width > bx - 20 && top < by + 120 + 20 && top + height > by - 20) {
                        overlap = true;
                    }
                });
                
                if (!overlap) found = true;
                attempts++;
            }
        }

        // Animate camera to center this new window
        const targetCameraX = (window.innerWidth / 2) - (left + width / 2) * this.cameraZ;
        const targetCameraY = (window.innerHeight / 2) - (top + height / 2) * this.cameraZ;
        this.animateCameraTo(targetCameraX, targetCameraY);

        this.pushWindowsOut('none', {x: left, y: top, w: width, h: height});

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
        minBtn.onclick = (e) => { e.stopPropagation(); this.minimize(id); };
        
        const maxBtn = document.createElement('button');
        maxBtn.className = 'window-btn maximize';
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        maxBtn.onclick = (e) => { e.stopPropagation(); this.maximize(id); };

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
        this.setupResize(winObj);
        
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
        
        // Physics and visuals chain
        win.el.style.animation = 'none';
        win.el.style.transition = 'all 0.5s cubic-bezier(1, 0, 0.5, 1)';
        win.el.style.transform = 'scale(0)';
        win.el.style.opacity = '0';
        win.el.style.pointerEvents = 'none';
        
        const box = { x: parseFloat(win.el.dataset.x), y: parseFloat(win.el.dataset.y), w: parseFloat(win.el.dataset.w), h: parseFloat(win.el.dataset.h) };
        this.pullWindowsIn(id, box);

        setTimeout(() => {
            if (window.AudioMng) AudioMng.play('explode'); // subtle pop
            
            const explosion = document.createElement('div');
            explosion.className = 'nova-explosion';
            explosion.style.left = (box.x + box.w / 2) + 'px';
            explosion.style.top = (box.y + box.h / 2) + 'px';
            this.container.appendChild(explosion);
            
            this.pushWindowsOut(id, box);
            
            // Spawn persistent wrapper immediately as explosion flashes
            const remContainer = document.createElement('div');
            remContainer.className = 'nova-remnant-wrap';
            remContainer.style.position = 'absolute';
            remContainer.style.left = (box.x + box.w / 2) + 'px';
            remContainer.style.top = (box.y + box.h / 2) + 'px';
            
            const remnant = document.createElement('div');
            remnant.className = 'nova-remnant';
            
            // Random nebular gradient
            const hue = Math.floor(Math.random() * 360);
            remnant.style.background = `radial-gradient(circle, hsla(${hue}, 80%, 65%, 0.5) 0%, hsla(${hue}, 100%, 30%, 0.2) 40%, transparent 70%)`;
            
            remContainer.appendChild(remnant);
            this.container.appendChild(remContainer);
            
            this.activeRemnants.add({
                el: remContainer,
                targetOpacity: 1.1, // 1.1 so it takes 1 initial closing to hit 1.0
                currentOpacity: 1.1,
                targetDepth: 0,
                currentDepth: 0,
                initCameraX: this.cameraX,
                initCameraY: this.cameraY
            });
            
            // Incrementally fade all active remnants by 10%
            this.activeRemnants.forEach(rem => {
                let op = rem.targetOpacity - 0.1;
                rem.targetOpacity = op;
                rem.targetDepth = 1 - Math.max(0, Math.min(1, op));
            });
            
            setTimeout(() => { explosion.remove(); }, 500);
        }, 400);

        setTimeout(() => {
            if (win.el.parentNode) {
                win.el.parentNode.removeChild(win.el);
            }
            this.windows.delete(id);
            
            if (win.appId) {
                let hasMore = false;
                this.windows.forEach(w => {
                    if (w.appId === win.appId) hasMore = true;
                });
                if (!hasMore && window.Apps) {
                    Apps.markClosed(win.appId);
                }
            }
        }, 500);
    }

    updateContent(id, html) {
        const win = this.windows.get(id);
        if (win) {
            win.content.innerHTML = html;
        }
    }

    pushWindowsOut(targetId, box) {
        this.windows.forEach((win, id) => {
            if (id === targetId || win.el.dataset.minimized === 'true') return;
            const wx = parseFloat(win.el.dataset.x);
            const wy = parseFloat(win.el.dataset.y);
            const ww = parseFloat(win.el.dataset.w);
            const wh = parseFloat(win.el.dataset.h);

            // Bounding box collision check
            if (wx < box.x + box.w && wx + ww > box.x && wy < box.y + box.h && wy + wh > box.y) {
                const distL = Math.abs(wx + ww - box.x);
                const distR = Math.abs(wx - (box.x + box.w));
                const distT = Math.abs(wy + wh - box.y);
                const distB = Math.abs(wy - (box.y + box.h));

                const min = Math.min(distL, distR, distT, distB);
                
                let newX = wx, newY = wy;
                if (min === distL) newX = box.x - ww - 20;
                else if (min === distR) newX = box.x + box.w + 20;
                else if (min === distT) newY = box.y - wh - 20;
                else if (min === distB) newY = box.y + box.h + 20;

                win.el.style.transition = 'all 0.5s var(--curve-spring)';
                win.el.dataset.x = newX;
                win.el.dataset.y = newY;
                win.el.style.left = newX + 'px';
                win.el.style.top = newY + 'px';
                setTimeout(() => { win.el.style.transition = ''; }, 500);
            }
        });
    }

    pullWindowsIn(targetId, box) {
        const centerX = box.x + box.w / 2;
        const centerY = box.y + box.h / 2;
        
        this.windows.forEach((win, id) => {
            if (id === targetId || win.el.dataset.minimized === 'true') return;
            const wx = parseFloat(win.el.dataset.x);
            const wy = parseFloat(win.el.dataset.y);
            
            const dx = centerX - (wx + parseFloat(win.el.dataset.w)/2);
            const dy = centerY - (wy + parseFloat(win.el.dataset.h)/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 0 && dist < 1200) {
                const pullFactor = Math.max(0.1, 1 - dist/1200) * 0.4;
                const newX = wx + dx * pullFactor;
                const newY = wy + dy * pullFactor;

                win.el.style.transition = 'all 0.6s var(--curve-spring)';
                win.el.dataset.x = newX;
                win.el.dataset.y = newY;
                win.el.style.left = newX + 'px';
                win.el.style.top = newY + 'px';
                setTimeout(() => { win.el.style.transition = ''; }, 600);
            }
        });
    }

    minimize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        // Capture current state to avoid snapping back to hidden styles when animation is removed
        const computed = window.getComputedStyle(win.el);
        const transform = computed.transform;
        const opacity = computed.opacity;
        
        win.el.style.animation = 'none';
        win.el.style.transform = transform;
        win.el.style.opacity = opacity;
        
        void win.el.offsetHeight; // Force reflow
        
        win.el.style.transition = 'all 0.5s cubic-bezier(1, 0, 0.5, 1)';
        win.el.style.transform = 'scale(0)';
        win.el.style.opacity = '0';
        win.el.style.pointerEvents = 'none';
        win.el.dataset.minimized = 'true';
        
        const box = {
            x: parseFloat(win.el.dataset.x),
            y: parseFloat(win.el.dataset.y),
            w: parseFloat(win.el.dataset.w),
            h: parseFloat(win.el.dataset.h)
        };
        this.pullWindowsIn(id, box);
        
        const bh = document.createElement('div');
        bh.className = 'nova-blackhole-container';
        
        const hue = Math.floor(Math.random() * 360);
        const gradId = 'discGrad-' + id;
        
        bh.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="width:100%; height:100%; filter: var(--bh-theme-filter) hue-rotate(${hue}deg);">
          <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#b32400;stop-opacity:1" /> 
              <stop offset="50%" style="stop-color:#ff6600;stop-opacity:1" /> 
              <stop offset="100%" style="stop-color:#ffcc66;stop-opacity:1" /> 
            </linearGradient>
          </defs>

          <g class="rotating-disc" style="animation-delay: -${Math.random()*180}s">
            <circle class="inflow" cx="100" cy="100" r="90" stroke-width="7" opacity="0.6" style="animation-duration: 25s; animation-delay: -${Math.random()*25}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="80" stroke-width="6.5" opacity="0.7" style="animation-duration: 22s; animation-delay: -${Math.random()*22}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="70" stroke-width="6" opacity="0.8" style="animation-duration: 19s; animation-delay: -${Math.random()*19}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="60" stroke-width="5.5" opacity="0.9" style="animation-duration: 16s; animation-delay: -${Math.random()*16}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="50" stroke-width="5" style="animation-duration: 13s; animation-delay: -${Math.random()*13}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="40" stroke-width="4.5" style="animation-duration: 10s; animation-delay: -${Math.random()*10}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="30" stroke-width="4" style="animation-duration: 7s; animation-delay: -${Math.random()*7}s; stroke: url(#${gradId});"/>
            <circle class="inflow" cx="100" cy="100" r="20" stroke-width="3.5" style="animation-duration: 5s; animation-delay: -${Math.random()*5}s; stroke: url(#${gradId});"/>
          </g>

          <circle class="central-mass" cx="100" cy="100" r="16" />
          <circle cx="100" cy="100" r="17" fill="none" stroke="#fff1cc" stroke-width="0.75" opacity="0.3"/>
        </svg>
        `;
        bh.style.left = (box.x + box.w / 2) + 'px';
        bh.style.top = (box.y + box.h / 2) + 'px';
        bh.style.pointerEvents = 'auto';
        bh.style.cursor = 'pointer';
        bh.onclick = () => this.restore(id);
        
        // Hover Previews
        bh.onmouseenter = () => {
            const iconHtml = window.Icons ? Icons.get(win.appId) : '';
            this.bhPreview.innerHTML = iconHtml;
            this.bhPreview.classList.add('visible');
        };
        bh.onmousemove = (e) => {
            this.bhPreview.style.left = (e.clientX + 15) + 'px';
            this.bhPreview.style.top = (e.clientY + 15) + 'px';
        };
        bh.onmouseleave = () => {
            this.bhPreview.classList.remove('visible');
        };

        this.container.appendChild(bh);
        this.activeBlackHoles.set(id, bh);
        
        if (window.ShelfInstance) window.ShelfInstance.render();
    }

    restore(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        // Dismiss hover preview immediately
        if (this.bhPreview) this.bhPreview.classList.remove('visible');
        
        win.el.style.animation = 'none';
        win.el.style.transition = 'all 0.5s var(--curve-spring)';
        win.el.style.transform = 'scale(1)';
        win.el.style.opacity = '1';
        win.el.style.pointerEvents = 'auto';
        win.el.dataset.minimized = 'false';
        
        const box = {
            x: parseFloat(win.el.dataset.x),
            y: parseFloat(win.el.dataset.y),
            w: parseFloat(win.el.dataset.w),
            h: parseFloat(win.el.dataset.h)
        };
        
        const bh = this.activeBlackHoles.get(id);
        if (bh) {
            bh.style.opacity = '0';
            setTimeout(() => { if (bh.parentNode) bh.remove(); }, 500);
            this.activeBlackHoles.delete(id);
        }
        
        this.pushWindowsOut(id, box);
        this.focus(id);
    }

    maximize(id) {
        const win = this.windows.get(id);
        if (!win) return;

        if (win.el.dataset.maximized === 'true') {
            // Restore
            win.el.dataset.maximized = 'false';
            win.el.style.transition = 'all 0.3s var(--curve-spring)';
            
            const prevW = parseFloat(win.el.dataset.prevW);
            const prevH = parseFloat(win.el.dataset.prevH);
            const prevX = parseFloat(win.el.dataset.prevX);
            const prevY = parseFloat(win.el.dataset.prevY);

            win.el.style.width = prevW + 'px';
            win.el.style.height = prevH + 'px';
            win.el.style.left = prevX + 'px';
            win.el.style.top = prevY + 'px';
            win.el.dataset.w = prevW;
            win.el.dataset.h = prevH;
            win.el.dataset.x = prevX;
            win.el.dataset.y = prevY;

            this.pushWindowsOut(id, {x: prevX, y: prevY, w: prevW, h: prevH});

            setTimeout(() => {
                win.el.style.transition = '';
            }, 300);
        } else {
            // Maximize over logical viewport
            win.el.dataset.maximized = 'true';
            win.el.dataset.prevW = win.el.dataset.w;
            win.el.dataset.prevH = win.el.dataset.h;
            win.el.dataset.prevX = win.el.dataset.x;
            win.el.dataset.prevY = win.el.dataset.y;

            win.el.style.transition = 'all 0.4s var(--curve-spring)';
            
            const vpW = window.innerWidth / this.cameraZ;
            const vpH = window.innerHeight / this.cameraZ;
            const vpX = -this.cameraX / this.cameraZ;
            const vpY = -this.cameraY / this.cameraZ;

            win.el.style.width = vpW + 'px';
            win.el.style.height = vpH + 'px';
            win.el.style.left = vpX + 'px';
            win.el.style.top = vpY + 'px';
            win.el.dataset.w = vpW;
            win.el.dataset.h = vpH;
            win.el.dataset.x = vpX;
            win.el.dataset.y = vpY;

            this.pushWindowsOut(id, {x: vpX, y: vpY, w: vpW, h: vpH});

            setTimeout(() => {
                win.el.style.transition = '';
            }, 400);
        }
    }

    setupResize(win) {
        let isResizing = false;
        let startClientX, startClientY;
        let startWinW, startWinH;
        let resizeDir = '';

        const eResize = win.el.querySelector('.resize-e');
        const sResize = win.el.querySelector('.resize-s');
        const seResize = win.el.querySelector('.resize-se');
        if (!eResize) return; // safety

        const startResize = (e, dir) => {
            isResizing = true;
            resizeDir = dir;
            this.focus(win.id);
            startClientX = e.clientX;
            startClientY = e.clientY;
            startWinW = parseFloat(win.el.dataset.w);
            startWinH = parseFloat(win.el.dataset.h);
            document.body.style.cursor = dir + '-resize';
            e.stopPropagation();
            e.preventDefault();
        };

        eResize.addEventListener('mousedown', (e) => startResize(e, 'e'));
        sResize.addEventListener('mousedown', (e) => startResize(e, 's'));
        seResize.addEventListener('mousedown', (e) => startResize(e, 'se'));

        const onMouseMove = (e) => {
            if (!isResizing) return;
            const deltaX = (e.clientX - startClientX) / this.cameraZ;
            const deltaY = (e.clientY - startClientY) / this.cameraZ;
            
            let newW = startWinW;
            let newH = startWinH;
            
            if (resizeDir === 'e' || resizeDir === 'se') newW = Math.max(200, startWinW + deltaX);
            if (resizeDir === 's' || resizeDir === 'se') newH = Math.max(100, startWinH + deltaY);

            win.el.style.width = newW + 'px';
            win.el.style.height = newH + 'px';
            win.el.dataset.w = newW;
            win.el.dataset.h = newH;
        };

        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                // Trigger bounds recalculation logic on release
                this.pushWindowsOut(win.id, {
                    x: parseFloat(win.el.dataset.x),
                    y: parseFloat(win.el.dataset.y),
                    w: parseFloat(win.el.dataset.w),
                    h: parseFloat(win.el.dataset.h)
                });
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        const oldCleanup = win.cleanup;
        win.cleanup = () => {
            if (oldCleanup) oldCleanup();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }
}

window.WindowManager = new WindowManagerClass();
