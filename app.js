/*
 * MATH FACT UNIVERSE - APP.JS
 * This file contains all JavaScript logic for the combined application.
 * It uses a modular structure to separate logic for each game mode.
 */

// --- GLOBAL APP STATE & CONFIG ---
const App = {
    currentGrade: 0,
    currentMode: '', // 'practice', 'master', or 'duel'
    screenContainer: document.getElementById('screenContainer'),
    appTitle: document.getElementById('appTitle'),
};

// Grade-level configurations (These are the CEILINGS)
const GRADE_CONFIG = {
    1: { name: '1st Grade', ops: ['+', '-'], maxAddend: 10, maxFactor: 0, targetScore: 20 },
    2: { name: '2nd Grade', ops: ['+', '-'], maxAddend: 20, maxFactor: 0, targetScore: 30 },
    3: { name: '3rd Grade', ops: ['+', '-', 'x'], maxAddend: 20, maxFactor: 10, targetScore: 40 },
    4: { name: '4th Grade', ops: ['+', '-', 'x', '÷'], maxAddend: 25, maxFactor: 12, targetScore: 50 },
    5: { name: '5th Grade', ops: ['+', '-', 'x', '÷'], maxAddend: 50, maxFactor: 12, targetScore: 60 },
    6: { name: '6th Grade', ops: ['+', '-', 'x', '÷'], maxAddend: 100, maxFactor: 20, targetScore: 60 },
    7: { name: '7th Grade', ops: ['+', '-', 'x', '÷'], maxAddend: 100, maxFactor: 20, targetScore: 70 },
    8: { name: '8th Grade', ops: ['+', '-', 'x', '÷'], maxAddend: 100, maxFactor: 20, targetScore: 80 },
};

// NEW: Configurable starting levels for scaffolding (EDITABLE)
const GRADE_STARTING_LEVELS = {
    1: { startAddend: 2, startFactor: 0 },
    2: { startAddend: 4, startFactor: 0 },
    3: { startAddend: 6, startFactor: 2 },
    4: { startAddend: 6, startFactor: 6 },
    5: { startAddend: 8, startFactor: 8 },
    6: { startAddend: 10, startFactor: 10 },
    7: { startAddend: 10, startFactor: 10 },
    8: { startAddend: 10, startFactor: 10 },
};

// Cooldown time on wrong answer (in milliseconds)
const COOLDOWN_TIME = 2500;
// Spaced Repetition "box" limit
const MAX_FACT_STRENGTH = 5; // Facts with strength 5 are "mastered"
// Response Time (Fluency) threshold in milliseconds
const FLUENCY_THRESHOLD = 3000; // 3 seconds
// Mastery threshold for "leveling up" (EDITABLE)
const MASTERY_THRESHOLD_PERCENT = 0.8; // 80%
const MASTERY_THRESHOLD_COUNT = 5; // Must have seen at least 5 facts at this level

// --- SHARED UI CONSTANTS (Tailwind Classes) ---
const BTN_BASE = "font-extrabold py-5 px-6 rounded-lg text-2xl w-full mb-4 transition-all duration-150 transform active:scale-95 shadow-lg border-2 border-b-4";
const BTN_INDIGO = "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-800 active:border-indigo-600";
const BTN_GREEN = "bg-green-600 hover:bg-green-700 text-white border-green-800 active:border-green-600";
const BTN_BLUE = "bg-blue-600 hover:bg-blue-700 text-white border-blue-800 active:border-blue-800";
const BTN_RED = "bg-red-600 hover:bg-red-700 text-white border-red-800 active:border-red-600";
const BTN_GRAY = "bg-gray-500 hover:bg-gray-600 text-white py-2 text-base shadow-sm border-gray-700 active:border-gray-500 font-bold rounded-lg w-full mb-4 transition-all duration-150 transform active:scale-95 border-2 border-b-4";
const BTN_CHOICE = "font-bold py-4 px-6 rounded-lg text-3xl w-full mb-4 transition-all duration-150 transform active:scale-95 shadow-lg border-2 border-b-4"; // For 4-choice
const BTN_DUEL = "font-bold rounded-lg w-full mb-4 transition-all duration-150 transform active:scale-95 shadow-lg border-2 border-b-4 text-lg p-3 leading-none flex flex-col justify-center items-center min-h-24"; // For duel

// --- SHARED UTILITIES ---

// Sound synthesizers
let correctSynth, incorrectSynth;

/** Initializes audio components after a user gesture. */
function startAudio() {
    if (Tone.context.state !== 'running') {
        Tone.context.resume().then(() => {
            if (!correctSynth) {
                correctSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" } }).toDestination();
                incorrectSynth = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
            }
        });
    }
}

function playCorrectSound() {
    startAudio();
    if (correctSynth) correctSynth.triggerAttackRelease(["C5", "E5"], "8n");
}
function playIncorrectSound() {
    startAudio();
    if (incorrectSynth) incorrectSynth.triggerAttackRelease("16n");
}

/** Formats operation symbols for display */
function formatOp(op) {
    if (op === 'x') return '×';
    if (op === '÷') return '÷';
    return op;
}

// --- NEW: DYNAMIC SCORING UTILITIES ---
/** Calculates the score value for a correct problem */
function getScoreValue(n1, n2, op) {
    let base = 5; // Minimum score
    if (op === '+' || op === 'x') {
        base = n1 + n2;
    } else if (op === '-') {
        base = n1; // Score based on the dividend
    } else if (op === '÷') {
        base = n1; // Score based on the dividend (n1 = 12 in 12 / 4)
    }
    // Give a minimum of 5 points, max of 50
    return Math.max(5, Math.min(50, base));
}

/** Calculates the score penalty for an incorrect problem */
function getPenaltyValue(n1, n2, op) {
    let score = getScoreValue(n1, n2, op);
    // Penalty is half the value, with a minimum of 2
    return Math.max(2, Math.floor(score / 2));
}
// --- END DYNAMIC SCORING ---


// --- ADAPTIVE LEARNING (localStorage) UTILITIES ---

/** Creates a unique, canonical key for a math fact. */
function getFactKey(n1, n2, op) {
    if (op === '+' || op === 'x') {
        return (n1 < n2) ? `${n1}${op}${n2}` : `${n2}${op}${n1}`;
    }
    return `${n1}${op}${n2}`;
}

/** Loads the student's entire profile from localStorage. */
function loadStudentProfile() {
    let profile = {};
    try {
        const data = localStorage.getItem('mathFactProfile');
        profile = data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Error loading student profile:", e);
    }
    
    if (!profile.factMastery) {
        profile.factMastery = {};
    }
    if (!profile.gradeProgress) {
        profile.gradeProgress = {};
    }
    
    return profile;
}

/** Saves the student's entire profile to localStorage. */
function saveStudentProfile(profile) {
    try {
        localStorage.setItem('mathFactProfile', JSON.stringify(profile));
    } catch (e) {
        console.error("Error saving student profile:", e);
    }
}

/** Gets the progress for the current grade, or initializes it. */
function getOrInitGradeProgress(grade) {
    const profile = loadStudentProfile();
    if (!profile.gradeProgress[grade]) {
        // NEW: Read from the configurable starting levels
        const startingLevel = GRADE_STARTING_LEVELS[grade] || { startAddend: 2, startFactor: 2 };
        
        profile.gradeProgress[grade] = {
            currentMaxAddend: startingLevel.startAddend,
            currentMaxFactor: (GRADE_CONFIG[grade].ops.includes('x')) ? startingLevel.startFactor : 0
        };
        saveStudentProfile(profile);
    }
    return profile.gradeProgress[grade];
}
// --- END ADAPTIVE UTILITIES ---


