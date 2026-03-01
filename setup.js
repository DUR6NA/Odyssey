// ============================================================
// SETUP.JS — Full New Game Flow
// Phase 1: World Setup (Real Universe / Custom)
// Phase 2: Player Creation (AI fields get full context)
// Phase 3: Starting Situation
// Phase 4: AI Summary & Confirmation
// Phase 5: Game Launch
// ============================================================

// --- Data Stores ---
const worldAnswers = {};
const playerAnswers = {};
let startingScenario = '';
let aiProcessedResult = null;
let currentGameFolder = null;
let playerImageBaseURL = null;

function buildFetchPayload(model, messages, temp, maxTokens, topP, presPen, freqPen, provider, jsonSchema = null) {
    const payload = { model: model, messages: messages, temperature: temp, max_tokens: maxTokens, top_p: topP };
    if (presPen !== 0) payload.presence_penalty = presPen;
    if (freqPen !== 0) payload.frequency_penalty = freqPen;

    if (jsonSchema && typeof jsonSchema === 'object') {
        payload.response_format = {
            type: 'json_schema',
            json_schema: {
                name: "game_turn",
                strict: true,
                schema: jsonSchema
            }
        };
    } else if (jsonSchema !== false) {
        payload.response_format = { type: 'json_object' };
    }

    return JSON.stringify(payload);
}

const gameOutputSchema = {
    type: "object",
    properties: {
        time: {
            type: "object",
            properties: {
                hour: { type: "integer" },
                minute: { type: "integer" },
                period: { type: "string" },
                dayOfWeek: { type: "string" },
                day: { type: "integer" },
                month: { type: "integer" },
                year: { type: "integer" },
                era: { type: "string" },
                calendarType: { type: "string" }
            },
            required: ["hour", "minute", "period", "dayOfWeek", "day", "month", "year", "era", "calendarType"],
            additionalProperties: false
        },
        textoutput: {
            type: "string",
            description: "The main narrative text formatted purely in Markdown. Use standard markdown paragraphing, bolding, and italics."
        },
        inventory_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["add", "remove", "update"] },
                    name: { type: "string" },
                    newName: { type: "string" },
                    description: { type: "string" }
                },
                required: ["action", "name", "newName", "description"],
                additionalProperties: false
            }
        },
        location_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" }
                },
                required: ["name", "description"],
                additionalProperties: false
            }
        },
        npc_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    status_or_history: { type: "string" }
                },
                required: ["name", "status_or_history"],
                additionalProperties: false
            }
        },
        stats: {
            type: "object",
            properties: {
                health: { type: "integer" },
                money: { type: "integer" },
                hunger: { type: "integer" },
                thirst: { type: "integer" },
                energy: { type: "integer" }
            },
            required: ["health", "money", "hunger", "thirst", "energy"],
            additionalProperties: false
        }
    },
    required: ["time", "textoutput", "inventory_changes", "location_changes", "npc_changes", "stats"],
    additionalProperties: false
};

// --- Phase Tracking ---
let currentPhase = 'world'; // 'world', 'player', 'scenario', 'summary'
let currentStep = 0;

// --- World Setup Fields ---
const worldFieldsRealUniverse = [
    { id: 'startDate', type: 'date', label: 'When does your adventure begin?', section: 'real' },
    {
        id: 'tone', type: 'ai', label: 'Describe the tone / mood of your game:', isArray: false, section: 'real',
        aiHint: 'E.g. dark and gritty, lighthearted comedy, noir mystery, epic heroic, surreal and dreamlike...'
    }
];

// --- Preset Data (auto-fills world info for known universes) ---
const WORLD_PRESETS = {
    'harry potter': {
        name: 'The Wizarding World',
        era: 'Modern era — a hidden magical society coexisting alongside the Muggle world.',
        setting: 'A secret magical society hidden within modern-day Britain, centered around Hogwarts School of Witchcraft and Wizardry, Diagon Alley, Hogsmeade, and the Ministry of Magic.',
        tone: 'Whimsical and adventurous with undertones of mystery and coming-of-age drama. Can shift dark when dealing with Dark Wizards.',
        magicOrTech: 'Wand-based magic channeled through spoken incantations and wand movements. Potions, magical creatures, enchanted objects, Transfiguration, Charms, Defence Against the Dark Arts, and the Unforgivable Curses.',
        rules: 'Magic is hidden from Muggles by the Statute of Secrecy. Underage wizards cannot perform magic outside school. The three Unforgivable Curses (Avada Kedavra, Crucio, Imperio) are illegal. Time-Turners are heavily restricted.',
        dangers: 'Dark Wizards and their followers, magical creatures (dragons, dementors, basilisks), cursed artifacts, political corruption within the Ministry of Magic.',
        factions: ['The Order of the Phoenix', 'Death Eaters', 'The Ministry of Magic', 'Dumbledore\'s Army', 'The Hogwarts Houses (Gryffindor, Slytherin, Ravenclaw, Hufflepuff)'],
        calendarType: 'gregorian',
        wikiUrl: 'https://harrypotter.fandom.com/wiki/'
    },
    'star wars': {
        name: 'The Star Wars Galaxy',
        era: 'A galaxy-spanning civilization with hyperspace travel, encompassing eras from the Old Republic to the Rise of the First Order.',
        setting: 'A vast galaxy with thousands of star systems, diverse planets ranging from desert worlds (Tatooine) to city-planets (Coruscant), forest moons (Endor), and ice worlds (Hoth).',
        tone: 'Epic space opera blending heroic adventure, moral struggle between Light and Dark, political intrigue, and swashbuckling action.',
        magicOrTech: 'The Force — a mystical energy field generated by all living things. Jedi wield lightsabers and use the Light Side (telekinesis, mind tricks, precognition). Sith use the Dark Side (Force lightning, Force choke). Technology includes blasters, hyperdrives, droids, and planet-destroying superweapons.',
        rules: 'The Jedi Code forbids attachment and emotion-driven action. The Sith follow the Rule of Two (one master, one apprentice). Hyperspace travel requires calculated routes. The Force has a Light Side and Dark Side.',
        dangers: 'The Sith and Dark Side users, galactic wars, bounty hunters, crime syndicates (Hutt Cartel, Black Sun), hostile alien species, superweapons like the Death Star.',
        factions: ['The Jedi Order', 'The Sith', 'The Galactic Republic / Rebel Alliance / Resistance', 'The Galactic Empire / First Order', 'The Mandalorians', 'The Hutt Cartel', 'The Bounty Hunters Guild'],
        calendarType: 'starwars',
        wikiUrl: 'https://starwars.fandom.com/wiki/'
    },
    'the chronicles of narnia': {
        name: 'Narnia',
        era: 'A magical realm existing parallel to our world, with its own timeline spanning from creation to the end of days.',
        setting: 'The land of Narnia — a magical realm of talking animals, mythological creatures, enchanted forests, castles, and wild frontier lands. Accessible through magical portals from Earth.',
        tone: 'High fantasy with Christian allegorical undertones. Adventurous, wondrous, and morally clear with themes of courage, faith, and sacrifice.',
        magicOrTech: 'Deep Magic from the Dawn of Time and Deeper Magic from Before the Dawn of Time, governed by Aslan. Enchantments, magical artifacts (rings, wardrobe portals), potions, and the innate magic of Narnia itself.',
        rules: 'Aslan\'s Deep Magic governs the moral order. Treachery is punished by the Deep Magic. Only those called by Aslan can enter Narnia. Time flows differently between Narnia and Earth.',
        dangers: 'The White Witch and her followers, corrupted Narnians, Calormene invaders, dark magic, the Emerald Witch, sea serpents, and the forces that seek to undo Aslan\'s creation.',
        factions: ['The Narnians (Talking Animals, Dwarves, Centaurs)', 'The Calormenes', 'The Telmarines', 'The Followers of the White Witch', 'The Court of Cair Paravel'],
        calendarType: 'narnia',
        wikiUrl: 'https://narnia.fandom.com/wiki/'
    },
    'lord of the rings': {
        name: 'Middle-earth',
        era: 'The Third Age of Middle-earth, an age of fading Elven power and rising Shadow.',
        setting: 'Middle-earth — a vast continent with the Shire, Rivendell, Moria, Rohan, Gondor, Mordor, and many wild lands between. Ancient ruins, deep forests, towering mountains, and the ever-present shadow of Sauron.',
        tone: 'Epic high fantasy with themes of friendship, sacrifice, corruption, hope against despair, and the fading of an older, more magical world.',
        magicOrTech: 'Subtle and powerful magic wielded by the Istari (wizards like Gandalf), Elven rings of power, Sauron\'s One Ring, Palantíri (seeing stones), enchanted blades, and the innate magic of the Elves and Maiar.',
        rules: 'The One Ring corrupts all who bear it. The Valar do not directly intervene in mortal affairs. The Elves are departing Middle-earth. Morgoth\'s corruption lingers in the world.',
        dangers: 'Sauron and his armies of Orcs, Trolls, Nazgûl, and Haradrim. Balrogs in the deep places. Shelob and other ancient evils. The corrupting influence of the One Ring.',
        factions: ['The Fellowship / Free Peoples', 'Sauron\'s Forces (Mordor)', 'The Elves of Rivendell and Lothlórien', 'The Rohirrim', 'The Men of Gondor', 'The Istari (Wizards)', 'Saruman and Isengard'],
        calendarType: 'lotr',
        wikiUrl: 'https://lotr.fandom.com/wiki/'
    },
    'a song of ice and fire': {
        name: 'The Known World (Westeros & Essos)',
        era: 'A brutal medieval-inspired era of feudal politics, dynastic wars, and ancient returning threats.',
        setting: 'The Seven Kingdoms of Westeros — from the frozen Wall in the North to the sun-baked Dorne in the south. Across the Narrow Sea lies Essos with the Free Cities, Dothraki Sea, and Slaver\'s Bay.',
        tone: 'Grimdark political fantasy. Morally grey characters, brutal consequences, intricate political scheming, and the looming existential threat of the Others (White Walkers).',
        magicOrTech: 'Rare and returning magic: dragon-fire, blood magic, shadowbinding, greensight, warging into animals, wildfire (alchemical), Valyrian steel, and the ice magic of the Others. Dragons are the ultimate weapon.',
        rules: 'Power is taken, not given. Oaths and guest right are sacred (but frequently violated). The Night\'s Watch takes no part in the wars of the realm. "Winter is Coming" — seasons last years.',
        dangers: 'The Others (White Walkers) and the army of the dead, civil war among the Great Houses, wildfire, dragons, the Faceless Men assassins, Dothraki hordes, and the ruthless game of thrones itself.',
        factions: ['House Stark', 'House Lannister', 'House Targaryen', 'House Baratheon', 'The Night\'s Watch', 'The Iron Islands (Greyjoy)', 'House Martell (Dorne)', 'The Free Folk (Wildlings)'],
        calendarType: 'asoiaf',
        wikiUrl: 'https://awoiaf.westeros.org/index.php/'
    }
};

