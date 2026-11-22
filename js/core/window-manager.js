// Infinite Space Window Manager
class WindowManagerClass {
    constructor() {
        this.windows = new Map();
        this.container = document.getElementById('desktop-content');
        this.container.style.transformOrigin = '0 0'; // Simplifies zoom math
        this.activeWindowId = null;
        this.zIndexCounter = 100;
        this.activeBlackHoles = new Map();   // window id -> hole element (shared when merged)
        this.holeCounter = 0;
        this.holes = new Map();              // hole element -> { el, x, y, hue, members: [window ids] }
        this.remnantCounter = 0;
        this.activeRemnants = new Set();
        this.mobileQuery = window.matchMedia('(max-width: 640px)');

        // Infinite Canvas properties
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZ = 1; // zoom scale
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        // Camera motion: a fling after a pan, or a spring toward a target.
        this.camVX = 0;
        this.camVY = 0;
        this.camVZ = 0;
        this.camTarget = null;
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.overlayRaf = 0;
        this.overlayLast = 0;
        this.shownIndicatorsKey = '';
        this.lastEmittedZ = 1;

        // Off-screen indicators
        this.indicatorsContainer = document.createElement('div');
        this.indicatorsContainer.id = 'window-indicators';
        this.indicatorsContainer.className = 'window-indicators';
        document.getElementById('desktop').appendChild(this.indicatorsContainer);

        // Black Hole Preview Tooltip
        this.bhPreview = document.createElement('div');
        this.bhPreview.className = 'bh-preview';
        document.body.appendChild(this.bhPreview);

        // Space Background parallax
        this.backgroundLayer = document.getElementById('nova-background');

        this.desktopContentStyle = getComputedStyle(document.getElementById('desktop'));
        this.physics = window.NovaPhysics;
        this.physics.camera = { step: (dt) => this.stepCamera(dt) };
        this.physics.holes = () => this.holeList();
        this.physics.onCapture = (id, hole) => this.swallow(id, hole);
        this.physics.onImpact = (speed, x, y) => this.bump(speed, x, y);
        this.physics.onHolePull = (active) => this.syncHolePull(active);
        this.physics.onDraw = () => this.scheduleOverlayTick();
        this.lastBump = 0;

        this.initCanvasControls();
        window.addEventListener('resize', () => this.scheduleOverlayTick());
        this.scheduleOverlayTick();
        this.mobileQuery.addEventListener('change', () => {
            this.stopCamera();
            if (this.isMobile()) {
                this.cameraX = 0;
                this.cameraY = 0;
                this.cameraZ = 1;
            } else {
                this.windows.forEach(w => this.physics.resync(w.id));
                this.physics.wakeAll();
            }
            this.applyCameraTransform();
            if (this.activeWindowId) this.focus(this.activeWindowId);
        });
    }

    isMobile() {
        return this.mobileQuery.matches;
    }

    // On-demand overlay loop: runs only while windows, camera, or remnants are
    // actively changing, so a settled desktop runs zero animation frames.
    scheduleOverlayTick() {
        if (this.overlayRaf) return;
        this.overlayLast = performance.now();
        this.overlayRaf = requestAnimationFrame((now) => this.tickOverlays(now));
    }

