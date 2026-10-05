Apps.register({
    id: 'calculator',
    name: 'Calculator',
    iconId: 'calculator',
    category: 'utilities',
    keepInDock: true,
    launch: () => {
        const winId = 'calc-' + Date.now();

        let current = '0';
        let previous = null;
        let op = null;
        let newNumber = true;
        let upsideDown = false;

        // Seven-segment LCD: the shapes also spell the secret when rotated.
        const segments = {
            '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg',
            '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc',
            '8': 'abcdefg', '9': 'abcdfg', '-': 'g',
            'e': 'adefg', 'E': 'adefg', '+': 'g'
        };
        const segmentShapes = [
            ['a', '8,2 32,2 36,6 32,10 8,10 4,6'],
            ['b', '34,12 38,8 42,12 42,34 38,38 34,34'],
            ['c', '34,46 38,42 42,46 42,68 38,72 34,68'],
            ['d', '8,70 32,70 36,74 32,78 8,78 4,74'],
            ['e', '0,46 4,42 8,46 8,68 4,72 0,68'],
            ['f', '0,12 4,8 8,12 8,34 4,38 0,34'],
            ['g', '8,36 32,36 36,40 32,44 8,44 4,40']
        ];
        const renderLCD = (value) => {
            if (![...value].every(char => char === '.' || char in segments)) {
                return value;
            }
            let x = 0;
            const digits = [...value].map(char => {
                if (char === '.') {
                    const dot = `<circle cx="${x + 4}" cy="74" r="4"/>`;
                    x += 14;
                    return dot;
                }
                const active = segments[char];
                const digit = `<g transform="translate(${x} 0)">${segmentShapes.map(([name, points]) =>
                    `<polygon points="${points}" style="opacity: ${active.includes(name) ? 1 : 'var(--calc-inactive)'}"/>`
                ).join('')}${char === '+' ? '<rect x="18" y="26" width="6" height="28"/>' : ''}</g>`;
                x += 52;
                return digit;
            }).join('');
            return `<svg width="${Math.max(x - 10, 8)}" height="80" viewBox="0 0 ${Math.max(x - 10, 8)} 80" aria-hidden="true" focusable="false">${digits}</svg>`;
        };

        const updateDisplay = () => {
            const disp = document.getElementById(`calc-display-${winId}`);
            if (disp) {
                // Formatting for length
                let displayVal = current;
                if(displayVal.length > 10) {
                    displayVal = parseFloat(displayVal).toPrecision(10);
                }
                disp.innerHTML = renderLCD(displayVal);
                disp.setAttribute('aria-label', displayVal);
                if (!upsideDown && current === '5318008' && !newNumber) {
                    upsideDown = true;
                    const calculatorWindow = WindowManager.windows.get(winId);
                    if (calculatorWindow) calculatorWindow.el.style.rotate = '180deg';
                }
            }
        };

        const calcStyle = `
            .calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 24px; flex: 1; }
            .calc-btn {
                background: var(--surface-sunk);
                border: 1px solid var(--line);
                box-shadow: var(--glass-edge);
                border-radius: var(--radius-md);
                font-size: 20px;
                color: var(--text);
                cursor: pointer;
                transition: all 0.2s;
                display: flex; align-items: center; justify-content: center;
                user-select: none;
            }
            .calc-btn:hover { background: var(--glass-hover); transform: translateY(-2px); box-shadow: var(--shadow-md), var(--glass-edge); }
            .calc-btn:active { transform: translateY(2px); background: var(--surface-sunk); box-shadow: var(--glass-edge); }
            .calc-btn.op { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-ring); }
            .calc-btn.op:hover { background: var(--accent-mid); }
            .calc-btn.equals { background: var(--accent); color: var(--text-on-accent); }
            .calc-btn.zero { grid-column: span 2; }
            .calc-display {
                --calc-ink: var(--text);
                --calc-screen: color-mix(in srgb, var(--accent) 12%, var(--surface));
                --calc-glow: none;
                --calc-border: var(--accent-ring);
                --calc-inactive: 0.07;
                margin: 20px 24px 0;
                padding: 14px;
                height: 84px;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                color: var(--calc-ink);
                background: var(--calc-screen);
                border: 1px solid var(--calc-border);
                border-radius: var(--radius-sm);
                box-shadow: inset 0 2px 8px var(--surface-sunk), var(--glass-edge);
                font: 26px var(--font-mono, monospace);
                overflow: hidden;
                flex-shrink: 0;
            }
            .calc-display svg {
                display: block;
                height: 42px;
                width: auto;
                filter: var(--calc-glow);
                max-width: 100%;
                fill: currentColor;
            }
            :root.theme-dark .calc-display {
                --calc-ink: color-mix(in srgb, var(--palette-blue) 65%, #b4f2ff);
                --calc-screen: color-mix(in srgb, var(--palette-blue) 10%, var(--surface));
                --calc-glow: drop-shadow(0 0 1px currentColor) drop-shadow(0 0 4px color-mix(in srgb, currentColor 30%, transparent));
                --calc-border: color-mix(in srgb, var(--calc-ink) 18%, transparent);
                --calc-inactive: 0.025;
                text-shadow: 0 0 4px var(--calc-ink);
            }
            @media (prefers-color-scheme: dark) {
                :root:not(.theme-light):not(.theme-dark) .calc-display {
                    --calc-ink: color-mix(in srgb, var(--palette-blue) 65%, #b4f2ff);
                    --calc-screen: color-mix(in srgb, var(--palette-blue) 10%, var(--surface));
                    --calc-glow: drop-shadow(0 0 1px currentColor) drop-shadow(0 0 4px color-mix(in srgb, currentColor 30%, transparent));
                    --calc-border: color-mix(in srgb, var(--calc-ink) 18%, transparent);
                    --calc-inactive: 0.025;
                    text-shadow: 0 0 4px var(--calc-ink);
                }
            }
            @media (prefers-reduced-motion: no-preference) {
                .nova-window:has(.calc-display) {
                    transition: rotate 700ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, border-color 0.3s ease;
                }
            }
        `;

        const html = `
            <div style="display:flex; flex-direction: column; height: 100%;">
                <div id="calc-display-${winId}" class="calc-display" role="status" aria-label="0">${renderLCD('0')}</div>
                <div class="calc-grid" id="calc-grid-${winId}">
                    <div class="calc-btn" data-action="clear">AC</div>
                    <div class="calc-btn" data-action="sign">+/-</div>
                    <div class="calc-btn" data-action="percent">%</div>
                    <div class="calc-btn op" data-action="/">÷</div>

                    <div class="calc-btn" data-val="7">7</div>
                    <div class="calc-btn" data-val="8">8</div>
                    <div class="calc-btn" data-val="9">9</div>
                    <div class="calc-btn op" data-action="*">×</div>

                    <div class="calc-btn" data-val="4">4</div>
                    <div class="calc-btn" data-val="5">5</div>
                    <div class="calc-btn" data-val="6">6</div>
                    <div class="calc-btn op" data-action="-">−</div>

                    <div class="calc-btn" data-val="1">1</div>
                    <div class="calc-btn" data-val="2">2</div>
                    <div class="calc-btn" data-val="3">3</div>
                    <div class="calc-btn op" data-action="+">+</div>

                    <div class="calc-btn zero" data-val="0">0</div>
                    <div class="calc-btn" data-val=".">.</div>
                    <div class="calc-btn op equals" data-action="=">=</div>
                </div>
            </div>
            <style>${calcStyle}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'calculator',
            title: 'Calculator',
            width: 320,
            height: 480,
            content: html
        });

        const handleInput = (val, action) => {
            if(val !== undefined && val !== null) {
                if(newNumber) {
                    current = val === '.' ? '0.' : val;
                    newNumber = false;
                } else {
                    if(val === '.' && current.includes('.')) return;
                    current = current === '0' && val !== '.' ? val : current + val;
                }
            } else if (action) {
                if (action === 'clear') {
                    current = '0'; previous = null; op = null; newNumber = true;
                } else if (action === 'sign') {
                    current = (parseFloat(current) * -1).toString();
                } else if (action === 'percent') {
                    current = (parseFloat(current) / 100).toString();
                } else if (action === '=') {
                    if (op && previous !== null) {
                        current = eval(`${previous} ${op} ${current}`).toString();
                        op = null;
                        previous = null;
                        newNumber = true;
                    }
                } else {
                    // operator
                    if(op && !newNumber && previous !== null) {
                        current = eval(`${previous} ${op} ${current}`).toString();
                    }
                    previous = current;
                    op = action;
                    newNumber = true;
                }
            }
            updateDisplay();
        };

        const grid = document.getElementById(`calc-grid-${winId}`);
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.calc-btn');
            if(!btn) return;
            handleInput(btn.dataset.val, btn.dataset.action);
        });

        const handleKeydown = (e) => {
            if (WindowManager.activeWindowId !== winId) return;
            let action = null;
            let val = null;

            if (e.key >= '0' && e.key <= '9') val = e.key;
            if (e.key === '.') val = '.';
            if (e.key === 'Escape') action = 'clear';
            if (e.key === 'Backspace') {
                if (!newNumber && current.length > 0) {
                    current = current.slice(0, -1);
                    if (current === '' || current === '-') current = '0';
                    updateDisplay();
                }
                return;
            }
            if (e.key === 'Enter' || e.key === '=') action = '=';
            if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') action = e.key;
            if (e.key === '%') action = 'percent';

            if (val !== null || action !== null) {
                e.preventDefault();
                handleInput(val, action);
            }
        };

        document.addEventListener('keydown', handleKeydown);

        const winObj = WindowManager.windows.get(winId);
        if(winObj) {
            const originalCleanup = winObj.cleanup;
            winObj.cleanup = () => {
                if (originalCleanup) originalCleanup();
                document.removeEventListener('keydown', handleKeydown);
            };
        }
    }
});