const worldFieldsCustom = [
    { id: 'preset', type: 'select', label: 'Select a Universe Preset (Optional)', options: ['None (Custom)', 'Harry Potter', 'Star Wars', 'The Chronicles of Narnia', 'Lord of the Rings', 'A Song of Ice and Fire'] },
    { id: 'name', type: 'text', label: 'What is your World called?' },
    { id: 'startDate', type: 'date', label: 'When does your adventure begin?' },
    {
        id: 'era', type: 'ai', label: 'Describe the Era / Time Period:', isArray: false,
        aiHint: 'E.g. medieval fantasy, cyberpunk 2200, Victorian steampunk, post-apocalyptic...'
    },
    {
        id: 'setting', type: 'ai', label: 'Describe the World Setting:', isArray: false,
        aiHint: 'E.g. a sprawling kingdom with floating islands, a dystopian mega-city, a haunted frontier town...'
    },
    {
        id: 'tone', type: 'ai', label: 'Describe the Tone / Mood:', isArray: false,
        aiHint: 'E.g. dark and gritty, lighthearted comedy, noir mystery, epic heroic...'
    },
    {
        id: 'magicOrTech', type: 'ai', label: 'Magic or Technology — describe the system:', isArray: false,
        aiHint: 'E.g. elemental magic from crystals, high-tech cybernetics, divine miracles, alchemy...'
    },
    {
        id: 'rules', type: 'ai', label: 'Any special World Rules or Laws?', isArray: false,
        aiHint: 'E.g. magic is outlawed, AI governs society, the dead can speak, gravity is reversed at night...'
    },
    {
        id: 'dangers', type: 'ai', label: 'What dangers lurk in this world?', isArray: false,
        aiHint: 'E.g. roaming dragon hordes, rogue AI, undead plague, political intrigue, cosmic horror...'
    },
    {
        id: 'factions', type: 'ai', label: 'Describe the major Factions or Groups:', isArray: true,
        aiHint: 'E.g. The Iron Brotherhood, The Elven Council, MegaCorp Industries...'
    }
];

// --- Player Setup Fields ---
const playerSetupFields = [
    { id: 'name', type: 'text', label: 'What is your Name?' },
    { id: 'age', type: 'number', label: 'How old are you?' },
    { id: 'gender', type: 'select', label: 'What is your Gender?', options: ['Male', 'Female', 'Other'] },
    { id: 'height', type: 'text', label: 'What is your Height? (e.g. 5\'11")' },
    { id: 'weight', type: 'text', label: 'What is your Weight? (e.g. 180lbs)' },
    {
        id: 'athleticism', type: 'attribute', label: 'How Athletic are you?', markers: [
            { value: 0, label: 'Couch Potato', desc: 'Out of breath walking upstairs' },
            { value: 15, label: 'Below Average', desc: 'Rarely exercises' },
            { value: 30, label: 'Average Joe', desc: 'Walks the dog, mows the lawn' },
            { value: 45, label: 'Fit', desc: 'Regular gym-goer' },
            { value: 60, label: 'Collegiate Athlete', desc: 'State-level competitor' },
            { value: 75, label: 'Pro Athlete', desc: 'LeBron James, Usain Bolt' },
            { value: 85, label: 'Captain America', desc: 'Peak human perfection' },
            { value: 100, label: 'Superhuman', desc: 'Beyond natural human limits' }
        ]
    },
    {
        id: 'intelligence', type: 'attribute', label: 'How Intelligent are you?', markers: [
            { value: 0, label: 'Simpleton', desc: 'Struggles with basic tasks' },
            { value: 15, label: 'Below Average', desc: 'Slow learner' },
            { value: 30, label: 'Average', desc: 'Normal reasoning ability' },
            { value: 45, label: 'Clever', desc: 'Quick thinker, street smart' },
            { value: 60, label: 'Gifted', desc: 'Top of the class' },
            { value: 75, label: 'Genius', desc: 'Tesla, Hawking level' },
            { value: 85, label: 'Einstein', desc: 'Once-in-a-generation mind' },
            { value: 100, label: 'Absolute Polymath & Polyglot', desc: 'Mastery of all disciplines and languages' }
        ]
    },
    { id: 'appearance', type: 'ai', label: 'Describe your Appearance:', isArray: false },
    { id: 'personality', type: 'ai', label: 'Describe your Personality:', isArray: false },
    { id: 'backstory', type: 'ai', label: 'Describe your Backstory:', isArray: false },
    { id: 'family', type: 'ai', label: 'Describe your Family:', isArray: true },
    { id: 'friends', type: 'ai', label: 'Describe your Friends:', isArray: true },
    { id: 'inventory', type: 'ai', label: 'What is in your Inventory?', isArray: true }
];

// ============================================================
// ENTRY POINT
// ============================================================
function initSetupMode() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.classList.add('hidden');

    const setupContainer = document.getElementById('setup-screen');
    if (setupContainer) setupContainer.classList.remove('hidden');

    currentPhase = 'world';
    currentStep = 0;
    renderWorldTypeChoice();
}

// ============================================================
// PHASE 1: WORLD SETUP
// ============================================================
function renderWorldTypeChoice() {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    // Phase indicator
    setupContent.appendChild(createPhaseIndicator('world'));

    const title = document.createElement('h2');
    title.className = 'setup-step-title';
    title.textContent = 'Choose Your World';
    setupContent.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'setup-question';
    subtitle.textContent = 'What kind of universe will your adventure take place in?';
    setupContent.appendChild(subtitle);

    const choiceContainer = document.createElement('div');
    choiceContainer.className = 'world-choice-container';

    // Real Universe card
    const realCard = document.createElement('div');
    realCard.className = 'world-choice-card';
    realCard.innerHTML = `
        <div class="world-choice-icon">🌍</div>
        <h3>Real Universe</h3>
        <p>Set your adventure in the real world. Choose a start date and define the tone of your story.</p>
    `;
    realCard.onclick = () => selectWorldType('real');
    choiceContainer.appendChild(realCard);

    // Custom Universe card
    const customCard = document.createElement('div');
    customCard.className = 'world-choice-card';
    customCard.innerHTML = `
        <div class="world-choice-icon">✨</div>
        <h3>Custom Universe</h3>
        <p>Build your own world from scratch with custom settings, magic systems, factions, and more.</p>
    `;
    customCard.onclick = () => selectWorldType('custom');
    choiceContainer.appendChild(customCard);

    setupContent.appendChild(choiceContainer);
}

function selectWorldType(type) {
    worldAnswers.type = type;
    currentStep = 0;
    currentPhase = 'world';
    renderWorldStep();
}

function getActiveWorldFields() {
    if (worldAnswers.type === 'real') return worldFieldsRealUniverse;

    const presetKey = (worldAnswers.preset || '').toLowerCase();
    const preset = WORLD_PRESETS[presetKey];

    if (preset) {
        // For presets, only ask for date and tone (tone can be overridden)
        return [
            { id: 'preset', type: 'select', label: 'Select a Universe Preset (Optional)', options: ['None (Custom)', 'Harry Potter', 'Star Wars', 'The Chronicles of Narnia', 'Lord of the Rings', 'A Song of Ice and Fire'] },
            { id: 'startDate', type: 'date', label: 'When does your adventure begin?' },
            {
                id: 'tone', type: 'ai', label: 'Describe the Tone / Mood (or keep the default):', isArray: false,
                aiHint: `Default: ${preset.tone}. Change it or leave as-is.`
            }
        ];
    }

    return worldFieldsCustom;
}

function renderWorldStep() {
    const fields = getActiveWorldFields();
    if (currentStep >= fields.length) {
        // World setup complete — move to player
        currentPhase = 'player';
        currentStep = 0;
        renderPlayerStep();
        return;
    }
    renderFieldStep(fields, currentStep, 'world', 'World Setup');
}

// ============================================================
// PHASE 2: PLAYER CREATION
// ============================================================
function renderPlayerStep() {
    if (currentStep >= playerSetupFields.length) {
        // Player creation complete — move to starting scenario
        currentPhase = 'scenario';
        renderScenarioStep();
        return;
    }
    renderFieldStep(playerSetupFields, currentStep, 'player', 'Player Creation');
}