/** Generates a new math problem based on settings. */
function generateProblem(settings) {
    const op = settings.ops[Math.floor(Math.random() * settings.ops.length)];
    let n1, n2, answer;
    const maxAdd = settings.currentMaxAddend;
    const maxFact = settings.currentMaxFactor;

    switch (op) {
        case '+':
            n1 = Math.floor(Math.random() * (maxAdd + 1));
            n2 = Math.floor(Math.random() * (maxAdd + 1));
            answer = n1 + n2;
            break;
        case '-':
            n1 = Math.floor(Math.random() * (maxAdd + 1));
            n2 = Math.floor(Math.random() * (n1 + 1));
            answer = n1 - n2;
            break;
        case 'x':
            n1 = Math.floor(Math.random() * (maxFact + 1));
            n2 = Math.floor(Math.random() * (maxFact + 1));
            answer = n1 * n2;
            break;
        case '÷':
            n2 = Math.floor(Math.random() * maxFact) + 1;
            let answer_temp = Math.floor(Math.random() * maxFact) + 1;
            n1 = n2 * answer_temp;
            answer = answer_temp;
            break;
    }
    return { n1, n2, op, answer };
}

/** Generates 3 incorrect choices for a given answer */
function getMultipleChoices(correctAnswer) {
    let choices = new Set([correctAnswer]);
    let incorrectPool = [];
    
    if (correctAnswer + 1 !== correctAnswer) incorrectPool.push(correctAnswer + 1);
    if (correctAnswer - 1 !== correctAnswer && correctAnswer - 1 >= 0) incorrectPool.push(correctAnswer - 1);
    if (correctAnswer + 10 !== correctAnswer) incorrectPool.push(correctAnswer + 10);
    if (correctAnswer - 10 !== correctAnswer && correctAnswer - 10 >= 0) incorrectPool.push(correctAnswer - 10);

    for (let i = 0; i < 5; i++) {
        let rand = Math.floor(Math.random() * (correctAnswer + 10)) + Math.max(0, correctAnswer - 5);
        if (rand >= 0) {
            incorrectPool.push(rand);
        }
    }

    let uniqueIncorrect = [...new Set(incorrectPool.filter(ans => ans !== correctAnswer))];
    uniqueIncorrect.sort(() => Math.random() - 0.5);

    let i = 0;
    while (choices.size < 4 && i < uniqueIncorrect.length) {
        choices.add(uniqueIncorrect[i]);
        i++;
    }

    while (choices.size < 4) {
        let rand = Math.floor(Math.random() * (correctAnswer + 15)) + Math.max(0, correctAnswer - 8);
        if (rand >= 0) {
            choices.add(rand);
        }
    }
    
    return Array.from(choices).sort(() => Math.random() - 0.5);
}

/** Returns HTML for a "Back to Mode Select" button */
function getBackButton() {
    return `<button id="goBack" class="${BTN_GRAY}">Back</button>`;
}

/** Attaches listener to the "Back" button */
function attachBackButtonListener(grade) {
    document.getElementById('goBack').addEventListener('click', () => {
        if (MasterMode.gameInterval) clearInterval(MasterMode.gameInterval);
        if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
        if (DuelMode.gameInterval) clearInterval(DuelMode.gameInterval);
        
        document.removeEventListener('keydown', DuelMode.handleKeyboardInput);
        document.removeEventListener('keydown', MasterMode.handleKeyboardInput);
        document.removeEventListener('keydown', PracticeMode.handleKeyboardInput);

        renderModeSelect(grade);
    });
}

// --- 1. NAVIGATION & UI RENDERING (Top Level) ---

