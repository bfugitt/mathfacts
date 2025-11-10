/*
 * MATH FACT UNIVERSE - APP.JS
 * This file contains all JavaScript logic for the combined application.
 * It uses a modular structure to separate logic for each game mode.
 */

// Wait for the entire page to load before running any script
window.onload = () => {
    // Ensure Tone.js context is started on any user interaction
    // (This is required by modern browsers)
    const startAudio = () => {
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
        document.body.removeEventListener('click', startAudio);
        document.body.removeEventListener('keydown', startAudio);
    };
    document.body.addEventListener('click', startAudio);
    document.body.addEventListener('keydown', startAudio);

    // Start the application by showing the first screen
    App.renderGradeSelect();
};

// --- 1. GLOBAL STATE & CONFIGURATION ---

// Central configuration for each grade level
const GRADE_CONFIG = {
    1: { name: '1st Grade', ops: ['+', '-'], maxAddend: 10, maxFactor: 0, targetScore: 20 },
    2: { name: '2nd Grade', ops: ['+', '-'], maxAddend: 20, maxFactor: 0, targetScore: 30 },
    3: { name: '3rd Grade', ops: ['+', '-', '*', '/'], maxAddend: 20, maxFactor: 10, targetScore: 40 },
    4: { name: '4th Grade', ops: ['+', '-', '*', '/'], maxAddend: 20, maxFactor: 12, targetScore: 50 },
    5: { name: '5th Grade', ops: ['+', '-', '*', '/'], maxAddend: 50, maxFactor: 12, targetScore: 50 },
    6: { name: '6th Grade', ops: ['+', '-', '*', '/'], maxAddend: 100, maxFactor: 20, targetScore: 60 },
    7: { name: '7th Grade', ops: ['+', '-', '*', '/'], maxAddend: 100, maxFactor: 30, targetScore: 60 },
    8: { name: '8th Grade', ops: ['+', '-', '*', '/'], maxAddend: 100, maxFactor: 50, targetScore: 60 }
};

// Central DOM element references
const screenContainer = document.getElementById('screenContainer');
const appTitle = document.getElementById('appTitle');

// --- 2. SHARED UTILITIES ---

/** Sound effect synthesizers (centralized) */
const correctSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" } }).toDestination();
const incorrectSynth = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
const duelWinSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" } }).toDestination();

/** Plays a "correct answer" sound. */
function playCorrectSound() {
    if (Tone.context.state !== 'running') return;
    correctSynth.triggerAttackRelease(["C5", "E5", "G5"], "8n");
}

/** Plays an "incorrect answer" sound. */
function playIncorrectSound() {
    if (Tone.context.state !== 'running') return;
    incorrectSynth.triggerAttackRelease("16n");
}

/** Plays a "duel win" sound. */
function playDuelWinSound() {
    if (Tone.context.state !== 'running') return;
    duelWinSynth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "4n");
}

/**
 * Formats an operator symbol for display.
 * @param {string} op The operator (+, -, *, /)
 * @returns {string} The display-friendly symbol (x, ÷)
 */