// ============================================================
// GENERIC FIELD RENDERER
// ============================================================
function renderFieldStep(fields, step, phase, phaseLabel) {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    const field = fields[step];

    setupContent.appendChild(createPhaseIndicator(phase));

    const header = document.createElement('h2');
    header.className = 'setup-step-title';
    header.textContent = `Step ${step + 1} of ${fields.length}`;
    setupContent.appendChild(header);

    const questionText = document.createElement('p');
    questionText.className = 'setup-question';
    questionText.textContent = field.label;
    setupContent.appendChild(questionText);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'setup-input-wrap';

    const answers = phase === 'world' ? worldAnswers : playerAnswers;
    const prevValue = answers[field.id] || '';

    // --- Dice button creator ---
    const createDiceBtn = () => {
        const diceBtn = document.createElement('button');
        diceBtn.className = 'btn-dice';
        diceBtn.innerHTML = '🎲';
        diceBtn.title = 'Auto-generate with AI';
        diceBtn.onclick = () => autoGenerateForField(field, phase);
        return diceBtn;
    };

    // Helper: input + dice in a row
    const inputRow = document.createElement('div');
    inputRow.className = 'setup-input-row';

    const getPresetCalendar = () => {
        const presetKey = (worldAnswers.preset || '').toLowerCase();
        const preset = WORLD_PRESETS[presetKey];
        return preset ? preset.calendarType : 'gregorian';
    };

    if (field.type === 'text' || field.type === 'number') {
        const input = document.createElement('input');
        input.type = field.type;
        input.id = 'setup-field-input';
        input.className = 'setup-input';
        input.style.flex = '1';
        input.value = prevValue;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFieldAndNext(input.value, phase); });
        inputRow.appendChild(input);
        if (field.id !== 'preset') inputRow.appendChild(createDiceBtn());
        inputWrap.appendChild(inputRow);

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = 'Next';
        btn.onclick = () => saveFieldAndNext(input.value, phase);
        inputWrap.appendChild(btn);

    } else if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = 'setup-field-input';
        select.className = 'setup-input';
        select.style.flex = '1';
        field.options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.toLowerCase();
            el.textContent = opt;
            select.appendChild(el);
        });
        if (prevValue) select.value = prevValue;
        inputRow.appendChild(select);
        // No dice for preset selector or plain selects
        if (field.id !== 'preset') inputRow.appendChild(createDiceBtn());
        inputWrap.appendChild(inputRow);

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = 'Next';
        btn.onclick = () => saveFieldAndNext(select.value, phase);
        inputWrap.appendChild(btn);

    } else if (field.type === 'attribute') {
        // --- Attribute Slider with markers and "Define it myself" ---
        const container = document.createElement('div');
        container.className = 'attribute-slider-container';

        // Current label display
        const currentLabel = document.createElement('div');
        currentLabel.className = 'attribute-current-label';

        const labelName = document.createElement('span');
        labelName.className = 'attribute-label-name';
        const labelDesc = document.createElement('span');
        labelDesc.className = 'attribute-label-desc';
        currentLabel.appendChild(labelName);
        currentLabel.appendChild(labelDesc);
        container.appendChild(currentLabel);

        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.step = 1;
        slider.className = 'attribute-slider';
        slider.id = 'setup-field-input';

        // Find nearest marker for a given value
        const findNearestMarker = (val) => {
            let closest = field.markers[0];
            let minDist = Math.abs(val - closest.value);
            for (const m of field.markers) {
                const d = Math.abs(val - m.value);
                if (d < minDist) { minDist = d; closest = m; }
            }
            return closest;
        };

        // Set initial value
        let initialVal = 30; // default to "Average"
        if (prevValue && typeof prevValue === 'string') {
            const match = field.markers.find(m => m.label === prevValue);
            if (match) initialVal = match.value;
        }
        slider.value = initialVal;
        const initMarker = findNearestMarker(initialVal);
        labelName.textContent = initMarker.label;
        labelDesc.textContent = initMarker.desc;

        slider.addEventListener('input', () => {
            const val = parseInt(slider.value);
            const m = findNearestMarker(val);
            labelName.textContent = m.label;
            labelDesc.textContent = m.desc;
        });

        // Snap to nearest marker on release
        slider.addEventListener('change', () => {
            const m = findNearestMarker(parseInt(slider.value));
            slider.value = m.value;
            labelName.textContent = m.label;
            labelDesc.textContent = m.desc;
        });

        container.appendChild(slider);

        // Marker track
        const markerTrack = document.createElement('div');
        markerTrack.className = 'attribute-marker-track';
        field.markers.forEach(m => {
            const tick = document.createElement('div');
            tick.className = 'attribute-marker-tick';
            tick.style.left = m.value + '%';
            const tickLabel = document.createElement('span');
            tickLabel.className = 'attribute-marker-tick-label';
            tickLabel.textContent = m.label;
            tick.appendChild(tickLabel);
            markerTrack.appendChild(tick);
        });
        container.appendChild(markerTrack);

        inputWrap.appendChild(container);

        // "Define it myself" toggle
        const defineToggle = document.createElement('button');
        defineToggle.className = 'btn btn-secondary attribute-define-toggle';
        defineToggle.textContent = '✍️ Define it myself';

        const customWrap = document.createElement('div');
        customWrap.className = 'attribute-custom-wrap hidden';
        const customTextarea = document.createElement('textarea');
        customTextarea.className = 'setup-textarea attribute-custom-textarea';
        customTextarea.rows = 3;
        customTextarea.placeholder = 'Describe your ' + field.id + ' in your own words...';
        if (prevValue && typeof prevValue === 'string' && prevValue.startsWith('Custom: ')) {
            customTextarea.value = prevValue.replace('Custom: ', '');
        }
        customWrap.appendChild(customTextarea);

        let isCustomMode = false;
        defineToggle.onclick = () => {
            isCustomMode = !isCustomMode;
            if (isCustomMode) {
                container.classList.add('hidden');
                customWrap.classList.remove('hidden');
                defineToggle.textContent = '📊 Use the slider instead';
                customTextarea.focus();
            } else {
                container.classList.remove('hidden');
                customWrap.classList.add('hidden');
                defineToggle.textContent = '✍️ Define it myself';
            }
        };

        inputWrap.appendChild(defineToggle);
        inputWrap.appendChild(customWrap);

        // Next button
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = 'Next';
        btn.onclick = () => {
            if (isCustomMode) {
                const txt = customTextarea.value.trim();
                if (!txt) { alert('Please describe your ' + field.id + '.'); return; }
                saveFieldAndNext('Custom: ' + txt, phase);
            } else {
                const m = findNearestMarker(parseInt(slider.value));
                saveFieldAndNext(m.label, phase);
            }
        };
        inputWrap.appendChild(btn);

    } else if (field.type === 'date') {
        const cal = getPresetCalendar();
        const dateWrap = document.createElement('div');
        dateWrap.className = 'date-picker-wrap';
        dateWrap.style.flex = '1';
        const prevDate = prevValue || {};

        if (cal === 'starwars') {
            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'setup-input date-input date-year';
            yearInput.placeholder = 'Year (e.g. 4)';
            yearInput.value = prevDate.year || '';
            yearInput.id = 'date-year';

            const eraSelect = document.createElement('select');
            eraSelect.className = 'setup-input';
            eraSelect.id = 'date-era';
            ['BBY', 'ABY'].forEach(opt => {
                const el = document.createElement('option');
                el.value = opt; el.textContent = opt;
                eraSelect.appendChild(el);
            });
            if (prevDate.era) eraSelect.value = prevDate.era;

            dateWrap.appendChild(yearInput);
            dateWrap.appendChild(eraSelect);
            inputRow.appendChild(dateWrap);
            inputRow.appendChild(createDiceBtn());
            inputWrap.appendChild(inputRow);

            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Next';
            btn.onclick = () => saveFieldAndNext({ year: parseInt(yearInput.value) || 0, era: eraSelect.value, calendarType: 'starwars' }, phase);
            inputWrap.appendChild(btn);

        } else if (cal === 'lotr') {
            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'setup-input date-input date-year';
            yearInput.placeholder = 'Year (e.g. 3018)';
            yearInput.value = prevDate.year || '';
            yearInput.id = 'date-year';

            const eraSelect = document.createElement('select');
            eraSelect.className = 'setup-input';
            eraSelect.id = 'date-era';
            ['First Age', 'Second Age', 'Third Age', 'Fourth Age'].forEach(opt => {
                const el = document.createElement('option');
                el.value = opt; el.textContent = opt;
                eraSelect.appendChild(el);
            });
            if (prevDate.era) eraSelect.value = prevDate.era;

            dateWrap.appendChild(yearInput);
            dateWrap.appendChild(eraSelect);
            inputRow.appendChild(dateWrap);
            inputRow.appendChild(createDiceBtn());
            inputWrap.appendChild(inputRow);

            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Next';
            btn.onclick = () => saveFieldAndNext({ year: parseInt(yearInput.value) || 0, era: eraSelect.value, calendarType: 'lotr' }, phase);
            inputWrap.appendChild(btn);

        } else if (cal === 'asoiaf') {
            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'setup-input date-input date-year';
            yearInput.placeholder = 'Year (e.g. 298)';
            yearInput.value = prevDate.year || '';
            yearInput.id = 'date-year';

            const eraSelect = document.createElement('select');
            eraSelect.className = 'setup-input';
            eraSelect.id = 'date-era';
            ['BC', 'AC'].forEach(opt => {
                const el = document.createElement('option');
                el.value = opt; el.textContent = opt;
                eraSelect.appendChild(el);
            });
            if (prevDate.era) eraSelect.value = prevDate.era;

            dateWrap.appendChild(yearInput);
            dateWrap.appendChild(eraSelect);
            inputRow.appendChild(dateWrap);
            inputRow.appendChild(createDiceBtn());
            inputWrap.appendChild(inputRow);

            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Next';
            btn.onclick = () => saveFieldAndNext({ year: parseInt(yearInput.value) || 0, era: eraSelect.value, calendarType: 'asoiaf' }, phase);
            inputWrap.appendChild(btn);

        } else if (cal === 'narnia') {
            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'setup-input date-input date-year';
            yearInput.placeholder = 'Narnian Year (e.g. 1000)';
            yearInput.value = prevDate.year || '';
            yearInput.id = 'date-year';

            const label = document.createElement('span');
            label.textContent = ' NY (Narnian Year)';
            label.style.color = 'var(--text-heading)';
            label.style.alignSelf = 'center';

            dateWrap.appendChild(yearInput);
            dateWrap.appendChild(label);
            inputRow.appendChild(dateWrap);
            inputRow.appendChild(createDiceBtn());
            inputWrap.appendChild(inputRow);

            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Next';
            btn.onclick = () => saveFieldAndNext({ year: parseInt(yearInput.value) || 0, era: 'NY', calendarType: 'narnia' }, phase);
            inputWrap.appendChild(btn);

        } else {
            // Default Gregorian
            const monthInput = document.createElement('input');
            monthInput.type = 'number';
            monthInput.min = 1; monthInput.max = 12;
            monthInput.className = 'setup-input date-input';
            monthInput.placeholder = 'MM';
            monthInput.value = prevDate.month || '';
            monthInput.id = 'date-month';

            const dayInput = document.createElement('input');
            dayInput.type = 'number';
            dayInput.min = 1; dayInput.max = 31;
            dayInput.className = 'setup-input date-input';
            dayInput.placeholder = 'DD';
            dayInput.value = prevDate.day || '';
            dayInput.id = 'date-day';

            const yearInput = document.createElement('input');
            yearInput.type = 'number';
            yearInput.className = 'setup-input date-input date-year';
            yearInput.placeholder = 'YYYY';
            yearInput.value = prevDate.year || '';
            yearInput.id = 'date-year';

            const sep1 = document.createElement('span');
            sep1.className = 'date-separator'; sep1.textContent = '/';
            const sep2 = document.createElement('span');
            sep2.className = 'date-separator'; sep2.textContent = '/';

            dateWrap.appendChild(monthInput);
            dateWrap.appendChild(sep1);
            dateWrap.appendChild(dayInput);
            dateWrap.appendChild(sep2);
            dateWrap.appendChild(yearInput);
            inputRow.appendChild(dateWrap);
            inputRow.appendChild(createDiceBtn());
            inputWrap.appendChild(inputRow);

            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Next';
            btn.onclick = () => {
                const dateVal = {
                    day: parseInt(dayInput.value) || 1,
                    month: parseInt(monthInput.value) || 1,
                    year: parseInt(yearInput.value) || 2026,
                    calendarType: 'gregorian'
                };
                saveFieldAndNext(dateVal, phase);
            };
            inputWrap.appendChild(btn);
        }

    } else if (field.type === 'ai') {
        const textarea = document.createElement('textarea');
        textarea.id = 'setup-field-input';
        textarea.className = 'setup-textarea';
        textarea.rows = 4;
        textarea.style.flex = '1';
        textarea.placeholder = field.aiHint || 'Enter your idea here...';
        textarea.value = typeof prevValue === 'string' ? prevValue : '';
        inputRow.appendChild(textarea);
        inputRow.appendChild(createDiceBtn());
        inputWrap.appendChild(inputRow);

        const aiActions = document.createElement('div');
        aiActions.className = 'ai-actions-row';

        const btnGen = document.createElement('button');
        btnGen.className = 'btn btn-ai';
        btnGen.id = 'btn-generate-ai';
        btnGen.textContent = '✨ Refine with AI';
        btnGen.onclick = () => processWithAI(textarea.value, field, phase);
        aiActions.appendChild(btnGen);
        inputWrap.appendChild(aiActions);
    }

    // --- Universal Result Container (for both Refine and Dice Auto-Generate) ---
    const resultContainer = document.createElement('div');
    resultContainer.id = 'ai-result-block';
    resultContainer.className = 'ai-result-block hidden';

    const resultTextLabel = document.createElement('p');
    resultTextLabel.id = 'ai-result-label';
    resultTextLabel.innerHTML = '<strong>✨ AI Result:</strong>';
    resultContainer.appendChild(resultTextLabel);

    const resultDisplay = document.createElement('div');
    resultDisplay.id = 'ai-result-display';
    resultDisplay.className = 'ai-result-display';
    resultContainer.appendChild(resultDisplay);

    const approveRow = document.createElement('div');
    approveRow.className = 'approve-actions-row';

    const btnApprove = document.createElement('button');
    btnApprove.className = 'btn btn-success';
    btnApprove.textContent = '✓ Approve & Continue';
    btnApprove.onclick = () => saveFieldAndNext(aiProcessedResult, phase);

    const btnRegenerate = document.createElement('button');
    btnRegenerate.className = 'btn btn-warning';
    btnRegenerate.textContent = '🔄 Regenerate';
    btnRegenerate.onclick = () => {
        const inp = document.getElementById('setup-field-input');
        if (inp && inp.value && field.type === 'ai') {
            processWithAI(inp.value, field, phase);
        } else {
            autoGenerateForField(field, phase);
        }
    };

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-secondary';
    btnEdit.textContent = '✏️ Edit / Retry';
    btnEdit.onclick = () => {
        resultContainer.classList.add('hidden');
        const inp = document.getElementById('setup-field-input');
        if (inp) {
            if (typeof aiProcessedResult === 'string') inp.value = aiProcessedResult;
            inp.focus();
        }
    };

    approveRow.appendChild(btnApprove);
    approveRow.appendChild(btnRegenerate);
    approveRow.appendChild(btnEdit);
    resultContainer.appendChild(approveRow);
    inputWrap.appendChild(resultContainer);

    // Back button (if not on the very first step of phase 'world')
    if (step > 0 || phase !== 'world') {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary setup-back-btn';
        backBtn.textContent = '← Back';
        backBtn.onclick = () => goBack(phase);
        inputWrap.appendChild(backBtn);
    }

    setupContent.appendChild(inputWrap);

    // Initialize custom UI components (dropdowns, number inputs)
    if (typeof initCustomUIComponents === 'function') {
        initCustomUIComponents(setupContent);
    }

    // Focus input
    setTimeout(() => {
        const inp = document.getElementById('setup-field-input');
        if (inp && field.type !== 'date') inp.focus();
    }, 100);
}

