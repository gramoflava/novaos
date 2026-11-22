// Nova physics: the desktop is a small rigid-body world.
//
// Every window is a body with mass (its area), velocity and attitude. Windows
// can be shoved, coast a short way through a thick medium, collide and trade
// momentum, bend around black holes and get swallowed by them.
// A closing window sends a shock front out at finite speed. The camera glides
// on the same clock.
//
// Units: world px, seconds, radians. The loop runs only while something is
// awake; a settled desktop costs nothing.
class NovaPhysicsClass {
    constructor() {
        this.bodies = new Map();
        this.waves = [];
        this.holes = () => [];      // set by the window manager: [{ x, y, mass, id }]
        this.onCapture = null;      // (bodyId, hole) => void
        this.onImpact = null;       // (speed, x, y) => void
        this.onHolePull = null;     // (activeHoleSet) => void
        this.onDraw = null;         // () => void (called when any body moved)
        this.camera = null;         // set by the window manager
        this.raf = 0;
        this.last = 0;
        this.acc = 0;
        this.pullingHoles = new Set();
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    }

    // ── Bodies ───────────────────────────────────────────────────────────────
    add(id, el) {
        const b = {
            id, el,
            x: parseFloat(el.dataset.x), y: parseFloat(el.dataset.y),
            w: parseFloat(el.dataset.w), h: parseFloat(el.dataset.h),
            vx: 0, vy: 0, ax: 0, ay: 0,
            theta: 0, omega: 0,
            held: false, grabX: 0, grabY: 0,
            ghost: false,            // closing or minimised: no collisions
            pinnedUntil: 0,          // immovable until then (restore, resize)
            asleep: true,
            shownX: null, shownY: null, shownTheta: 0
        };
        this.bodies.set(id, b);
        return b;
    }

    remove(id) { this.bodies.delete(id); }
    get(id) { return this.bodies.get(id); }

    mass(b) { return Math.max(0.4, b.w * b.h / NovaPhysicsClass.K.density); }

    // Size changed from outside (a game resized its window).
    resync(id) {
        const b = this.bodies.get(id);
        if (!b) return;
        b.w = parseFloat(b.el.dataset.w);
        b.h = parseFloat(b.el.dataset.h);
        b.x = parseFloat(b.el.dataset.x);
        b.y = parseFloat(b.el.dataset.y);
    }

    wake(b) {
        if (b) b.asleep = false;
        this.start();
    }

    wakeAll() {
        this.bodies.forEach(b => { if (!b.ghost) b.asleep = false; });
        this.start();
    }

    // Hold the body still while the neighbours make room for it.
    pin(id, ms = 700) {
        const b = this.bodies.get(id);
        if (!b) return;
        b.pinnedUntil = performance.now() + ms;
        b.vx = b.vy = 0;
        this.wakeAll();
    }

    // ── Dragging ─────────────────────────────────────────────────────────────
    grab(id, worldX, worldY) {
        const b = this.bodies.get(id);
        if (!b) return;
        b.held = true;
        b.vx = b.vy = 0;
        b.ax = b.ay = 0;
        // Where the hand holds the window, relative to its centre of mass.
        b.grabX = worldX - (b.x + b.w / 2);
        b.grabY = worldY - (b.y + b.h / 2);
        b.holdX = b.x; b.holdY = b.y;
        b.targetX = b.x; b.targetY = b.y;     // not where an earlier drag left off
        b.holdT = performance.now();
        this.wakeAll();
    }

    // The hand moves; the window follows exactly. Velocity is what the hand
    // has been doing lately, so a release carries real momentum.
    dragTo(id, x, y) {
        const b = this.bodies.get(id);
        if (!b || !b.held) return;
        const now = performance.now();
        const dt = Math.max(0.004, (now - b.holdT) / 1000);
        const vx = (x - b.holdX) / dt, vy = (y - b.holdY) / dt;
        const k = Math.min(1, dt / 0.04);            // ~40 ms smoothing window
        const nvx = b.vx + (vx - b.vx) * k, nvy = b.vy + (vy - b.vy) * k;
        b.ax = (nvx - b.vx) / dt; b.ay = (nvy - b.vy) / dt;
        b.vx = nvx; b.vy = nvy;
        b.holdX = x; b.holdY = y; b.holdT = now;
        b.targetX = x; b.targetY = y;
        this.wake(b);
    }