    tickOverlays(now) {
        this.overlayRaf = 0;
        const dt = Math.min(0.05, Math.max(0.001, (now - this.overlayLast) / 1000));
        this.overlayLast = now;

        if (this.isMobile()) {
            if (this.shownIndicatorsKey) {
                this.indicatorsContainer.replaceChildren();
                this.shownIndicatorsKey = '';
            }
            return;
        }

        const markers = [];
        const vW = window.innerWidth;
        const vH = window.innerHeight;
        const projectEdge = (centerX, centerY) => {
            const scX = vW / 2;
            const scY = vH / 2;
            const dx = centerX - scX;
            const dy = centerY - scY;
            const slope = dy / (dx || 1e-6);
            const E = 16;
            const maxDX = vW / 2 - E;
            const maxDY = vH / 2 - E;
            if (Math.abs(slope) < maxDY / maxDX) {
                const edgeX = dx > 0 ? vW - E : E;
                return { x: Math.round(edgeX), y: Math.round(scY + (edgeX - scX) * slope) };
            }
            const edgeY = dy > 0 ? vH - E : E;
            return { x: Math.round(scX + (edgeY - scY) / slope), y: Math.round(edgeY) };
        };

        this.windows.forEach(w => {
            if (w.el.dataset.minimized === 'true') return;
            const wx = parseFloat(w.el.dataset.x);
            const wy = parseFloat(w.el.dataset.y);
            const ww = parseFloat(w.el.dataset.w);
            const wh = parseFloat(w.el.dataset.h);

            const screenX = this.cameraX + wx * this.cameraZ;
            const screenY = this.cameraY + wy * this.cameraZ;
            const screenW = ww * this.cameraZ;
            const screenH = wh * this.cameraZ;

            // Check if completely off-screen
            if (screenX + screenW < 0 || screenX > vW || screenY + screenH < 0 || screenY > vH) {
                const pos = projectEdge(screenX + screenW / 2, screenY + screenH / 2);
                const app = w.appId && window.Apps ? Apps.get(w.appId) : null;
                markers.push({
                    kind: 'win',
                    id: w.id,
                    appId: w.appId || '',
                    label: w.title || (app ? app.name : 'Window'),
                    x: pos.x,
                    y: pos.y
                });
            }
        });

        this.holes.forEach(h => {
            if (!h.members.length) return;
            const screenX = this.cameraX + h.x * this.cameraZ;
            const screenY = this.cameraY + h.y * this.cameraZ;
            const pad = 40 * this.cameraZ;
            if (screenX + pad < 0 || screenX - pad > vW || screenY + pad < 0 || screenY - pad > vH) {
                const pos = projectEdge(screenX, screenY);
                const topId = h.members[h.members.length - 1];
                const topWin = this.windows.get(topId);
                const topLabel = topWin && topWin.title ? topWin.title : 'Minimized';
                const extra = h.members.length > 1 ? ` +${h.members.length - 1}` : '';
                markers.push({
                    kind: 'hole',
                    worldX: h.x,
                    worldY: h.y,
                    hue: h.hue,
                    label: topLabel + extra,
                    x: pos.x,
                    y: pos.y
                });
            }
        });

        const key = markers.map(m => `${m.kind}:${m.id || m.worldX},${m.x},${m.y},${m.appId || m.hue},${m.label}`).join(';');
        if (key !== this.shownIndicatorsKey) {
            this.shownIndicatorsKey = key;
            this.indicatorsContainer.replaceChildren(...markers.map(m => {
                const ind = document.createElement('button');
                ind.type = 'button';
                if (m.kind === 'hole') {
                    ind.className = 'window-indicator window-indicator--hole';
                    ind.style.setProperty('--bh-hue', m.hue + 'deg');
                    ind.onclick = (e) => {
                        e.stopPropagation();
                        const tx = window.innerWidth / 2 - m.worldX * this.cameraZ;
                        const ty = window.innerHeight / 2 - m.worldY * this.cameraZ;
                        this.animateCameraTo(tx, ty);
                    };
                } else {
                    const markClass = m.appId ? ` app-mark--${m.appId}` : '';
                    ind.className = `window-indicator${markClass}`;
                    ind.onclick = (e) => {
                        e.stopPropagation();
                        const win = this.windows.get(m.id);
                        if (!win) return;
                        const cx = parseFloat(win.el.dataset.x) + parseFloat(win.el.dataset.w) / 2;
                        const cy = parseFloat(win.el.dataset.y) + parseFloat(win.el.dataset.h) / 2;
                        const tx = window.innerWidth / 2 - cx * this.cameraZ;
                        const ty = window.innerHeight / 2 - cy * this.cameraZ;
                        this.animateCameraTo(tx, ty);
                        this.focus(m.id);
                    };
                }
                ind.style.left = m.x + 'px';
                ind.style.top = m.y + 'px';
                ind.title = m.label;
                ind.setAttribute('aria-label', `Jump to ${m.label}`);
                return ind;
            }));
        }

        // Animate remnants (framerate-independent exponential smoothing)
        const remEase = 1 - Math.exp(-1.2 * dt);
        let remnantsBusy = false;
        this.activeRemnants.forEach(rem => {
            if (rem.currentDepth !== rem.targetDepth || rem.currentOpacity !== rem.targetOpacity) {
                rem.currentDepth += (rem.targetDepth - rem.currentDepth) * remEase;
                rem.currentOpacity += (rem.targetOpacity - rem.currentOpacity) * remEase;
                if (Math.abs(rem.targetDepth - rem.currentDepth) < 0.001) rem.currentDepth = rem.targetDepth;
                if (Math.abs(rem.targetOpacity - rem.currentOpacity) < 0.001) rem.currentOpacity = rem.targetOpacity;
                if (rem.currentDepth !== rem.targetDepth || rem.currentOpacity !== rem.targetOpacity) {
                    remnantsBusy = true;
                }
            }

            const opacity = String(Math.max(0, rem.currentOpacity));
            if (rem.shownOpacity !== opacity) { rem.el.style.opacity = opacity; rem.shownOpacity = opacity; }

            const M = 0.95 * rem.currentDepth;
            const dx = (this.cameraX - rem.initCameraX);
            const dy = (this.cameraY - rem.initCameraY);

            const offsetX = -M * dx / this.cameraZ;
            const offsetY = -M * dy / this.cameraZ;

            const transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) scale(${(1 - rem.currentDepth * 0.3).toFixed(4)})`;
            if (rem.shownTransform !== transform) { rem.el.style.transform = transform; rem.shownTransform = transform; }

            if (rem.targetOpacity <= 0 && rem.currentOpacity <= 0.01) {
                if (rem.el.parentNode) rem.el.remove();
                this.activeRemnants.delete(rem);
            }
        });

        if (remnantsBusy) {
            this.overlayRaf = requestAnimationFrame((t) => this.tickOverlays(t));
        }
    }

    initCanvasControls() {
        // Handle infinite canvas panning
        // We bind to document body but only initiate if the target isn't an interactive window element
        document.body.addEventListener('mousedown', (e) => {
            if (this.isMobile()) return;
            // Ignore if clicking on UI elements like island, shelf, indicators, or interactive window parts
            if (e.target.closest('#nova-island-container') ||
                e.target.closest('#nova-shelf-container') ||
                e.target.closest('.window-indicator') ||
                e.target.closest('.nova-window')) {
                return;
            }

            if (e.button !== 0) return;
            // A click on empty space means "no window": keys stop going to the
            // last app (the cheat code's arrows used to start Columns).
            if (this.activeWindowId) this.releaseFocus(this.activeWindowId);
            this.stopCamera();
            this.panT = performance.now();
            this.isPanning = true;
            document.body.classList.add('is-dragging');
            this.panStartX = e.clientX - this.cameraX;
            this.panStartY = e.clientY - this.cameraY;
            document.body.style.cursor = 'grabbing';
        });

        document.body.addEventListener('mousemove', (e) => {
            if (this.isMobile()) return;
            if (!this.isPanning) return;
            // Released outside the page: the mouseup never came here.
            if (!(e.buttons & 1)) {
                this.isPanning = false;
                document.body.classList.remove('is-dragging');
                document.body.style.cursor = 'default';
                return;
            }

            const nx = e.clientX - this.panStartX;
            const ny = e.clientY - this.panStartY;
            // What the hand has been doing lately; a release keeps it.
            const now = performance.now();
            const dt = Math.max(0.004, (now - this.panT) / 1000);
            const k = Math.min(1, dt / 0.04);
            this.camVX += ((nx - this.cameraX) / dt - this.camVX) * k;
            this.camVY += ((ny - this.cameraY) / dt - this.camVY) * k;
            this.panT = now;
            this.cameraX = nx;
            this.cameraY = ny;

            this.applyCameraTransform();
        });

        document.body.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                document.body.classList.remove('is-dragging');
                document.body.style.cursor = 'default';
                // The desktop keeps gliding, unless the hand had stopped first.
                if (performance.now() - this.panT > 90 || this.physics.reduced.matches) this.camVX = this.camVY = 0;
                else this.physics.start();
            }
        });

        // Trackpad panning & pinch-to-zoom
        let wheelGestureMode = null;
        let wheelTimeout = null;

        document.body.addEventListener('wheel', (e) => {
            if (this.isMobile()) return;
            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => { wheelGestureMode = null; }, 150);
            const stopGlide = () => this.stopCamera();

            // Ignore and let native scroll take over if hovering any scrollable element
            if (!e.ctrlKey) {
                if (wheelGestureMode === 'scroll') return;

                let isScrollable = false;
                if (wheelGestureMode !== 'pan') {
                    const hoveredWin = e.target.closest('.nova-window');
                    if (!hoveredWin || hoveredWin.classList.contains('is-active')) {
                        let domNode = e.target;
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
                    }
                }

                if (wheelGestureMode === null) {
                    wheelGestureMode = isScrollable ? 'scroll' : 'pan';
                }

                if (wheelGestureMode === 'scroll') return;
            }

            e.preventDefault();
            stopGlide();

            if (e.ctrlKey) {
                // Exponential pinch-to-zoom towards cursor for uniform speed across scales
                const oldZ = this.cameraZ;
                this.cameraZ = Math.max(0.2, Math.min(this.cameraZ * Math.exp(-e.deltaY * 0.008), 3));

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
        if (this.isMobile()) {
            this.container.style.transform = 'none';
            if (this.backgroundLayer) this.backgroundLayer.style.transform = 'none';
            if (this.lastEmittedZ !== 1) {
                this.lastEmittedZ = 1;
                if (window.Bus) Bus.emit('camera:zoom', 1);
            }
            return;
        }
        this.container.style.transform = `translate3d(${this.cameraX + this.shakeX}px, ${this.cameraY + this.shakeY}px, 0) scale(${this.cameraZ})`;
        if (Math.abs(this.cameraZ - this.lastEmittedZ) >= 0.004) {
            this.lastEmittedZ = this.cameraZ;
            if (window.Bus) Bus.emit('camera:zoom', this.cameraZ);
        }
        if (this.backgroundLayer) {
            // The nebula is far away: it leans with the camera but never
            // leaves, however far the desktop is panned.
            const lean = (v) => (Math.tanh(v / 3000) * 48).toFixed(1);
            this.backgroundLayer.style.transform = `translate3d(${lean(this.cameraX)}px, ${lean(this.cameraY)}px, 0)`;
        }
        if (window.NovaStarfield) NovaStarfield.touch();
        // The camera moved: whatever the preview was pointing at has moved too.
        if (this.bhPreview) this.bhPreview.classList.remove('visible');
        this.activeRemnants.forEach(rem => {
            const M = 0.95 * rem.currentDepth;
            const dx = (this.cameraX - rem.initCameraX);
            const dy = (this.cameraY - rem.initCameraY);

            const offsetX = -M * dx / this.cameraZ;
            const offsetY = -M * dy / this.cameraZ;

            rem.el.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${1 - rem.currentDepth * 0.3})`;
        });
        this.scheduleOverlayTick();
    }

    // The camera travels on a critically damped spring: no overshoot, and a
    // new target mid-flight keeps the current velocity.
    animateCameraTo(targetX, targetY, targetZ = null) {
        if (this.isMobile()) return;
        const z = targetZ == null ? null : Math.max(0.2, Math.min(targetZ, 3));
        if (this.physics.reduced.matches) {
            this.cameraX = targetX; this.cameraY = targetY;
            if (z != null) this.cameraZ = z;
            this.applyCameraTransform();
            return;
        }
        this.camTarget = { x: targetX, y: targetY, z };
        this.physics.start();
    }

    stopCamera() {
        this.camTarget = null;
        this.camVX = this.camVY = this.camVZ = 0;
    }

    resetZoom() {
        if (this.isMobile()) return;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const worldX = (cx - this.cameraX) / this.cameraZ;
        const worldY = (cy - this.cameraY) / this.cameraZ;
        this.animateCameraTo(cx - worldX, cy - worldY, 1);
    }

    recenter() {
        if (this.isMobile()) return;
        const active = this.activeWindowId && this.windows.get(this.activeWindowId);
        if (active && active.el.dataset.minimized !== 'true') {
            const cx = parseFloat(active.el.dataset.x) + parseFloat(active.el.dataset.w) / 2;
            const cy = parseFloat(active.el.dataset.y) + parseFloat(active.el.dataset.h) / 2;
            this.animateCameraTo(window.innerWidth / 2 - cx, window.innerHeight / 2 - cy, 1);
            return;
        }
        let sumX = 0, sumY = 0, count = 0;
        this.windows.forEach(w => {
            if (w.el.dataset.minimized === 'true') return;
            sumX += parseFloat(w.el.dataset.x) + parseFloat(w.el.dataset.w) / 2;
            sumY += parseFloat(w.el.dataset.y) + parseFloat(w.el.dataset.h) / 2;
            count++;
        });
        if (count > 0) {
            this.animateCameraTo(window.innerWidth / 2 - sumX / count, window.innerHeight / 2 - sumY / count, 1);
        } else {
            this.animateCameraTo(0, 0, 1);
        }
    }

    shake(intensity = 0.5) {
        if (this.isMobile() || this.physics.reduced.matches) return;
        this.shakeMag = Math.max(this.shakeMag, intensity * 18);
        this.physics.start();
    }

    // One tick of camera motion; true while it is still moving.
    stepCamera(dt) {
        if (this.isMobile()) return false;
        let moving = false;

        if (this.shakeMag > 0.25) {
            const a = Math.random() * Math.PI * 2;
            this.shakeX = Math.cos(a) * this.shakeMag;
            this.shakeY = Math.sin(a) * this.shakeMag;
            this.shakeMag *= Math.exp(-9 * dt);
            moving = true;
        } else if (this.shakeMag > 0 || this.shakeX || this.shakeY) {
            this.shakeMag = 0;
            this.shakeX = 0;
            this.shakeY = 0;
            this.applyCameraTransform();
        }

        if (this.isPanning) {
            if (moving) this.applyCameraTransform();
            return moving;
        }
        if (this.camTarget) {
            const w = 11;   // rad/s
            const dx = this.camTarget.x - this.cameraX, dy = this.camTarget.y - this.cameraY;
            this.camVX += (w * w * dx - 2 * w * this.camVX) * dt;
            this.camVY += (w * w * dy - 2 * w * this.camVY) * dt;
            this.cameraX += this.camVX * dt;
            this.cameraY += this.camVY * dt;

            let zSettled = true;
            if (this.camTarget.z != null) {
                const dz = this.camTarget.z - this.cameraZ;
                this.camVZ += (w * w * dz - 2 * w * this.camVZ) * dt;
                this.cameraZ = Math.max(0.2, Math.min(3, this.cameraZ + this.camVZ * dt));
                zSettled = Math.abs(dz) < 0.002 && Math.abs(this.camVZ) < 0.01;
            }

            if (Math.hypot(dx, dy) < 0.5 && Math.hypot(this.camVX, this.camVY) < 6 && zSettled) {
                this.cameraX = this.camTarget.x; this.cameraY = this.camTarget.y;
                if (this.camTarget.z != null) this.cameraZ = this.camTarget.z;
                this.stopCamera();
            }
            this.applyCameraTransform();
            return true;
        }
        const speed = Math.hypot(this.camVX, this.camVY);
        if (speed >= 8) {
            const f = Math.exp(-4.5 * dt);
            this.camVX *= f; this.camVY *= f;
            this.cameraX += this.camVX * dt;
            this.cameraY += this.camVY * dt;
            moving = true;
        } else if (speed > 0) {
            this.camVX = this.camVY = 0;
        }
        if (moving) this.applyCameraTransform();
        return moving;
    }

    // Black holes as the physics sees them.
    holeList() {
        const list = [];
        this.holes.forEach(h => { if (h.members.length) list.push(h); });
        return list;
    }

    // A hole weighs what fell into it: a window's mass is its area.
    holeMass(h) {
        let m = 0;
        h.members.forEach(id => { const b = this.physics.get(id); if (b) m += this.physics.mass(b); });
        return Math.max(0.5, Math.min(36, m));
    }

    // Bigger windows leave bigger holes, with a longer reach.
    syncHole(h) {
        h.mass = this.holeMass(h);
        // A Calculator's hole is under 1×, Minesweeper on hard about 1.7×,
        // and a hole fed several windows passes 2× and keeps growing to 3.3×.
        h.scale = 0.3 + 0.5 * Math.sqrt(h.mass);
        h.el.style.setProperty('--bh-scale', h.scale.toFixed(3));
        h.el.dataset.count = h.members.length;
    }

    syncHolePull(activeSet) {
        this.holes.forEach(h => {
            h.el.classList.toggle('is-pulling', activeSet.has(h));
        });
    }

    // Two windows met: a soft thud and a subtle contact spark scaled by impact.
    bump(speed, x, y) {
        const now = performance.now();
        if (now - this.lastBump < 70) return;
        this.lastBump = now;
        const level = Math.min(1, speed / 1400);
        if (window.AudioMng) AudioMng.play('bump', level);
        if (x != null && y != null && !this.isMobile() && !this.physics.reduced.matches) {
            const spark = document.createElement('div');
            spark.className = 'nova-impact-spark';
            spark.style.left = x + 'px';
            spark.style.top = y + 'px';
            spark.style.setProperty('--spark-scale', (0.65 + level * 0.95).toFixed(2));
            this.container.appendChild(spark);
            setTimeout(() => spark.remove(), 360);
        }
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

        if (this.isMobile()) {
            left = 0;
            top = 0;
        } else if (left === undefined || top === undefined) {
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

        if (!this.isMobile()) {
            const targetCameraX = (window.innerWidth / 2) - (left + width / 2) * this.cameraZ;
            const targetCameraY = (window.innerHeight / 2) - (top + height / 2) * this.cameraZ;
            this.animateCameraTo(targetCameraX, targetCameraY);
        }

        const winEl = document.createElement('div');
        winEl.className = 'nova-window';
        winEl.id = id;
        winEl.style.width = width + 'px';
        winEl.style.height = height + 'px';

        // Position via standalone translate so physics runs on the GPU compositor
        // while staying independent of transform: scale() open/close animations.
        winEl.style.left = '0px';
        winEl.style.top = '0px';
        winEl.style.translate = `${left}px ${top}px`;

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
        closeBtn.setAttribute('aria-label', 'Close window');
        closeBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(id); };

        const minBtn = document.createElement('button');
        minBtn.className = 'window-btn minimize';
        minBtn.setAttribute('aria-label', 'Minimize window');
        minBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';
        minBtn.onclick = (e) => { e.stopPropagation(); this.minimize(id); };

        controls.appendChild(closeBtn);
        controls.appendChild(minBtn);

        const title = document.createElement('div');
        title.className = 'window-title';
        const mark = window.Icons ? Icons.get(options.appId) : '';
        title.innerHTML = `<span class="window-title-mark">${mark}</span><span>${this.escapeTitle(options.title || '')}</span>`;

        const placeholder = document.createElement('div');
        placeholder.className = 'window-placeholder';

        titlebar.appendChild(controls);
        titlebar.appendChild(title);
        titlebar.appendChild(placeholder);

        const content = document.createElement('div');
        content.className = 'window-content';
        content.innerHTML = options.content || '';

        winEl.appendChild(titlebar);
        winEl.appendChild(content);

        this.container.appendChild(winEl);

        const winObj = {
            id,
            el: winEl,
            appId: options.appId,
            title: options.title || '',
            titlebar,
            content
        };

        this.windows.set(id, winObj);
        this.physics.add(id, winEl);
        // Arriving displaces whatever is in the way, and nudges the rest.
        if (!this.isMobile()) {
            this.physics.pin(id, 500);
            this.physics.impulse(left + width / 2, top + height / 2, 140, id, 900);
        }
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

    escapeTitle(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    setupInteractions(win) {
        win.el.addEventListener('mousedown', () => this.focus(win.id));

        // Dragging
        let isDragging = false;
        let startClientX, startClientY;
        let startWinX, startWinY;

        win.titlebar.addEventListener('mousedown', (e) => {
            if (this.isMobile()) return;
            // Ignore if clicking window controls
            if (e.target.closest('.window-btn') || e.button !== 0) return;

            isDragging = true;
            document.body.classList.add('is-dragging');
            win.el.classList.add('is-held');
            this.focus(win.id);
            this.physics.grab(win.id, (e.clientX - this.cameraX) / this.cameraZ, (e.clientY - this.cameraY) / this.cameraZ);

            startClientX = e.clientX;
            startClientY = e.clientY;
            startWinX = parseFloat(win.el.dataset.x);
            startWinY = parseFloat(win.el.dataset.y);

            document.body.style.cursor = 'grabbing';
        });

        // Use global mouse handlers for dragging to prevent losing drag when mouse moves fast
        const onMouseMove = (e) => {
            if (!isDragging) return;
            // Released outside the page: the mouseup never came, so the window
            // would stay glued to the cursor.
            if (!(e.buttons & 1)) { onMouseUp(); return; }

            // Adjust delta by camera zoom to move perfectly with the mouse
            const deltaX = (e.clientX - startClientX) / this.cameraZ;
            const deltaY = (e.clientY - startClientY) / this.cameraZ;

            const newX = startWinX + deltaX;
            const newY = startWinY + deltaY;

            this.physics.dragTo(win.id, newX, newY);
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                win.el.classList.remove('is-held');
                this.physics.release(win.id);
                document.body.classList.remove('is-dragging');
                document.body.style.cursor = 'default';
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onMouseUp);

        // Store listeners so we can clean up if window closes
        win.cleanup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onMouseUp);
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
        Bus.emit('window:focused', id);
    }

    // Leaves focus on nothing when the active window goes away; the island
    // then falls back to "Nova" instead of keeping a closed app's name.
    releaseFocus(id) {
        if (this.activeWindowId !== id) return;
        const win = this.windows.get(id);
        if (win) win.el.classList.remove('is-active');
        this.activeWindowId = null;
        Bus.emit('window:focused', null);
    }

    close(id) {
        const win = this.windows.get(id);
        if (!win) return;
        this.releaseFocus(id);

        if (this.isMobile()) {
            if (win.cleanup) win.cleanup();
            this.leaveHole(id);
            this.physics.remove(id);
            win.el.remove();
            this.windows.delete(id);
            if (win.appId && !Array.from(this.windows.values()).some(w => w.appId === win.appId)) {
                Apps.markClosed(win.appId);
            }
            const remaining = Array.from(this.windows.values()).filter(w => w.el.dataset.minimized !== 'true');
            this.activeWindowId = null;
            if (remaining.length) this.focus(remaining[remaining.length - 1].id);
            if (window.ShelfInstance) window.ShelfInstance.render();
            return;
        }

        if (win.cleanup) win.cleanup();
        this.leaveHole(id);

        const body = this.physics.get(id);
        if (body) { body.ghost = true; body.held = false; body.asleep = true; }

        // The star collapses…
        win.el.classList.remove('is-held');
        win.el.style.animation = 'none';
        win.el.style.transition = 'transform 0.5s cubic-bezier(1, 0, 0.5, 1), opacity 0.5s cubic-bezier(1, 0, 0.5, 1)';
        win.el.style.transform = 'scale(0)';
        win.el.style.opacity = '0';
        win.el.style.pointerEvents = 'none';

        const box = { x: parseFloat(win.el.dataset.x), y: parseFloat(win.el.dataset.y), w: parseFloat(win.el.dataset.w), h: parseFloat(win.el.dataset.h) };
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        const energy = Math.sqrt(box.w * box.h / 1e5);   // bigger windows, bigger novae
        this.physics.impulse(cx, cy, -190 * energy, id);

        setTimeout(() => {
            if (window.AudioMng) AudioMng.play('explode'); // subtle pop

            // …and goes nova: a flash, and a shock front that reaches the
            // neighbours in the order of their distance.
            const explosion = document.createElement('div');
            explosion.className = 'nova-explosion';
            explosion.style.left = cx + 'px';
            explosion.style.top = cy + 'px';
            explosion.innerHTML = '<i class="nova-explosion__core"></i><i class="nova-explosion__front"></i><i class="nova-explosion__front nova-explosion__front--late"></i>';
            this.container.appendChild(explosion);

            this.physics.shock(cx, cy, 1500 * energy, id);

            // Spawn persistent wrapper immediately as explosion flashes
            const remContainer = document.createElement('div');
            remContainer.className = 'nova-remnant-wrap';
            remContainer.style.position = 'absolute';
            remContainer.style.left = cx + 'px';
            remContainer.style.top = cy + 'px';

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
            this.scheduleOverlayTick();

            setTimeout(() => { explosion.remove(); }, 1200);
        }, 400);

        setTimeout(() => {
            if (win.el.parentNode) {
                win.el.parentNode.removeChild(win.el);
            }
            this.windows.delete(id);
            this.physics.remove(id);
            this.scheduleOverlayTick();

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

    // The window `targetId` now occupies `box` (it appeared, grew or came
    // back): it holds its ground while the contact solver moves the others.
    pushWindowsOut(targetId, box) {
        if (this.isMobile()) return;
        this.physics.resync(targetId);
        this.physics.pin(targetId);
    }

    // Something at the centre of `box` collapsed: the neighbours lurch inward.
    pullWindowsIn(targetId, box) {
        if (this.isMobile()) return;
        this.physics.impulse(box.x + box.w / 2, box.y + box.h / 2, -260, targetId);
    }

    // A black hole as it would be photographed: the accretion disc seen at a
    // slant, its far half passing behind the shadow and its near half in
    // front, with the far side's light bent up over the top. The disc is
    // loose matter, not a surface: each band is a ring of clumps, and inner
    // bands orbit faster (period ∝ r^1.5).
    blackHoleMarkup() {
        const uid = 'bh' + (++this.holeCounter);
        const T = r => (3.6 * Math.pow(r / 39, 1.5)).toFixed(2);
        // radius, stroke width, opacity, clumps (dash pattern over a path length of 100)
        const bands = [
            [39, 3.2, 1, '2 5 7 4 1 6 9 7 3 6 5 4 2 8 6 5 1 9 4 6'],
            [48, 3.6, 1, '6 5 2 7 9 6 1 5 4 8 7 6 3 9 5 7 2 8'],
            [58, 4, 0.9, '3 8 8 7 2 9 5 8 6 9 1 7 9 8 4 6'],
            [68, 4.4, 0.75, '7 9 2 10 5 9 9 10 3 9 6 11 1 9'],
            [78, 4.8, 0.55, '4 12 9 11 2 13 7 12 5 11 3 11'],
            [88, 5.2, 0.38, '8 14 3 15 6 14 2 13 9 16']
        ];
        const band = ([r, w, o, dash], i) =>
            `<circle class="bh-flow" cx="100" cy="100" r="${r}" pathLength="100" stroke="url(#${uid}-disc)" stroke-width="${w}" opacity="${o}" stroke-dasharray="${dash}" style="animation-duration:${T(r)}s;animation-delay:-${(i * 2.7 + 1).toFixed(1)}s"/>`;
        const disc = bands.map(band).join('');
        const tilt = 'rotate(-14 100 100) translate(0 64) scale(1 0.36)';
        return `
        <svg class="bh" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="${uid}-disc" gradientUnits="userSpaceOnUse" x1="10" y1="100" x2="190" y2="100">
              <stop offset="0" stop-color="var(--nova-bh-glare)"/>
              <stop offset="0.3" stop-color="var(--nova-bh-hot)"/>
              <stop offset="0.62" stop-color="var(--nova-bh-warm)"/>
              <stop offset="1" stop-color="var(--nova-bh-deep)"/>
            </linearGradient>
            <radialGradient id="${uid}-glow">
              <stop offset="0.2" stop-color="var(--nova-bh-warm)" stop-opacity="0.3"/>
              <stop offset="1" stop-color="var(--nova-bh-deep)" stop-opacity="0"/>
            </radialGradient>
            <clipPath id="${uid}-far"><rect x="0" y="0" width="200" height="100"/></clipPath>
            <clipPath id="${uid}-near"><rect x="0" y="100" width="200" height="100"/></clipPath>
            <clipPath id="${uid}-over"><rect x="0" y="0" width="200" height="104"/></clipPath>
          </defs>
          <ellipse cx="100" cy="100" rx="96" ry="44" transform="rotate(-14 100 100)" fill="url(#${uid}-glow)"/>
          <g transform="${tilt}"><g clip-path="url(#${uid}-far)">${disc}</g></g>
          <g clip-path="url(#${uid}-over)" transform="rotate(-14 100 100)">
            <circle class="bh-flow" cx="100" cy="100" r="29" pathLength="100" stroke="url(#${uid}-disc)" stroke-width="3" opacity="0.7" stroke-dasharray="5 6 2 7 8 6 3 8 6 7 1 6 9 7 4 5" style="animation-duration:7s"/>
          </g>
          <circle class="bh-shadow" cx="100" cy="100" r="21"/>
          <circle class="bh-photon" cx="100" cy="100" r="22.5" pathLength="100" stroke="url(#${uid}-disc)" stroke-dasharray="1.2 1.6" />
          <g transform="${tilt}"><g clip-path="url(#${uid}-near)">${disc}</g></g>
        </svg>`;
    }

    makeHole(x, y) {
        const el = document.createElement('div');
        el.className = 'nova-blackhole-container';
        const hue = Math.floor(Math.random() * 360);
        el.dataset.hue = hue; // the disc's colour, reused by the End of times view
        el.style.setProperty('--bh-hue', hue + 'deg');
        el.innerHTML = this.blackHoleMarkup();
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';

        const hole = { el, x, y, hue, mass: 1, members: [] };
        // A click frees whatever fell in last.
        el.onclick = () => { if (hole.members.length) this.restore(hole.members[hole.members.length - 1]); };
        // The preview sits by the pointer. It is placed on entering as well
        // as on moving: when the desktop is panned, a hole can slide under a
        // pointer that never moved, and the preview used to show wherever it
        // had last been.
        const place = (e) => {
            this.bhPreview.style.left = (e.clientX + 15) + 'px';
            this.bhPreview.style.top = (e.clientY + 15) + 'px';
        };
        el.onmouseenter = (e) => {
            const lastIdx = hole.members.length - 1;
            const marks = hole.members.map((id, idx) => {
                const w = this.windows.get(id);
                const svg = w && window.Icons ? Icons.get(w.appId) : '';
                return `<span class="bh-preview__mark${idx === lastIdx ? ' is-next' : ''}">${svg}</span>`;
            }).join('');
            const topWin = hole.members.length ? this.windows.get(hole.members[lastIdx]) : null;
            const label = topWin && topWin.title ? this.escapeTitle(topWin.title) : '';
            const extra = hole.members.length > 1 ? ` +${hole.members.length - 1}` : '';
            this.bhPreview.innerHTML = marks + (label ? `<span class="bh-preview__label">${label}${extra}</span>` : '');
            place(e);
            this.bhPreview.classList.add('visible');
        };
        // moving again after a pan hid it brings it back
        el.onmousemove = (e) => { if (this.bhPreview.classList.contains('visible')) place(e); else el.onmouseenter(e); };
        el.onmouseleave = () => {
            this.bhPreview.classList.remove('visible');
        };

        this.container.appendChild(el);
        this.holes.set(el, hole);
        return hole;
    }

    // Takes a window out of the hole that holds it; an empty hole evaporates.
    leaveHole(id) {
        const el = this.activeBlackHoles.get(id);
        if (!el) return null;
        this.activeBlackHoles.delete(id);
        const hole = this.holes.get(el);
        if (!hole) return null;
        hole.members = hole.members.filter(m => m !== id);
        if (hole.members.length) {
            this.syncHole(hole);
        } else {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            this.holes.delete(el);
            setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
        }
        if (window.NovaStarfield) NovaStarfield.touch();
        return hole;
    }

    // A moving window strayed inside a hole's capture radius.
    swallow(id, hole) {
        if (this.isMobile()) return;
        const win = this.windows.get(id);
        if (!win || win.el.dataset.minimized === 'true' || !this.holes.has(hole.el)) return;
        this.minimize(id, hole);
    }

    minimize(id, into) {
        if (this.isMobile()) return;
        const win = this.windows.get(id);
        if (!win) return;

        if (window.AudioMng) AudioMng.play('collapse');

        const box = {
            x: parseFloat(win.el.dataset.x),
            y: parseFloat(win.el.dataset.y),
            w: parseFloat(win.el.dataset.w),
            h: parseFloat(win.el.dataset.h)
        };

        const body = this.physics.get(id);
        if (body) {
            body.ghost = true; body.held = false; body.asleep = true;
            body.vx = body.vy = 0;
        }
        win.el.classList.remove('is-held');

        // Capture current state to avoid snapping back to hidden styles when animation is removed
        const computed = window.getComputedStyle(win.el);
        const transform = computed.transform;
        const opacity = computed.opacity;

        win.el.style.animation = 'none';
        win.el.style.transform = transform;
        win.el.style.opacity = opacity;
        // Falling into another hole, the window spirals down to that point.
        if (into) win.el.style.transformOrigin = `${into.x - box.x}px ${into.y - box.y}px`;

        void win.el.offsetHeight; // Force reflow

        win.el.style.transition = 'transform 0.5s cubic-bezier(1, 0, 0.5, 1), opacity 0.5s cubic-bezier(1, 0, 0.5, 1)';
        win.el.style.transform = into ? 'scale(0) rotate(120deg)' : 'scale(0)';
        win.el.style.opacity = '0';
        win.el.style.pointerEvents = 'none';
        win.el.dataset.minimized = 'true';
        this.releaseFocus(id);
        Bus.emit('window:minimized', id);

        const cx = into ? into.x : box.x + box.w / 2;
        const cy = into ? into.y : box.y + box.h / 2;
        this.physics.impulse(cx, cy, into ? -120 : -260, id);

        const hole = into || this.makeHole(cx, cy);
        hole.members.push(id);
        this.activeBlackHoles.set(id, hole.el);
        this.syncHole(hole);
        if (into) {
            // The hole swallowed mass: it rings.
            hole.el.classList.remove('is-fed');
            void hole.el.offsetWidth;
            hole.el.classList.add('is-fed');
            // Once inside, the window sits at the singularity.
            setTimeout(() => {
                if (win.el.dataset.minimized !== 'true' || !body) return;
                body.x = hole.x - body.w / 2; body.y = hole.y - body.h / 2;
                this.physics.draw(body);
                win.el.style.transformOrigin = '';
            }, 520);
        }
        if (window.NovaStarfield) NovaStarfield.touch();
        this.scheduleOverlayTick();

        if (window.ShelfInstance) window.ShelfInstance.render();
    }

    restore(id) {
        const win = this.windows.get(id);
        if (!win) return;

        if (this.isMobile()) {
            win.el.dataset.minimized = 'false';
            Bus.emit('window:restored', id);
            this.focus(id);
            return;
        }

        if (window.AudioMng) AudioMng.play('expand');

        // Dismiss hover preview immediately
        if (this.bhPreview) this.bhPreview.classList.remove('visible');

        win.el.style.animation = 'none';
        win.el.style.transformOrigin = '';
        win.el.style.transition = 'transform 0.5s var(--ease-spring), opacity 0.5s var(--ease-spring)';
        win.el.style.transform = 'scale(1)';
        win.el.style.opacity = '1';
        win.el.style.pointerEvents = 'auto';
        win.el.dataset.minimized = 'false';
        Bus.emit('window:restored', id);

        const hole = this.leaveHole(id);
        const body = this.physics.get(id);
        if (body) {
            body.ghost = false;
            const cx = body.x + body.w / 2, cy = body.y + body.h / 2;
            if (hole && hole.members.length && !this.physics.reduced.matches) {
                // The hole keeps others: this one is thrown clear of it.
                // Of sixteen headings, take the one with the most open space.
                const reach = Math.hypot(body.w, body.h) / 2 + 150;
                const spin = Math.random() * Math.PI * 2;
                let a = spin, best = -Infinity;
                for (let i = 0; i < 16; i++) {
                    const t = spin + i * Math.PI / 8;
                    const ex = cx + Math.cos(t) * reach, ey = cy + Math.sin(t) * reach;
                    let room = Infinity;
                    this.physics.bodies.forEach(o => {
                        if (o === body || o.ghost) return;
                        const dx = Math.max(o.x - ex, 0, ex - (o.x + o.w));
                        const dy = Math.max(o.y - ey, 0, ey - (o.y + o.h));
                        room = Math.min(room, Math.hypot(dx, dy));
                    });
                    if (room > best) { best = room; a = t; }
                }
                const v = reach * NovaPhysicsClass.K.drag * 1.3;   // drag plus dry friction to overcome
                body.vx = Math.cos(a) * v; body.vy = Math.sin(a) * v;
                body.freeUntil = performance.now() + 3000;
                this.physics.wakeAll();
            } else {
                this.physics.pin(id);
                this.physics.impulse(cx, cy, 160, id, 900);
            }
        }

        this.scheduleOverlayTick();
        this.focus(id);
    }

}

window.WindowManager = new WindowManagerClass();