// ============================================================
// AUTO-GENERATE FOR FIELD (Dice Button)
// ============================================================
async function autoGenerateForField(fieldInfo, phase) {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.85;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    if (!apiKey && provider !== 'openai') { alert('No API key found. Please configure it in Settings first.'); return; }

    // Build context
    const contextParts = [];
    if (Object.keys(worldAnswers).length > 0) contextParts.push(`WORLD INFO:\n${JSON.stringify(worldAnswers, null, 2)}`);
    if (Object.keys(playerAnswers).length > 0) contextParts.push(`PLAYER INFO:\n${JSON.stringify(playerAnswers, null, 2)}`);

    // Add preset info + wiki link
    const presetKey = (worldAnswers.preset || '').toLowerCase();
    const preset = WORLD_PRESETS[presetKey];
    if (preset) {
        contextParts.push(`PRESET UNIVERSE: ${presetKey}\nAll world details are pre-defined for this preset.\nWiki reference for accuracy: ${preset.wikiUrl}\nPlease ensure all generated content is accurate and consistent with the official lore of this universe.`);
    }

    let expectedFormatStr = "a single string";
    if (fieldInfo.isArray) {
        expectedFormatStr = "an array of strings";
    } else if (fieldInfo.type === 'number') {
        expectedFormatStr = "an integer number";
    } else if (fieldInfo.type === 'date') {
        const cal = preset ? preset.calendarType : 'gregorian';
        if (cal === 'starwars') expectedFormatStr = "an object with keys 'year' (integer) and 'era' (string: 'BBY' or 'ABY')";
        else if (cal === 'lotr') expectedFormatStr = "an object with keys 'year' (integer) and 'era' (string: one of 'First Age', 'Second Age', 'Third Age', 'Fourth Age')";
        else if (cal === 'asoiaf') expectedFormatStr = "an object with keys 'year' (integer) and 'era' (string: 'BC' or 'AC')";
        else if (cal === 'narnia') expectedFormatStr = "an object with keys 'year' (integer) and 'era' (string: 'NY')";
        else expectedFormatStr = "an object with keys 'day' (integer 1-31), 'month' (integer 1-12), and 'year' (integer)";
    } else if (fieldInfo.type === 'select') {
        expectedFormatStr = `a single string strictly chosen from: [${fieldInfo.options.join(', ')}]`;
    }

    const instructions = `You are an AI auto-generating a creative, fitting value for the '${fieldInfo.id}' field in a text-based RPG game setup.
The user pressed the "Auto-Generate" dice button because they want a suggestion.

Context of what has already been decided:
${contextParts.join('\n\n')}

Generate a highly creative, immersive, and lore-appropriate value for '${fieldInfo.id}'.
If this is a name, invent one fitting the world. If a date, pick something that makes narrative sense.
CRITICAL: Output ONLY a valid JSON object with exactly one key named "result". No markdown formatting.
The value of "result" must be ${expectedFormatStr}.`;

    try {
        // Show loading state on the result block
        const resultContainer = document.getElementById('ai-result-block');
        const resultDisplay = document.getElementById('ai-result-display');
        const resultLabel = document.getElementById('ai-result-label');
        if (resultLabel) resultLabel.innerHTML = '<strong>🎲 Generating...</strong>';
        if (resultDisplay) resultDisplay.textContent = '⏳ Thinking...';
        if (resultContainer) resultContainer.classList.remove('hidden');

        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') fetchUrl = "https://api.x.ai/v1/chat/completions";
        else if (provider === 'googleai') fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        else if (provider === 'openai') fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey || 'dummy'}`, 'Content-Type': 'application/json' },
            body: buildFetchPayload(model, [
                { role: 'system', content: instructions },
                { role: 'user', content: `Please auto-generate the '${fieldInfo.id}' field.` }
            ], temp, maxTokens, topP, presPen, freqPen, provider)
        });

        if (!response.ok) throw new Error(`API returned status ${response.status}: ${await response.text()}`);

        const data = await response.json();
        let content = data.choices && data.choices[0] && data.choices[0].message.content;
        content = content.trim();
        if (content.startsWith('```json')) content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        if (content.startsWith('```')) content = content.replace(/^```/, '').replace(/```$/, '').trim();

        const finalParsed = JSON.parse(content);
        if (finalParsed.result === undefined) throw new Error("AI did not return 'result' key.");

        aiProcessedResult = finalParsed.result;

        // Attach calendarType if date
        if (fieldInfo.type === 'date' && typeof aiProcessedResult === 'object') {
            const cal = preset ? preset.calendarType : 'gregorian';
            aiProcessedResult.calendarType = cal;
        }

        // Display
        if (resultLabel) resultLabel.innerHTML = '<strong>🎲 Auto-Generated:</strong>';
        resultDisplay.innerHTML = '';
        if (Array.isArray(aiProcessedResult)) {
            const ul = document.createElement('ul'); ul.style.textAlign = 'left';
            aiProcessedResult.forEach(item => { const li = document.createElement('li'); li.textContent = item; ul.appendChild(li); });
            resultDisplay.appendChild(ul);
        } else if (typeof aiProcessedResult === 'object') {
            if (aiProcessedResult.era) resultDisplay.textContent = `${aiProcessedResult.year} ${aiProcessedResult.era}`;
            else resultDisplay.textContent = `${aiProcessedResult.month || ''}/${aiProcessedResult.day || ''}/${aiProcessedResult.year || ''}`;
        } else {
            resultDisplay.textContent = aiProcessedResult;
        }
    } catch (err) {
        console.error('Auto-generate error:', err);
        const resultDisplay = document.getElementById('ai-result-display');
        const resultLabel = document.getElementById('ai-result-label');
        if (resultLabel) resultLabel.innerHTML = '<strong>❌ Error</strong>';
        if (resultDisplay) resultDisplay.textContent = err.message;
    }
}

// ============================================================
// NAVIGATION HELPERS
// ============================================================
function saveFieldAndNext(val, phase) {
    if (val === undefined || (typeof val === 'string' && val.trim() === '')) {
        alert('Please provide an answer.');
        return;
    }
    const answers = phase === 'world' ? worldAnswers : playerAnswers;
    const fields = phase === 'world' ? getActiveWorldFields() : playerSetupFields;
    const field = fields[currentStep];
    answers[field.id] = val;

    // When a preset is selected, auto-fill all preset fields into worldAnswers
    if (field.id === 'preset' && phase === 'world') {
        const presetKey = val.toLowerCase();
        const preset = WORLD_PRESETS[presetKey];
        if (preset) {
            worldAnswers.name = preset.name;
            worldAnswers.era = preset.era;
            worldAnswers.setting = preset.setting;
            worldAnswers.magicOrTech = preset.magicOrTech;
            worldAnswers.rules = preset.rules;
            worldAnswers.dangers = preset.dangers;
            worldAnswers.factions = preset.factions;
            worldAnswers.wikiUrl = preset.wikiUrl;
            // Tone is kept as editable, but we pre-fill it
            if (!worldAnswers.tone) worldAnswers.tone = preset.tone;
        } else {
            // "None (Custom)" — clear any preset auto-fills
            delete worldAnswers.wikiUrl;
        }
    }

    currentStep++;

    if (phase === 'world') {
        renderWorldStep();
    } else {
        renderPlayerStep();
    }
}

function goBack(phase) {
    if (currentStep > 0) {
        currentStep--;
        if (phase === 'world') renderWorldStep();
        else renderPlayerStep();
    } else if (phase === 'player') {
        // Go back to last world step
        currentPhase = 'world';
        const fields = getActiveWorldFields();
        currentStep = fields.length - 1;
        renderWorldStep();
    } else if (phase === 'world') {
        // Go back to world type choice
        renderWorldTypeChoice();
    }
}

// ============================================================
// PHASE INDICATOR
// ============================================================
function createPhaseIndicator(activePhaseStr) {
    let phases = [
        { id: 'world', label: 'World' },
        { id: 'player', label: 'Player' },
        { id: 'scenario', label: 'Scenario' }
    ];
    if (localStorage.getItem('jsonAdventure_enableImage') === 'true') {
        phases.push({ id: 'playerImage', label: 'Player Image' });
    }
    phases.push({ id: 'summary', label: 'Summary' });

    let activeIndex = phases.findIndex(p => p.id === activePhaseStr);
    if (activeIndex === -1) activeIndex = 0;

    const container = document.createElement('div');
    container.className = 'phase-indicator';

    phases.forEach((p, idx) => {
        const stepNum = idx + 1;
        const isActive = idx === activeIndex;
        const isCompleted = idx < activeIndex;

        const step = document.createElement('div');
        step.className = 'phase-step';
        if (isCompleted) step.classList.add('completed');
        if (isActive) step.classList.add('active');

        const circle = document.createElement('div');
        circle.className = 'phase-circle';
        circle.textContent = isCompleted ? '✓' : stepNum;

        const text = document.createElement('span');
        text.className = 'phase-label';
        text.textContent = p.label;

        step.appendChild(circle);
        step.appendChild(text);
        container.appendChild(step);

        if (idx < phases.length - 1) {
            const line = document.createElement('div');
            line.className = 'phase-line';
            if (isCompleted) line.classList.add('completed');
            container.appendChild(line);
        }
    });
    return container;
}

// ============================================================
// AI PROCESSING (with full context)
// ============================================================
async function processWithAI(userInputValue, fieldInfo, phase) {
    if (!userInputValue || userInputValue.trim() === '') {
        alert('Please enter some text for the AI to process.');
        return;
    }

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.7;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    if (!apiKey && provider !== 'openai') {
        alert('No API key found. Please configure it in Settings first.');
        return;
    }

    const btn = document.getElementById('btn-generate-ai');
    btn.textContent = '⏳ Processing...';
    btn.disabled = true;

    // Build context from all previously filled fields
    const contextParts = [];
    if (Object.keys(worldAnswers).length > 0) {
        contextParts.push(`WORLD INFO:\n${JSON.stringify(worldAnswers, null, 2)}`);
    }
    if (Object.keys(playerAnswers).length > 0) {
        contextParts.push(`PLAYER INFO:\n${JSON.stringify(playerAnswers, null, 2)}`);
    }
    const contextBlock = contextParts.length > 0
        ? `\n\nHere is all previously established context for this game:\n${contextParts.join('\n\n')}\n\nUse this context to make your answer consistent and fitting.`
        : '';

    // Add wiki reference for preset universes
    const presetKey = (worldAnswers.preset || '').toLowerCase();
    const presetData = WORLD_PRESETS[presetKey];
    const wikiHint = presetData ? `\nFor lore accuracy, reference: ${presetData.wikiUrl}` : '';

    const expectedFormat = fieldInfo.isArray ? 'an array of strings' : 'a single string';
    const domainHint = phase === 'world'
        ? localStorage.getItem('jsonAdventure_promptWorld') || 'You are a world-building assistant for a text-based RPG.'
        : localStorage.getItem('jsonAdventure_promptPlayer') || 'You are a game character creation assistant for a text-based RPG.';

    const promptInstructions = `${domainHint}
The user provided their input for the '${fieldInfo.id}' field.
Please fix any mistakes, formalize the answer, and expand slightly if the input is too brief to make it fitting and immersive.
${contextBlock}${wikiHint}
CRITICAL: You must output ONLY a valid JSON object. Do not include markdown code block formatting like \`\`\`json.
The JSON object must have exactly one key named "result", and its value must be ${expectedFormat}.`;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, [
                { role: 'system', content: promptInstructions },
                { role: 'user', content: `User input: ${userInputValue}` }
            ], temp, maxTokens, topP, presPen, freqPen, provider)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        let content = data.choices && data.choices[0] && data.choices[0].message.content;

        content = content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        }

        const finalParsed = JSON.parse(content);
        if (!finalParsed.result) {
            throw new Error("AI did not return 'result' key in JSON.");
        }

        aiProcessedResult = finalParsed.result;

        // Display results
        const resultContainer = document.getElementById('ai-result-block');
        const resultDisplay = document.getElementById('ai-result-display');

        resultDisplay.innerHTML = '';
        if (Array.isArray(aiProcessedResult)) {
            const ul = document.createElement('ul');
            ul.style.textAlign = 'left';
            aiProcessedResult.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
            resultDisplay.appendChild(ul);
        } else {
            resultDisplay.textContent = aiProcessedResult;
        }

        resultContainer.classList.remove('hidden');

    } catch (err) {
        console.error('AI Generation error:', err);
        alert('Failed to process with AI: ' + err.message);
    } finally {
        btn.textContent = '✨ Refine with AI';
        btn.disabled = false;
    }
}

