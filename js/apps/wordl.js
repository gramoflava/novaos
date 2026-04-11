Apps.register({
    id: 'wordl',
    name: 'Wordl',
    iconId: 'wordl',
    category: 'games',
    keepInDock: true,
    launch: async () => {
        const winId = 'wordl-' + Date.now();
        
        const style = `
            .wl-wrap { display: flex; flex-direction: column; height: 100%; color: var(--text-primary); font-family: var(--font-sans); }
            .wl-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--border-glass); }
            .wl-title { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
            .wl-controls { display: flex; gap: 8px; align-items: center; }
            .wl-btn { background: rgba(128,128,128,0.1); border: 1px solid var(--border-glass); color: var(--text-primary); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.2s; }
            .wl-btn:hover { background: rgba(128,128,128,0.2); }
            .wl-score-wrap { background: rgba(128,128,128,0.1); padding: 4px 12px; border-radius: 6px; text-align: right; }
            
            .wl-board-wrap { flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 16px; }
            .wl-board { display: grid; gap: 6px; }
            .wl-row { display: grid; gap: 6px; }
            .wl-cell { width: var(--cell-size, 50px); height: var(--cell-size, 50px); border: 2px solid rgba(128,128,128,0.2); border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: calc(var(--cell-size, 50px) * 0.45); font-weight: 700; text-transform: uppercase; transition: all 0.3s ease; }
            .wl-cell.filled { border-color: rgba(128,128,128,0.5); }
            .wl-cell.correct { background-color: #22C55E; border-color: #22C55E; color: #fff; }
            .wl-cell.present { background-color: #EAB308; border-color: #EAB308; color: #fff; }
            .wl-cell.absent { background-color: #4B5563; border-color: #4B5563; color: #fff; }
            .wl-cell.shaking { animation: shake 0.4s; }
            .wl-cell.flipping { animation: flip 0.6s ease; }
            
            .wl-keyboard { padding: 16px; display: flex; flex-direction: column; gap: 6px; align-items: center; border-top: 1px solid var(--border-glass); background: rgba(0,0,0,0.1); }
            .wl-kb-row { display: flex; gap: 6px; }
            .wl-kb-key { background: rgba(128,128,128,0.2); border: none; color: var(--text-primary); font-family: var(--font-sans); font-size: 14px; font-weight: 600; padding: 12px 10px; border-radius: 4px; cursor: pointer; text-transform: uppercase; transition: background 0.2s; min-width: 32px; display: flex; justify-content: center; align-items: center; }
            .wl-kb-key.large { min-width: 50px; font-size: 13px; }
            .wl-kb-key:hover { background: rgba(128,128,128,0.3); }
            .wl-kb-key.correct { background-color: #22C55E; color: #fff; }
            .wl-kb-key.present { background-color: #EAB308; color: #fff; }
            .wl-kb-key.absent { background-color: #374151; color: #9CA3AF; }
            
            .wl-loading { position: absolute; inset: 0; background: var(--bg-glass); display: flex; justify-content: center; align-items: center; font-weight: 600; z-index: 100; backdrop-filter: blur(8px); }
            
            @keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }
            @keyframes flip { 0% { transform: rotateX(0); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
        `;

        const html = `
            <div class="wl-wrap" id="wl-wrap-${winId}">
                <div class="wl-header">
                    <div class="wl-title">Wordl</div>
                    <div class="wl-controls">
                        <select id="wl-len-${winId}" class="wl-btn">
                            <option value="4">4 Letters</option>
                            <option value="5" selected>5 Letters</option>
                            <option value="6">6 Letters</option>
                            <option value="7">7 Letters</option>
                        </select>
                        <button class="wl-btn" id="wl-restart-${winId}">Restart</button>
                    </div>
                </div>
                
                <div class="wl-board-wrap">
                    <div class="wl-board" id="wl-board-${winId}"></div>
                </div>
                
                <div class="wl-keyboard" id="wl-keyboard-${winId}">
                    <div class="wl-kb-row">
                        <button class="wl-kb-key" data-key="q">Q</button>
                        <button class="wl-kb-key" data-key="w">W</button>
                        <button class="wl-kb-key" data-key="e">E</button>
                        <button class="wl-kb-key" data-key="r">R</button>
                        <button class="wl-kb-key" data-key="t">T</button>
                        <button class="wl-kb-key" data-key="y">Y</button>
                        <button class="wl-kb-key" data-key="u">U</button>
                        <button class="wl-kb-key" data-key="i">I</button>
                        <button class="wl-kb-key" data-key="o">O</button>
                        <button class="wl-kb-key" data-key="p">P</button>
                    </div>
                    <div class="wl-kb-row">
                        <button class="wl-kb-key" data-key="a">A</button>
                        <button class="wl-kb-key" data-key="s">S</button>
                        <button class="wl-kb-key" data-key="d">D</button>
                        <button class="wl-kb-key" data-key="f">F</button>
                        <button class="wl-kb-key" data-key="g">G</button>
                        <button class="wl-kb-key" data-key="h">H</button>
                        <button class="wl-kb-key" data-key="j">J</button>
                        <button class="wl-kb-key" data-key="k">K</button>
                        <button class="wl-kb-key" data-key="l">L</button>
                    </div>
                    <div class="wl-kb-row">
                        <button class="wl-kb-key large" data-key="Enter">ENTER</button>
                        <button class="wl-kb-key" data-key="z">Z</button>
                        <button class="wl-kb-key" data-key="x">X</button>
                        <button class="wl-kb-key" data-key="c">C</button>
                        <button class="wl-kb-key" data-key="v">V</button>
                        <button class="wl-kb-key" data-key="b">B</button>
                        <button class="wl-kb-key" data-key="n">N</button>
                        <button class="wl-kb-key" data-key="m">M</button>
                        <button class="wl-kb-key large" data-key="Backspace">DEL</button>
                    </div>
                </div>
                
                <div id="wl-loading-${winId}" class="wl-loading">Loading Dictionary...</div>
            </div>
            <style>${style}</style>
        `;

        WindowManager.create({
            id: winId,
            appId: 'wordl',
            title: 'Wordl',
            width: 480,
            height: 720,
            content: html
        });

        const gWin = WindowManager.windows.get(winId).el;
        let wordLength = 5;
        let targetWord = "";
        let maxGuesses = 6;
        let guesses = [];
        let currentGuess = "";
        let gameOver = false;
        let isAnimating = false;
        let startTime = Date.now();
        
        // Global Dictionary Storage
        if (!window.WordlDict) {
            window.WordlDict = { 4:[], 5:[], 6:[], 7:[], loaded: false };
            window.WordlValidSet = new Set();
        }

        const uiBoard = document.getElementById(`wl-board-${winId}`);
        const uiKeyboard = document.getElementById(`wl-keyboard-${winId}`);
        const loadingOverlay = document.getElementById(`wl-loading-${winId}`);
        
        async function loadDict() {
            if (window.WordlDict.loaded) {
                loadingOverlay.style.display = 'none';
                initGame();
                return;
            }
            try {
                loadingOverlay.style.display = 'flex';
                loadingOverlay.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; gap:12px;"><span>Evolving Lexicon...</span> <div style="width:100px; height:2px; background:rgba(255,255,255,0.2); overflow:hidden; position:relative;"><div id="wl-prog" style="position:absolute; top:0; left:0; height:100%; width:0; background:var(--accent-primary); transition:width 0.3s;"></div></div></div>';
                const prog = document.getElementById('wl-prog');

                // 1. Fetch Common Word List (20k) for Targets
                const res20k = await fetch('https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt');
                const text20k = await res20k.text();
                if (prog) prog.style.width = '30%';

                const commonWords = text20k.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 4 && w.length <= 7);
                commonWords.forEach(w => {
                    window.WordlDict[w.length].push(w);
                    window.WordlValidSet.add(w);
                });
                if (prog) prog.style.width = '60%';

                // 2. Fetch Massive Word List (370k) for Validation
                const resHuge = await fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt');
                const textHuge = await resHuge.text();
                if (prog) prog.style.width = '90%';

                textHuge.split('\r\n').forEach(w => {
                    const word = w.trim().toLowerCase();
                    if (word.length >= 4 && word.length <= 7) window.WordlValidSet.add(word);
                });

                window.WordlDict.loaded = true;
                loadingOverlay.style.display = 'none';
                initGame();
            } catch(e) {
                console.error('Wordl dictionary load failed', e);
                loadingOverlay.innerHTML = 'Failed to load dictionary. Please check connection.';
            }
        }

        function initGame() {
            wordLength = parseInt(document.getElementById(`wl-len-${winId}`).value);
            const list = window.WordlDict[wordLength];
            targetWord = list[Math.floor(Math.random() * list.length)];
            guesses = [];
            currentGuess = "";
            gameOver = false;
            isAnimating = false;
            startTime = Date.now();
            maxGuesses = wordLength + 1; // 5 -> 6 guesses, 6 -> 7 guesses
            
            // Calculate optimal cell size
            const maxW = 400; // Window width padding
            const maxH = 420; // Available vertical space 
            const gap = 6;
            const cellSize = Math.floor(Math.min((maxW - gap * (wordLength - 1)) / wordLength, (maxH - gap * (maxGuesses - 1)) / maxGuesses, 56));
            uiBoard.style.setProperty('--cell-size', `${cellSize}px`);

            // Render Board structure
            uiBoard.style.gridTemplateRows = `repeat(${maxGuesses}, 1fr)`;
            uiBoard.innerHTML = '';
            for(let r=0; r<maxGuesses; r++) {
                const row = document.createElement('div');
                row.className = 'wl-row';
                row.style.gridTemplateColumns = `repeat(${wordLength}, 1fr)`;
                for(let c=0; c<wordLength; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'wl-cell';
                    row.appendChild(cell);
                }
                uiBoard.appendChild(row);
            }
            
            // Reset keyboard visually
            Array.from(uiKeyboard.querySelectorAll('.wl-kb-key')).forEach(k => {
                k.classList.remove('correct', 'present', 'absent');
            });
            
            updateBoard();
        }

        function updateBoard() {
            for(let r=0; r<maxGuesses; r++) {
                const rowObj = uiBoard.children[r];
                const isCurrentRow = r === guesses.length;
                let wordToRender = r < guesses.length ? guesses[r] : '';
                if (isCurrentRow) wordToRender = currentGuess;
                
                for(let c=0; c<wordLength; c++) {
                    const cell = rowObj.children[c];
                    const letter = wordToRender[c] || '';
                    if (!cell.classList.contains('flipping')) {
                        cell.textContent = letter;
                        if (letter && isCurrentRow) cell.classList.add('filled');
                        else cell.classList.remove('filled');
                    }
                }
            }
        }

        function showMessage(msg) {
            // Reusing nova spotlight or custom flash overlay? Simple floating message overlay
            const toast = document.createElement('div');
            toast.style.position = 'absolute';
            toast.style.top = '100px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'var(--text-primary)';
            toast.style.color = 'var(--surface-base)';
            toast.style.padding = '8px 16px';
            toast.style.borderRadius = '8px';
            toast.style.fontWeight = '600';
            toast.style.zIndex = '1000';
            toast.style.opacity = '1';
            toast.style.transition = 'opacity 0.5s ease';
            toast.textContent = msg;
            document.getElementById(`wl-wrap-${winId}`).appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 1000);
        }

        async function submitGuess() {
            if (currentGuess.length < wordLength) {
                // Shake row
                const rowObj = uiBoard.children[guesses.length];
                rowObj.classList.remove('shaking');
                void rowObj.offsetWidth; // trigger reflow
                rowObj.classList.add('shaking');
                showMessage('Not enough letters');
                return;
            }
            if (!window.WordlValidSet.has(currentGuess.toLowerCase())) {
                const rowObj = uiBoard.children[guesses.length];
                rowObj.classList.remove('shaking');
                void rowObj.offsetWidth;
                rowObj.classList.add('shaking');
                showMessage('Not in word list');
                return;
            }
            
            isAnimating = true;
            const guess = currentGuess.toLowerCase();
            const target = targetWord.toLowerCase();
            guesses.push(guess);
            
            const rowIndex = guesses.length - 1;
            const rowObj = uiBoard.children[rowIndex];
            
            // Logic for colors
            let targetChars = target.split('');
            let guessChars = guess.split('');
            let result = Array(wordLength).fill('absent');
            
            // First pass: exact matches
            for(let i=0; i<wordLength; i++) {
                if (guessChars[i] === targetChars[i]) {
                    result[i] = 'correct';
                    targetChars[i] = null;
                }
            }
            // Second pass: present
            for(let i=0; i<wordLength; i++) {
                if (result[i] === 'correct') continue;
                let idx = targetChars.indexOf(guessChars[i]);
                if (idx !== -1) {
                    result[i] = 'present';
                    targetChars[idx] = null;
                }
            }

            // Animate flips
            for(let i=0; i<wordLength; i++) {
                const cell = rowObj.children[i];
                cell.classList.add('flipping');
                // flip halfway point approx 300ms
                setTimeout(() => {
                    cell.classList.remove('filled');
                    cell.classList.add(result[i]);
                    updateKeyboard(guessChars[i], result[i]);
                }, 300);
                await new Promise(r => setTimeout(r, 150)); // stagger
            }
            
            await new Promise(r => setTimeout(r, 450)); // finish animations
            Array.from(rowObj.children).forEach(c => c.classList.remove('flipping'));
            
            currentGuess = "";
            isAnimating = false;
            
            if (guess === target) {
                gameOver = true;
                handleWin();
            } else if (guesses.length >= maxGuesses) {
                gameOver = true;
                showMessage(target.toUpperCase());
                if (window.AudioMng) AudioMng.play('lose');
            } else {
                updateBoard();
            }
        }

        function updateKeyboard(letter, status) {
            const key = Array.from(uiKeyboard.querySelectorAll('.wl-kb-key')).find(k => k.dataset.key === letter);
            if (!key) return;
            
            if (status === 'correct') {
                key.classList.remove('present', 'absent');
                key.classList.add('correct');
            } else if (status === 'present') {
                if (!key.classList.contains('correct')) {
                    key.classList.remove('absent');
                    key.classList.add('present');
                }
            } else if (status === 'absent') {
                if (!key.classList.contains('correct') && !key.classList.contains('present')) {
                    key.classList.add('absent');
                }
            }
        }

        function handleWin() {
            if (window.AudioMng) AudioMng.play('win');
            
            const timeElapsed = (Date.now() - startTime) / 1000;
            // Scoring mechanism
            // Points = ((maxGuesses - guessesTaken) * base) + timeBonus
            // Base = 100. Length 5 => base 500. Length 6 => base 600.
            const base = wordLength * 100;
            const stepPoints = (maxGuesses - guesses.length + 1) * base;
            const timeBonus = Math.max(0, Math.floor(1000 - timeElapsed * 10));
            const score = stepPoints + timeBonus;
            
            showMessage('GENIUS!');
            
            if (window.NovaEffects) {
                // Individual small bursts on win as well as the global one
                NovaEffects.burst(window.innerWidth/2, window.innerHeight/2, { 
                    colors: ['#22C55E', '#EAB308', '#fff'],
                    count: 30 
                });
            }

            setTimeout(() => {
                const isHighScore = Scores.isHighScore('wordl', score);
                // Passing true for 'isWin' ensures the prompt shows "Board Cleared!" branding
                Scores.showScorePrompt('wordl', score, true, initGame, winId);
            }, 1500);
        }

        function handleKeypress(key) {
            if (gameOver || isAnimating || loadingOverlay.style.display !== 'none') return;
            
            if (key === 'Enter') {
                submitGuess();
            } else if (key === 'Backspace') {
                currentGuess = currentGuess.slice(0, -1);
                updateBoard();
            } else if (/^[a-zA-Z]$/.test(key)) {
                if (currentGuess.length < wordLength) {
                    currentGuess += key.toLowerCase();
                    updateBoard();
                }
            }
        }

        // Setup DOM events
        document.getElementById(`wl-len-${winId}`).addEventListener('change', () => {
            initGame();
        });
        document.getElementById(`wl-restart-${winId}`).addEventListener('click', () => {
            initGame();
        });
        uiKeyboard.addEventListener('click', (e) => {
            if (e.target.matches('.wl-kb-key')) {
                handleKeypress(e.target.dataset.key);
            }
        });
        
        // Global Keyboard Event
        const onGlobalKey = (e) => {
            if (WindowManager.activeWindowId === winId) {
                if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) {
                    handleKeypress(e.key);
                }
            }
        };
        document.addEventListener('keydown', onGlobalKey);
        
        // Cleanup on close
        const winObj = WindowManager.windows.get(winId);
        const originalCleanup = winObj.cleanup;
        winObj.cleanup = () => {
            if (originalCleanup) originalCleanup();
            document.removeEventListener('keydown', onGlobalKey);
        };

        // Start
        loadDict();
    }
});