    release(id) {
        const b = this.bodies.get(id);
        if (!b || !b.held) return;
        b.held = false;
        // A hand that stopped before letting go throws nothing.
        if (performance.now() - b.holdT > 90) b.vx = b.vy = 0;
        b.vx *= 0.75; b.vy *= 0.75;
        const max = NovaPhysicsClass.K.maxSpeed, s = Math.hypot(b.vx, b.vy);
        if (s > max) { b.vx *= max / s; b.vy *= max / s; }
        if (this.reduced.matches) b.vx = b.vy = 0;
        this.wake(b);
    }

    // ── Forces from events ───────────────────────────────────────────────────
    // An instant radial kick, as from a collapse (negative) or a burst.
    impulse(x, y, strength, exceptId, reach = 1400) {
        if (this.reduced.matches) return;
        this.bodies.forEach(b => {
            if (b.id === exceptId || b.ghost || b.held) return;
            const dx = b.x + b.w / 2 - x, dy = b.y + b.h / 2 - y;
            const d = Math.hypot(dx, dy);
            if (d < 1 || d > reach) return;
            const dv = strength / this.mass(b) / (1 + d / 320);
            b.vx += dx / d * dv; b.vy += dy / d * dv;
            b.asleep = false;
        });
        this.start();
    }

    // A shock front leaving (x, y) at finite speed: far windows feel it later.
    shock(x, y, strength, exceptId) {
        if (this.reduced.matches) return;
        this.waves.push({ x, y, strength, exceptId, r: 0, hit: new Set() });
        this.start();
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    start() {
        if (this.raf) return;
        this.last = performance.now();
        this.acc = 0;
        this.raf = requestAnimationFrame(t => this.frame(t));
    }

    frame(now) {
        const K = NovaPhysicsClass.K;
        this.acc += Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        let steps = 0;
        while (this.acc >= K.dt && steps < 8) { this.step(K.dt, now); this.acc -= K.dt; steps++; }
        if (steps === 8) this.acc = 0;

        let busy = this.waves.length > 0;
        let moved = false;
        this.bodies.forEach(b => {
            if (this.draw(b)) moved = true;
            if (!b.asleep) busy = true;
        });
        if (this.onHolePull) this.onHolePull(this.pullingHoles);
        if (this.camera && this.camera.step(Math.min(0.05, steps * K.dt || K.dt))) busy = true;
        if (moved && this.onDraw) this.onDraw();

        this.raf = busy ? requestAnimationFrame(t => this.frame(t)) : 0;
    }

    step(dt, now) {
        const K = NovaPhysicsClass.K;
        const holes = this.holes();
        const reduced = this.reduced.matches;
        const list = [];
        this.bodies.forEach(b => { if (!b.ghost) list.push(b); });
        this.pullingHoles.clear();

        // Shock fronts.
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const wv = this.waves[i];
            wv.r += K.shockSpeed * dt;
            for (const b of list) {
                if (b.id === wv.exceptId || b.held || wv.hit.has(b.id)) continue;
                const dx = b.x + b.w / 2 - wv.x, dy = b.y + b.h / 2 - wv.y;
                const d = Math.hypot(dx, dy);
                if (d > wv.r || d < 1) continue;
                wv.hit.add(b.id);
                const dv = wv.strength / this.mass(b) / (1 + d / 320);
                b.vx += dx / d * dv; b.vy += dy / d * dv;
                if (!reduced) {
                    const spin = ((dx * dy >= 0 ? 1 : -1) * Math.min(1.4, dv / 700));
                    b.omega += spin;
                }
                b.asleep = false;
            }
            if (wv.r > K.shockReach) this.waves.splice(i, 1);
        }

        for (const b of list) {
            if (b.asleep) continue;
            const pinned = now < b.pinnedUntil;

            if (b.held) {
                const tx = b.targetX ?? b.x, ty = b.targetY ?? b.y;
                const dx = tx - b.x, dy = ty - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist > K.heldStepMax) {
                    b.x += dx / dist * K.heldStepMax;
                    b.y += dy / dist * K.heldStepMax;
                } else {
                    b.x = tx; b.y = ty;
                }
                // Off-center drag acceleration creates a subtle physical swing.
                if (!reduced) {
                    const torque = (b.grabX * b.ay - b.grabY * b.ax) * K.dragTorque;
                    b.omega += Math.max(-14, Math.min(14, torque)) * dt;
                }
                // The hand stopped: the velocity estimate decays with it.
                if (now - b.holdT > 60) { b.vx *= 0.8; b.vy *= 0.8; b.ax = b.ay = 0; }
            } else if (pinned) {
                b.vx = b.vy = 0;
            } else {
                // Gravity bends the path of anything already in motion; a
                // window at rest is held by the desktop.
                const speed = Math.hypot(b.vx, b.vy);
                if (speed > K.gravityMinSpeed && !(now < b.freeUntil)) {
                    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
                    for (const h of holes) {
                        const dx = h.x - cx, dy = h.y - cy;
                        const r2 = dx * dx + dy * dy;
                        if (r2 > K.gravityReach * K.gravityReach) continue;
                        const r = Math.sqrt(r2);
                        const capR = K.captureRadius * Math.sqrt(h.mass);
                        if (r < capR && this.onCapture) {
                            this.onCapture(b.id, h);
                            break;
                        }
                        if (r < capR * 3.8) this.pullingHoles.add(h);
                        const a = K.GM * h.mass / (r2 + K.soft * K.soft);
                        b.vx += dx / r * a * dt; b.vy += dy / r * a * dt;
                    }
                    if (b.ghost) continue;
                }
                // Thin medium: drag proportional to velocity.
                let f = Math.exp(-K.drag * dt);
                // …and a little dry friction, so a coasting window stops
                // cleanly instead of creeping.
                const v = Math.hypot(b.vx, b.vy) * f;
                f *= v > 0 ? Math.max(0, v - K.friction * dt) / v : 0;
                b.vx *= f; b.vy *= f;
                b.x += b.vx * dt; b.y += b.vy * dt;
            }

            // Attitude spring: windows gently right themselves to 0 rad.
            if (reduced) {
                b.theta = 0; b.omega = 0;
            } else if (b.theta !== 0 || b.omega !== 0) {
                b.omega += (-K.rotK * b.theta - K.rotDamp * b.omega) * dt;
                b.theta += b.omega * dt;
                if (b.theta > K.maxTilt) { b.theta = K.maxTilt; b.omega = Math.min(0, b.omega); }
                else if (b.theta < -K.maxTilt) { b.theta = -K.maxTilt; b.omega = Math.max(0, b.omega); }
            }
        }