// ============================================================
// PHASE 3: STARTING SCENARIO
// ============================================================
function renderScenarioStep() {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    setupContent.appendChild(createPhaseIndicator('scenario'));

    const title = document.createElement('h2');
    title.className = 'setup-step-title';
    title.textContent = 'Your Starting Situation';
    setupContent.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'setup-question';
    desc.textContent = 'Describe how your adventure begins. Set the scene — where are you, what\'s happening?';
    setupContent.appendChild(desc);

    const example = document.createElement('p');
    example.className = 'scenario-example';
    example.innerHTML = '<em>Example: "I was sleeping in bed, when a genie lamp appeared in the air, and fell on my chest waking me up."</em>';
    setupContent.appendChild(example);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'setup-input-wrap';

    const textarea = document.createElement('textarea');
    textarea.id = 'scenario-input';
    textarea.className = 'setup-textarea scenario-textarea';
    textarea.rows = 6;
    textarea.placeholder = 'Describe your starting scenario...';
    textarea.value = startingScenario || '';
    inputWrap.appendChild(textarea);

    const btnRow = document.createElement('div');
    btnRow.className = 'ai-actions-row';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-success';
    submitBtn.textContent = '🚀 Next Step';
    submitBtn.onclick = () => {
        const val = textarea.value.trim();
        if (!val) {
            alert('Please describe your starting scenario.');
            return;
        }
        startingScenario = val;
        if (localStorage.getItem('jsonAdventure_enableImage') === 'true') {
            currentPhase = 'playerImage';
            renderPlayerImageStep();
        } else {
            generateSummary();
        }
    };
    btnRow.appendChild(submitBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = '← Back';
    backBtn.onclick = () => {
        currentPhase = 'player';
        currentStep = playerSetupFields.length - 1;
        renderPlayerStep();
    };
    btnRow.appendChild(backBtn);

    inputWrap.appendChild(btnRow);
    setupContent.appendChild(inputWrap);

    setTimeout(() => { const ta = document.getElementById('scenario-input'); if (ta) ta.focus(); }, 100);
}

// ============================================================
// PHASE 3.5: PLAYER IMAGE GENERATION
// ============================================================
async function renderPlayerImageStep() {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';
    setupContent.appendChild(createPhaseIndicator('playerImage'));

    const title = document.createElement('h2');
    title.className = 'setup-step-title';
    title.textContent = 'Generating Player Image...';
    setupContent.appendChild(title);

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    setupContent.appendChild(spinner);

    const ds = document.createElement('p');
    ds.className = 'setup-question';
    ds.id = 'player-image-status';
    ds.textContent = 'Drafting image prompt based on your character details...';
    setupContent.appendChild(ds);

    try {
        const textPrompt = await generatePlayerImagePromptText({ isBaseImage: true });

        ds.textContent = 'Generating image... this may take a moment.';
        const imgUrl = await performImageGeneration(textPrompt, '2:3', null);
        if (!imgUrl) throw new Error("Could not generate image.");

        playerImageBaseURL = imgUrl;
        showPlayerImageConfirmation(imgUrl, textPrompt);
    } catch (err) {
        console.error(err);
        setupContent.innerHTML = `<h2>Error</h2><p>${err.message}</p>
        <button class="btn btn-warning" onclick="renderPlayerImageStep()">Retry</button>
        <button class="btn btn-secondary" onclick="generateSummary()">Skip to Summary</button>`;
    }
}

async function generatePlayerImagePromptText(context = {}) {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const defaultImagePromptBase = `You are an expert AI prompt engineer specializing in character visualization.
Your job is to write a highly detailed image generation prompt that depicts ONLY the player character.

CRITICAL RULES:
- The image must focus EXCLUSIVELY on the player character — do NOT depict other characters, narrative scenes, or story events.
- Show the character as a high-fidelity 3D rendered model with detailed textures, realistic materials, and cinematic lighting.
- The character should be shown in a 2:3 portrait composition, facing or slightly angled toward the camera.
- Show them in their current environment as a backdrop, but the player is the clear subject.
- Accurately depict what they are currently WEARING and CARRYING based on their inventory.
- If the current situation suggests physical effects (mud, blood, bruises, sweat, rain-soaked, torn clothing, burns, etc.), show those on the character.
- Write ONLY the final image prompt text. No preamble, no explanations.`;

    let promptBase = localStorage.getItem('jsonAdventure_promptImage') || defaultImagePromptBase;

    let promptText = promptBase + `\n\n`;

    // Add player appearance (fallback to playerAnswers for setup phase, then window.playerInfo for in-game)
    const appearance = context.playerAppearance
        || (window.playerInfo && window.playerInfo.player ? window.playerInfo.player.appearance : '')
        || (typeof playerAnswers !== 'undefined' ? playerAnswers.appearance : '')
        || '';
    if (appearance) {
        promptText += `PLAYER APPEARANCE:\n${appearance}\n\n`;
    }

    // Add inventory (what they're wearing/carrying)
    const inventory = context.inventory
        || (window.gamestate ? window.gamestate.inventory : null)
        || (typeof playerAnswers !== 'undefined' && Array.isArray(playerAnswers.inventory) ? playerAnswers.inventory : null)
        || [];
    if (inventory.length > 0) {
        const itemDescriptions = inventory.map(item => {
            if (typeof item === 'string') return item;
            return item.description ? `${item.name}: ${item.description}` : item.name;
        }).join('\n- ');
        promptText += `PLAYER EQUIPMENT & INVENTORY (show worn/carried items visually):\n- ${itemDescriptions}\n\n`;
    }

    // Add current game situation for environmental/state context
    if (context.gameText) {
        promptText += `CURRENT SITUATION (use this for environment, lighting, weather, and any physical effects on the player — muddy, bruised, injured, wet, etc.):\n${context.gameText}\n\n`;
    }

    // Add world context for setting/environment styling
    const worldData = context.worldData || (window.worldInfo) || buildWorldJson();
    promptText += `WORLD SETTING (for environment/backdrop style only):\n${JSON.stringify(worldData, null, 2)}\n\n`;

    if (context.isBaseImage) {
        promptText += `This is the INITIAL character portrait for a new game. Show them in their starting outfit and equipment, looking confident and ready for adventure.`;
    } else {
        promptText += `This is an IN-GAME update. The character should look exactly like their base appearance but updated to reflect their current situation, equipment, and any physical effects from recent events.`;
    }

    let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
    if (provider === 'xai') {
        fetchUrl = "https://api.x.ai/v1/chat/completions";
    } else if (provider === 'googleai') {
        fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    } else if (provider === 'openai') {
        fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    }

    const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey || 'dummy'}`,
            'Content-Type': 'application/json'
        },
        body: buildFetchPayload(model, [{ role: 'user', content: promptText }], 0.8, 600, 1.0, 0, 0, provider, false)
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error("Failed to generate image prompt: " + errText);
    }
    const data = await res.json();
    return data.choices[0].message.content.trim();
}

async function performImageGeneration(promptText, aspect_ratio = "2:3", baseImageUrl = null) {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const imageModel = localStorage.getItem('jsonAdventure_imageModel_' + provider) || localStorage.getItem('jsonAdventure_openRouterImageModel') || 'google/gemini-2.5-flash';

    let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
    let payload = {};

    if (provider === 'openrouter') {
        payload = {
            model: imageModel,
            messages: [{ role: 'user', content: promptText }],
            modalities: ["image"]
        };
    } else if (provider === 'xai') {
        // xAI: Use /v1/images/edits when we have a base image, otherwise /v1/images/generations
        if (baseImageUrl) {
            fetchUrl = "https://api.x.ai/v1/images/edits";
            payload = {
                model: imageModel,
                prompt: promptText,
                image: { url: baseImageUrl, type: "image_url" },
                aspect_ratio: aspect_ratio
            };
        } else {
            fetchUrl = "https://api.x.ai/v1/images/generations";
            payload = {
                model: imageModel,
                prompt: promptText,
                aspect_ratio: aspect_ratio
            };
        }
    } else {
        // OpenAI-compatible providers
        payload = {
            model: imageModel,
            prompt: promptText
        };

        if (provider === 'openai') {
            payload.size = "1024x1024";
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}images/generations` : `${baseUrl}/images/generations`;
        } else if (provider === 'googleai') {
            throw new Error("Direct Google Web API routing doesn't natively support OpenAI image gen via standard endpoint yet. Please use OpenRouter for Nano Banana.");
        }
    }

    const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey || 'dummy'}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Image Gen Error (${res.status}): ${errTxt}`);
    }

    const data = await res.json();

    if (provider === 'openrouter') {
        const message = data.choices[0].message;
        if (message.images && message.images.length > 0) {
            return message.images[0].url || message.images[0].image_url?.url || message.images[0];
        }
        const content = message.content || "";
        const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
        if (mdMatch && mdMatch[1]) return mdMatch[1];
        if (content.startsWith("http") || content.startsWith("data:image")) return content.trim();
    } else {
        if (data.data && data.data.length > 0 && data.data[0].url) {
            return data.data[0].url;
        }
    }

    console.warn("Could not find image in standard locations. Payload was:", data);
    return null;
}

function showPlayerImageConfirmation(imgUrl, textPrompt) {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';
    setupContent.appendChild(createPhaseIndicator('playerImage'));

    const title = document.createElement('h2');
    title.className = 'setup-step-title';
    title.textContent = 'Your Character Image';
    setupContent.appendChild(title);

    const imgContainer = document.createElement('div');
    imgContainer.style.textAlign = 'center';
    imgContainer.style.marginBottom = '20px';
    const imgElement = document.createElement('img');
    imgElement.src = imgUrl;
    imgElement.style.width = '100%';
    imgElement.style.maxWidth = '300px';
    imgElement.style.borderRadius = '8px';
    imgContainer.appendChild(imgElement);
    setupContent.appendChild(imgContainer);

    const promptWrap = document.createElement('div');
    promptWrap.className = 'setup-input-wrap';
    const promptLabel = document.createElement('p');
    promptLabel.textContent = 'Prompt used:';
    promptLabel.style.fontSize = '0.9em';
    promptLabel.style.color = 'var(--text-muted)';

    const promptInput = document.createElement('textarea');
    promptInput.className = 'setup-textarea';
    promptInput.rows = 4;
    promptInput.value = textPrompt;

    promptWrap.appendChild(promptLabel);
    promptWrap.appendChild(promptInput);
    setupContent.appendChild(promptWrap);

    const row = document.createElement('div');
    row.className = 'approve-actions-row';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-success';
    confirmBtn.textContent = '✓ Confirm & Continue';
    confirmBtn.onclick = () => {
        playerImageBaseURL = imgUrl;
        generateSummary();
    };

    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn btn-warning';
    regenBtn.textContent = '🔄 Regenerate (Edit Prompt)';
    regenBtn.onclick = async () => {
        setupContent.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;">Regenerating...</p>';
        try {
            const newUrl = await performImageGeneration(promptInput.value.trim(), '2:3');
            showPlayerImageConfirmation(newUrl || imgUrl, promptInput.value.trim());
        } catch (e) {
            alert(e.message);
            showPlayerImageConfirmation(imgUrl, promptInput.value.trim());
        }
    };

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = '← Back';
    backBtn.onclick = () => {
        currentPhase = 'scenario';
        renderScenarioStep();
    };

    row.appendChild(confirmBtn);
    row.appendChild(regenBtn);
    row.appendChild(backBtn);
    setupContent.appendChild(row);
}

// ============================================================
// PHASE 4: AI SUMMARY & CONFIRMATION
// ============================================================
async function generateSummary() {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    setupContent.appendChild(createPhaseIndicator('summary'));

    const loadingTitle = document.createElement('h2');
    loadingTitle.className = 'setup-step-title';
    loadingTitle.textContent = 'Generating Your Adventure Summary...';
    setupContent.appendChild(loadingTitle);

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    setupContent.appendChild(spinner);

    const loadingText = document.createElement('p');
    loadingText.className = 'setup-question';
    loadingText.textContent = 'The AI is reading through all your details and writing a summary...';
    setupContent.appendChild(loadingText);

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.8;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    if (!apiKey && provider !== 'openai') {
        alert('No OpenRouter API key found. Please configure it in Settings first.');
        renderScenarioStep();
        return;
    }

    // Build full context
    const worldData = buildWorldJson();
    const playerData = buildPlayerJson();

    const defaultSummaryPrompt = `You are the narrator and game master for a text-based RPG called "JSON Adventure".
