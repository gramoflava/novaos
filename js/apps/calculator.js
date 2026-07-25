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

        const updateDisplay = () => {
            const disp = document.getElementById(`calc-display-${winId}`);
            if (disp) {
                // Formatting for length
                let displayVal = current;
                if(displayVal.length > 10) {
                    displayVal = parseFloat(displayVal).toPrecision(10);
                }
                disp.textContent = displayVal;
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
                padding: 32px 24px 16px;
                text-align: right;
                font-size: 48px;
                font-weight: 300;
                letter-spacing: -1px;
                border-bottom: 1px solid var(--line);
                background: var(--surface-sunk);
            }
        `;

        const html = `
            <div style="display:flex; flex-direction: column; height: 100%;">
                <div id="calc-display-${winId}" class="calc-display">0</div>
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