        // Contacts. A few passes let a shove travel down a row of windows.
        let touching = false;
        for (let pass = 0; pass < 4; pass++) {
            for (let i = 0; i < list.length; i++) {
                const a = list[i];
                if (a.ghost) continue;
                for (let j = i + 1; j < list.length; j++) {
                    const b = list[j];
                    if (b.ghost || (a.asleep && b.asleep)) continue;
                    if (this.collide(a, b, now, pass === 0)) touching = true;
                }
            }
        }

        // Rest.
        for (const b of list) {
            if (b.asleep || b.held) continue;
            const still = Math.hypot(b.vx, b.vy) < K.sleepSpeed;
            const level = Math.abs(b.theta) < 0.001 && Math.abs(b.omega) < 0.01;
            if (still && level && !touching && now >= b.pinnedUntil) {
                b.vx = b.vy = 0;
                b.theta = b.omega = 0;
                b.asleep = true;
            }
        }
    }

    // Two rounded boxes with a little air between them. Resolves along the
    // axis of least penetration; momentum is conserved, some energy is lost.
    collide(a, b, now, first) {
        const K = NovaPhysicsClass.K, gap = K.gap;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (ox <= 0 || oy <= 0) return false;

        const ima = (a.held || now < a.pinnedUntil) ? 0 : 1 / this.mass(a);
        const imb = (b.held || now < b.pinnedUntil) ? 0 : 1 / this.mass(b);
        const im = ima + imb;
        if (im === 0) return false;

        let nx = 0, ny = 0, pen;
        if (ox < oy) { nx = (a.x + a.w / 2 < b.x + b.w / 2) ? 1 : -1; pen = ox; }
        else { ny = (a.y + a.h / 2 < b.y + b.h / 2) ? 1 : -1; pen = oy; }

        // Closing speed along the normal (b relative to a).
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
            const e = -vn > K.restThreshold ? K.restitution : 0;
            const j = -(1 + e) * vn / im;
            a.vx -= j * ima * nx; a.vy -= j * ima * ny;
            b.vx += j * imb * nx; b.vy += j * imb * ny;

            const px = nx ? (nx > 0 ? a.x + a.w : a.x) : (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
            const py = ny ? (ny > 0 ? a.y + a.h : a.y) : (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2;

            // Off-center hits impart a gentle twist.
            if (!this.reduced.matches) {
                const arx = px - (a.x + a.w / 2), ary = py - (a.y + a.h / 2);
                const brx = px - (b.x + b.w / 2), bry = py - (b.y + b.h / 2);
                const ta = -(arx * ny - ary * nx) * j * ima * K.hitTorque;
                const tb = (brx * ny - bry * nx) * j * imb * K.hitTorque;
                a.omega += Math.max(-2.5, Math.min(2.5, ta));
                b.omega += Math.max(-2.5, Math.min(2.5, tb));
            }

            if (first && this.onImpact && -vn > K.restThreshold) {
                this.onImpact(-vn, px, py);
            }
        }

        // Ease the overlap out instead of teleporting; firmer when actively shoved.
        const unstick = (a.held || b.held) ? K.heldUnstick : K.unstick;
        const corr = Math.min(pen, Math.max(pen * unstick, 0.4)) / im;
        a.x -= corr * ima * nx; a.y -= corr * ima * ny;
        b.x += corr * imb * nx; b.y += corr * imb * ny;
        a.asleep = false; b.asleep = false;
        return true;
    }

    draw(b) {
        const theta = Math.abs(b.theta) > 0.0004 ? b.theta : 0;
        const posChanged = b.x !== b.shownX || b.y !== b.shownY;
        const rotChanged = theta !== b.shownTheta;
        if (posChanged || rotChanged) {
            if (posChanged) {
                b.shownX = b.x; b.shownY = b.y;
                b.el.dataset.x = b.x; b.el.dataset.y = b.y;
                b.el.style.translate = `${b.x}px ${b.y}px`;
            }
            if (rotChanged) {
                b.shownTheta = theta;
                b.el.style.rotate = theta ? `${theta.toFixed(4)}rad` : '';
            }
            return posChanged;
        }
        return false;
    }
}