function formatOp(op) {
    if (op === '*') return 'x';
    if (op === '/') return '÷';
    return op;
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffles an array in place (Fisher-Yates algorithm).
 * @param {Array} array The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Creates a "Go Back" button that returns to the mode select screen.
 * @returns {string} HTML string for the back button.
 */
function getBackButton() {
    return `<button id="goBack" class="btn btn-gray mt-6">Back to Mode Select</button>`;
}

/**
 * Creates a "Main Menu" button that returns to the grade select screen.
 * @returns {string} HTML string for the main menu button.
 */
function getMainMenuButton() {
    return `<button id="goMainMenu" class="btn btn-gray mt-6">Main Menu</button>`;
}

/**
 * Attaches click listener for the "Go Back" button.
 */
function attachBackButtonListener(grade) {
    document.getElementById('goBack')?.addEventListener('click', () => {
        App.renderModeSelect(grade);
    });
}

/**
 * Attaches click listener for the "Main Menu" button.
 */
function attachMainMenuButtonListener() {
    document.getElementById('goMainMenu')?.addEventListener('click', () => {
        App.renderGradeSelect();
    });
}


// --- 3. MAIN APP NAVIGATION (THE "ROUTER") ---

const App = {
    currentGrade: 0,

    /** Renders the initial screen to select a grade. */
    renderGradeSelect: () => {
        appTitle.textContent = 'Select Your Grade';
        let buttonsHTML = Object.keys(GRADE_CONFIG).map(grade => {
            return `<button class="btn btn-indigo grade-btn" data-grade="${grade}">
                ${GRADE_CONFIG[grade].name}
            </button>`;
        }).join('');

        screenContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                ${buttonsHTML}
            </div>`;

        // Add event listeners to the new buttons
        document.querySelectorAll('.grade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                App.currentGrade = parseInt(e.target.dataset.grade);
                App.renderModeSelect(App.currentGrade); // Go to the next screen
            });
        });
    },

    /** Renders the screen to select a game mode for the chosen grade. */
    renderModeSelect: (grade) => {
        appTitle.textContent = `Grade ${grade} - Select Mode`;
        screenContainer.innerHTML = `
            <button id="startPractice" class="btn btn-green">
                🎯 Practice
            </button>
            <button id="startMaster" class="btn btn-blue">
                ⭐ Master Test (1-Min)
            </button>
            <button id="startDuel" class="btn btn-red">
                ⚔️ Facts Duel
            </button>
            <button id="goBackToGrade" class="btn btn-gray mt-6">
                Back to Grade Select
            </button>
        `;

        // Add event listeners
        document.getElementById('startPractice').addEventListener('click', () => PracticeMode.start(GRADE_CONFIG[grade]));
        document.getElementById('startMaster').addEventListener('click', () => MasterMode.start(GRADE_CONFIG[grade]));
        document.getElementById('startDuel').addEventListener('click', () => DuelMode.start(GRADE_CONFIG[grade]));
        document.getElementById('goBackToGrade').addEventListener('click', App.renderGradeSelect);
    }
};


// --- 4. PRACTICE MODE MODULE ---
// (Logic combined from primary_facts_v4.html and elementary_facts_v1.html)
const PracticeMode = {
    // State variables for this mode
    gradeConfig: null,
    score: 0,
    attempted: 0,
    problemHistory: [],
    currentProblem: null,
    isMultipleChoice: false,
    useTimer: false,
    gameTimer: 60,
    gameInterval: null,
    isCoolingDown: false,
    COOLDOWN_TIME: 2500, // 2.5 second penalty

    /** Starts the practice mode (shows setup screen) */
    start: (gradeConfig) => {
        PracticeMode.gradeConfig = gradeConfig;
        PracticeMode.renderSetupScreen();
    },

    /** Renders the setup screen for Practice Mode */
    renderSetupScreen: () => {
        appTitle.textContent = 'Practice Setup';
        
        // Only show operations available for that grade
        const opsCheckboxes = PracticeMode.gradeConfig.ops.map(op => `
            <div class="flex items-center justify-center">
                <input id="op-${op}" type="checkbox" checked class="form-checkbox h-5 w-5 text-indigo-600" value="${op}">
                <label for="op-${op}" class="ml-2 text-2xl font-bold">${op}</label>
            </div>
        `).join('');

        screenContainer.innerHTML = `
            <div class="space-y-6">
                <div class="text-center">
                    <label class="text-lg font-medium text-gray-700">Operations to practice:</label>
                    <div class="flex justify-center space-x-6 mt-2">
                        ${opsCheckboxes}
                    </div>
                </div>
                
                <div class="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                    <label for="mcToggle" class="text-lg font-medium text-gray-700">Multiple Choice</label>
                    <input type="checkbox" id="mcToggle" class="toggle-checkbox hidden" />
                    <label for="mcToggle" class="toggle-label"></label>
                </div>
                
                <div class="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                    <label for="timerToggle" class="text-lg font-medium text-gray-700">1-Minute Timer</label>
                    <input type="checkbox" id="timerToggle" class="toggle-checkbox hidden" />
                    <label for="timerToggle" class="toggle-label"></label>
                </div>

                <button id="startPracticeGame" class="btn btn-green">Start Practice</button>
                ${getBackButton()}
            </div>
        `;

        // Add event listeners
        document.getElementById('startPracticeGame').addEventListener('click', () => {
            const selectedOps = Array.from(document.querySelectorAll('.form-checkbox:checked')).map(cb => cb.value);
            if (selectedOps.length === 0) {
                alert("Please select at least one operation.");
                return;
            }
            // Update gradeConfig to only use selected ops
            PracticeMode.gradeConfig.selectedOps = selectedOps;
            PracticeMode.isMultipleChoice = document.getElementById('mcToggle').checked;
            PracticeMode.useTimer = document.getElementById('timerToggle').checked;
            
            PracticeMode.renderGameScreen();
        });
        attachBackButtonListener(App.currentGrade);
    },

    /** Renders the main game screen for Practice Mode */
    renderGameScreen: () => {
        // Reset state
        PracticeMode.score = 0;
        PracticeMode.attempted = 0;
        PracticeMode.problemHistory = [];
        PracticeMode.gameTimer = 60;
        if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);

        appTitle.textContent = 'Practice!';
        
        screenContainer.innerHTML = `
            <div class="text-center space-y-4">
                <div class="flex justify-between items-center text-xl font-semibold">
                    <div id="scoreDisplay" class="text-green-600">Score: 0</div>
                    <div id="timerDisplay" class="text-gray-700 ${PracticeMode.useTimer ? '' : 'hidden'}">Time: 60s</div>
                    <div id="attemptsDisplay" class="text-blue-600">Attempted: 0</div>
                </div>
                
                <div id="problemDisplay" class="text-6xl md:text-7xl font-bold text-gray-800 my-8 p-6 bg-gray-100 rounded-lg">
                    <!-- Problem will be injected here -->
                </div>
                
                <!-- Helper text for showing correct answer on text input -->
                <div id="helperTextDisplay" class="text-2xl font-bold text-green-600 h-8"></div>
                
                <div id="answerContainer">
                    <!-- Answer input or buttons will be injected here -->
                </div>
                
                <button id="endGameEarly" class="btn btn-gray">End Session</button>
            </div>
        `;
        
        document.getElementById('endGameEarly').addEventListener('click', PracticeMode.endGame);
        
        if (PracticeMode.useTimer) {
            PracticeMode.gameInterval = setInterval(PracticeMode.updateTimer, 1000);
        }
        
        PracticeMode.nextProblem();
    },

    /** Updates the game timer */
    updateTimer: () => {
        PracticeMode.gameTimer--;
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = `Time: ${PracticeMode.gameTimer}s`;
            if (PracticeMode.gameTimer <= 10) {
                timerDisplay.classList.add('text-red-700', 'animate-pulse');
            }
            if (PracticeMode.gameTimer <= 0) {
                PracticeMode.endGame();
            }
        }
    },

    /** Ends the game and shows results */
    endGame: () => {
        if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
        PracticeMode.renderResults();
    },

    /** Generates and displays the next problem */
    nextProblem: () => {
        if (PracticeMode.isCoolingDown) return; // Don't load new problem during penalty
        
        const { n1, n2, op, answer } = PracticeMode.generateProblem();
        PracticeMode.currentProblem = { n1, n2, op, answer };

        const problemDisplay = document.getElementById('problemDisplay');
        const answerContainer = document.getElementById('answerContainer');
        const helperText = document.getElementById('helperTextDisplay');
        
        if (!problemDisplay || !answerContainer || !helperText) return; // Screen not visible

        problemDisplay.textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        helperText.textContent = ''; // Clear helper text

        if (PracticeMode.isMultipleChoice) {
            const choices = PracticeMode.generateChoices(answer);
            answerContainer.innerHTML = `
                <div class="grid grid-cols-2 gap-4 mt-4">
                    ${choices.map(choice => `
                        <button class="choice-button btn btn-indigo text-3xl">${choice}</button>
                    `).join('')}
                </div>`;
            
            document.querySelectorAll('.choice-button').forEach(btn => {
                btn.addEventListener('click', () => PracticeMode.checkAnswer(btn.textContent));
            });
        } else {
            answerContainer.innerHTML = `
                <input type="number" id="answerInput" class="text-center text-4xl font-bold p-4 w-full max-w-xs mx-auto border-4 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none" autofocus />
            `;
            const input = document.getElementById('answerInput');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value !== '') {
                    PracticeMode.checkAnswer(input.value);
                }
            });
            input.focus();
        }
    },

    /** Generates a new problem based on settings */
    generateProblem: () => {
        const { maxAddend, maxFactor } = PracticeMode.gradeConfig;
        const op = PracticeMode.gradeConfig.selectedOps[getRandomInt(0, PracticeMode.gradeConfig.selectedOps.length - 1)];
        let n1, n2, answer;

        switch (op) {
            case '+':
                n1 = getRandomInt(0, maxAddend);
                n2 = getRandomInt(0, maxAddend);
                answer = n1 + n2;
                break;
            case '-':
                n1 = getRandomInt(0, maxAddend);
                n2 = getRandomInt(0, n1); // Ensure non-negative answer
                answer = n1 - n2;
                break;
            case '*':
                n1 = getRandomInt(0, maxFactor);
                n2 = getRandomInt(0, maxFactor);
                answer = n1 * n2;
                break;
            case '/':
                // Ensure divisible, non-zero denominator
                n2 = getRandomInt(1, maxFactor);
                n1 = n2 * getRandomInt(0, maxFactor);
                answer = n1 / n2;
                break;
        }
        return { n1, n2, op, answer };
    },

    /** Generates multiple-choice options */
    generateChoices: (correctAnswer) => {
        let choices = new Set([correctAnswer]);
        while (choices.size < 4) {
            let offset = getRandomInt(1, 5);
            choices.add(Math.max(0, correctAnswer - offset));
            if (choices.size < 4) {
                choices.add(correctAnswer + offset);
            }
        }
        let choiceArray = Array.from(choices);
        shuffleArray(choiceArray);
        return choiceArray;
    },

    /** Checks the user's answer */
    checkAnswer: (userAnswer) => {
        if (PracticeMode.isCoolingDown) return; // Ignore input during penalty

        const isCorrect = parseInt(userAnswer) === PracticeMode.currentProblem.answer;
        const input = document.getElementById('answerInput');
        
        PracticeMode.attempted++;
        PracticeMode.problemHistory.push({ ...PracticeMode.currentProblem, userAnswer, isCorrect });

        if (isCorrect) {
            playCorrectSound();
            PracticeMode.score++;
            
            if (input && !PracticeMode.isMultipleChoice) {
                input.classList.add('correct-flash');
                setTimeout(() => {
                    input.classList.remove('correct-flash');
                    PracticeMode.nextProblem();
                }, 200);
            } else if (PracticeMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    btn.disabled = true;
                    if (parseInt(btn.textContent) === PracticeMode.currentProblem.answer) {
                        btn.classList.add('correct-flash'); // Show correct
                    }
                });
                setTimeout(PracticeMode.nextProblem, 200);
            }
        } else {
            playIncorrectSound();
            PracticeMode.isCoolingDown = true; // Start penalty
            
            if (PracticeMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    btn.disabled = true;
                    const btnValue = parseInt(btn.textContent);
                    if (btnValue === PracticeMode.currentProblem.answer) {
                        btn.classList.add('correct-flash'); // Show correct
                    }
                    if (btnValue === parseInt(userAnswer)) {
                        btn.classList.add('incorrect-flash'); // Show wrong
                    }
                });
            } else if (input) {
                input.disabled = true;
                input.classList.add('incorrect-flash');
                // Show the correct answer
                document.getElementById('helperTextDisplay').textContent = `Answer: ${PracticeMode.currentProblem.answer}`;
            }

            // Set the cooldown timer
            setTimeout(() => {
                PracticeMode.isCoolingDown = false;
                
                if (!PracticeMode.isMultipleChoice && input) {
                     input.classList.remove('incorrect-flash');
                     input.disabled = false;
                }
                PracticeMode.nextProblem();
            }, PracticeMode.COOLDOWN_TIME);
        }
        
        document.getElementById('scoreDisplay').textContent = `Score: ${PracticeMode.score}`;
        document.getElementById('attemptsDisplay').textContent = `Attempted: ${PracticeMode.attempted}`;
    },

    /** Renders the results screen */
    renderResults: () => {
        appTitle.textContent = 'Practice Results';
        const accuracy = PracticeMode.attempted > 0 ? ((PracticeMode.score / PracticeMode.attempted) * 100).toFixed(0) : 0;
        
        screenContainer.innerHTML = `
            <div class="text-center space-y-4">
                <h2 class="text-3xl font-bold">Session Over!</h2>
                <div class="text-2xl">
                    You scored <strong class="text-green-600">${PracticeMode.score}</strong> with
                    <strong class="text-blue-600">${accuracy}%</strong> accuracy.
                </div>
                <div class_text-lg">
                    Total Correct: ${PracticeMode.score} <br>
                    Total Attempted: ${PracticeMode.attempted}
                </div>
                
                <button id="practiceAgain" class="btn btn-green">Practice Again</button>
                ${getMainMenuButton()}
            </div>
        `;
        
        document.getElementById('practiceAgain').addEventListener('click', PracticeMode.renderSetupScreen);
        attachMainMenuButtonListener();
    }
};


// --- 5. MASTER MODE MODULE ---
// (Logic from facts_master_v6.html)
const MasterMode = {
    // State variables
    gradeConfig: null,
    score: 0,
    timer: 60,
    problemHistory: [],
    currentProblem: null,
    gameInterval: null,
    isCoolingDown: false,
    COOLDOWN_TIME: 2500, // 2.5 second penalty
    isMultipleChoice: true, // Master mode is always multiple choice

    /** Starts the Master Mode */
    start: (gradeConfig) => {
        MasterMode.gradeConfig = gradeConfig;
        
        // Reset state
        MasterMode.score = 0;
        MasterMode.timer = 60;
        MasterMode.problemHistory = [];
        if (MasterMode.gameInterval) clearInterval(MasterMode.gameInterval);
        
        MasterMode.renderGame();
        MasterMode.startTimer();
        MasterMode.nextProblem();
    },

    /** Renders the game screen for Master Mode */
    renderGame: () => {
        appTitle.textContent = 'Master Test';
        const { targetScore } = MasterMode.gradeConfig;
        
        screenContainer.innerHTML = `
            <div class="text-center space-y-4">
                <div class="flex justify-between items-center text-xl font-semibold">
                    <div id="scoreDisplay" class="text-green-600">Score: 0</div>
                    <div id="timerDisplay" class="text-blue-600">Time: 60s</div>
                </div>
                
                <div class="progress-bar-container w-full">
                    <div id="scoreProgress" class="progress-bar" style="width: 0%;"></div>
                </div>
                <div class="text-sm text-gray-600">Target Score: ${targetScore}</div>
                
                <div id="problemDisplay" class="text-6xl md:text-7xl font-bold text-gray-800 my-8 p-6 bg-gray-100 rounded-lg">
                    <!-- Problem will be injected here -->
                </div>
                
                <!-- Helper text for showing correct answer (though not used in MC) -->
                <div id="helperTextDisplay" class="text-2xl font-bold text-green-600 h-8"></div>
                
                <div id="answerContainer" class="grid grid-cols-2 gap-4 mt-4">
                    <!-- Answer buttons will be injected here -->
                </div>
                ${getBackButton()}
            </div>
        `;
        
        attachBackButtonListener(App.currentGrade);
    },

    /** Starts the 60-second timer */
    startTimer: () => {
        MasterMode.gameInterval = setInterval(() => {
            MasterMode.timer--;
            MasterMode.updateTimerDisplay();
            if (MasterMode.timer <= 0) {
                MasterMode.endGame();
            }
        }, 1000);
    },

    /** Ends the game and shows results */
    endGame: () => {
        clearInterval(MasterMode.gameInterval);
        MasterMode.renderResults();
    },

    /** Generates and displays the next problem */
    nextProblem: () => {
        if (MasterMode.isCoolingDown) return;

        const { n1, n2, op, answer } = MasterMode.generateProblem();
        MasterMode.currentProblem = { n1, n2, op, answer };
        
        const problemDisplay = document.getElementById('problemDisplay');
        const answerContainer = document.getElementById('answerContainer');
        const helperText = document.getElementById('helperTextDisplay');
        if (!problemDisplay || !answerContainer || !helperText) return; // Game ended

        problemDisplay.textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        helperText.textContent = ''; // Clear helper text
        
        const choices = MasterMode.generateChoices(answer);
        answerContainer.innerHTML = `
            ${choices.map(choice => `
                <button class="choice-button btn btn-indigo text-3xl">${choice}</button>
            `).join('')}
        `;
        
        document.querySelectorAll('.choice-button').forEach(btn => {
            btn.addEventListener('click', () => MasterMode.checkAnswer(btn.textContent));
        });
    },

    /** Generates a new problem (uses same logic as Practice Mode) */
    generateProblem: () => {
        const { maxAddend, maxFactor, ops } = MasterMode.gradeConfig;
        const op = ops[getRandomInt(0, ops.length - 1)];
        let n1, n2, answer;

        switch (op) {
            case '+':
                n1 = getRandomInt(0, maxAddend);
                n2 = getRandomInt(0, maxAddend);
                answer = n1 + n2;
                break;
            case '-':
                n1 = getRandomInt(0, maxAddend);
                n2 = getRandomInt(0, n1); // Ensure non-negative answer
                answer = n1 - n2;
                break;
            case '*':
                n1 = getRandomInt(0, maxFactor);
                n2 = getRandomInt(0, maxFactor);
                answer = n1 * n2;
                break;
            case '/':
                n2 = getRandomInt(1, maxFactor);
                n1 = n2 * getRandomInt(0, maxFactor);
                answer = n1 / n2;
                break;
        }
        return { n1, n2, op, answer };
    },

    /** Generates multiple-choice options (uses same logic as Practice Mode) */
    generateChoices: (correctAnswer) => {
        let choices = new Set([correctAnswer]);
        while (choices.size < 4) {
            let offset = getRandomInt(1, 5);
            choices.add(Math.max(0, correctAnswer - offset));
            if (choices.size < 4) {
                choices.add(correctAnswer + offset);
            }
        }
        let choiceArray = Array.from(choices);
        shuffleArray(choiceArray);
        return choiceArray;
    },

    /** Checks the user's answer */
    checkAnswer: (userAnswer) => {
        if (MasterMode.isCoolingDown) return;

        const isCorrect = parseInt(userAnswer) === MasterMode.currentProblem.answer;
        MasterMode.problemHistory.push({ ...MasterMode.currentProblem, userAnswer, isCorrect });
        
        MasterMode.isCoolingDown = true; // Block input immediately
        const buttons = document.querySelectorAll('.choice-button');

        buttons.forEach(btn => {
            btn.disabled = true;
            const btnValue = parseInt(btn.textContent);
            if (btnValue === MasterMode.currentProblem.answer) {
                btn.classList.add('correct-flash'); // Always show correct answer
            }
            if (!isCorrect && btnValue === parseInt(userAnswer)) {
                btn.classList.add('incorrect-flash'); // Show user's wrong answer
            }
        });

        if (isCorrect) {
            playCorrectSound();
            MasterMode.score++;
            MasterMode.updateScoreDisplay();
            setTimeout(() => {
                MasterMode.isCoolingDown = false;
                MasterMode.nextProblem();
            }, 200); // Quick transition
        } else {
            playIncorrectSound();
            // No score penalty, just time penalty
            setTimeout(() => {
                MasterMode.isCoolingDown = false;
                MasterMode.nextProblem();
            }, MasterMode.COOLDOWN_TIME);
        }
    },

    /** Updates the score display and progress bar */
    updateScoreDisplay: () => {
        const scoreDisplay = document.getElementById('scoreDisplay');
        if (scoreDisplay) {
            scoreDisplay.textContent = `Score: ${MasterMode.score}`;
        }
        const progress = document.getElementById('scoreProgress');
        if (progress) {
            const { targetScore } = MasterMode.gradeConfig;
            const percent = Math.min(100, (MasterMode.score / targetScore) * 100);
            progress.style.width = `${percent}%`;
        }
    },

    /** Updates the timer display */
    updateTimerDisplay: () => {
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = `Time: ${MasterMode.timer}s`;
            if (MasterMode.timer <= 10) {
                timerDisplay.classList.add('text-red-700', 'animate-pulse');
            }
        }
    },

    /** Renders the results screen */
    renderResults: () => {
        appTitle.textContent = 'Test Results';
        const { targetScore } = MasterMode.gradeConfig;
        const passed = MasterMode.score >= targetScore;
        const accuracy = MasterMode.problemHistory.length > 0 ? ((MasterMode.score / MasterMode.problemHistory.length) * 100).toFixed(0) : 0;
        
        screenContainer.innerHTML = `
            <div class="text-center space-y-4">
                <h2 class="text-4xl font-extrabold ${passed ? 'text-green-600' : 'text-red-600'}">
                    ${passed ? 'Level Mastered!' : 'Try Again!'}
                </h2>
                <div class="text-2xl">
                    You scored <strong class="text-blue-600">${MasterMode.score}</strong>
                    (Target: ${targetScore})
                </div>
                <div class="text-lg">
                    Accuracy: ${accuracy}%
                </div>
                
                <button id="tryAgain" class="btn btn-blue">Try Again</button>
                ${getMainMenuButton()}
            </div>
        `;
        
        document.getElementById('tryAgain').addEventListener('click', () => MasterMode.start(MasterMode.gradeConfig));
        attachMainMenuButtonListener();
    }
};


// --- 6. DUEL MODE MODULE ---
// (Logic from facts_battle_v4.html)
const DuelMode = {
    // State
    gradeConfig: null,
    settings: {},
    timer: 60,
    gameInterval: null,
    player1: null,
    player2: null,
    
    /** Starts Duel Mode (shows setup screen) */
    start: (gradeConfig) => {
        DuelMode.gradeConfig = gradeConfig;
        DuelMode.renderSetupScreen();
    },

    /** Renders setup screen for Duel Mode */
    renderSetupScreen: () => {
        appTitle.textContent = 'Duel Setup';
        const { maxAddend, maxFactor } = DuelMode.gradeConfig;
        const newMaxAdd = 50;
        const newMaxFact = 20;
        const defaultAdd = Math.min(maxAddend, newMaxAdd);
        const defaultFact = Math.min(maxFactor > 0 ? maxFactor : 12, newMaxFact);

        screenContainer.innerHTML = `
            <div class="space-y-6">
                <div class="text-center">
                    <label class="text-lg font-medium text-gray-700">Operations:</label>
                    <div class="flex justify-center space-x-6 mt-2">
                        ${DuelMode.gradeConfig.ops.map(op => `
                            <div class="flex items-center justify-center">
                                <input id="op-${op}" type="checkbox" checked class="form-checkbox h-5 w-5 text-indigo-600" value="${op}">
                                <label for="op-${op}" class="ml-2 text-2xl font-bold">${op}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="space-y-2">
                    <label for="maxAdd" class="flex justify-between text-lg font-medium text-gray-700">
                        Max Addend/Subtrahend: <span id="maxAddValue">${defaultAdd}</span>
                    </label>
                    <input type="range" id="maxAdd" min="10" max="${newMaxAdd}" value="${defaultAdd}" class="w-full">
                </div>
                
                <div class="space-y-2">
                    <label for="maxFact" class="flex justify-between text-lg font-medium text-gray-700">
                        Max Factor (Multiply/Divide): <span id="maxFactValue">${defaultFact}</span>
                    </label>
                    <input type="range" id="maxFact" min="5" max="${newMaxFact}" value="${defaultFact}" class="w-full">
                </div>
                
                <div class="space-y-2">
                    <label for="maxFact" class="flex justify-between text-lg font-medium text-gray-700">
                        Max Factor (Multiply/Divide): <span id="maxFactValue">${maxFactor > 0 ? maxFactor : 12}</span>
                    </label>
                    <input type="range" id="maxFact" min="5" max="50" value="${maxFactor > 0 ? maxFactor : 12}" class="w-full">
                </div>
                
                <div class="space-y-2">
                    <label for="timerSet" class="flex justify-between text-lg font-medium text-gray-700">
                        Game Time: <span id="timerValue">60</span>s
                    </label>
                    <input type="range" id="timerSet" min="30" max="120" value="60" step="15" class="w-full">
                </div>

                <button id="startDuelGame" class="btn btn-red">Start Duel!</button>
                ${getBackButton()}
            </div>
        `;

        // Event listeners for sliders
        document.getElementById('maxAdd').addEventListener('input', e => {
            document.getElementById('maxAddValue').textContent = e.target.value;
        });
        document.getElementById('maxFact').addEventListener('input', e => {
            document.getElementById('maxFactValue').textContent = e.target.value;
        });
        document.getElementById('timerSet').addEventListener('input', e => {
            document.getElementById('timerValue').textContent = e.target.value;
        });
        
        // Event listener for start
        document.getElementById('startDuelGame').addEventListener('click', () => {
            const selectedOps = Array.from(document.querySelectorAll('.form-checkbox:checked')).map(cb => cb.value);
            if (selectedOps.length === 0) {
                alert("Please select at least one operation.");
                return;
            }
            
            DuelMode.settings = {
                ops: selectedOps,
                maxAddend: parseInt(document.getElementById('maxAdd').value),
                maxFactor: parseInt(document.getElementById('maxFact').value),
                timer: parseInt(document.getElementById('timerSet').value)
            };
            
            DuelMode.renderGame();
        });
        
        attachBackButtonListener(App.currentGrade);
    },

    /** Renders the two-player game screen */
    renderGame: () => {
        appTitle.textContent = 'Duel!';
        DuelMode.timer = DuelMode.settings.timer;
        
        // Initialize player states
        DuelMode.player1 = { id: 1, score: 0, isCoolingDown: false, problem: null, containerId: 'player1Container' };
        DuelMode.player2 = { id: 2, score: 0, isCoolingDown: false, problem: null, containerId: 'player2Container' };

        screenContainer.innerHTML = `
            <div class="text-center mb-4">
                <div id="timerDisplay" class="text-3xl font-bold text-blue-600">Time: ${DuelMode.timer}s</div>
            </div>
            <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                <!-- Player 1 -->
                <div id="player1Container" class="flex-1 bg-red-100 p-4 rounded-lg shadow-md transition-all duration-100">
                    <h2 class="text-2xl font-bold text-red-700 text-center">Player 1 (A, S, D, F)</h2>
                    <div class="text-4xl font-bold text-center my-4" id="p1-score">Score: 0</div>
                    <div class="text-5xl font-bold text-center my-6" id="p1-problem"></div>
                    <div class="grid grid-cols-2 gap-2" id="p1-choices"></div>
                </div>
                
                <!-- Player 2 -->
                <div id="player2Container" class="flex-1 bg-blue-100 p-4 rounded-lg shadow-md transition-all duration-100">
                    <h2 class="text-2xl font-bold text-blue-700 text-center">Player 2 (J, K, L, ;)</h2>
                    <div class="text-4xl font-bold text-center my-4" id="p2-score">Score: 0</div>
                    <div class="text-5xl font-bold text-center my-6" id="p2-problem"></div>
                    <div class="grid grid-cols-2 gap-2" id="p2-choices"></div>
                </div>
            </div>
        `;
        
        DuelMode.nextProblemForPlayer(DuelMode.player1);
        DuelMode.nextProblemForPlayer(DuelMode.player2);
        
        DuelMode.setupGameListeners();
        
        DuelMode.gameInterval = setInterval(() => {
            DuelMode.timer--;
            document.getElementById('timerDisplay').textContent = `Time: ${DuelMode.timer}s`;
            if (DuelMode.timer <= 10) {
                document.getElementById('timerDisplay').classList.add('text-red-700', 'animate-pulse');
            }
            if (DuelMode.timer <= 0) {
                DuelMode.endGame();
            }
        }, 1000);
    },

    /** Generates and displays a new problem for a specific player */
    nextProblemForPlayer: (player) => {
        if (player.isCoolingDown) return;

        const { n1, n2, op, answer } = DuelMode.generateProblem();
        player.problem = { n1, n2, op, answer };
        
        const choices = DuelMode.generateChoices(answer);
        const keys = player.id === 1 ? ['A', 'S', 'D', 'F'] : ['J', 'K', 'L', ';'];
        
        document.getElementById(`p${player.id}-problem`).textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        
        const choiceContainer = document.getElementById(`p${player.id}-choices`);
        choiceContainer.innerHTML = `
            ${choices.map((choice, index) => `
                <button class="choice-button btn ${player.id === 1 ? 'btn-red' : 'btn-blue'} text-xl p-2 leading-none" data-answer="${choice}">
                    <span class="font-bold text-sm opacity-75">${keys[index]}</span>
                    <span class="block text-3xl font-extrabold">${choice}</span>
                </button>
            `).join('')}
        `;
        
        // Add click listeners for touch devices
        choiceContainer.querySelectorAll('.choice-button').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (player.isCoolingDown) return;
                DuelMode.checkAnswer(player, index);
            });
        });
    },

    /** Generates a problem based on duel settings */
    generateProblem: () => {
        const { maxAddend, maxFactor, ops } = DuelMode.settings;
        const op = ops[getRandomInt(0, ops.length - 1)];
        let n1, n2, answer;
        
        switch (op) {
            case '+':
                n1 = getRandomInt(0, maxAddend); n2 = getRandomInt(0, maxAddend);
                answer = n1 + n2; break;
            case '-':
                n1 = getRandomInt(0, maxAddend); n2 = getRandomInt(0, n1);
                answer = n1 - n2; break;
            case '*':
                n1 = getRandomInt(0, maxFactor); n2 = getRandomInt(0, maxFactor);
                answer = n1 * n2; break;
            case '/':
                n2 = getRandomInt(1, maxFactor); n1 = n2 * getRandomInt(0, maxFactor);
                answer = n1 / n2; break;
        }
        return { n1, n2, op, answer };
    },
    
    /** Generates choices (same as other modes) */
    generateChoices: (correctAnswer) => {
        let choices = new Set([correctAnswer]);
        while (choices.size < 4) {
            let offset = getRandomInt(1, 5);
            choices.add(Math.max(0, correctAnswer - offset));
            if (choices.size < 4) {
                choices.add(correctAnswer + offset);
            }
        }
        return Array.from(choices);
    },

    /** Sets up the keyboard listeners for two players */
    setupGameListeners: () => {
        // Remove old listener to prevent duplicates
        document.removeEventListener('keydown', DuelMode.handleTwoPlayerInput);
        document.addEventListener('keydown', DuelMode.handleTwoPlayerInput);
    },

    /** Handles keydown events for A,S,D,F and J,K,L,; */
    handleTwoPlayerInput: (event) => {
        let playerTarget = null;
        let choiceIndex = -1;

        switch (event.key.toLowerCase()) {
            case 'a': playerTarget = DuelMode.player1; choiceIndex = 0; break;
            case 's': playerTarget = DuelMode.player1; choiceIndex = 1; break;
            case 'd': playerTarget = DuelMode.player1; choiceIndex = 2; break;
            case 'f': playerTarget = DuelMode.player1; choiceIndex = 3; break;
            
            case 'j': playerTarget = DuelMode.player2; choiceIndex = 0; break;
            case 'k': playerTarget = DuelMode.player2; choiceIndex = 1; break;
            case 'l': playerTarget = DuelMode.player2; choiceIndex = 2; break;
            case ';': playerTarget = DuelMode.player2; choiceIndex = 3; break;
        }

        if (playerTarget && choiceIndex !== -1) {
            if (playerTarget.isCoolingDown) return; // Ignore input
            event.preventDefault();
            DuelMode.checkAnswer(playerTarget, choiceIndex);
        }
    },

    /** Checks a player's answer by index */
    checkAnswer: (player, choiceIndex) => {
        if (player.isCoolingDown) return;

        const choiceButtons = document.querySelectorAll(`#${player.containerId} .choice-button`);
        const chosenAnswer = parseInt(choiceButtons[choiceIndex].dataset.answer);
        const isCorrect = chosenAnswer === player.problem.answer;
        const playerContainer = document.getElementById(player.containerId);

        if (isCorrect) {
            playCorrectSound();
            player.score++;
            document.getElementById(`p${player.id}-score`).textContent = `Score: ${player.score}`;
            playerContainer.classList.add('duel-correct-flash');
            setTimeout(() => {
                playerContainer.classList.remove('duel-correct-flash');
                DuelMode.nextProblemForPlayer(player);
            }, 200);
        } else {
            playIncorrectSound();
            player.score = Math.max(0, player.score - 1); // Lose a point
            player.isCoolingDown = true;
            document.getElementById(`p${player.id}-score`).textContent = `Score: ${player.score}`;
            playerContainer.classList.add('duel-incorrect-flash');
            
            setTimeout(() => {
                playerContainer.classList.remove('duel-incorrect-flash');
                player.isCoolingDown = false;
                DuelMode.nextProblemForPlayer(player);
            }, 2500); // 2.5 second penalty
        }
    },

    /** Ends the duel and shows results */
    endGame: () => {
        clearInterval(DuelMode.gameInterval);
        document.removeEventListener('keydown', DuelMode.handleTwoPlayerInput); // Clean up listener

        let winnerMessage = '';
        if (DuelMode.player1.score > DuelMode.player2.score) {
            winnerMessage = '<h2 class="text-4xl font-extrabold text-red-600">Player 1 Wins!</h2>';
            playDuelWinSound();
        } else if (DuelMode.player2.score > DuelMode.player1.score) {
            winnerMessage = '<h2 class="text-4xl font-extrabold text-blue-600">Player 2 Wins!</h2>';
            playDuelWinSound();
        } else {
            winnerMessage = '<h2 class="text-4xl font-extrabold text-gray-700">It\'s a Draw!</h2>';
        }

        screenContainer.innerHTML = `
            <div class="text-center space-y-6">
                <h2 class="text-3xl font-bold">Time's Up!</h2>
                ${winnerMessage}
                <div class="text-2xl">
                    <strong>Player 1 Score:</strong> ${DuelMode.player1.score} <br>
                    <strong>Player 2 Score:</strong> ${DuelMode.player2.score}
                </div>
                
                <button id="playDuelAgain" class="btn btn-red">Play Again</button>
                ${getMainMenuButton()}
            </div>
        `;
        
        document.getElementById('playDuelAgain').addEventListener('click', DuelMode.renderSetupScreen);
        attachMainMenuButtonListener();
    }
};