The player has just finished creating their character and world. Read ALL the following information carefully and write a compelling, immersive narrative summary that weaves together:
- The world setting and tone
- The player character's background, personality, and appearance
- The starting scenario

Write it as a 2-3 paragraph narrative introduction — dramatic, atmospheric, and engaging. Write in second person ("You wake up...").`;

    const customSummaryBase = localStorage.getItem('jsonAdventure_promptSummary') || defaultSummaryPrompt;

    const summaryPrompt = `${customSummaryBase}

WORLD INFO:
${JSON.stringify(worldData, null, 2)}

PLAYER INFO:
${JSON.stringify(playerData, null, 2)}

STARTING SCENARIO:
${startingScenario}

CRITICAL: Output ONLY a valid JSON object with one key "summary" containing the narrative text as a string. Do not use markdown formatting.`;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, [
                { role: 'system', content: summaryPrompt },
                { role: 'user', content: 'Generate the adventure summary now.' }
            ], temp, maxTokens, topP, presPen, freqPen, provider)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(content);
        const summaryText = parsed.summary;

        displaySummary(summaryText);

    } catch (err) {
        console.error('Summary generation error:', err);
        alert('Failed to generate summary: ' + err.message);
        renderScenarioStep();
    }
}

function displaySummary(summaryText) {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    setupContent.appendChild(createPhaseIndicator('summary'));

    const title = document.createElement('h2');
    title.className = 'setup-step-title';
    title.textContent = 'Your Adventure Awaits';
    setupContent.appendChild(title);

    const summaryBlock = document.createElement('div');
    summaryBlock.className = 'summary-display';

    const paragraphs = summaryText.split('\n').filter(p => p.trim());
    paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.textContent = p;
        para.style.marginBottom = '12px';
        para.style.color = 'var(--text-main)';
        summaryBlock.appendChild(para);
    });

    setupContent.appendChild(summaryBlock);

    const btnRow = document.createElement('div');
    btnRow.className = 'approve-actions-row';
    btnRow.style.marginTop = '20px';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-success btn-large';
    confirmBtn.textContent = '⚔️ Begin Adventure';
    confirmBtn.onclick = () => finishSetup(summaryText);

    const redoBtn = document.createElement('button');
    redoBtn.className = 'btn btn-warning';
    redoBtn.textContent = '🔄 Redo Starting Scenario';
    redoBtn.onclick = () => {
        currentPhase = 'scenario';
        renderScenarioStep();
    };

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(redoBtn);
    setupContent.appendChild(btnRow);
}

// ============================================================
// BUILD JSON DATA
// ============================================================
function buildWorldJson() {
    const w = {
        world: {
            type: worldAnswers.type || 'real',
            preset: worldAnswers.preset || '',
            name: worldAnswers.name || (worldAnswers.type === 'real' ? 'Earth' : 'Unknown'),
            startDate: worldAnswers.startDate || { day: 1, month: 1, year: 2026 },
            tone: worldAnswers.tone || '',
            setting: worldAnswers.setting || (worldAnswers.type === 'real' ? 'The real world as we know it' : ''),
            era: worldAnswers.era || (worldAnswers.type === 'real' ? 'Modern day' : ''),
            rules: worldAnswers.rules || '',
            magicOrTech: worldAnswers.magicOrTech || '',
            dangers: worldAnswers.dangers || '',
            factions: worldAnswers.factions || '',
            wikiUrl: worldAnswers.wikiUrl || ''
        }
    };
    return w;
}

function buildPlayerJson() {
    return {
        player: {
            name: playerAnswers.name || 'Unknown',
            age: Number(playerAnswers.age) || 25,
            gender: playerAnswers.gender || 'male',
            height: playerAnswers.height || '5\'11"',
            weight: playerAnswers.weight || '180lbs',
            athleticism: playerAnswers.athleticism || 'average',
            intelligence: playerAnswers.intelligence || 'average',
            appearance: playerAnswers.appearance || '',
            personality: playerAnswers.personality || '',
            backstory: playerAnswers.backstory || '',
            'money-usd': 100,
            family: playerAnswers.family || [],
            friends: playerAnswers.friends || [],
            inventory: playerAnswers.inventory || []
        }
    };
}

function buildGameStateJson() {
    const sd = worldAnswers.startDate || { day: 1, month: 1, year: 2026 };
    const calType = sd.calendarType || 'gregorian';

    if (calType === 'gregorian') {
        return {
            time: {
                hour: 8,
                minute: 0,
                period: 'AM',
                dayOfWeek: getDayOfWeek(sd.year, sd.month, sd.day),
                day: sd.day || 1,
                month: sd.month || 1,
                year: sd.year || 2026,
                calendarType: 'gregorian'
            }
        };
    } else {
        // Custom calendar (starwars, lotr, asoiaf, narnia)
        return {
            time: {
                hour: 8,
                minute: 0,
                period: 'AM',
                dayOfWeek: 'Day 1',
                day: 1,
                month: 1,
                year: sd.year || 0,
                era: sd.era || '',
                calendarType: calType
            }
        };
    }
}

function getDayOfWeek(year, month, day) {
    if (!year || !month || !day) return 'Day 1';
    try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const d = new Date(year, month - 1, day);
        if (isNaN(d.getTime())) return 'Day 1';
        return days[d.getDay()];
    } catch (e) {
        return 'Day 1';
    }
}

// ============================================================
// PHASE 5: FINISH — SAVE & LAUNCH GAME
// ============================================================
async function finishSetup(summaryText) {
    const setupContent = document.getElementById('setup-content');
    setupContent.innerHTML = '';

    const loadingTitle = document.createElement('h2');
    loadingTitle.className = 'setup-step-title';
    loadingTitle.textContent = 'Preparing Your Adventure...';
    setupContent.appendChild(loadingTitle);

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    setupContent.appendChild(spinner);

    const worldData = buildWorldJson();
    const playerData = buildPlayerJson();
    const gameStateData = buildGameStateJson();

    const payload = {
        worldInfo: worldData,
        playerInfo: playerData,
        gameState: gameStateData,
        startingScenario: startingScenario,
        summary: summaryText,
        playerImage: playerImageBaseURL
    };

    try {
        const res = await fetch('/api/save-new-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Backend save failed. Are you running server.js?');

        const saveResult = await res.json();
        currentGameFolder = saveResult.folder;

        // Download and save the base player image locally (xAI URLs expire)
        if (playerImageBaseURL) {
            try {
                await fetch('/api/download-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: currentGameFolder, url: playerImageBaseURL })
                });
                console.log('Base player image saved locally.');
            } catch (imgErr) {
                console.warn('Failed to save base image locally:', imgErr);
            }
        }

        // Now send everything to AI to start the game
        await launchGame(summaryText, payload);

    } catch (err) {
        console.error('Save error:', err);
        setupContent.innerHTML = `<h2>Save Error</h2>
            <p>${err.message}</p>
            <button class="btn" onclick="finishSetup('${summaryText.replace(/'/g, "\\'")}')">Retry</button>`;
    }
}