NovaPhysicsClass.K = {
    dt: 1 / 120,
    density: 1e5,           // px² per unit of mass
    drag: 5.2,              // 1/s: a shove carries a window a short way, no further
    friction: 240,          // px/s²
    restitution: 0.35,
    restThreshold: 60,      // px/s: slower contacts don't bounce
    gap: 14,                // px of air kept between windows
    unstick: 0.09,          // share of an overlap eased out per step
    heldUnstick: 0.45,      // firmer separation when a held window shoves another
    heldStepMax: 42,        // max world px per 1/120s substep while held (prevents tunneling)
    rotK: 34,               // 1/s²: attitude restoring spring
    rotDamp: 10.5,          // 1/s: attitude damping
    maxTilt: 0.085,         // rad (~4.9°): cap on window tilt
    dragTorque: 1.4e-6,     // off-center drag leverage -> angular acceleration
    hitTorque: 3.5e-5,      // off-center collision leverage -> angular velocity
    maxSpeed: 2400,
    sleepSpeed: 5,
    GM: 0.8e7,              // px³/s² per unit of hole mass
    soft: 70,
    gravityReach: 900,
    gravityMinSpeed: 30,
    captureRadius: 42,      // × √mass
    shockSpeed: 2600,
    shockReach: 1500
};

window.NovaPhysics = new NovaPhysicsClass();