/** Renders the initial screen to select a grade. */
function renderGradeSelect() {
    App.appTitle.textContent = 'Select Your Grade';
    let buttonsHTML = Object.keys(GRADE_CONFIG).map(grade => {
        return `<button class="${BTN_BASE} ${BTN_INDIGO} grade-btn" data-grade="${grade}">
            ${GRADE_CONFIG[grade].name}
        </button>`;
    }).join('');

    App.screenContainer.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${buttonsHTML}
        </div>`;

    document.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            startAudio(); 
            App.currentGrade = parseInt(e.currentTarget.dataset.grade);
            renderModeSelect(App.currentGrade);
        });
    });
}

/** Renders the screen to select a game mode. */
function renderModeSelect(grade) {
    App.appTitle.textContent = `Grade ${grade} - Select Mode`;
    PracticeMode.clearMasteryLights(); // Clear lights
    
    App.screenContainer.innerHTML = `
        <button id="startPractice" class="${BTN_BASE} ${BTN_GREEN}">
            🎯 Practice
        </button>
        <button id="startMaster" class="${BTN_BASE} ${BTN_BLUE}">
            ⭐ Master Test
        </button>
        <button id="startDuel" class="${BTN_BASE} ${BTN_RED}">
            ⚔️ Facts Duel
        </button>
        <button id="goBack" class="${BTN_GRAY}">Back to Grade Select</button>
    `;

    document.getElementById('startPractice').addEventListener('click', () => PracticeMode.start(GRADE_CONFIG[App.currentGrade]));
    document.getElementById('startMaster').addEventListener('click', () => MasterMode.start(GRADE_CONFIG[App.currentGrade]));
    document.getElementById('startDuel').addEventListener('click', () => DuelMode.start(GRADE_CONFIG[App.currentGrade]));
    document.getElementById('goBack').addEventListener('click', renderGradeSelect);
}

// --- 2. GAME MODE: PRACTICE ---
const PracticeMode = {
    gradeConfig: {},
    settings: {},
    score: 0,
    problem: {},
    isMultipleChoice: true,
    isCoolingDown: false,
    gameInterval: null,
    timer: 0,
    timeLimit: 0, 
    problemLimit: 0,
    stats: {},
    isAdaptive: true,
    studentProfile: {},
    problemStartTime: 0,
    lastProblemKey: null,
    newFactChance: 0.4, 

    getTotalAttempted: () => {
        return Object.values(PracticeMode.stats).reduce((sum, opStats) => sum + opStats.attempted, 0);
    },
    getTotalCorrect: () => {
        return Object.values(PracticeMode.stats).reduce((sum, opStats) => sum + opStats.correct, 0);
    },
    
    /** NEW: Renders the two-row mastery lights */
    renderMasteryLights: () => {
        const addSubContainer = document.getElementById('add-sub-lights-row');
        const multDivContainer = document.getElementById('mult-div-lights-row');
        
        if (!addSubContainer || !multDivContainer || !PracticeMode.settings.isAdaptive) {
            PracticeMode.clearMasteryLights(); // Clear if not adaptive
            return;
        }

        // 1. Find all facts relevant to the *selected operations*
        const addSubFacts = Object.values(PracticeMode.studentProfile.factMastery).filter(fact => {
            return (fact.op === '+' || fact.op === '-') && PracticeMode.settings.ops.includes(fact.op);
        });
        const multDivFacts = Object.values(PracticeMode.studentProfile.factMastery).filter(fact => {
            return (fact.op === 'x' || fact.op === '÷') && PracticeMode.settings.ops.includes(fact.op);
        });

        // 2. Calculate mastery for Add/Sub
        let addSubHTML = '<span class="mastery-row-label">+/&minus;</span>';
        if (PracticeMode.settings.ops.includes('+') || PracticeMode.settings.ops.includes('-')) {
            let addLightsToFill = 0;
            if (addSubFacts.length > 0) {
                const addMastered = addSubFacts.filter(fact => fact.strength >= 3).length;
                const addPercent = addMastered / addSubFacts.length;
                addLightsToFill = Math.floor(addPercent * 10);
            }
            for (let i = 0; i < 10; i++) {
                addSubHTML += `<div class="mastery-light ${i < addLightsToFill ? 'mastered' : ''}"></div>`;
            }
        } else {
            // Not selected, show empty
            for (let i = 0; i < 10; i++) { addSubHTML += `<div class="mastery-light opacity-20"></div>`; }
        }
        
        // 3. Calculate mastery for Mult/Div
        let multDivHTML = '<span class="mastery-row-label">&times;/&divide;</span>';
        if (PracticeMode.settings.ops.includes('x') || PracticeMode.settings.ops.includes('÷')) {
            let multLightsToFill = 0;
            if (multDivFacts.length > 0) {
                const multMastered = multDivFacts.filter(fact => fact.strength >= 3).length;
                const multPercent = multMastered / multDivFacts.length;
                multLightsToFill = Math.floor(multPercent * 10);
            }
            for (let i = 0; i < 10; i++) {
                multDivHTML += `<div class="mastery-light ${i < multLightsToFill ? 'mastered' : ''}"></div>`;
            }
        } else {
            // Not selected, show empty
            for (let i = 0; i < 10; i++) { multDivHTML += `<div class="mastery-light opacity-20"></div>`; }
        }

        // 4. Render lights
        addSubContainer.innerHTML = addSubHTML;
        multDivContainer.innerHTML = multDivHTML;
    },
    
    /** NEW: Clears all mastery lights and labels */
    clearMasteryLights: () => {
        const addSubContainer = document.getElementById('add-sub-lights-row');
        const multDivContainer = document.getElementById('mult-div-lights-row');
        if (addSubContainer) addSubContainer.innerHTML = '';
        if (multDivContainer) multDivContainer.innerHTML = '';
    },

    TIME_MAP: { '0': 'No Limit', '1': '30s', '2': '60s', '3': '120s' },
    TIME_VAL_MAP: { '0': 0, '1': 30, '2': 60, '3': 120 },
    PROB_MAP: { '0': 'No Limit', '1': '10', '2': '20', '3': '40', '4': '50' },
    PROB_VAL_MAP: { '0': 0, '1': 10, '2': 20, '3': 40, '4': 50 },

    start: (gradeConfig) => {
        App.currentMode = 'practice';
        PracticeMode.gradeConfig = gradeConfig;
        PracticeMode.renderSetupScreen();
    },

    /** Renders setup screen for Practice Mode */
    renderSetupScreen: () => {
        App.appTitle.textContent = 'Practice Setup';
        
        const opsCheckboxes = PracticeMode.gradeConfig.ops.map(op => `
            <div class="flex items-center justify-center">
                <input id="op-${op}" type="checkbox" checked class="form-checkbox h-5 w-5 text-indigo-600" value="${op}">
                <label for="op-${op}" class="ml-2 text-2xl font-bold">${formatOp(op)}</label>
            </div>
        `).join('');

        const gradeProgress = getOrInitGradeProgress(App.currentGrade);
        let adaptiveDesc = `Starts at your current level (e.g., up to ${gradeProgress.currentMaxAddend}, facts up to ${gradeProgress.currentMaxFactor}) and adapts.`;
        if (!PracticeMode.isAdaptive) {
            adaptiveDesc = `All problems up to Grade ${App.currentGrade} max (${PracticeMode.gradeConfig.maxAddend} / ${PracticeMode.gradeConfig.maxFactor}).`;
        }
        
        App.screenContainer.innerHTML = `
            <div class="space-y-6">
                <div class="text-center">
                    <label class="text-lg font-medium text-gray-700">Operations:</label>
                    <div class="flex justify-center space-x-6 mt-2">
                        ${opsCheckboxes}
                    </div>
                </div>

                <div class="flex items-center justify-center space-x-4">
                    <span class="text-lg font-medium ${PracticeMode.isMultipleChoice ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Multiple Choice</span>
                    <div class="relative inline-block w-16 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="toggleInputMode" class="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer" ${!PracticeMode.isMultipleChoice ? 'checked' : ''} />
                        <label for="toggleInputMode" class="toggle-label block overflow-hidden h-8 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                    <span class="text-lg font-medium ${!PracticeMode.isMultipleChoice ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Keyed Entry</span>
                </div>

                <!-- Adaptive Learning Toggle -->
                <div class="flex items-center justify-center space-x-4">
                    <span class="text-lg font-medium ${!PracticeMode.isAdaptive ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Random Practice</span>
                    <div class="relative inline-block w-16 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="toggleAdaptive" class="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer" ${PracticeMode.isAdaptive ? 'checked' : ''} />
                        <label for="toggleAdaptive" class="toggle-label block overflow-hidden h-8 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                    <span class="text-lg font-medium ${PracticeMode.isAdaptive ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Adaptive Learning</span>
                </div>
                <p id="adaptiveDesc" class="text-center text-sm text-gray-600 -mt-2">${adaptiveDesc}</p>

                <!-- Sliders for Time and Problem Limits -->
                <div class="space-y-4">
                    <div>
                        <label for="practiceTimeLimit" class="block text-sm font-medium text-gray-700">Time Limit: <span id="practiceTimeValue" class="font-bold">No Limit</span></label>
                        <input type="range" id="practiceTimeLimit" min="0" max="3" value="0" step="1" class="mt-1">
                    </div>
                    <div>
                        <label for="practiceProblemLimit" class="block text-sm font-medium text-gray-700">Problem Limit: <span id="practiceProblemValue" class="font-bold">No Limit</span></label>
                        <input type="range" id="practiceProblemLimit" min="0" max="4" value="0" step="1" class="mt-1">
                    </div>
                </div>

                <button id="startPracticeGame" class="${BTN_BASE} ${BTN_GREEN}">Start Practice!</button>
                ${getBackButton()}
            </div>
        `;

        document.getElementById('toggleInputMode').addEventListener('change', (e) => {
            PracticeMode.isMultipleChoice = !e.target.checked;
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('text-gray-500');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('text-gray-500');
        });
        
        document.getElementById('toggleAdaptive').addEventListener('change', (e) => {
            PracticeMode.isAdaptive = e.target.checked;
            document.querySelector('span[class*="Random Practice"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Random Practice"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Random Practice"]').classList.toggle('text-gray-500');
            document.querySelector('span[class*="Adaptive Learning"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Adaptive Learning"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Adaptive Learning"]').classList.toggle('text-gray-500');
            
            const gradeProgress = getOrInitGradeProgress(App.currentGrade);
            const descEl = document.getElementById('adaptiveDesc');
            if (PracticeMode.isAdaptive) {
                descEl.textContent = `Starts at your current level (e.g., up to ${gradeProgress.currentMaxAddend}, facts up to ${gradeProgress.currentMaxFactor}) and adapts.`;
            } else {
                descEl.textContent = `All problems up to Grade ${App.currentGrade} max (${PracticeMode.gradeConfig.maxAddend} / ${PracticeMode.gradeConfig.maxFactor}).`;
            }
        });
        
        document.getElementById('practiceTimeLimit').addEventListener('input', e => {
            document.getElementById('practiceTimeValue').textContent = PracticeMode.TIME_MAP[e.target.value];
        });
        document.getElementById('practiceProblemLimit').addEventListener('input', e => {
            document.getElementById('practiceProblemValue').textContent = PracticeMode.PROB_MAP[e.target.value];
        });

        document.getElementById('startPracticeGame').addEventListener('click', () => {
            const selectedOps = Array.from(document.querySelectorAll('.form-checkbox:checked')).map(cb => cb.value);
            if (selectedOps.length === 0) {
                alert("Please select at least one operation.");
                return;
            }
            
            const timeSliderVal = document.getElementById('practiceTimeLimit').value;
            const probSliderVal = document.getElementById('practiceProblemLimit').value;
            PracticeMode.timeLimit = PracticeMode.TIME_VAL_MAP[timeSliderVal];
            PracticeMode.problemLimit = PracticeMode.PROB_VAL_MAP[probSliderVal];
            
            PracticeMode.studentProfile = loadStudentProfile();
            const gradeProgress = getOrInitGradeProgress(App.currentGrade);

            if (PracticeMode.isAdaptive) {
                PracticeMode.settings = {
                    ops: selectedOps,
                    currentMaxAddend: gradeProgress.currentMaxAddend, 
                    currentMaxFactor: gradeProgress.currentMaxFactor,
                    gradeMaxAddend: PracticeMode.gradeConfig.maxAddend,
                    gradeMaxFactor: PracticeMode.gradeConfig.maxFactor,
                    timeLimit: PracticeMode.timeLimit,
                    problemLimit: PracticeMode.problemLimit,
                    isAdaptive: true
                };
            } else {
                PracticeMode.settings = {
                    ops: selectedOps,
                    currentMaxAddend: PracticeMode.gradeConfig.maxAddend,
                    currentMaxFactor: PracticeMode.gradeConfig.maxFactor,
                    gradeMaxAddend: PracticeMode.gradeConfig.maxAddend,
                    gradeMaxFactor: PracticeMode.gradeConfig.maxFactor,
                    timeLimit: PracticeMode.timeLimit,
                    problemLimit: PracticeMode.problemLimit,
                    isAdaptive: false
                };
            }
            PracticeMode.renderGame();
        });
        
        attachBackButtonListener(App.currentGrade);
    },

    /** Renders the main game screen for Practice Mode */
    renderGame: () => {
        PracticeMode.score = 0;
        PracticeMode.isCoolingDown = false;
        if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
        PracticeMode.lastProblemKey = null;
        
        PracticeMode.stats = {};
        PracticeMode.settings.ops.forEach(op => {
            PracticeMode.stats[op] = { correct: 0, attempted: 0 };
        });
        
        const hasTimeLimit = PracticeMode.settings.timeLimit > 0;
        PracticeMode.timer = hasTimeLimit ? PracticeMode.settings.timeLimit : 0;

        App.appTitle.textContent = 'Practice Mode';
        App.screenContainer.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div id="scoreDisplay" class="text-3xl font-bold text-indigo-600">Score: 0</div>
                <div id="timerDisplay" class="text-3xl font-bold text-gray-700">${PracticeMode.timer}s</div>
            </div>
            <div class="progress-bar-container mb-6">
                <div id="progressBar" class="progress-bar" style="width: 0%;"></div>
            </div>
            
            <div id="problemDisplay" class="text-7xl font-extrabold text-center my-10 text-gray-800"></div>
            <div id="helperTextDisplay" class="text-center text-2xl font-medium text-green-600 h-8 mb-4"></div>
            <div id="answerContainer"></div>

            <button id="endPracticeEarly" class="${BTN_GRAY} mt-6">End Practice</button>
        `;

        document.getElementById('endPracticeEarly').addEventListener('click', () => {
            if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
            PracticeMode.renderResults();
        });

        PracticeMode.gameInterval = setInterval(() => {
            const timerDisplay = document.getElementById('timerDisplay');
            if (!timerDisplay) {
                clearInterval(PracticeMode.gameInterval);
                return;
            }
            
            if (hasTimeLimit) {
                PracticeMode.timer--;
                timerDisplay.textContent = `${PracticeMode.timer}s`;
                if (PracticeMode.timer <= 10 && PracticeMode.timer > 0) {
                    timerDisplay.classList.add('text-red-700', 'animate-pulse');
                } else if (PracticeMode.timer <= 0) {
                    timerDisplay.textContent = `0s`;
                    clearInterval(PracticeMode.gameInterval);
                    PracticeMode.renderResults();
                }
            } else {
                PracticeMode.timer++;
                timerDisplay.textContent = `${PracticeMode.timer}s`;
            }
        }, 1000);

        PracticeMode.nextProblem();
        PracticeMode.renderMasteryLights(); // Render lights on game start
    },

    /** Generates and displays the next problem (ADAPTIVE ENGINE) */
    nextProblem: () => {
        PracticeMode.isCoolingDown = false;
        let problemToAsk = null;
        
        if (PracticeMode.settings.isAdaptive) {
            const allFacts = Object.entries(PracticeMode.studentProfile.factMastery);
            const dueFacts = allFacts.filter(([key, fact]) => {
                const { n1, n2, op } = fact;
                const inOps = PracticeMode.settings.ops.includes(op);
                const inRange = (op === '+' || op === '-') ? 
                    (n1 <= PracticeMode.settings.gradeMaxAddend && n2 <= PracticeMode.settings.gradeMaxAddend) :
                    (n1 <= PracticeMode.settings.gradeMaxFactor && n2 <= PracticeMode.settings.gradeMaxFactor);
                
                return key !== PracticeMode.lastProblemKey && inOps && inRange && fact.strength < MAX_FACT_STRENGTH;
            });

            const weakestFacts = dueFacts.filter(([key, fact]) => fact.strength === 1);
            
            if (weakestFacts.length > 0 && Math.random() > PracticeMode.newFactChance) {
                const [key, fact] = weakestFacts[Math.floor(Math.random() * weakestFacts.length)];
                problemToAsk = fact;
            } else if (dueFacts.length > 0 && Math.random() > PracticeMode.newFactChance) {
                const [key, fact] = dueFacts[Math.floor(Math.random() * dueFacts.length)];
                problemToAsk = fact;
            }
        }
        
        if (!problemToAsk) {
            const settingsForNewProblem = {
                ops: PracticeMode.settings.ops,
                currentMaxAddend: PracticeMode.settings.currentMaxAddend,
                currentMaxFactor: PracticeMode.settings.currentMaxFactor,
            };
            problemToAsk = generateProblem(settingsForNewProblem);
            
            let newKey = getFactKey(problemToAsk.n1, problemToAsk.n2, problemToAsk.op);
            let attempts = 0;
            while(newKey === PracticeMode.lastProblemKey && attempts < 10) {
                 problemToAsk = generateProblem(settingsForNewProblem);
                 newKey = getFactKey(problemToAsk.n1, problemToAsk.n2, problemToAsk.op);
                 attempts++;
            }
        }
        
        PracticeMode.problem = problemToAsk;
        
        const { n1, n2, op, answer } = PracticeMode.problem;
        PracticeMode.lastProblemKey = getFactKey(n1, n2, op);
        
        document.getElementById('problemDisplay').textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        document.getElementById('helperTextDisplay').textContent = ''; 
        const answerContainer = document.getElementById('answerContainer');

        if (PracticeMode.isMultipleChoice) {
            const choices = getMultipleChoices(answer);
            answerContainer.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    ${choices.map(choice => `
                        <button class="choice-button ${BTN_CHOICE} ${BTN_INDIGO}" data-answer="${choice}">${choice}</button>
                    `).join('')}
                </div>
            `;
            document.querySelectorAll('.choice-button').forEach(btn => {
                btn.addEventListener('click', () => PracticeMode.checkAnswer(btn.textContent));
                btn.disabled = false;
            });
        } else {
            answerContainer.innerHTML = `
                <input type="number" id="answerInput" class="w-full text-center text-4xl p-4 border-4 border-gray-300 rounded-lg shadow-inner focus:border-indigo-500 focus:ring-indigo-500" placeholder="Type answer...">
            `;
            const input = document.getElementById('answerInput');
            input.focus();
            
            document.removeEventListener('keydown', PracticeMode.handleKeyboardInput); 
            document.addEventListener('keydown', PracticeMode.handleKeyboardInput);
        }
        
        PracticeMode.problemStartTime = Date.now();
    },
    
    handleKeyboardInput: (e) => {
        if (e.key === 'Enter') {
            const input = document.getElementById('answerInput');
            if (input && !PracticeMode.isCoolingDown) {
                PracticeMode.checkAnswer(input.value);
            }
        }
    },

    /** Checks the user's answer (ADAPTIVE ENGINE) */
    checkAnswer: (userAnswer) => {
        if (PracticeMode.isCoolingDown || userAnswer === '') return;
        
        if (PracticeMode.settings.timeLimit > 0 && PracticeMode.timer <= 0) {
            return;
        }

        PracticeMode.isCoolingDown = true;
        
        const responseTime = Date.now() - PracticeMode.problemStartTime;
        
        const { n1, n2, op, answer } = PracticeMode.problem;
        
        PracticeMode.stats[op].attempted++;
        const totalAttempted = PracticeMode.getTotalAttempted();
        
        const isCorrect = parseInt(userAnswer) === PracticeMode.problem.answer;
        const input = document.getElementById('answerInput');
        
        const problemLimitReached = PracticeMode.settings.problemLimit > 0 && totalAttempted >= PracticeMode.settings.problemLimit;

        if (PracticeMode.settings.isAdaptive) {
            const factKey = getFactKey(n1, n2, op);
            const fact = PracticeMode.studentProfile.factMastery[factKey] || {
                n1, n2, op, answer, strength: 0
            };

            if (isCorrect) {
                if (responseTime < FLUENCY_THRESHOLD) {
                    fact.strength = Math.min(MAX_FACT_STRENGTH, fact.strength + 2);
                } else {
                    fact.strength = Math.min(MAX_FACT_STRENGTH, fact.strength + 1);
                }
            } else {
                fact.strength = 1;
            }
            
            PracticeMode.studentProfile.factMastery[factKey] = fact;
            
            if (isCorrect) {
                PracticeMode.checkAndLevelUp(op);
            }
            
            saveStudentProfile(PracticeMode.studentProfile);
            PracticeMode.renderMasteryLights(); // Update lights after check
        }

        if (isCorrect) {
            playCorrectSound();
            PracticeMode.stats[op].correct++;
            // NEW: DYNAMIC SCORING
            PracticeMode.score += getScoreValue(n1, n2, op);
            
            if (PracticeMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    if (parseInt(btn.dataset.answer) === answer) {
                        btn.classList.add('correct-flash');
                    }
                    btn.disabled = true;
                });
            } else {
                input.classList.add('correct-flash');
                input.disabled = true;
            }
            
            setTimeout(() => {
                if (input) input.classList.remove('correct-flash');
                if (problemLimitReached) {
                    if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
                    PracticeMode.renderResults();
                } else {
                    PracticeMode.nextProblem();
                }
            }, 500); 

        } else {
            playIncorrectSound();
            // NEW: DYNAMIC SCORING PENALTY
            PracticeMode.score = Math.max(0, PracticeMode.score - getPenaltyValue(n1, n2, op));
            
            if (PracticeMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    if (parseInt(btn.dataset.answer) === answer) {
                        btn.classList.add('correct-flash');
                    } else if (btn.textContent === userAnswer) {
                        btn.classList.add('incorrect-flash');
                    }
                    btn.disabled = true;
                });
            } else {
                input.classList.add('incorrect-flash');
                input.disabled = true;
                document.getElementById('helperTextDisplay').textContent = `Correct Answer: ${answer}`;
            }

            setTimeout(() => {
                if (input) {
                    input.classList.remove('incorrect-flash');
                    input.disabled = false;
                    input.value = '';
                    input.focus();
                }
                if (problemLimitReached) {
                    if (PracticeMode.gameInterval) clearInterval(PracticeMode.gameInterval);
                    PracticeMode.renderResults();
                } else {
                    PracticeMode.nextProblem();
                }
            }, COOLDOWN_TIME);
        }
        
        document.getElementById('scoreDisplay').textContent = `Score: ${PracticeMode.score}`;
        const accuracy = (totalAttempted > 0) ? (PracticeMode.getTotalCorrect() / totalAttempted) * 100 : 0;
        document.getElementById('progressBar').style.width = `${accuracy}%`;
    },

    /** Checks if the student has mastered the current difficulty level */
    checkAndLevelUp: (op) => {
        const gradeProgress = PracticeMode.studentProfile.gradeProgress[App.currentGrade];
        const { factMastery } = PracticeMode.studentProfile;
        
        let currentMax, maxKey, gradeCeiling;
        
        if (op === '+' || op === '-') {
            currentMax = gradeProgress.currentMaxAddend;
            maxKey = 'currentMaxAddend';
            gradeCeiling = PracticeMode.settings.gradeMaxAddend;
        } else {
            currentMax = gradeProgress.currentMaxFactor;
            maxKey = 'currentMaxFactor';
            gradeCeiling = PracticeMode.settings.gradeMaxFactor;
        }

        if (currentMax >= gradeCeiling) {
            return;
        }

        const factsAtThisLevel = Object.values(factMastery).filter(fact => {
            // Find facts *at this level*
            const opMatch = (op === '+' || op === '-') ? (fact.op === '+' || fact.op === '-') : (fact.op === 'x' || fact.op === '÷');
            const numMatch = (fact.n1 === currentMax || fact.n2 === currentMax);
            return opMatch && numMatch;
        });

        if (factsAtThisLevel.length < MASTERY_THRESHOLD_COUNT) {
            return;
        }

        const masteredFacts = factsAtThisLevel.filter(fact => fact.strength >= 3);
        const masteryPercent = masteredFacts.length / factsAtThisLevel.length;

        if (masteryPercent >= MASTERY_THRESHOLD_PERCENT) {
            const newMax = currentMax + 1;
            PracticeMode.studentProfile.gradeProgress[App.currentGrade][maxKey] = newMax;
            PracticeMode.settings[maxKey] = newMax; // Update session settings
            
            console.log(`LEVEL UP for op ${op}: New max is ${newMax}`);
        }
    },


    /** Renders the results screen for Practice Mode */
    renderResults: () => {
        App.appTitle.textContent = 'Practice Results';
        PracticeMode.clearMasteryLights(); // Clear lights
        
        const totalAttempted = PracticeMode.getTotalAttempted();
        const totalCorrect = PracticeMode.getTotalCorrect();
        const accuracy = (totalAttempted > 0) ? (totalCorrect / totalAttempted * 100).toFixed(0) : 0;
        
        let statsHTML = '';
        if (Object.keys(PracticeMode.stats).length > 1 || PracticeMode.settings.isAdaptive) {
            statsHTML = '<div class="col-span-2 text-left space-y-2 mt-4">';
            statsHTML += '<h3 class="text-2xl font-bold text-gray-700 text-center mb-2">Breakdown by Operation</h3>';
            
            for (const op in PracticeMode.stats) {
                const opStats = PracticeMode.stats[op];
                if (opStats.attempted === 0) continue;
                
                const opAcc = (opStats.attempted > 0) ? (opStats.correct / opStats.attempted * 100).toFixed(0) : 0;
                const opColor = (opAcc < 70 ? 'text-red-600' : (opAcc < 90 ? 'text-yellow-600' : 'text-green-600'));
                
                statsHTML += `
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <span class="text-2xl font-bold">${formatOp(op)}</span>
                        <span class="text-xl font-medium">
                            ${opStats.correct} / ${opStats.attempted} 
                            (<span class="font-bold ${opColor}">${opAcc}%</span>)
                        </span>
                    </div>
                `;
            }
            statsHTML += '</div>';
        }

        App.screenContainer.innerHTML = `
            <div class="text-center space-y-6">
                <h2 class="text-4xl font-bold">Great Job!</h2>
                <div class="grid grid-cols-2 gap-4 text-2xl">
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${PracticeMode.score}</div>
                        <div class="text-lg text-gray-600">Final Score</div>
                    </div>
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${accuracy}%</div>
                        <div class="text-lg text-gray-600">Overall Accuracy</div>
                    </div>
                    
                    ${statsHTML}
                    
                </div>
                <button id="practiceAgain" class="${BTN_BASE} ${BTN_GREEN}">Practice Again</button>
                <button id="mainMenu" class="${BTN_BASE} ${BTN_GRAY}">Main Menu</button>
            </div>
        `;
        
        document.getElementById('practiceAgain').addEventListener('click', () => PracticeMode.start(PracticeMode.gradeConfig));
        document.getElementById('mainMenu').addEventListener('click', renderGradeSelect);
    }
};

// --- 3. GAME MODE: MASTER TEST ---
const MasterMode = {
    gradeConfig: {},
    settings: {},
    score: 0,
    attempted: 0,
    correct: 0,
    problem: {},
    isMultipleChoice: true,
    isCoolingDown: false,
    gameInterval: null,
    timer: 60,
    targetScore: 0,

    start: (gradeConfig) => {
        App.currentMode = 'master';
        PracticeMode.clearMasteryLights(); // Clear lights
        MasterMode.gradeConfig = gradeConfig;
        MasterMode.targetScore = gradeConfig.targetScore;
        MasterMode.renderSetupScreen();
    },
    
    renderSetupScreen: () => {
        App.appTitle.textContent = 'Master Test Setup';
        const { maxAddend, maxFactor, ops } = MasterMode.gradeConfig;
        
        let addSubDesc = `Addition & Subtraction problems up to ${maxAddend}.`;
        let multDivDesc = (ops.includes('x')) ? `Multiplication & Division facts from 0 to ${maxFactor}.` : "No multiplication or division.";

        App.screenContainer.innerHTML = `
            <div class="space-y-6">
                <div class="bg-gray-100 p-6 rounded-lg shadow-inner">
                    <h3 class="text-xl font-bold text-indigo-700 mb-3 text-center">Problem Ranges for Your Grade</h3>
                    <ul class="list-disc list-inside space-y-2 text-lg text-gray-800">
                        <li>${addSubDesc}</li>
                        <li>${multDivDesc}</li>
                    </ul>
                    <p class="text-center font-bold text-2xl text-indigo-600 mt-4">Target Score: ${MasterMode.targetScore}</p>
                </div>
            
                <div class="flex items-center justify-center space-x-4">
                    <span class="text-lg font-medium ${MasterMode.isMultipleChoice ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Multiple Choice</span>
                    <div class="relative inline-block w-16 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="toggleInputMode" class="toggle-checkbox absolute block w-8 h-8 rounded-full bg-white border-4 appearance-none cursor-pointer" ${!MasterMode.isMultipleChoice ? 'checked' : ''} />
                        <label for="toggleInputMode" class="toggle-label block overflow-hidden h-8 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                    <span class="text-lg font-medium ${!MasterMode.isMultipleChoice ? 'text-indigo-600 font-bold' : 'text-gray-500'}">Keyed Entry</span>
                </div>

                <button id="startMasterGame" class="${BTN_BASE} ${BTN_BLUE}">Start 1-Min Test!</button>
                ${getBackButton()}
            </div>
        `;

        document.getElementById('toggleInputMode').addEventListener('change', (e) => {
            MasterMode.isMultipleChoice = !e.target.checked;
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Multiple Choice"]').classList.toggle('text-gray-500');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('text-indigo-600');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('font-bold');
            document.querySelector('span[class*="Keyed Entry"]').classList.toggle('text-gray-500');
        });

        document.getElementById('startMasterGame').addEventListener('click', () => {
            MasterMode.settings = {
                ops: MasterMode.gradeConfig.ops,
                maxAddend: MasterMode.gradeConfig.maxAddend,
                maxFactor: MasterMode.gradeConfig.maxFactor
            };
            MasterMode.renderGame();
        });
        
        attachBackButtonListener(App.currentGrade);
    },

    renderGame: () => {
        MasterMode.score = 0;
        MasterMode.correct = 0;
        MasterMode.attempted = 0;
        MasterMode.timer = 60;
        MasterMode.isCoolingDown = false;
        if (MasterMode.gameInterval) clearInterval(MasterMode.gameInterval);

        App.appTitle.textContent = 'Master Test';
        App.screenContainer.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div id="scoreDisplay" class="text-3xl font-bold text-indigo-600">Score: 0</div>
                <div id="timerDisplay" class="text-3xl font-bold text-gray-700">60s</div>
            </div>
            <div class="progress-bar-container mb-6">
                <div id="progressBar" class="progress-bar" style="width: 0%;"></div>
            </div>
            
            <div id="problemDisplay" class="text-7xl font-extrabold text-center my-10 text-gray-800"></div>
            <div id="helperTextDisplay" class="text-center text-2xl font-medium text-green-600 h-8 mb-4"></div>
            <div id="answerContainer"></div>
        `;
        
        MasterMode.gameInterval = setInterval(() => {
            const timerDisplay = document.getElementById('timerDisplay');
            if (!timerDisplay) {
                clearInterval(MasterMode.gameInterval);
                return;
            }

            MasterMode.timer--;
            timerDisplay.textContent = `${MasterMode.timer}s`;
            if (MasterMode.timer <= 10) {
                timerDisplay.classList.add('text-red-700', 'animate-pulse');
            }
            if (MasterMode.timer <= 0) {
                clearInterval(MasterMode.gameInterval);
                MasterMode.renderResults();
            }
        }, 1000);

        MasterMode.nextProblem();
    },

    nextProblem: () => {
        if (MasterMode.timer <= 0) return; 
        MasterMode.isCoolingDown = false;
        
        const masterSettings = {
            ops: MasterMode.settings.ops,
            maxAddend: MasterMode.settings.maxAddend, // Master test uses grade max
            maxFactor: MasterMode.settings.maxFactor,
            currentMaxAddend: MasterMode.settings.maxAddend, // Set current to max
            currentMaxFactor: MasterMode.settings.maxFactor
        };
        MasterMode.problem = generateProblem(masterSettings);
        
        const { n1, n2, op, answer } = MasterMode.problem;

        document.getElementById('problemDisplay').textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        document.getElementById('helperTextDisplay').textContent = '';
        const answerContainer = document.getElementById('answerContainer');

        if (MasterMode.isMultipleChoice) {
            const choices = getMultipleChoices(answer);
            answerContainer.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    ${choices.map(choice => `
                        <button class="choice-button ${BTN_CHOICE} ${BTN_BLUE}" data-answer="${choice}">${choice}</button>
                    `).join('')}
                </div>
            `;
            document.querySelectorAll('.choice-button').forEach(btn => {
                btn.addEventListener('click', () => MasterMode.checkAnswer(btn.textContent));
                btn.disabled = false;
            });
        } else {
            answerContainer.innerHTML = `
                <input type="number" id="answerInput" class="w-full text-center text-4xl p-4 border-4 border-gray-300 rounded-lg shadow-inner focus:border-indigo-500 focus:ring-indigo-500" placeholder="Type answer...">
            `;
            const input = document.getElementById('answerInput');
            input.focus();
            
            document.removeEventListener('keydown', MasterMode.handleKeyboardInput);
            document.addEventListener('keydown', MasterMode.handleKeyboardInput);
        }
    },

    handleKeyboardInput: (e) => {
        if (e.key === 'Enter') {
            const input = document.getElementById('answerInput');
            if (input && !MasterMode.isCoolingDown) {
                MasterMode.checkAnswer(input.value);
            }
        }
    },

    checkAnswer: (userAnswer) => {
        if (MasterMode.isCoolingDown || userAnswer === '' || MasterMode.timer <= 0) return;

        MasterMode.isCoolingDown = true;
        MasterMode.attempted++;
        const { n1, n2, op, answer } = MasterMode.problem;
        const isCorrect = parseInt(userAnswer) === answer;
        const input = document.getElementById('answerInput');

        if (isCorrect) {
            playCorrectSound();
            MasterMode.correct++;
            // NEW: DYNAMIC SCORING for Master Test
            MasterMode.score += getScoreValue(n1, n2, op);
            
            if (MasterMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    if (parseInt(btn.dataset.answer) === answer) {
                        btn.classList.add('correct-flash');
                    }
                    btn.disabled = true;
                });
            } else {
                input.classList.add('correct-flash');
                input.disabled = true;
            }
            
            setTimeout(() => {
                if (input) input.classList.remove('correct-flash');
                MasterMode.nextProblem();
            }, 500); 

        } else {
            playIncorrectSound();
            
            if (MasterMode.isMultipleChoice) {
                document.querySelectorAll('.choice-button').forEach(btn => {
                    if (parseInt(btn.dataset.answer) === answer) {
                        btn.classList.add('correct-flash');
                    } else if (btn.textContent === userAnswer) {
                        btn.classList.add('incorrect-flash');
                    }
                    btn.disabled = true;
                });
            } else {
                input.classList.add('incorrect-flash');
                input.disabled = true;
                document.getElementById('helperTextDisplay').textContent = `Correct Answer: ${answer}`;
            }

            setTimeout(() => {
                if (input) {
                    input.classList.remove('incorrect-flash');
                    input.disabled = false;
                    input.value = '';
                    input.focus();
                }
                MasterMode.nextProblem();
            }, COOLDOWN_TIME);
        }
        
        document.getElementById('scoreDisplay').textContent = `Score: ${MasterMode.score}`;
        // Progress bar is now based on target *score* not target *count*
        const progress = (MasterMode.targetScore > 0) ? (MasterMode.score / MasterMode.targetScore) * 100 : 0;
        document.getElementById('progressBar').style.width = `${Math.min(progress, 100)}%`;
    },

    renderResults: () => {
        App.appTitle.textContent = 'Test Results';
        const accuracy = (MasterMode.attempted > 0) ? (MasterMode.correct / MasterMode.attempted * 100).toFixed(0) : 0;
        const passed = MasterMode.score >= MasterMode.targetScore;
        
        let resultMessage = passed
            ? `<h2 class="text-4xl font-bold text-green-600">You Passed!</h2><p class="text-2xl text-gray-700">You met the target score of ${MasterMode.targetScore}!</p>`
            : `<h2 class="text-4xl font-bold text-red-600">Try Again!</h2><p class="text-2xl text-gray-700">You were ${MasterLogit.targetScore - MasterMode.score} points away from the target of ${MasterMode.targetScore}.</p>`;

        App.screenContainer.innerHTML = `
            <div class="text-center space-y-6">
                ${resultMessage}
                <div class="grid grid-cols-2 gap-4 text-2xl">
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${MasterMode.score}</div>
                        <div class="text-lg text-gray-600">Final Score</div>
                    </div>
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${accuracy}%</div>
                        <div class="text-lg text-gray-600">Accuracy</div>
                    </div>
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${MasterMode.correct}</div>
                        <div class="text-lg text-gray-600">Correct</div>
                    </div>
                    <div class="bg-gray-100 p-6 rounded-lg">
                        <div class="font-bold text-5xl text-indigo-600">${MasterMode.attempted}</div>
                        <div class="text-lg text-gray-600">Attempted</div>
                    </div>
                </div>
                <button id="tryAgain" class="${BTN_BASE} ${BTN_BLUE}">Try Again</button>
                <button id="mainMenu" class="${BTN_BASE} ${BTN_GRAY}">Main Menu</button>
            </div>
        `;
        
        document.getElementById('tryAgain').addEventListener('click', () => MasterMode.start(MasterMode.gradeConfig));
        document.getElementById('mainMenu').addEventListener('click', renderGradeSelect);
    }
};

// --- 4. GAME MODE: FACTS DUEL ---
const DuelMode = {
    gradeConfig: {},
    settings: {},
    player1: { id: 1, score: 0, problem: {}, choices: [], isCoolingDown: false, containerId: 'player1Container', problemId: 'p1-problem', choicesId: 'p1-choices', scoreId: 'p1-score' },
    player2: { id: 2, score: 0, problem: {}, choices: [], isCoolingDown: false, containerId: 'player2Container', problemId: 'p2-problem', choicesId: 'p2-choices', scoreId: 'p2-score' },
    timer: 60,
    gameInterval: null,

    start: (gradeConfig) => {
        App.currentMode = 'duel';
        PracticeMode.clearMasteryLights(); // Clear lights
        DuelMode.gradeConfig = gradeConfig;
        DuelMode.renderSetupScreen();
    },

    renderSetupScreen: () => {
        App.appTitle.textContent = 'Duel Setup';
        const { maxAddend, maxFactor } = DuelMode.gradeConfig;
        
        const newMaxAdd = 50;
        const newMaxFact = 20;
        
        const defaultAdd = Math.min(maxAddend, newMaxAdd);
        const defaultFact = Math.min(maxFactor > 0 ? maxFactor : 12, newMaxFact);

        App.screenContainer.innerHTML = `
            <div class="space-y-6">
                <div class="text-center">
                    <label class="text-lg font-medium text-gray-700">Operations:</label>
                    <div class="flex justify-center space-x-6 mt-2">
                        ${DuelMode.gradeConfig.ops.map(op => `
                            <div class="flex items-center justify-center">
                                <input id="op-${op}" type="checkbox" checked class="form-checkbox h-5 w-5 text-indigo-600" value="${op}">
                                <label for="op-${op}" class="ml-2 text-2xl font-bold">${formatOp(op)}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="space-y-4">
                    <div>
                        <label for="duelMaxAdd" class="block text-sm font-medium text-gray-700">Max Number (+, -): <span id="duelMaxAddValue" class="font-bold">${defaultAdd}</span></label>
                        <input type="range" id="duelMaxAdd" min="5" max="${newMaxAdd}" value="${defaultAdd}" class="mt-1">
                    </div>
                    <div>
                        <label for="duelMaxFact" class="block text-sm font-medium text-gray-700">Max Number (x, ÷): <span id="duelMaxFactValue" class="font-bold">${defaultFact}</span></label>
                        <input type="range" id="duelMaxFact" min="2" max="${newMaxFact}" value="${defaultFact}" class="mt-1">
                    </div>
                </div>

                <button id="startDuelGame" class="${BTN_BASE} ${BTN_RED}">Start Duel!</button>
                ${getBackButton()}
            </div>
        `;

        document.getElementById('duelMaxAdd').addEventListener('input', e => {
            document.getElementById('duelMaxAddValue').textContent = e.target.value;
        });
        document.getElementById('duelMaxFact').addEventListener('input', e => {
            document.getElementById('duelMaxFactValue').textContent = e.target.value;
        });
        
        document.getElementById('startDuelGame').addEventListener('click', () => {
            const selectedOps = Array.from(document.querySelectorAll('.form-checkbox:checked')).map(cb => cb.value);
            if (selectedOps.length === 0) {
                alert("Please select at least one operation.");
                return;
            }
            
            DuelMode.settings = {
                ops: selectedOps,
                maxAddend: parseInt(document.getElementById('duelMaxAdd').value),
                maxFactor: parseInt(document.getElementById('duelMaxFact').value),
                // NEW: Use the settings for generateProblem
                currentMaxAddend: parseInt(document.getElementById('duelMaxAdd').value),
                currentMaxFactor: parseInt(document.getElementById('duelMaxFact').value),
                timer: 60
            };
            
            DuelMode.renderGame();
        });
        
        attachBackButtonListener(App.currentGrade);
    },

    renderGame: () => {
        DuelMode.player1.score = 0;
        DuelMode.player2.score = 0;
        DuelMode.player1.isCoolingDown = false;
        DuelMode.player2.isCoolingDown = false;
        DuelMode.timer = DuelMode.settings.timer;
        if (DuelMode.gameInterval) clearInterval(DuelMode.gameInterval);

        App.appTitle.textContent = 'Facts Duel!';
        App.screenContainer.innerHTML = `
            <div class="text-center mb-4">
                <div id="timerDisplay" class="text-5xl font-extrabold text-gray-800">${DuelMode.timer}s</div>
            </div>
            
            <div class="flex flex-col md:flex-row gap-6">
                <!-- Player 1 -->
                <div id="player1Container" class="flex-1 bg-red-100 p-4 rounded-lg shadow-md transition-all duration-100">
                    <h2 class="text-2xl font-bold text-red-700 text-center">Player 1 (A, S, D, F)</h2>
                    <div class="text-4xl font-bold text-center my-4" id="p1-score">Score: 0</div>
                    <div class="text-5xl font-bold text-center my-6" id="p1-problem"></div>
                    <div class="grid grid-cols-4 gap-2" id="p1-choices"></div>
                </div>
                
                <!-- Player 2 -->
                <div id="player2Container" class="flex-1 bg-blue-100 p-4 rounded-lg shadow-md transition-all duration-100">
                    <h2 class="text-2xl font-bold text-blue-700 text-center">Player 2 (J, K, L, ;)</h2>
                    <div class="text-4xl font-bold text-center my-4" id="p2-score">Score: 0</div>
                    <div class="text-5xl font-bold text-center my-6" id="p2-problem"></div>
                    <div class="grid grid-cols-4 gap-2" id="p2-choices"></div>
                </div>
            </div>
            <button id="endDuelEarly" class="${BTN_GRAY} mt-6">End Duel</button>
        `;
        
        document.getElementById('endDuelEarly').addEventListener('click', () => {
            if (DuelMode.gameInterval) clearInterval(DuelMode.gameInterval);
            DuelMode.renderResults();
        });

        DuelMode.gameInterval = setInterval(() => {
            DuelMode.timer--;
            const timerDisplay = document.getElementById('timerDisplay');
            if (timerDisplay) {
                timerDisplay.textContent = `${DuelMode.timer}s`;
                if (DuelMode.timer <= 10) {
                    timerDisplay.classList.add('text-red-700', 'animate-pulse');
                }
            }
            if (DuelMode.timer <= 0) {
                clearInterval(DuelMode.gameInterval);
                DuelMode.renderResults();
            }
        }, 1000);

        DuelMode.nextProblemForPlayer(DuelMode.player1);
        DuelMode.nextProblemForPlayer(DuelMode.player2);
        
        document.removeEventListener('keydown', DuelMode.handleKeyboardInput);
        document.addEventListener('keydown', DuelMode.handleKeyboardInput);
    },
    
    nextProblemForPlayer: (player) => {
        if (player.isCoolingDown) return;
        
        player.problem = generateProblem(DuelMode.settings);
        player.choices = getMultipleChoices(player.problem.answer);
        
        const { n1, n2, op } = player.problem;
        const keys = player.id === 1 ? ['A', 'S', 'D', 'F'] : ['J', 'K', 'L', ';'];
        
        const problemContainer = document.getElementById(player.problemId);
        const choiceContainer = document.getElementById(player.choicesId);

        if (!problemContainer || !choiceContainer) return;

        problemContainer.textContent = `${n1} ${formatOp(op)} ${n2} = ?`;
        choiceContainer.innerHTML = `
            ${player.choices.map((choice, index) => `
                <button class="choice-button ${BTN_DUEL} ${player.id === 1 ? BTN_RED : BTN_BLUE}" data-answer="${choice}">
                    <span class="font-bold text-sm opacity-75">${keys[index]}</span>
                    <span class="block text-4xl font-extrabold">${choice}</span>
                </button>
            `).join('')}
        `;
        
        choiceContainer.querySelectorAll('.choice-button').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (!player.isCoolingDown) {
                    DuelMode.checkAnswer(player, index);
                }
            });
        });
    },

    handleKeyboardInput: (e) => {
        if (DuelMode.timer <= 0) return;
        
        let playerTarget = null;
        let choiceIndex = -1;

        switch (e.key.toLowerCase()) {
            case 'a': playerTarget = DuelMode.player1; choiceIndex = 0; break;
            case 's': playerTarget = DuelMode.player1; choiceIndex = 1; break;
            case 'd': playerTarget = DuelMode.player1; choiceIndex = 2; break;
            case 'f': playerTarget = DuelMode.player1; choiceIndex = 3; break;
            
            case 'j': playerTarget = DuelMode.player2; choiceIndex = 0; break;
            case 'k': playerTarget = DuelMode.player2; choiceIndex = 1; break;
            case 'l': playerTarget = DuelMode.player2; choiceIndex = 2; break;
            case ';': playerTarget = DuelMode.player2; choiceIndex = 3; break;
        }

        if (playerTarget && choiceIndex !== -1 && !playerTarget.isCoolingDown) {
            e.preventDefault();
            DuelMode.checkAnswer(playerTarget, choiceIndex);
        }
    },

    checkAnswer: (player, choiceIndex) => {
        if (player.isCoolingDown || DuelMode.timer <= 0) return;
        
        player.isCoolingDown = true;
        const selectedAnswer = player.choices[choiceIndex];
        const { n1, n2, op, answer } = player.problem;
        const isCorrect = selectedAnswer === answer;
        const container = document.getElementById(player.containerId);
        const choiceButtons = document.getElementById(player.choicesId).querySelectorAll('button');

        if (isCorrect) {
            playCorrectSound();
            // NEW: DYNAMIC SCORING for Duel
            player.score += getScoreValue(n1, n2, op);
            container.classList.add('duel-correct-flash');
            
            choiceButtons[choiceIndex].classList.add('correct-flash');
            
            setTimeout(() => {
                container.classList.remove('duel-correct-flash');
                player.isCoolingDown = false;
                DuelMode.nextProblemForPlayer(player);
            }, 500); 

        } else {
            playIncorrectSound();
            // NEW: DYNAMIC SCORING PENALTY for Duel
            player.score = Math.max(0, player.score - getPenaltyValue(n1, n2, op));
            container.classList.add('duel-incorrect-flash');
            
            choiceButtons.forEach((btn, index) => {
                if (index === choiceIndex) {
                    btn.classList.add('incorrect-flash');
                }
                if (player.choices[index] === answer) {
                    btn.classList.add('correct-flash');
                }
            });

            setTimeout(() => {
                container.classList.remove('duel-incorrect-flash');
                player.isCoolingDown = false;
                DuelMode.nextProblemForPlayer(player);
            }, COOLDOWN_TIME);
        }
        
        document.getElementById(player.scoreId).textContent = `Score: ${player.score}`;
    },

    renderResults: () => {
        App.appTitle.textContent = 'Duel Over!';
        let winnerMessage = '';
        if (DuelMode.player1.score > DuelMode.player2.score) {
            winnerMessage = '<h2 class="text-4xl font-bold text-red-600">Player 1 Wins!</h2>';
        } else if (DuelMode.player2.score > DuelMode.player1.score) {
            winnerMessage = '<h2 class="text-4xl font-bold text-blue-600">Player 2 Wins!</h2>';
        } else {
            winnerMessage = '<h2 class="text-4xl font-bold text-indigo-600">It\'s a Tie!</h2>';
        }

        App.screenContainer.innerHTML = `
            <div class="text-center space-y-6">
                ${winnerMessage}
                <div class="flex flex-col md:flex-row gap-6 text-2xl">
                    <!-- Player 1 Score -->
                    <div class="flex-1 bg-red-100 p-6 rounded-lg">
                        <div class="text-lg text-red-700 font-bold">Player 1</div>
                        <div class="font-extrabold text-6xl text-red-600">${DuelMode.player1.score}</div>
                        <div class="text-lg text-gray-600">Final Score</div>
                    </div>
                    <!-- Player 2 Score -->
                    <div class="flex-1 bg-blue-100 p-6 rounded-lg">
                        <div class="text-lg text-blue-700 font-bold">Player 2</div>
                        <div class="font-extrabold text-6xl text-blue-600">${DuelMode.player2.score}</div>
                        <div class="text-lg text-gray-600">Final Score</div>
                    </div>
                </div>
                <button id="playAgain" class="${BTN_BASE} ${BTN_RED}">Play Again</button>
                <button id="mainMenu" class="${BTN_BASE} ${BTN_GRAY}">Main Menu</button>
            </div>
        `;
        
        document.getElementById('playAgain').addEventListener('click', () => DuelMode.start(DuelMode.gradeConfig));
        document.getElementById('mainMenu').addEventListener('click', renderGradeSelect);
    }
};

// --- APP INITIALIZATION ---
window.onload = () => {
    // Start by showing the grade selection screen
    renderGradeSelect();
};