// ============================================================
// GAME LAUNCH — Send to AI and show game screen
// ============================================================
async function launchGame(summaryText, allData) {
    const setupScreen = document.getElementById('setup-screen');
    if (setupScreen) setupScreen.classList.add('hidden');

    // Show the main game UI
    const layout = document.querySelector('.layout');
    if (layout) layout.style.display = 'grid';

    // Update game state and initial UI
    if (!allData.gameState.stats) allData.gameState.stats = { health: 100, money: allData.playerInfo.player['money-usd'] || 0 };
    if (!allData.gameState.inventory) allData.gameState.inventory = allData.playerInfo.player.inventory.map(i => typeof i === 'string' ? { name: i, description: '' } : i) || [];
    window.gamestate = allData.gameState;
    window.worldInfo = allData.worldInfo || {};
    window.playerInfo = allData.playerInfo || {};
    window.gameSummaryText = summaryText;

    if (window.gamestate.time && typeof updateClock === 'function') {
        updateClock(window.gamestate.time);
    }
    if (typeof updateStatsUI === 'function') {
        updateStatsUI(window.gamestate.stats);
    }
    if (typeof renderInventoryUI === 'function') {
        renderInventoryUI();
    }

    // NEW: Ensure Image UI is shown correctly on new game start
    const enableImage = localStorage.getItem('jsonAdventure_enableImage') === 'true';
    if (enableImage) {
        const imgWidget = document.getElementById('player-image-widget');
        if (imgWidget) imgWidget.style.display = 'block';
        if (playerImageBaseURL) {
            const imgEl = document.getElementById('player-dynamic-image');
            const placeholder = document.getElementById('player-dynamic-image-placeholder');
            if (imgEl && placeholder) {
                imgEl.src = playerImageBaseURL;
                imgEl.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }
    }

    // Clear example messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    // Build the game system prompt
    const gamePrompt = buildGameSystemPrompt(allData, summaryText);

    // Store game prompt for future messages
    window.gameSystemPrompt = gamePrompt;
    window.chatHistory = [
        { role: 'system', content: gamePrompt }
    ];

    // Send the initial message to AI
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.8;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    // Show a loading message
    const loadingMsg = createChatMessage('ai', '⏳ The adventure is loading...');
    chatMessages.appendChild(loadingMsg);

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, [
                { role: 'system', content: gamePrompt },
                { role: 'user', content: `Begin the adventure. Here is the opening scenario:\n\n${allData.startingScenario}\n\nNarrate this opening scene immersively and then present the player with their first choice or opportunity to act.` }
            ], temp, maxTokens, topP, presPen, freqPen, provider, gameOutputSchema)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;

        // Store in chat history
        window.chatHistory.push({ role: 'user', content: `Begin the adventure. Here is the opening scenario:\n\n${startingScenario}` });
        window.chatHistory.push({ role: 'assistant', content: aiText });

        // Display the AI's opening
        chatMessages.innerHTML = '';
        const displayText = processGameTurnJson(aiText);
        const aiMsg = createChatMessage('ai', displayText);
        chatMessages.appendChild(aiMsg);

    } catch (err) {
        console.error('Game launch error:', err);
        chatMessages.innerHTML = '';
        const errorMsg = createChatMessage('ai', `⚠️ Failed to start the adventure: ${err.message}\n\nPlease check your API key in Settings and try again.`);
        chatMessages.appendChild(errorMsg);
    }

    // Wire up the chat input for ongoing gameplay
    setupChatInput();
    saveCurrentGame();
}

function buildGameSystemPrompt(allData, summaryText) {
    const defaultGamePrompt = `You are now a seasoned novelist acting as the Game Master. Write a dynamic, immersive, and grounded text-based adventure. 

CRITICAL NARRATIVE RULES:
1. Grounded & Natural Prose: Write like a high-quality, traditionally published novel. The prose should flow naturally. Put the player inside a breathing world. The world exists on its own; the player is simply the protagonist navigating it. 
2. Realistic Dialogue: ALL dialogue MUST be enclosed in proper double quotation marks (e.g., "Hello there," she said.). Characters must speak like normal, grounded humans. Absolutely NO hammy, hyper-stylized slang, forced era-specific jargon, or excessive "quippy" banter. Dialogue should sound like a real conversation, placed on its own line when a new character speaks.
3. No Meta-References: Do not constantly remind the player of the setting or throw out random historical/world facts unless it makes strict narrative sense.
4. Clean Readability: Break your response into several short paragraphs (2-4 sentences max). Use standard Markdown formatting (bolding, italics).
5. No Stats or Lists in Text: NEVER output numbers for stat changes, and NEVER output a numbered list of options at the end. Describe the consequences naturally in the prose, and end the narrative by presenting an open-ended situation or a subtle hook for the player to react to. Let them decide what to do next without dictating a menu of choices.
6. Player Agency: NEVER speak for the player character or take actions for them.

CURRENCY RULE: Always track the player's money through the stats.money field (as an integer). Do NOT create inventory items for money, credits, coins, gold, or any form of currency. When the player earns or spends money, update stats.money to the new total. Only use inventory_changes for physical items.

INVENTORY UPDATE RULE: When an existing inventory item changes (e.g. quantity, condition, or name), use the "update" action with the item's current name and set newName/description to the updated values. Do NOT remove and re-add items to change them — use "update" instead.

Rely on the background JSON systems to handle stats, inventory, and time. Your ONLY job in the text output is to write a beautiful, grounded, and engaging story.`;

    const customBase = localStorage.getItem('jsonAdventure_promptGame') || defaultGamePrompt;

    return `${customBase}

=== WORLD INFO ===
${JSON.stringify(allData.worldInfo, null, 2)}

=== PLAYER CHARACTER ===
${JSON.stringify(allData.playerInfo, null, 2)}

=== GAME STATE ===
${JSON.stringify(allData.gameState, null, 2)}

=== ADVENTURE SUMMARY ===
${summaryText}`;
}

// ============================================================
// CHAT INTERFACE (In-Game)
// ============================================================
// Helper for parsing game JSON
function processGameTurnJson(aiText) {
    let aiJson = { textoutput: aiText };
    try {
        let content = aiText.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        }
        aiJson = JSON.parse(content);
    } catch (e) {
        console.error("Failed to parse AI JSON:", e);
    }

    const displayText = aiJson.textoutput || aiText;

    if (!window.gamestate) return displayText;

    if (aiJson.time) {
        window.gamestate.time = aiJson.time;
        if (typeof updateClock === 'function') updateClock(window.gamestate.time);
    }
    if (aiJson.stats) {
        if (!window.gamestate.stats) window.gamestate.stats = {};
        Object.assign(window.gamestate.stats, aiJson.stats);
        if (typeof updateStatsUI === 'function') updateStatsUI(window.gamestate.stats);
    }
    if (aiJson.inventory_changes && Array.isArray(aiJson.inventory_changes)) {
        if (!window.gamestate.inventory) window.gamestate.inventory = [];
        aiJson.inventory_changes.forEach(change => {
            if (change.action === 'add') {
                window.gamestate.inventory.push({ name: change.name, description: change.description || '' });
            } else if (change.action === 'remove') {
                window.gamestate.inventory = window.gamestate.inventory.filter(i => i.name !== change.name);
            } else if (change.action === 'update') {
                let item = window.gamestate.inventory.find(i => i.name.toLowerCase() === change.name.toLowerCase());
                if (item) {
                    if (change.newName && change.newName.trim()) item.name = change.newName;
                    if (change.description && change.description.trim()) item.description = change.description;
                }
            }
        });
        if (typeof renderInventoryUI === 'function') renderInventoryUI();
    }
    if (aiJson.location_changes && Array.isArray(aiJson.location_changes)) {
        if (!window.gamestate.locations) window.gamestate.locations = [];
        aiJson.location_changes.forEach(change => {
            let loc = window.gamestate.locations.find(l => l.name.toLowerCase() === change.name.toLowerCase());
            if (loc) {
                loc.description = change.description;
            } else {
                window.gamestate.locations.push({ name: change.name, description: change.description || '' });
            }
        });
    }
    if (aiJson.npc_changes && Array.isArray(aiJson.npc_changes)) {
        if (!window.gamestate.npcs) window.gamestate.npcs = [];
        aiJson.npc_changes.forEach(change => {
            let npc = window.gamestate.npcs.find(n => n.name.toLowerCase() === change.name.toLowerCase());
            if (npc) {
                npc.status_or_history = change.status_or_history;
            } else {
                window.gamestate.npcs.push({ name: change.name, status_or_history: change.status_or_history || '' });
            }
        });
    }
    return displayText;
}

function createChatMessage(type, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type === 'ai' ? 'ai-message' : 'user-message'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = type === 'ai' ? 'AI' : 'U';

    const body = document.createElement('div');
    body.className = 'message-body';

    const content = document.createElement('div');
    content.className = 'message-content';

    if (type === 'ai' && typeof marked !== 'undefined') {
        content.innerHTML = marked.parse(text);
    } else {
        content.textContent = text;
    }

    const options = document.createElement('div');
    options.className = 'message-options';

    if (type === 'ai') {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'msg-action-btn';
        regenBtn.title = 'Regenerate';
        regenBtn.textContent = '🔄';
        regenBtn.onclick = () => regenerateLastAI();

        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.title = 'Copy';
        copyBtn.textContent = '📋';
        copyBtn.onclick = () => navigator.clipboard.writeText(text);

        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'msg-action-btn';
        ttsBtn.title = 'Play Audio';
        ttsBtn.textContent = '🔊';
        ttsBtn.onclick = () => playTTS(text);

        options.appendChild(regenBtn);
        options.appendChild(copyBtn);
        options.appendChild(ttsBtn);
    } else {
        const editBtn = document.createElement('button');
        editBtn.className = 'msg-action-btn';
        editBtn.title = 'Edit';
        editBtn.textContent = '✏️';
        editBtn.onclick = () => editMessage(msgDiv);
        options.appendChild(editBtn);
    }

    body.appendChild(content);
    body.appendChild(options);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(body);

    return msgDiv;
}

function editMessage(msgDiv) {
    const chatMessages = document.getElementById('chat-messages');
    const allNodes = Array.from(chatMessages.children);
    const domIndex = allNodes.indexOf(msgDiv);
    if (domIndex === -1) return;

    // Get the exact user text from DOM so prompter context instructions aren't shown to user
    const msgContentText = msgDiv.querySelector('.message-content').textContent;

    // Count how many user messages appear in DOM *after* this message.
    // This provides a robust way to find the actual corresponding message in chatHistory,
    // ignoring discrepancies at the beginning.
    let domUserMsgsAfter = 0;
    for (let i = domIndex + 1; i < allNodes.length; i++) {
        if (allNodes[i].classList.contains('user-message')) {
            domUserMsgsAfter++;
        }
    }

    // Find corresponding user message in window.chatHistory searching from the end
    let historyIdxToRemoveFrom = -1;
    let historyUserMsgsSeenFromEnd = 0;
    for (let i = window.chatHistory.length - 1; i >= 0; i--) {
        if (window.chatHistory[i].role === 'user') {
            if (historyUserMsgsSeenFromEnd === domUserMsgsAfter) {
                historyIdxToRemoveFrom = i;
                break;
            }
            historyUserMsgsSeenFromEnd++;
        }
    }

    if (historyIdxToRemoveFrom === -1) {
        console.error("Could not find corresponding message in chatHistory.");
        return; // Fallback in case of unexpected state
    }

    // 1. Remove from DOM (the edited message + all subsequent messages)
    for (let i = domIndex; i < allNodes.length; i++) {
        chatMessages.removeChild(allNodes[i]);
    }

    // 2. Remove from window.chatHistory
    window.chatHistory.splice(historyIdxToRemoveFrom);

    // 3. Put original text back in chat input
    const chatInput = document.getElementById('chat-input');
    chatInput.value = msgContentText;
    chatInput.style.height = 'auto';
    chatInput.focus();

    // 4. Save game state so reload works consistently
    if (typeof saveCurrentGame === 'function') {
        saveCurrentGame();
    }
}

