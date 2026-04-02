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
                background: rgba(255,255,255,0.03); 
                border: 1px solid var(--border-glass); 
                box-shadow: var(--shadow-inset); 
                border-radius: 12px; 
                font-size: 20px; 
                color: var(--text-primary); 
                cursor: pointer; 
                transition: all 0.2s; 
                display: flex; align-items: center; justify-content: center;
                user-select: none;
            }
            .calc-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2), var(--shadow-inset); }
            .calc-btn:active { transform: translateY(2px); background: rgba(0,0,0,0.2); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
            .calc-btn.op { background: rgba(99, 102, 241, 0.2); color: #818CF8; border-color: rgba(99, 102, 241, 0.3); }
            .calc-btn.op:hover { background: rgba(99, 102, 241, 0.3); }
            .calc-btn.zero { grid-column: span 2; }
            .calc-display { 
                padding: 32px 24px 16px; 
                text-align: right; 
                font-size: 48px; 
                font-weight: 300; 
                letter-spacing: -1px;
                border-bottom: 1px solid var(--border-glass);
                background: rgba(0,0,0,0.2);
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
                    <div class="calc-btn op" style="background:#6366F1; color:#fff;" data-action="=">=</div>
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

        const grid = document.getElementById(`calc-grid-${winId}`);
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.calc-btn');
            if(!btn) return;

            if(btn.dataset.val !== undefined) {
                const v = btn.dataset.val;
                if(newNumber) {
                    current = v === '.' ? '0.' : v;
                    newNumber = false;
                } else {
                    if(v === '.' && current.includes('.')) return;
                    current = current === '0' && v !== '.' ? v : current + v;
                }
            } else if (btn.dataset.action) {
                const a = btn.dataset.action;
                if (a === 'clear') {
                    current = '0'; previous = null; op = null; newNumber = true;
                } else if (a === 'sign') {
                    current = (parseFloat(current) * -1).toString();
                } else if (a === 'percent') {
                    current = (parseFloat(current) / 100).toString();
                } else if (a === '=') {
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
                    op = a;
                    newNumber = true;
                }
            }
            updateDisplay();
        });
    }
});