async function runPrompter(userInput) {
    if (!window.gamestate) return userInput;

    const npcs = window.gamestate.npcs || [];
    const locations = window.gamestate.locations || [];

    // If no context to provide, skip
    if (npcs.length === 0 && locations.length === 0) return userInput;

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';
    if (!apiKey && provider !== 'openai') return userInput;

    const defaultPrompterPrompt = `You are the Prompter. You sit between the user and the Game Master.
Your job is to read the user's input and determine if they mentioned any known Locations or NPCs in the game state. 
If they did, you must extract those details and provide them so the Game Master remembers them correctly.`;
    const customPrompterPrompt = localStorage.getItem('jsonAdventure_promptPrompter') || defaultPrompterPrompt;

    const promptInstructions = `${customPrompterPrompt}

KNOWN NPCS:
${JSON.stringify(npcs)}

KNOWN LOCATIONS:
${JSON.stringify(locations)}

USER INPUT:
"${userInput}"

CRITICAL: Output ONLY a JSON object:
{
  "relevant": true/false, // Set to true ONLY if they mentioned one of the known NPCs or Locations
  "context_string": "Write a short summary of the relevant NPCs/Locations here. Leave empty if none."
}`;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, [
                { role: 'system', content: promptInstructions }
            ], 0.1, 512, 1.0, 0, 0, provider)
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            const parsed = JSON.parse(content.replace(/^```json/, '').replace(/```$/, '').trim());

            if (parsed.relevant && parsed.context_string && parsed.context_string.trim()) {
                console.log("Prompter injected context:", parsed.context_string);
                return `[SYSTEM NOTE - KNOWN CONTEXT FOR RELEVANT ENTITIES: ${parsed.context_string}]\n\nPlayer action: ${userInput}`;
            }
        }
    } catch (err) {
        console.error("Prompter error:", err);
    }

    return userInput;
}

// Ensure the chat input dynamically scales
function setupChatInput() {
    const sendBtn = document.querySelector('.send-btn');
    const chatInput = document.getElementById('chat-input');

    // Remove old listeners by cloning
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

    const newChatInput = chatInput.cloneNode(true);
    chatInput.parentNode.replaceChild(newChatInput, chatInput);

    newSendBtn.onclick = () => sendChatMessage();
    newChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    newChatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') this.style.height = 'auto';
    });
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';

    const chatMessages = document.getElementById('chat-messages');

    // Add user message
    const userMsg = createChatMessage('user', message);
    chatMessages.appendChild(userMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show loading for prompter step
    const loadingMsg = createChatMessage('ai', '⏳ Prompter is checking context...');
    chatMessages.appendChild(loadingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Run the prompter to enrich the input
    const promptedMessage = await runPrompter(message);

    // Update loading text
    const loaderContent = loadingMsg.querySelector('.message-content');
    if (loaderContent) loaderContent.textContent = '⏳ Thinking...';

    // Add to history (with potential prompter context)
    window.chatHistory.push({ role: 'user', content: promptedMessage });

    // Refresh system prompt with latest game state before sending
    if (window.chatHistory.length > 0 && window.chatHistory[0].role === 'system') {
        const allData = {
            worldInfo: window.worldInfo || {},
            playerInfo: window.playerInfo || {},
            gameState: window.gamestate || {}
        };
        window.chatHistory[0].content = buildGameSystemPrompt(allData, window.gameSummaryText || '');
    }

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.8;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, window.chatHistory, temp, maxTokens, topP, presPen, freqPen, provider, gameOutputSchema)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;

        window.chatHistory.push({ role: 'assistant', content: aiText });

        // Replace loading with real message
        chatMessages.removeChild(loadingMsg);
        const displayText = processGameTurnJson(aiText);
        const aiMsg = createChatMessage('ai', displayText);
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        saveCurrentGame();

        if (localStorage.getItem('jsonAdventure_enableAutoImage') === 'true') {
            triggerImageGeneration();
        }

    } catch (err) {
        chatMessages.removeChild(loadingMsg);
        const errorMsg = createChatMessage('ai', `⚠️ Error: ${err.message}`);
        chatMessages.appendChild(errorMsg);
    }
}

async function regenerateLastAI() {
    if (!window.chatHistory || window.chatHistory.length < 2) return;

    // Remove last AI response from history
    if (window.chatHistory[window.chatHistory.length - 1].role === 'assistant') {
        window.chatHistory.pop();
    }

    const chatMessages = document.getElementById('chat-messages');
    // Remove last AI message from DOM
    const allMessages = chatMessages.querySelectorAll('.ai-message');
    if (allMessages.length > 0) {
        chatMessages.removeChild(allMessages[allMessages.length - 1]);
    }

    // Show loading
    const loadingMsg = createChatMessage('ai', '🔄 Regenerating...');
    chatMessages.appendChild(loadingMsg);

    // Refresh system prompt with latest game state before sending
    if (window.chatHistory.length > 0 && window.chatHistory[0].role === 'system') {
        const allData = {
            worldInfo: window.worldInfo || {},
            playerInfo: window.playerInfo || {},
            gameState: window.gamestate || {}
        };
        window.chatHistory[0].content = buildGameSystemPrompt(allData, window.gameSummaryText || '');
    }

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || 0.85;
    const maxTokens = parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens')) || 2048;
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey || 'dummy'}`,
                'Content-Type': 'application/json'
            },
            body: buildFetchPayload(model, window.chatHistory, temp, maxTokens, topP, presPen, freqPen, provider, gameOutputSchema)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;

        window.chatHistory.push({ role: 'assistant', content: aiText });

        chatMessages.removeChild(loadingMsg);
        const displayText = processGameTurnJson(aiText);
        const aiMsg = createChatMessage('ai', displayText);
        chatMessages.appendChild(aiMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        saveCurrentGame();

        if (localStorage.getItem('jsonAdventure_enableAutoImage') === 'true') {
            triggerImageGeneration();
        }

    } catch (err) {
        chatMessages.removeChild(loadingMsg);
        const errorMsg = createChatMessage('ai', `⚠️ Regeneration failed: ${err.message}`);
        chatMessages.appendChild(errorMsg);
    }
}

async function saveCurrentGame() {
    const id = typeof currentGameFolder !== 'undefined' && currentGameFolder ? currentGameFolder : window.currentGameFolder;
    if (!id) return;
    try {
        await fetch('/api/update-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                gameState: window.gamestate || {},
                chatHistory: window.chatHistory || [],
                npcLedger: { npcs: window.gamestate?.npcs || [] },
                locationsLedger: { locations: window.gamestate?.locations || [] }
            })
        });
    } catch (e) { console.error("Auto-save failed:", e); }
}

async function triggerImageGeneration() {
    if (localStorage.getItem('jsonAdventure_enableImage') !== 'true') return;

    const btn = document.getElementById('regenerate-image-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
        // 1. Get the last AI text output for situation/environment context
        let gameText = "";
        const historyCopy = window.chatHistory || [];
        for (let i = historyCopy.length - 1; i >= 0; i--) {
            if (historyCopy[i].role === 'assistant') {
                let rawContent = historyCopy[i].content;
                // Try to extract just the textoutput from JSON responses
                try {
                    let parsed = rawContent.trim();
                    if (parsed.startsWith('```json')) parsed = parsed.replace(/^```json/, '').replace(/```$/, '').trim();
                    const jsonData = JSON.parse(parsed);
                    gameText = jsonData.textoutput || rawContent;
                } catch (e) {
                    gameText = rawContent;
                }
                break;
            }
        }

        // 2. Get player appearance from player.json
        const playerAppearance = (window.playerInfo && window.playerInfo.player) ? window.playerInfo.player.appearance : '';

        // 3. Get current inventory from gamestate
        const inventory = (window.gamestate && window.gamestate.inventory) ? window.gamestate.inventory : [];

        // 4. Get the base image for the xAI edit endpoint
        let baseImageUrl = null;
        const gameId = typeof currentGameFolder !== 'undefined' && currentGameFolder ? currentGameFolder : window.currentGameFolder;
        if (gameId) {
            try {
                const baseImgRes = await fetch(`/api/get-base-image?id=${gameId}`);
                if (baseImgRes.ok) {
                    const baseImgData = await baseImgRes.json();
                    if (baseImgData.dataUri) {
                        baseImageUrl = baseImgData.dataUri;
                    }
                }
            } catch (e) {
                console.warn('Could not load base image for edit, will generate from scratch:', e);
            }
        }

        // 5. Generate the image prompt with full player context
        const promptText = await generatePlayerImagePromptText({
            gameText: gameText,
            playerAppearance: playerAppearance,
            inventory: inventory,
            isBaseImage: false
        });

        // 6. Generate the image (with base image for xAI edit endpoint)
        const url = await performImageGeneration(promptText, "2:3", baseImageUrl);

        if (url) {
            const imgEl = document.getElementById('player-dynamic-image');
            const placeholder = document.getElementById('player-dynamic-image-placeholder');
            if (imgEl) {
                imgEl.src = url;
                imgEl.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
            }

            if (gameId) {
                await fetch('/api/update-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: gameId, url: url })
                });
            }
        }
    } catch (e) {
        console.error("Auto image gen error:", e);
    }

    if (btn) { btn.disabled = false; btn.textContent = '🔄'; }
}


// ============================================================
// TEXT TO SPEECH (TTS)
// ============================================================
async function playTTS(text) {
    const provider = localStorage.getItem('jsonAdventure_ttsProvider') || 'none';
    if (provider === 'none') {
        alert("TTS is disabled in settings.");
        return;
    }

    let baseUrl = '';
    let apiKey = '';
    let model = '';
    let voice = '';
    let speed = 1.0;

    if (provider === 'connected') {
        const connectedProv = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
        baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
        if (connectedProv === 'openai') {
            baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            baseUrl += '/audio/speech';
        } else if (connectedProv === 'kokoro') {
            baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            baseUrl += '/audio/speech';
        } else if (connectedProv === 'openrouter' || connectedProv === 'xai' || connectedProv === 'googleai') {
            alert(connectedProv + " does not support standard TTS endpoint directly through this UI yet. Use Separate OpenAI logic.");
            return;
        } else {
            baseUrl = "https://api.openai.com/v1/audio/speech";
        }
        apiKey = localStorage.getItem('jsonAdventure_apiKey_' + connectedProv) || 'dummy';
        model = localStorage.getItem('jsonAdventure_ttsModel') || 'tts-1';
        voice = localStorage.getItem('jsonAdventure_ttsVoice') || 'alloy';
        speed = parseFloat(localStorage.getItem('jsonAdventure_ttsSpeed')) || 1.0;
    } else if (provider === 'openai') {
        baseUrl = localStorage.getItem('jsonAdventure_ttsBaseUrl') || '';
        baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        baseUrl += '/audio/speech';
        apiKey = localStorage.getItem('jsonAdventure_ttsApiKey') || 'dummy';
        model = localStorage.getItem('jsonAdventure_ttsModel') || 'tts-1';
        voice = localStorage.getItem('jsonAdventure_ttsVoice') || 'alloy';
        speed = parseFloat(localStorage.getItem('jsonAdventure_ttsSpeed')) || 1.0;
    } else if (provider === 'kokoro') {
        baseUrl = localStorage.getItem('jsonAdventure_ttsBaseUrl') || 'http://127.0.0.1:8880/v1';
        baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        baseUrl += '/audio/speech';
        apiKey = 'dummy';
        model = localStorage.getItem('jsonAdventure_ttsModel') || 'kokoro';
        voice = localStorage.getItem('jsonAdventure_ttsVoice') || 'af_bella';
        speed = parseFloat(localStorage.getItem('jsonAdventure_ttsSpeed')) || 1.0;
    }

    // Strip out markdown formatting that TTS might pronounce
    let pureText = text.replace(/[*_#`~]/g, '');

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                input: pureText,
                voice: voice,
                speed: speed,
                response_format: 'mp3'
            })
        });

        if (!response.ok) {
            throw new Error(`TTS API error: ${response.status} - ${await response.text()}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    } catch (err) {
        console.error("TTS Error:", err);
        alert("Failed to play TTS: " + err.message);
    }
}
