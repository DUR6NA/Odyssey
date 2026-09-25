// ============================================================
// CHAT.JS - AI prompting, in-game chat, image runtime, and TTS
// ============================================================

const DEFAULT_MAX_TOKENS = 8000;
const HELPER_MAX_TOKENS = 8000;
const SUMMARY_MAX_TOKENS = 8000;
const OPENROUTER_MAX_COMPLETION_TOKENS = 32000;
const MIN_MAIN_RESPONSE_TOKENS = 3500;
const MIN_HELPER_RESPONSE_TOKENS = 1200;
const MIN_SUMMARY_RESPONSE_TOKENS = 2500;
const REASONING_EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const REASONING_EFFORT_RATIOS = {
    none: 0,
    minimal: 0.1,
    low: 0.2,
    medium: 0.5,
    high: 0.8,
    xhigh: 0.95
};

function formatErrorForUser(err) {
    if (!err || !err.message) return "An unknown error occurred.";
    const msg = err.message;
    if (msg.includes('status 400')) {
        // Most common cause for local OpenAI-compatible / LM Studio backends is a model that
        // does not support structured outputs (response_format). Surface a helpful hint.
        if (msg.toLowerCase().includes('response_format') || msg.toLowerCase().includes('json_schema') || msg.toLowerCase().includes('grammar') || msg.toLowerCase().includes('structured')) {
            return "The selected local model does not support structured JSON outputs. Try a different model in LM Studio (e.g. a recent Llama/Qwen/Mistral instruct model), or verify your LM Studio version is up to date. Full error: " + msg;
        }
        return "The AI provider rejected the request (400). This usually means the model does not support structured outputs or one of the parameters is not allowed. Full error: " + msg;
    }
    if (msg.includes('status 401')) return "It looks like your API key is missing or invalid. Please check your Settings.";
    if (msg.includes('status 404')) return "Endpoint not found (404). For LM Studio use base http://localhost:1234/v1 (calls /v1/chat/completions). Native REST uses /api/v1/chat.";
    if (msg.includes('status 429')) return "You've hit a rate limit. Please wait a moment and try again.";
    if (msg.includes('status 500')) return "The AI provider is currently experiencing issues. Please try again later.";
    if (msg.includes('status 502') || msg.includes('status 503')) return "The AI service is unavailable right now.";
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Unexpected endpoint')) return "Network/endpoint error. LM Studio: set Base URL to http://localhost:1234/v1 for OpenAI compat (/v1/chat/completions). Check server is running.";
    return msg;
}


// Build request headers; omit Authorization entirely when no API key is set.
// Some OpenAI-compatible local servers (llama.cpp-server, LiteLLM proxies, LM Studio
// with auth enabled, etc.) return 401 when they see a malformed empty Bearer token,
// so an empty header is worse than no header.
function buildAuthHeaders(apiKey, providerOrUrl = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter') {
    if (window.OdysseyOpenRouter && typeof window.OdysseyOpenRouter.buildAuthHeaders === 'function') {
        return window.OdysseyOpenRouter.buildAuthHeaders(apiKey, providerOrUrl);
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && String(apiKey).trim()) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (String(providerOrUrl || '').trim().toLowerCase() === 'openrouter' || String(providerOrUrl || '').toLowerCase().includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://github.com/DUR6NA/Odyssey';
        headers['X-OpenRouter-Title'] = 'Odyssey';
        headers['X-Title'] = 'Odyssey';
        headers['X-OpenRouter-Categories'] = 'game,roleplay';
    }
    return headers;
}

function normalizeReasoningEffort(value, fallback = 'low') {
    const normalized = String(value || '').trim().toLowerCase();
    return REASONING_EFFORT_ORDER.includes(normalized) ? normalized : fallback;
}

function capReasoningEffort(effort, maxEffort) {
    const normalized = normalizeReasoningEffort(effort);
    const max = normalizeReasoningEffort(maxEffort);
    const index = REASONING_EFFORT_ORDER.indexOf(normalized);
    const maxIndex = REASONING_EFFORT_ORDER.indexOf(max);
    return REASONING_EFFORT_ORDER[Math.min(index, maxIndex)];
}

function getReasoningPayloadOptions(provider, purpose = 'main') {
    if (provider !== 'openrouter') return {};

    const configuredEffort = normalizeReasoningEffort(
        localStorage.getItem('jsonAdventure_apiReasoningEffort'),
        'medium'
    );

    if (purpose === 'helper' || purpose === 'summary' || purpose === 'repair') {
        return { reasoning: { effort: capReasoningEffort(configuredEffort, 'low'), exclude: true } };
    }

    const enabled = localStorage.getItem('jsonAdventure_apiEnableReasoning') === 'true';
    return {
        reasoning: {
            effort: enabled ? configuredEffort : 'low',
            exclude: true
        }
    };
}

function getCompletionBudget(maxTokens, provider, payloadOptions = {}, minFinalTokens = MIN_HELPER_RESPONSE_TOKENS) {
    const requested = Math.max(Number(maxTokens) || 0, minFinalTokens);
    if (provider !== 'openrouter' || !payloadOptions?.reasoning) return requested;

    const reasoning = payloadOptions.reasoning;
    let needed = requested;

    if (Number.isFinite(Number(reasoning.max_tokens))) {
        needed = Math.max(needed, Math.ceil(Number(reasoning.max_tokens) + minFinalTokens));
    } else {
        const effort = normalizeReasoningEffort(reasoning.effort, 'low');
        const reasoningRatio = REASONING_EFFORT_RATIOS[effort] ?? REASONING_EFFORT_RATIOS.low;
        const finalRatio = Math.max(0.05, 1 - reasoningRatio);
        needed = Math.max(needed, Math.ceil(minFinalTokens / finalRatio));
    }

    return Math.min(needed, OPENROUTER_MAX_COMPLETION_TOKENS);
}

function getChoiceContentOrThrow(data, label = 'response') {
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;

    const finishReason = choice?.finish_reason || choice?.native_finish_reason || '';
    const hasReasoning = !!(choice?.message?.reasoning || choice?.message?.reasoning_details);
    const finishHint = finishReason ? ` Finish reason: ${finishReason}.` : '';
    const reasoningHint = hasReasoning ? ' The model returned reasoning but no final content.' : '';
    const budgetHint = finishReason === 'length'
        ? ' Increase max tokens or lower reasoning effort for this model.'
        : '';
    throw new Error(`The AI returned no ${label} content.${finishHint}${reasoningHint}${budgetHint}`);
}

function getChatCompletionsUrl(provider, baseUrl) {
    if (provider === 'xai') return "https://api.x.ai/v1/chat/completions";
    if (provider === 'googleai') return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    if (provider === 'lmstudio' || provider === 'openai') {
        return baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    }
    return "https://openrouter.ai/api/v1/chat/completions";
}

function buildFetchPayload(model, messages, temp, maxTokens, topP, presPen, freqPen, provider, jsonSchema = null, options = {}) {
    const payload = { model: model, messages: messages, temperature: temp, max_tokens: maxTokens, top_p: topP };
    if (presPen !== 0 && provider !== 'xai') payload.presence_penalty = presPen;
    if (freqPen !== 0 && provider !== 'xai') payload.frequency_penalty = freqPen;
    if (options && options.reasoning) payload.reasoning = options.reasoning;
    if (options && options.stream) payload.stream = true;

    if (provider === 'lmstudio') {
        const schema = jsonSchema && typeof jsonSchema === 'object' ? jsonSchema : {
            type: "object",
            properties: { content: { type: "string" } },
            required: ["content"],
            additionalProperties: false
        };
        payload.response_format = {
            type: 'json_schema',
            json_schema: {
                name: "response",
                schema: schema
            }
        };
    } else if (provider !== 'openai' && jsonSchema && typeof jsonSchema === 'object') {
        const schemaName = jsonSchema.properties && jsonSchema.properties.textoutput ? "game_turn" : "structured_response";
        payload.response_format = {
            type: 'json_schema',
            json_schema: {
                name: schemaName,
                strict: true,
                schema: jsonSchema
            }
        };
    }

    return JSON.stringify(payload);
}

function stripJsonCodeFences(content) {
    if (typeof content !== 'string') return '';
    let sanitized = content.trim();
    if (sanitized.startsWith('```json')) {
        sanitized = sanitized.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    } else if (sanitized.startsWith('```')) {
        sanitized = sanitized.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }
    return sanitized;
}

function extractBalancedJsonSegment(text, openChar, closeChar) {
    if (typeof text !== 'string') return null;
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === openChar) {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === closeChar && depth > 0) {
            depth--;
            if (depth === 0 && start !== -1) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

function tryParseJsonObject(rawContent) {
    const sanitized = stripJsonCodeFences(rawContent);
    const candidates = [
        sanitized,
        extractBalancedJsonSegment(sanitized, '{', '}'),
        extractBalancedJsonSegment(sanitized, '[', ']')
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (err) {
        }
    }

    return null;
}

function hasRequiredKeys(obj, requiredKeys = []) {
    return !!obj && typeof obj === 'object' && requiredKeys.every(key => Object.prototype.hasOwnProperty.call(obj, key));
}

async function repairCompatibleJson(rawContent, jsonExample, requiredKeys = [], label = 'response') {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    if (provider !== 'openai' || !baseUrl) return null;

    const fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    const repairPrompt = `You repair malformed model outputs into strict JSON.

Return ONLY valid JSON. Do not include markdown fences, explanations, or any text before/after the JSON.
The JSON must contain these required top-level keys: ${requiredKeys.join(', ')}.
Match this shape exactly:
${jsonExample}

Malformed ${label} to repair:
${rawContent}`;

    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: buildAuthHeaders(apiKey, provider),
        body: buildFetchPayload(model, [{ role: 'system', content: repairPrompt }], 0.1, 2500, 1.0, 0, 0, provider, null)
    });

    if (!response.ok) {
        throw new Error(`JSON repair failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return getChoiceContentOrThrow(data, `${label} JSON repair`);
}

async function parseStructuredModelOutput(rawContent, options = {}) {
    const {
        requiredKeys = [],
        jsonExample = '{}',
        label = 'response'
    } = options;

    const directParsed = tryParseJsonObject(rawContent);
    if (hasRequiredKeys(directParsed, requiredKeys)) return directParsed;

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    if (provider === 'openai') {
        const repairedContent = await repairCompatibleJson(rawContent, jsonExample, requiredKeys, label);
        const repairedParsed = tryParseJsonObject(repairedContent);
        if (hasRequiredKeys(repairedParsed, requiredKeys)) return repairedParsed;
    }

    throw new Error(`The AI returned invalid JSON for ${label}.`);
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
                    action: { type: "string", enum: ["add", "remove", "update"] },
                    name: { type: "string" },
                    newName: { type: "string" },
                    description: { type: "string" },
                    notes: { type: "string" }
                },
                required: ["action", "name", "newName", "description", "notes"],
                additionalProperties: false
            }
        },
        npc_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["add", "remove", "update"] },
                    name: { type: "string" },
                    newName: { type: "string" },
                    description: { type: "string" },
                    notes: { type: "string" }
                },
                required: ["action", "name", "newName", "description", "notes"],
                additionalProperties: false
            }
        },
        player_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["update"] },
                    field: { type: "string", enum: ["description", "appearance", "personality", "backstory"] },
                    value: { type: "string" }
                },
                required: ["action", "field", "value"],
                additionalProperties: false
            }
        },
        quest_changes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["add", "update", "complete", "fail", "remove"] },
                    name: { type: "string" },
                    newName: { type: "string" },
                    description: { type: "string" },
                    notes: { type: "string" }
                },
                required: ["action", "name", "newName", "description", "notes"],
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
    required: ["time", "textoutput", "inventory_changes", "location_changes", "npc_changes", "player_changes", "quest_changes", "stats"],
    additionalProperties: false
};

// quest_changes is in the schema but not required when validating, so older saves' custom
// prompts and non-strict providers that omit it still produce valid turns.
const GAME_TURN_REQUIRED_KEYS = ['time', 'textoutput', 'inventory_changes', 'location_changes', 'npc_changes', 'player_changes', 'stats'];
const GAME_TURN_JSON_EXAMPLE = '{"time":{"hour":0,"minute":0,"period":"AM","dayOfWeek":"Monday","day":1,"month":1,"year":1,"era":"CE","calendarType":"gregorian"},"textoutput":"Narrative text","inventory_changes":[],"location_changes":[],"npc_changes":[],"player_changes":[],"quest_changes":[],"stats":{"health":100,"money":0,"hunger":100,"thirst":100,"energy":100}}';

// --- Phase Tracking ---

async function generatePlayerImagePromptText(context = {}) {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const gameModel = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';
    const useGameModel = localStorage.getItem('jsonAdventure_imagePromptUseGameModel') !== 'false';
    const promptManualModel = localStorage.getItem('jsonAdventure_imagePromptManualModel_' + provider) || '';
    const promptSelectedModel = localStorage.getItem('jsonAdventure_imagePromptModel_' + provider) || '';
    const model = useGameModel ? gameModel : (promptManualModel || promptSelectedModel || gameModel);
    const storedPromptTemperature = parseFloat(localStorage.getItem('jsonAdventure_imagePromptTemperature'));
    const promptTemperature = Number.isFinite(storedPromptTemperature) ? storedPromptTemperature : 0.7;
    const promptMaxTokens = Math.max(
        parseInt(localStorage.getItem('jsonAdventure_imagePromptMaxTokens'), 10)
            || parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens'), 10)
            || 0,
        DEFAULT_MAX_TOKENS
    );
    const storedPromptTopP = parseFloat(localStorage.getItem('jsonAdventure_imagePromptTopP'));
    const promptTopP = Number.isFinite(storedPromptTopP) ? storedPromptTopP : 1.0;
    const excludeReasoning = localStorage.getItem('jsonAdventure_imagePromptExcludeReasoning') !== 'false';

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
    } else if (provider === 'lmstudio' || provider === 'openai') {
        fetchUrl = getChatCompletionsUrl(provider, baseUrl);
    }

    const payloadOptions = provider === 'openrouter' && excludeReasoning
        ? getReasoningPayloadOptions(provider, 'helper')
        : {};
    const promptCompletionBudget = getCompletionBudget(promptMaxTokens, provider, payloadOptions, MIN_HELPER_RESPONSE_TOKENS);
    const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: buildAuthHeaders(apiKey, provider),
        body: buildFetchPayload(model, [{ role: 'user', content: promptText }], promptTemperature, promptCompletionBudget, promptTopP, 0, 0, provider, false, payloadOptions)
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error("Failed to generate image prompt: " + errText);
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
        const finishReason = choice?.finish_reason ? ` Finish reason: ${choice.finish_reason}.` : '';
        const reasoningHint = choice?.message?.reasoning ? ' The model returned reasoning but no final prompt content.' : '';
        throw new Error(`The AI returned an empty image prompt.${finishReason}${reasoningHint} Try increasing Image Prompt Max Tokens or disabling reasoning for image prompts.`);
    }
    return content.trim();
}

async function performImageGeneration(promptText, aspect_ratio = "2:3", baseImageUrl = null) {
    const useSeparateImage = localStorage.getItem('jsonAdventure_imageUseSeparateApi') === 'true';
    const provider = useSeparateImage
        ? (localStorage.getItem('jsonAdventure_imageApiProvider') || 'openrouter')
        : (localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter');
    const baseUrl = useSeparateImage
        ? (localStorage.getItem('jsonAdventure_imageApiBaseUrl') || '')
        : (localStorage.getItem('jsonAdventure_apiBaseUrl') || '');
    const apiKey = useSeparateImage
        ? (localStorage.getItem('jsonAdventure_imageApiKey_' + provider) || '')
        : (localStorage.getItem('jsonAdventure_openRouterApiKey') || '');
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
    } else if (provider === 'googleai') {
        // Google AI (Imagen / Nano Banana)
        const arMap = { "2:3": "3:4", "16:9": "16:9", "1:1": "1:1", "3:2": "4:3", "9:16": "9:16" };
        const mappedAr = arMap[aspect_ratio] || "3:4";
        // Strip off the path if the model ID has 'models/' prefix already
        const modelName = imageModel.replace(/^models\//, "");
        fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
        payload = {
            instances: [{ prompt: promptText }],
            parameters: { sampleCount: 1, aspectRatio: mappedAr }
        };
    } else {
        // OpenAI-compatible providers
        payload = {
            model: imageModel,
            prompt: promptText
        };

        if (provider === 'lmstudio') {
            // LM Studio does not currently serve /v1/images/generations for any model.
            // Fail fast with a clear message so the user can switch to a separate image provider.
            throw new Error("LM Studio does not support image generation. Enable 'Use a separate provider for images' in Settings and pick an image-capable provider (OpenRouter, xAI, Google AI).");
        }

        if (provider === 'openai') {
            payload.size = "1024x1024";
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}images/generations` : `${baseUrl}/images/generations`;
        }
    }

    let reqHeaders = { 'Content-Type': 'application/json' };
    if (provider !== 'googleai' && apiKey && String(apiKey).trim()) {
        reqHeaders['Authorization'] = `Bearer ${apiKey}`;
    }
    if (window.OdysseyOpenRouter && typeof window.OdysseyOpenRouter.applyAttributionHeaders === 'function') {
        reqHeaders = window.OdysseyOpenRouter.applyAttributionHeaders(reqHeaders, provider);
    }

    const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Image Gen Error (${res.status}): ${errTxt}`);
    }

    const data = await res.json();

    if (provider === 'googleai') {
        if (data.predictions && data.predictions.length > 0) {
            const b64 = data.predictions[0].bytesBase64Encoded || data.predictions[0].bytes;
            if (b64) return `data:image/jpeg;base64,${b64}`;
        }
    } else if (provider === 'openrouter') {
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


function buildGameSystemPrompt(allData, summaryText, relevantLore = '', wikipediaData = '', fandomData = '', provider = '', ragData = '', braveData = '') {
    const defaultGamePrompt = `You are now a seasoned novelist acting as the Game Master. Write a dynamic, immersive, and grounded text-based adventure. You are impartial: you do not break character, do not summarize when you should roleplay, and do not skip time unless the player explicitly asks to wait, rest, travel, or otherwise advance time.

INTERNAL REASONING (never shown to the player — complete silently before writing):
1. PHYSICS — Is the player's action physically possible given their state, inventory, location, and surroundings?
2. TIME — How much time does this action realistically consume? Update the time fields accordingly.
3. STATE — How do Health, Hunger, Thirst, Energy, money, inventory, NPCs, and location change as a result? Express those changes only through the required JSON fields, not as numbers in the prose.
4. NPC LOGIC — What do present NPCs know, want, remember, and do right now?
5. CONSEQUENCES — Immediate, short-term, and plausible long-term fallout of the action.
6. NARRATIVE HOOK — What sensory detail, tension, or intrigue best serves immersion?

CRITICAL NARRATIVE RULES:
1. Grounded & Natural Prose: Write like a high-quality, traditionally published novel. The prose should flow naturally. Put the player inside a breathing world. The world exists on its own; the player is simply the protagonist navigating it.
2. Realistic Dialogue: ALL dialogue MUST be enclosed in proper double quotation marks (e.g., "Hello there," she said.). Characters must speak like normal, grounded humans. Absolutely NO hammy, hyper-stylized slang, forced era-specific jargon, or excessive "quippy" banter. Dialogue should sound like a real conversation, placed on its own line when a new character speaks. Play dialogue verbatim — never write "the guard agrees" when you can write what the guard actually says.
3. No Meta-References: Do not constantly remind the player of the setting or throw out random historical/world facts unless it makes strict narrative sense.
4. Clean Readability: Break your response into several short paragraphs (2-4 sentences max). Use standard Markdown formatting (bolding, italics).
5. No Stats or Lists in Text: NEVER output numbers for stat changes, and NEVER output a numbered list of options at the end. Describe consequences naturally in the prose, and end by presenting an open-ended situation or a subtle hook. Let the player decide what to do next without dictating a menu of choices. Stats, inventory, and time belong in the JSON systems — not in the narrative.
6. Player Agency: NEVER speak for the player character or take actions for them.

SIMULATION DISCIPLINE:
- Time is real. Walking, talking, eating, fighting, and sleeping each consume appropriate time. Conversation plays line by line; do not collapse whole scenes into a summary unless the player asks to skip or wait.
- Failure, injury, social fallout, and death are real possibilities. Do not protect the player from bad decisions. Illegal or dangerous acts draw realistic reactions: people flee, alert others, refuse, bargain, or fight back.
- Outcomes come from logical simulation of the situation, not from arbitrary luck or soft plot armor.
- NPCs have memory. Rudeness, kindness, violence, and deception change how they treat the player going forward. Reflect lasting disposition shifts through npc_changes notes and natural behavior, not through exposition dumps.
- Present the consequences of the player's last action before fully opening the new situation.

CURRENCY RULE: Always track the player's money through the stats.money field (as an integer). Do NOT create inventory items for money, credits, coins, gold, or any form of currency. When the player earns or spends money, update stats.money to the new total. Only use inventory_changes for physical items.

INVENTORY UPDATE RULE: When an existing inventory item changes (e.g. quantity, condition, or name), use the "update" action with the item's current name and set newName/description to the updated values. Do NOT remove and re-add items to change them — use "update" instead.

Rely on the background JSON systems to handle stats, inventory, time, NPCs, and locations. Your ONLY job in the text output is to write a beautiful, grounded, and engaging story.`;

    const customBase = localStorage.getItem('jsonAdventure_promptGame') || defaultGamePrompt;
    const stateUpdateContract = `STATE UPDATE CONTRACT:
- Always express state changes in JSON arrays, not in narrative prose.
- inventory_changes supports action "add", "update", or "remove". Use "update" for item renames, quantity/condition changes, or description edits; set name to the current item name, newName to the desired name or an empty string, and description to the desired description or an empty string.
- location_changes supports action "add", "update", or "remove". Use "update" to rename a location or edit its description/notes. Use "remove" only when the codex entry should be deleted.
- npc_changes supports action "add", "update", or "remove". Put visual/personality text in description, and current status, relationship history, or GM notes in notes. Use "update" to edit NPC descriptions or notes. Use "remove" only when the NPC codex entry should be deleted.
- player_changes supports action "update" for field "description", "appearance", "personality", or "backstory". Use field "description" when the player's visible description/appearance changes.
- quest_changes tracks the player's goals, jobs, promises, and open leads. Use "add" when the player takes on or clearly discovers a goal, "update" to change its description or progress notes, "complete" when it is achieved, "fail" when it becomes impossible, and "remove" only when the codex entry should be deleted. Keep quest names short and stable. Do not invent quests the story has not established.
- If nothing changed for a system, output an empty array for that system.

DEATH RULE: If the player character dies, set stats.health to 0 and narrate the death with finality. Never set health to 0 unless the character is actually dead.`;

    const contextUseRules = `CONTEXT USE RULES:
- Use retrieved memory, codex entries, web results, and fandom lore as references only when they are relevant to the player's current action.
- Current game state and player/world facts override older retrieved memory if they conflict.
- Fandom lore is for canon consistency; weave it into the scene naturally and do not dump unrelated facts.`;

    const baseParts = `${customBase}

${stateUpdateContract}

${contextUseRules}

=== WORLD INFO ===
${JSON.stringify(allData.worldInfo, null, 2)}

=== PLAYER CHARACTER ===
${JSON.stringify(allData.playerInfo, null, 2)}

=== GAME STATE ===
${JSON.stringify(allData.gameState, null, 2)}

=== ADVENTURE SUMMARY ===
${summaryText}

=== RELEVANT CODEX ENTRIES ===
${relevantLore}

=== RETRIEVED MEMORY ===
${ragData}

=== RELEVANT WORLD INFO ===
${wikipediaData}

=== BRAVE WEB SEARCH ===
${braveData}

=== FANDOM LORE ===
${fandomData}`;

    // For openai-compatible providers that use json_object mode, include explicit JSON format
    // instructions so the model knows the required output structure without json_schema enforcement.
    if (provider === 'openai') {
        return baseParts + `

=== REQUIRED OUTPUT FORMAT ===
CRITICAL: Your ENTIRE response must be valid JSON only — no markdown, no prose outside the JSON object. Use this exact structure:
{"time":{"hour":0,"minute":0,"period":"AM","dayOfWeek":"Monday","day":1,"month":1,"year":1,"era":"CE","calendarType":"gregorian"},"textoutput":"Your full narrative here.","inventory_changes":[],"location_changes":[],"npc_changes":[],"player_changes":[],"quest_changes":[],"stats":{"health":100,"money":0,"hunger":100,"thirst":100,"energy":100}}
Replace all values with the actual current game state. The "textoutput" field is where your narrative goes. All eight top-level keys are required.`;
    }

    return baseParts;
}

// ============================================================
// CHAT INTERFACE (In-Game)
// ============================================================
// Helper for parsing game JSON
function findGameEntityByName(list, name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    return list.find(entry => String(entry?.name || '').trim().toLowerCase() === needle) || null;
}

function removeGameEntityByName(list, name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter(entry => String(entry?.name || '').trim().toLowerCase() !== needle);
}

function getGameChangeAction(change, fallback = 'update') {
    const action = String(change?.action || fallback).trim().toLowerCase();
    return ['add', 'remove', 'update'].includes(action) ? action : fallback;
}

function getNpcChangeNotes(change) {
    return change?.notes || change?.status_or_history || change?.history_with_player || '';
}

function applyNpcNotes(npc, notes) {
    npc.notes = notes || '';
    npc.status_or_history = notes || '';
    if (Object.prototype.hasOwnProperty.call(npc, 'history_with_player')) {
        npc.history_with_player = notes || '';
    }
}

function getMutableGamePlayer() {
    if (!window.playerInfo || typeof window.playerInfo !== 'object') {
        window.playerInfo = { player: {} };
    }
    if (!window.playerInfo.player || typeof window.playerInfo.player !== 'object') {
        window.playerInfo = { player: { ...window.playerInfo } };
    }
    return window.playerInfo.player;
}

function processGameTurnJson(aiText) {
    let aiJson = { textoutput: aiText };
    try {
        aiJson = tryParseJsonObject(aiText) || aiJson;
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
            const action = getGameChangeAction(change, 'update');
            const name = String(change.name || '').trim();
            const newName = String(change.newName || '').trim();
            const description = String(change.description || '').trim();
            if (!name && !newName) return;

            if (action === 'remove') {
                window.gamestate.inventory = removeGameEntityByName(window.gamestate.inventory, name);
            } else if (action === 'add') {
                let item = findGameEntityByName(window.gamestate.inventory, newName || name) || findGameEntityByName(window.gamestate.inventory, name);
                if (item) {
                    item.name = newName || name;
                    if (description) item.description = description;
                } else {
                    window.gamestate.inventory.push({ name: newName || name, description: description || '' });
                }
            } else if (action === 'update') {
                let item = findGameEntityByName(window.gamestate.inventory, name);
                if (item) {
                    if (newName) item.name = newName;
                    if (description) item.description = description;
                }
            }
        });
        if (typeof renderInventoryUI === 'function') renderInventoryUI();
        if (typeof renderPlayerMenuUI === 'function') renderPlayerMenuUI();
    }
    if (aiJson.location_changes && Array.isArray(aiJson.location_changes)) {
        if (!window.gamestate.locations) window.gamestate.locations = [];
        aiJson.location_changes.forEach(change => {
            const action = getGameChangeAction(change, change.action ? 'update' : 'add');
            const name = String(change.name || '').trim();
            const newName = String(change.newName || '').trim();
            const description = String(change.description || '').trim();
            const notes = String(change.notes || '').trim();
            if (!name && !newName) return;

            if (action === 'remove') {
                window.gamestate.locations = removeGameEntityByName(window.gamestate.locations, name);
                return;
            }

            let loc = findGameEntityByName(window.gamestate.locations, name) || findGameEntityByName(window.gamestate.locations, newName);
            if (!loc) {
                loc = { name: newName || name, description: '' };
                window.gamestate.locations.push(loc);
            }
            if (newName) loc.name = newName;
            if (description) loc.description = description;
            if (notes) loc.notes = notes;
        });
        if (typeof renderCodexUI === 'function') renderCodexUI();
    }
    if (aiJson.npc_changes && Array.isArray(aiJson.npc_changes)) {
        if (!window.gamestate.npcs) window.gamestate.npcs = [];
        aiJson.npc_changes.forEach(change => {
            const action = getGameChangeAction(change, change.action ? 'update' : 'add');
            const name = String(change.name || '').trim();
            const newName = String(change.newName || '').trim();
            const description = String(change.description || '').trim();
            const notes = String(getNpcChangeNotes(change)).trim();
            if (!name && !newName) return;

            if (action === 'remove') {
                window.gamestate.npcs = removeGameEntityByName(window.gamestate.npcs, name);
                return;
            }

            let npc = findGameEntityByName(window.gamestate.npcs, name) || findGameEntityByName(window.gamestate.npcs, newName);
            if (!npc) {
                npc = { name: newName || name, description: '', notes: '', status_or_history: '' };
                window.gamestate.npcs.push(npc);
            }
            if (newName) npc.name = newName;
            if (description) npc.description = description;
            if (notes) applyNpcNotes(npc, notes);
        });
        if (typeof renderCodexUI === 'function') renderCodexUI();
    }
    if (aiJson.player_changes && Array.isArray(aiJson.player_changes)) {
        const player = getMutableGamePlayer();
        aiJson.player_changes.forEach(change => {
            if (getGameChangeAction(change, 'update') !== 'update') return;
            const rawField = String(change.field || '').trim();
            const field = rawField === 'description' ? 'appearance' : rawField;
            if (!['appearance', 'personality', 'backstory'].includes(field)) return;
            const value = String(change.value || '').trim();
            if (!value) return;
            player[field] = value;
            if (field === 'appearance' && Object.prototype.hasOwnProperty.call(player, 'description')) {
                player.description = value;
            }
        });
        if (typeof renderPlayerMenuUI === 'function') renderPlayerMenuUI();
    }
    if (aiJson.quest_changes && Array.isArray(aiJson.quest_changes)) {
        applyQuestChanges(window.gamestate, aiJson.quest_changes);
        if (typeof renderQuestUI === 'function') renderQuestUI();
    }
    return displayText;
}

const QUEST_STATUS_BY_ACTION = { add: 'active', complete: 'completed', fail: 'failed' };

function applyQuestChanges(gameState, changes) {
    if (!Array.isArray(gameState.quests)) gameState.quests = [];
    changes.forEach(change => {
        const action = String(change?.action || 'update').trim().toLowerCase();
        const name = String(change?.name || '').trim();
        const newName = String(change?.newName || '').trim();
        const description = String(change?.description || '').trim();
        const notes = String(change?.notes || '').trim();
        if (!name && !newName) return;

        if (action === 'remove') {
            gameState.quests = removeGameEntityByName(gameState.quests, name);
            return;
        }

        let quest = findGameEntityByName(gameState.quests, name) || findGameEntityByName(gameState.quests, newName);
        if (!quest) {
            quest = { name: newName || name, description: '', notes: '', status: 'active' };
            gameState.quests.push(quest);
        }
        if (newName) quest.name = newName;
        if (description) quest.description = description;
        if (notes) quest.notes = notes;
        if (QUEST_STATUS_BY_ACTION[action]) quest.status = QUEST_STATUS_BY_ACTION[action];
    });
}

function renderMarkdownSafe(text) {
    const html = typeof marked !== 'undefined' ? marked.parse(String(text || '')) : escapeHtml(text);
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(text);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

function createMessageActionButton(icon, title, onClick, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `msg-action-btn${extraClass ? ` ${extraClass}` : ''}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = icon ? window.OdysseyIcons.html(icon) : '';
    button.onclick = onClick;
    return button;
}

function createMessageShell(type, extraClass = '') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type === 'ai' ? 'ai-message' : 'user-message'}${extraClass ? ` ${extraClass}` : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = type === 'ai' ? 'AI' : 'U';

    const body = document.createElement('div');
    body.className = 'message-body';

    const content = document.createElement('div');
    content.className = 'message-content';

    body.appendChild(content);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(body);
    return { msgDiv, body, content };
}

// options.turnId links a user message to its rewind snapshot; options.isError renders a
// status card without turn controls.
function createChatMessage(type, text, options = {}) {
    const { msgDiv, body, content } = createMessageShell(type, options.isError ? 'error-message' : '');

    if (type === 'ai') {
        content.innerHTML = renderMarkdownSafe(text);
    } else {
        content.textContent = text;
    }

    const actions = document.createElement('div');
    actions.className = 'message-options';

    if (type === 'ai' && options.isError) {
        actions.appendChild(createMessageActionButton('clipboard', 'Copy', () => navigator.clipboard.writeText(content.textContent)));
    } else if (type === 'ai') {
        const variantNav = document.createElement('div');
        variantNav.className = 'variant-nav';
        variantNav.hidden = true;
        variantNav.appendChild(createMessageActionButton('chevronLeft', 'Previous version', () => showAssistantVariant(-1)));
        const variantLabel = document.createElement('span');
        variantLabel.className = 'variant-label';
        variantNav.appendChild(variantLabel);
        variantNav.appendChild(createMessageActionButton('chevronRight', 'Next version', () => showAssistantVariant(1)));

        const ttsBtn = createMessageActionButton('', 'Play Audio', () => playTTS(text, ttsBtn));
        ttsBtn.dataset.ttsButton = 'true';
        ttsBtn.innerHTML = `<span class="tts-button-icon" aria-hidden="true">${window.OdysseyIcons.html('speaker')}</span><span class="tts-button-spinner" aria-hidden="true"></span>`;

        actions.appendChild(variantNav);
        actions.appendChild(createMessageActionButton('refresh', 'Regenerate (keeps this version)', () => regenerateLastAI(), 'msg-regen-btn'));
        actions.appendChild(createMessageActionButton('clipboard', 'Copy', () => navigator.clipboard.writeText(text)));
        actions.appendChild(ttsBtn);
        actions.appendChild(createMessageActionButton('branch', 'Branch a new save from this point', () => branchFromAiMessage(msgDiv)));
    } else {
        if (options.turnId) msgDiv.dataset.turnId = options.turnId;
        actions.appendChild(createMessageActionButton('edit', 'Edit (rewinds to before this turn)', () => rewindToUserMessage(msgDiv, { refillInput: true })));
        actions.appendChild(createMessageActionButton('rewind', 'Rewind to before this turn', () => rewindToUserMessage(msgDiv)));
    }

    body.appendChild(actions);
    if (type === 'ai' && options.usage) renderTurnUsage(msgDiv, options.usage);
    return msgDiv;
}

// Shows what a turn cost (every API call made for it) under the reply.
function renderTurnUsage(msgDiv, usage) {
    const body = msgDiv?.querySelector('.message-body');
    if (!body || !window.OdysseyUsage) return;
    body.querySelector('.turn-usage')?.remove();
    if (!usage || !usage.calls) return;

    const U = window.OdysseyUsage;
    const line = document.createElement('div');
    line.className = 'turn-usage';
    line.textContent = `${U.formatTokens(usage.promptTokens)} in · ${U.formatTokens(usage.completionTokens)} out · ${U.formatCost(usage.cost)}`;
    line.title = `This turn\n${U.describeTotals(usage)}`;
    body.insertBefore(line, body.querySelector('.message-options'));
}

function getTurnAiMessageNodes() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return [];
    return Array.from(chatMessages.querySelectorAll('.ai-message:not(.generation-loader-message):not(.error-message):not(.streaming-message)'));
}

// Only the newest reply can be regenerated or switched between versions.
function refreshChatMessageControls() {
    const aiNodes = getTurnAiMessageNodes();
    const latest = aiNodes[aiNodes.length - 1] || null;
    aiNodes.forEach(node => {
        node.classList.toggle('is-latest', node === latest);
        const nav = node.querySelector('.variant-nav');
        if (nav) nav.hidden = true;
    });
    if (!latest) return;

    const lastMessage = window.chatHistory?.[window.chatHistory.length - 1];
    const variants = lastMessage?.role === 'assistant' && Array.isArray(lastMessage.variants) ? lastMessage.variants : [];
    const nav = latest.querySelector('.variant-nav');
    if (!nav || variants.length < 2) return;
    const index = Number.isInteger(lastMessage.variantIndex) ? lastMessage.variantIndex : variants.length - 1;
    nav.hidden = false;
    nav.querySelector('.variant-label').textContent = `${index + 1}/${variants.length}`;
    const [prevBtn, nextBtn] = nav.querySelectorAll('button');
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= variants.length - 1;
}

const generationLoadingLines = [
    'Checking notes...',
    'Building story threads...',
    'Taking witness statements...',
    'Consulting the codex...',
    'Tracing the scene...',
    'Reviewing inventory clues...',
    'Updating the timeline...',
    'Cross-checking local lore...',
    'Sharpening consequences...',
    'Writing the next turn...',
    'Dusting off the map...',
    'Reviewing old rumors...',
    'Testing alibis...',
    'Sorting scene details...',
    'Listening at closed doors...',
    'Cataloging loose ends...',
    'Following the footprints...',
    'Checking the weathered signposts...',
    'Reading the room...',
    'Looking for contradictions...',
    'Matching names to faces...',
    'Threading cause and effect...',
    'Sketching the next dilemma...',
    'Balancing risk and reward...',
    'Setting the stage...',
    'Choosing the right shadow...',
    'Checking character motives...',
    'Polishing the tension...',
    'Reviewing recent choices...',
    'Weighing hidden consequences...',
    'Preparing dialogue beats...',
    'Scanning memory fragments...',
    'Organizing the case file...',
    'Finding the dramatic angle...',
    'Tuning the atmosphere...',
    'Writing in the margins...',
    'Checking the clock...',
    'Pulling on story threads...',
    'Reconstructing the scene...',
    'Listening for danger...',
    'Consulting travel notes...',
    'Mapping possible exits...',
    'Checking NPC ledgers...',
    'Updating location notes...',
    'Reviewing the last clue...',
    'Measuring the stakes...',
    'Setting lanterns in the dark...',
    'Sorting witness accounts...',
    'Checking the trail...',
    'Planning the reveal...',
    'Tightening the mystery...',
    'Preparing the next clue...',
    'Inspecting the evidence...',
    'Checking the horizon...',
    'Reviewing promises made...',
    'Checking for unfinished business...',
    'Setting the tone...',
    'Building the next obstacle...',
    'Revising the danger level...',
    'Listening for echoes...',
    'Matching lore to action...',
    'Choosing a meaningful consequence...',
    'Opening the next door...',
    'Checking the party records...',
    'Reviewing the world state...',
    'Shuffling encounter notes...',
    'Preparing a twist...',
    'Filing suspicious details...',
    'Interpreting the silence...',
    'Arranging the next scene...',
    'Checking narrative pressure...',
    'Looking behind the curtain...',
    'Balancing the encounter...',
    'Refreshing character memory...',
    'Reading travel logs...',
    'Finding a clean transition...',
    'Reviewing danger signs...',
    'Setting the emotional weather...',
    'Checking the pulse of the story...',
    'Connecting distant clues...',
    'Preparing the response...',
    'Staging the next moment...',
    'Sharpening the prompt...',
    'Sorting the timeline...',
    'Checking world consistency...',
    'Reviewing faction moves...',
    'Listening to the setting...',
    'Choosing the next beat...',
    'Updating the adventure log...',
    'Inspecting motive and means...',
    'Preparing the scene lighting...',
    'Checking unanswered questions...',
    'Tracing old debts...',
    'Reading between the lines...',
    'Tending continuity...',
    'Checking the chain of events...',
    'Drafting consequences...',
    'Setting up the next choice...',
    'Reviewing the inventory trail...',
    'Placing the next breadcrumb...',
    'Checking for secret doors...',
    'Updating threat levels...',
    'Aligning lore fragments...',
    'Reviewing character arcs...',
    'Testing the scene logic...',
    'Preparing sensory details...',
    'Checking the pressure points...',
    'Setting the narrative compass...',
    'Turning the page...',
    'Finalizing the next move...'
];

function createGenerationLoader(initialLine = generationLoadingLines[0]) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-message generation-loader-message';

    const loader = document.createElement('div');
    loader.className = 'generation-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');

    const globe = document.createElement('div');
    globe.className = 'wireframe-globe';
    globe.setAttribute('aria-hidden', 'true');

    const meridian = document.createElement('span');
    meridian.className = 'globe-meridian';

    const equator = document.createElement('span');
    equator.className = 'globe-equator';

    const tilt = document.createElement('span');
    tilt.className = 'globe-tilt';

    globe.appendChild(meridian);
    globe.appendChild(equator);
    globe.appendChild(tilt);

    const text = document.createElement('div');
    text.className = 'generation-loader-text';
    text.textContent = initialLine;

    loader.appendChild(globe);
    loader.appendChild(text);
    msgDiv.appendChild(loader);

    let lineIndex = Math.max(0, generationLoadingLines.indexOf(initialLine));
    msgDiv._generationLineTimer = window.setInterval(() => {
        lineIndex = (lineIndex + 1) % generationLoadingLines.length;
        text.classList.remove('is-swapping');
        window.requestAnimationFrame(() => {
            text.classList.add('is-swapping');
            text.textContent = generationLoadingLines[lineIndex];
        });
    }, 1800);

    return msgDiv;
}

function removeGenerationLoader(loader) {
    if (!loader) return;
    if (loader._generationLineTimer) {
        window.clearInterval(loader._generationLineTimer);
        loader._generationLineTimer = null;
    }
    if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
    }
}

// ============================================================
// TURN SNAPSHOTS, REWIND, AND BRANCHING
// ============================================================
// Snapshots use the same turn_snapshots.json format as tools/odyssey-core.mjs, so a save can
// be rewound from the desktop, CLI, or Telegram. Each snapshot holds the state from just
// before a turn; restoring one undoes that turn and everything after it.

const MAX_TURN_SNAPSHOTS = 80;

function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function getActiveGameId() {
    return typeof currentGameFolder !== 'undefined' && currentGameFolder ? currentGameFolder : window.currentGameFolder;
}

function captureRuntimeState() {
    return {
        gameState: deepCloneJson(window.gamestate || {}),
        playerInfo: deepCloneJson(window.playerInfo || { player: {} }),
        summary: window.gameSummaryText || '',
        startingScenario: window.startingScenarioText || '',
        chatHistory: deepCloneJson(window.chatHistory || [])
    };
}

function restoreRuntimeState(state) {
    window.gamestate = deepCloneJson(state.gameState || {});
    window.playerInfo = deepCloneJson(state.playerInfo || { player: {} });
    window.gameSummaryText = state.summary || '';
    if (state.startingScenario) window.startingScenarioText = state.startingScenario;
    window.chatHistory = deepCloneJson(state.chatHistory || []);
    refreshGameStateUI();
}

function refreshGameStateUI() {
    if (window.gamestate?.time && typeof updateClock === 'function') updateClock(window.gamestate.time);
    if (typeof updateStatsUI === 'function') updateStatsUI(window.gamestate?.stats || {});
    if (typeof renderPlayerMenuUI === 'function') renderPlayerMenuUI();
    if (typeof renderCodexUI === 'function') renderCodexUI();
    if (typeof renderQuestUI === 'function') renderQuestUI();
}

function createDesktopTurnSnapshot(action, kind = 'turn') {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        version: 1,
        kind,
        createdAt: new Date().toISOString(),
        action: String(action || '').trim(),
        before: captureRuntimeState()
    };
}

async function loadDesktopTurnSnapshots() {
    const gameId = getActiveGameId();
    if (!gameId || !window.tauriBridge?.loadTurnSnapshots) return [];
    return await window.tauriBridge.loadTurnSnapshots(gameId);
}

async function saveDesktopTurnSnapshots(snapshots) {
    const gameId = getActiveGameId();
    if (!gameId || !window.tauriBridge?.saveTurnSnapshots) return;
    await window.tauriBridge.saveTurnSnapshots(gameId, snapshots.slice(-MAX_TURN_SNAPSHOTS));
}

// Reads the file fresh each time so snapshots written by the CLI/Telegram bot are kept.
async function appendDesktopTurnSnapshot(snapshot) {
    try {
        const snapshots = await loadDesktopTurnSnapshots();
        snapshots.push(snapshot);
        await saveDesktopTurnSnapshots(snapshots);
    } catch (err) {
        console.warn('Could not save turn snapshot:', err);
    }
}

function normalizeTurnText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findSnapshotIndex(snapshots, turnId, historyMsg, historyIndex) {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return -1;
    if (turnId) {
        const byId = snapshots.findIndex(snapshot => snapshot?.id === turnId);
        if (byId >= 0) return byId;
    }
    if (!historyMsg || historyIndex < 1) return -1;

    // Turns without an id (older desktop turns, CLI/Telegram turns) are matched by action text.
    // A match only counts if the snapshot's history ends with the message that precedes this turn.
    const action = normalizeTurnText(getOriginalUserPrompt(historyMsg.content));
    const previous = window.chatHistory[historyIndex - 1];
    if (!previous || previous.role === 'system') return -1;
    for (let i = snapshots.length - 1; i >= 0; i--) {
        const snapshot = snapshots[i];
        if (normalizeTurnText(snapshot?.action) !== action) continue;
        const before = snapshot?.before?.chatHistory || [];
        if (before[before.length - 1]?.content === previous.content) return i;
    }
    return -1;
}

// Maps a user message in the DOM to its chatHistory entry (if still present) and its snapshot.
function locateUserTurn(userNode, snapshots) {
    const chatMessages = document.getElementById('chat-messages');
    const allNodes = chatMessages ? Array.from(chatMessages.children) : [];
    const domIndex = allNodes.indexOf(userNode);

    let userNodesAfter = 0;
    for (let i = domIndex + 1; i < allNodes.length; i++) {
        if (allNodes[i].classList.contains('user-message')) userNodesAfter++;
    }

    let historyIndex = -1;
    let seen = 0;
    const history = window.chatHistory || [];
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role !== 'user') continue;
        if (seen === userNodesAfter) {
            historyIndex = i;
            break;
        }
        seen++;
    }

    const historyMsg = historyIndex >= 0 ? history[historyIndex] : null;
    const turnId = userNode.dataset.turnId || historyMsg?.turnId || '';
    return {
        allNodes,
        domIndex,
        historyIndex,
        historyMsg,
        snapshotIndex: findSnapshotIndex(snapshots, turnId, historyMsg, historyIndex)
    };
}

function getLastUserMessageNode() {
    const nodes = document.querySelectorAll('#chat-messages .user-message');
    return nodes[nodes.length - 1] || null;
}

function showGameToast(message, type = 'info') {
    if (window.Odyssey && typeof window.Odyssey.notify === 'function') {
        window.Odyssey.notify(message, { type });
    } else {
        alert(message);
    }
}

async function confirmGameAction(message, title, confirmText, danger = true) {
    if (window.Odyssey && typeof window.Odyssey.confirm === 'function') {
        return await window.Odyssey.confirm(message, { title, confirmText, danger });
    }
    return confirm(message);
}

async function rewindToUserMessage(userNode, options = {}) {
    const { refillInput = false, skipConfirm = false } = options;
    if (chatGenerationState.isGenerating || !userNode) return false;

    const snapshots = await loadDesktopTurnSnapshots();
    const turn = locateUserTurn(userNode, snapshots);
    if (turn.domIndex === -1) return false;

    const isLastTurn = userNode === getLastUserMessageNode();
    if (!skipConfirm && (!refillInput || !isLastTurn)) {
        const message = isLastTurn
            ? 'Rewind to before this turn? The reply and its effects on your stats, inventory, and codex will be undone.'
            : 'Rewind to before this turn? This turn and every turn after it will be discarded, along with their effects on your stats, inventory, and codex.';
        if (!await confirmGameAction(message, 'Rewind Story', 'Rewind')) return false;
    }

    const originalText = userNode.querySelector('.message-content')?.textContent || '';

    if (turn.snapshotIndex >= 0) {
        restoreRuntimeState(snapshots[turn.snapshotIndex].before);
        await saveDesktopTurnSnapshots(snapshots.slice(0, turn.snapshotIndex));
    } else if (turn.historyIndex >= 0) {
        // Turn played before rewind support existed: only the story text can be rewound.
        window.chatHistory.splice(turn.historyIndex);
        showGameToast('This turn has no saved state, so the story was rewound but stats, inventory, and codex were left as they are.', 'warning');
    } else {
        showGameToast('This turn has already been folded into the adventure summary and has no saved state to rewind to.', 'error');
        return false;
    }

    for (let i = turn.domIndex; i < turn.allNodes.length; i++) {
        turn.allNodes[i].remove();
    }

    if (refillInput) setChatInputText(originalText, true);
    refreshChatMessageControls();
    if (typeof hideGameOverScreen === 'function' && (getPlayerHealth() ?? 1) > 0) hideGameOverScreen();
    await saveCurrentGame();
    return true;
}

async function rewindLastTurn(options = {}) {
    const lastUserNode = getLastUserMessageNode();
    if (!lastUserNode) return false;
    return rewindToUserMessage(lastUserNode, options);
}

async function branchFromAiMessage(aiNode) {
    if (chatGenerationState.isGenerating || !window.tauriBridge?.createBranchGame) return;
    const gameId = getActiveGameId();
    if (!gameId) return;

    const chatMessages = document.getElementById('chat-messages');
    const allNodes = Array.from(chatMessages.children);
    const nextUserNode = allNodes.slice(allNodes.indexOf(aiNode) + 1).find(node => node.classList.contains('user-message'));

    const snapshots = await loadDesktopTurnSnapshots();
    let state;
    let branchSnapshots = snapshots;
    if (nextUserNode) {
        // The state right after this reply is the state saved just before the next turn.
        const turn = locateUserTurn(nextUserNode, snapshots);
        if (turn.snapshotIndex < 0) {
            showGameToast('This point in the story has no saved state, so it cannot be branched. Turns played from now on can be.', 'error');
            return;
        }
        state = snapshots[turn.snapshotIndex].before;
        branchSnapshots = snapshots.slice(0, turn.snapshotIndex);
    } else {
        state = captureRuntimeState();
    }

    if (!await confirmGameAction('Create a new save that continues from this point? This save stays unchanged, and you will switch to the new one.', 'Branch Story', 'Create Branch', false)) return;

    const result = await window.tauriBridge.createBranchGame(gameId, state, branchSnapshots);
    if (!result?.success) {
        showGameToast(`Could not create the branch: ${result?.error || 'unknown error'}`, 'error');
        return;
    }
    window.location.href = `game.html?action=load&id=${encodeURIComponent(result.folder)}`;
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
    if (!apiKey && provider !== 'openai' && provider !== 'lmstudio') return userInput;

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
        } else if (provider === 'lmstudio' || provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const payloadOptions = getReasoningPayloadOptions(provider, 'helper');
        const maxTokens = getCompletionBudget(HELPER_MAX_TOKENS, provider, payloadOptions, MIN_HELPER_RESPONSE_TOKENS);
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: buildAuthHeaders(apiKey, provider),
            body: buildFetchPayload(model, [
                { role: 'system', content: promptInstructions }
            ], 0.1, maxTokens, 1.0, 0, 0, provider,
                provider === 'lmstudio'
                    ? { type: "object", properties: { relevant: { type: "boolean" }, context_string: { type: "string" } }, required: ["relevant", "context_string"], additionalProperties: false }
                    : null,
                payloadOptions
            )
        });

        if (response.ok) {
            const data = await response.json();
            const parsed = await parseStructuredModelOutput(getChoiceContentOrThrow(data, 'prompt context precheck'), {
                requiredKeys: ['relevant', 'context_string'],
                jsonExample: '{"relevant":true,"context_string":"Known lore details"}',
                label: 'prompt context precheck'
            });

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

function retrieveInternalLore(userInput) {
    if (!window.gamestate) return '';

    const npcs = window.gamestate.npcs || [];
    const locations = window.gamestate.locations || [];
    let loreLines = [];

    const lowerInput = userInput.toLowerCase();

    // Scan NPCs
    for (const npc of npcs) {
        if (npc.name && lowerInput.includes(npc.name.toLowerCase())) {
            const npcLore = [
                npc.description ? `Description: ${npc.description}` : '',
                (npc.notes || npc.status_or_history || npc.history_with_player) ? `Notes: ${npc.notes || npc.status_or_history || npc.history_with_player}` : ''
            ].filter(Boolean).join(' ');
            loreLines.push(`NPC - ${npc.name}: ${npcLore}`);
        }
    }

    // Scan Locations
    for (const loc of locations) {
        if (loc.name && lowerInput.includes(loc.name.toLowerCase())) {
            const locationLore = [
                loc.description ? `Description: ${loc.description}` : '',
                loc.notes ? `Notes: ${loc.notes}` : ''
            ].filter(Boolean).join(' ');
            loreLines.push(`Location - ${loc.name}: ${locationLore}`);
        }
    }

    return loreLines.length > 0 ? loreLines.join('\n') : '';
}

const chatInputPrompts = [
    'What will you do...',
    'Where will you go...',
    'Who will you trust...',
    'What will you say...',
    'What will you search for...',
    'How will you survive...',
    'What will you risk...',
    'Who will you follow...',
    'What will you take...',
    'What will you leave behind...'
];

const CHAT_DRAFT_STORAGE_PREFIX = 'jsonAdventure_chatDraft_';
const CHAT_PENDING_TURN_STORAGE_PREFIX = 'jsonAdventure_pendingTurn_';
const chatGenerationState = {
    isGenerating: false
};

function getCurrentGameIdForChatState() {
    const activeId = typeof currentGameFolder !== 'undefined' && currentGameFolder
        ? currentGameFolder
        : window.currentGameFolder;
    if (activeId) return String(activeId);

    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || 'global';
    } catch (e) {
        return 'global';
    }
}

function getChatStorageKey(prefix, gameId = getCurrentGameIdForChatState()) {
    return prefix + encodeURIComponent(String(gameId || 'global'));
}

function resizeChatInput(chatInput) {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    if (chatInput.value) {
        chatInput.style.height = chatInput.scrollHeight + 'px';
    }
}

function setChatInputText(value, focus = false) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    chatInput.value = value || '';
    resizeChatInput(chatInput);
    persistChatDraft(chatInput.value);
    if (focus) chatInput.focus();
}

function persistChatDraft(value) {
    const chatInput = document.getElementById('chat-input');
    const text = value !== undefined ? String(value || '') : (chatInput ? chatInput.value : '');
    const key = getChatStorageKey(CHAT_DRAFT_STORAGE_PREFIX);
    if (text) {
        localStorage.setItem(key, text);
    } else {
        localStorage.removeItem(key);
    }
}

function persistChatDraftOnPageHide() {
    persistChatDraft();
}

function clearChatDraft() {
    localStorage.removeItem(getChatStorageKey(CHAT_DRAFT_STORAGE_PREFIX));
}

function restoreChatDraft() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || chatInput.value) return;

    const draft = localStorage.getItem(getChatStorageKey(CHAT_DRAFT_STORAGE_PREFIX));
    if (draft) {
        chatInput.value = draft;
        resizeChatInput(chatInput);
    }
}

function getOriginalUserPrompt(content) {
    const text = String(content || '');
    const marker = 'Player action: ';
    if (text.includes(marker)) {
        return text.split(marker).pop().trim();
    }
    return text.trim();
}

function storePendingChatTurn(message) {
    const gameId = getCurrentGameIdForChatState();
    const pending = {
        gameId,
        message,
        createdAt: Date.now()
    };
    localStorage.setItem(getChatStorageKey(CHAT_PENDING_TURN_STORAGE_PREFIX, gameId), JSON.stringify(pending));
}

function getPendingChatTurn() {
    const key = getChatStorageKey(CHAT_PENDING_TURN_STORAGE_PREFIX);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
        const pending = JSON.parse(raw);
        if (!pending || typeof pending.message !== 'string' || !pending.message.trim()) {
            localStorage.removeItem(key);
            return null;
        }
        return pending;
    } catch (e) {
        localStorage.removeItem(key);
        return null;
    }
}

function clearPendingChatTurn() {
    localStorage.removeItem(getChatStorageKey(CHAT_PENDING_TURN_STORAGE_PREFIX));
}

function removeLastVisibleUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return false;

    const userMessages = Array.from(chatMessages.querySelectorAll('.user-message'));
    const lastUserMessage = userMessages[userMessages.length - 1];
    if (!lastUserMessage) return false;

    const text = (lastUserMessage.querySelector('.message-content')?.textContent || '').trim();
    if (text !== String(message || '').trim()) return false;

    lastUserMessage.remove();
    return true;
}

function rollbackUnansweredUserTurn(message) {
    let removedHistory = false;
    if (Array.isArray(window.chatHistory) && window.chatHistory.length > 0) {
        const last = window.chatHistory[window.chatHistory.length - 1];
        if (last?.role === 'user' && getOriginalUserPrompt(last.content) === String(message || '').trim()) {
            window.chatHistory.pop();
            removedHistory = true;
        }
    }

    const removedDom = removeLastVisibleUserMessage(message);
    return removedHistory || removedDom;
}

function setChatGenerationActive(isGenerating) {
    chatGenerationState.isGenerating = isGenerating;

    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.disabled = isGenerating;
        sendBtn.setAttribute('aria-busy', isGenerating ? 'true' : 'false');
        sendBtn.title = isGenerating ? 'Generating...' : 'Send message';
    }

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.disabled = isGenerating || stuckHintState.loading;

    if (typeof updateMicButtonState === 'function') {
        updateMicButtonState();
    }
}

/** Strip HTML / collapse whitespace for a short desktop notification body. */
function plainTextForNotification(htmlOrText, maxLen = 160) {
    const raw = String(htmlOrText || '');
    let text = raw;
    if (/[<>]/.test(raw)) {
        const tmp = document.createElement('div');
        tmp.innerHTML = raw;
        text = tmp.textContent || tmp.innerText || '';
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + '…';
    return text;
}

/**
 * Fire a cross-platform desktop notification when a game response finishes.
 * Respects Settings → General → Desktop notifications (default on).
 */
function notifyResponseFinished(options = {}) {
    try {
        if (localStorage.getItem('jsonAdventure_desktopNotifications') === 'false') return;
        if (typeof document.hasFocus === 'function' && document.hasFocus()) return;

        const ok = options.ok !== false;
        const title = ok ? 'Odyssey — Response ready' : 'Odyssey — Response failed';
        const body = options.body
            ? plainTextForNotification(options.body)
            : (ok ? 'Your story response is ready.' : 'The response failed. Check the chat for details.');

        const notifyFn = window.odysseyShowDesktopNotification
            || (window.tauriBridge && window.tauriBridge.showDesktopNotification
                ? window.tauriBridge.showDesktopNotification.bind(window.tauriBridge)
                : null);
        if (typeof notifyFn === 'function') {
            Promise.resolve(notifyFn(title, body)).catch((err) => {
                console.warn('Desktop notification failed:', err);
            });
        }
    } catch (err) {
        console.warn('notifyResponseFinished error:', err);
    }
}

function restoreFailedPromptToInput(message) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    if (!chatInput.value.trim()) {
        setChatInputText(message, true);
    } else {
        persistChatDraft(chatInput.value);
    }
}

async function resumePendingChatTurnIfNeeded() {
    const pending = getPendingChatTurn();
    if (!pending || chatGenerationState.isGenerating) return;

    rollbackUnansweredUserTurn(pending.message);
    await sendChatMessageFromText(pending.message, { fromPending: true });
}

function startChatPlaceholderLoop() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    if (window.chatPlaceholderTimer) {
        clearTimeout(window.chatPlaceholderTimer);
    }

    let promptIndex = 0;
    let charIndex = 0;
    const typeDelay = 70;
    const holdDelay = 2400;
    const swapDelay = 220;

    function typeNextPrompt() {
        const prompt = chatInputPrompts[promptIndex];
        chatInput.placeholder = prompt.slice(0, charIndex);
        charIndex++;

        if (charIndex <= prompt.length) {
            window.chatPlaceholderTimer = setTimeout(typeNextPrompt, typeDelay);
            return;
        }

        window.chatPlaceholderTimer = setTimeout(() => {
            promptIndex = (promptIndex + 1) % chatInputPrompts.length;
            charIndex = 0;
            chatInput.placeholder = '';
            window.chatPlaceholderTimer = setTimeout(typeNextPrompt, swapDelay);
        }, holdDelay);
    }

    typeNextPrompt();
}

// Ensure the chat input dynamically scales
function setupChatInput() {
    const sendBtn = document.querySelector('.send-btn');
    const chatInput = document.getElementById('chat-input');
    const micBtn = document.getElementById('mic-btn');

    // Remove old listeners by cloning
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

    const newChatInput = chatInput.cloneNode(true);
    chatInput.parentNode.replaceChild(newChatInput, chatInput);

    if (micBtn && micBtn.parentNode) {
        const newMicBtn = micBtn.cloneNode(true);
        micBtn.parentNode.replaceChild(newMicBtn, micBtn);
        wireMicHoldToTalk(newMicBtn);
    }

    newSendBtn.onclick = () => sendChatMessage();
    newChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    newChatInput.addEventListener('input', function () {
        resizeChatInput(this);
        persistChatDraft(this.value);
    });
    newChatInput.addEventListener('blur', () => persistChatDraft(newChatInput.value));

    restoreChatDraft();
    window.removeEventListener('pagehide', persistChatDraftOnPageHide);
    window.addEventListener('pagehide', persistChatDraftOnPageHide);
    startChatPlaceholderLoop();
    updateMicButtonState();
}

async function runWikipediaPreCheck(userInput) {
    if (localStorage.getItem('jsonAdventure_enableWebSearch') !== 'true') return { needs_search: false, query: '' };

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';
    if (!apiKey && provider !== 'openai' && provider !== 'lmstudio') return { needs_search: false, query: '' };

    const promptInstructions = `You are a search analysis tool analyzing the latest player action in a modern-day text-adventure game.
Determine if the user's action involves or mentions a specific REAL-WORLD factual entity (like a current government leader, a real-world business CEO, a real country, a real company, historical event, etc.) where the Game Master might need accurate real-world context to describe the scene or consequences properly.

If the Game Master needs real-world context, set "needs_search" to true and extract the EXACT, optimal short search query (e.g. "CEO of Apple", "President of France", "Microsoft", "Tim Cook") into "search_query".
If the message is just general game actions (e.g., "I open the door", "I talk to the bartender"), fictional game items, or fictional lore characters, set "needs_search" to false and leave "search_query" empty.

USER MESSAGE: "${userInput}"

CRITICAL: Output ONLY valid JSON:
{"needs_search": true/false, "search_query": "search terms here or empty"}`;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') fetchUrl = "https://api.x.ai/v1/chat/completions";
        else if (provider === 'googleai') fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        else if (provider === 'lmstudio' || provider === 'openai') fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

        const payloadOptions = getReasoningPayloadOptions(provider, 'helper');
        const maxTokens = getCompletionBudget(HELPER_MAX_TOKENS, provider, payloadOptions, MIN_HELPER_RESPONSE_TOKENS);
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: buildAuthHeaders(apiKey, provider),
            body: buildFetchPayload(model, [{ role: 'system', content: promptInstructions }], 0.1, maxTokens, 1.0, 0, 0, provider,
                provider === 'lmstudio' || provider === 'openai'
                    ? { type: "object", properties: { needs_search: { type: "boolean" }, search_query: { type: "string" } }, required: ["needs_search", "search_query"], additionalProperties: false }
                    : null,
                payloadOptions
            )
        });

        if (response.ok) {
            const data = await response.json();
            const parsed = await parseStructuredModelOutput(getChoiceContentOrThrow(data, 'Wikipedia precheck'), {
                requiredKeys: ['needs_search', 'search_query'],
                jsonExample: '{"needs_search":true,"search_query":"CEO of Apple"}',
                label: 'Wikipedia precheck'
            });
            return { needs_search: !!parsed.needs_search, query: parsed.search_query || '' };
        }
    } catch (err) { console.error("Wiki precheck error:", err); }

    return { needs_search: false, query: '' };
}

async function performWikipediaSearch(query) {
    if (!query) return '';
    if (window.OdysseyRetrieval) {
        const results = await window.OdysseyRetrieval.searchWikipedia(query, 3);
        return window.OdysseyRetrieval.formatSearchResults('WIKIPEDIA RESULT', results);
    }

    try {
        console.log("Querying Wikipedia for:", query);
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (data.query && data.query.search && data.query.search.length > 0) {
            // Grab the top result snippet and clean HTML tags
            let topHit = data.query.search[0];
            let cleanSnippet = topHit.snippet.replace(/<\/?[^>]+(>|$)/g, "");
            return `WIKIPEDIA RESULT FOR "${topHit.title}": ${cleanSnippet}`;
        }
    } catch (err) {
        console.error("Wikipedia search failed:", err);
    }
    return '';
}

async function performBraveSearch(query) {
    if (!query || !window.OdysseyRetrieval) return '';
    const results = await window.OdysseyRetrieval.searchBrave(query);
    return window.OdysseyRetrieval.formatSearchResults('BRAVE WEB RESULT', results);
}

async function runFandomPreCheck(userInput, presetKey) {
    if (localStorage.getItem('jsonAdventure_enableFandomSearch') !== 'true') return { needs_search: false, query: '' };
    const presetData = WORLD_PRESETS[presetKey];
    if (!presetData || !presetData.wikiUrl) return { needs_search: false, query: '' };

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';
    if (!apiKey && provider !== 'openai' && provider !== 'lmstudio') return { needs_search: false, query: '' };

    const promptInstructions = `You are a search analysis tool analyzing the latest player action in a "${presetData.name}" universe text-adventure game.
Determine if the user's action involves or mentions a specific lore entity, character, location, faction, or item from this specific universe where the Game Master might need accurate wiki context to describe the scene or consequences properly.

If the Game Master needs lore context, set "needs_search" to true and extract the EXACT, optimal short search query (e.g. "Darth Vader", "Tatooine", "Hogwarts", "Mandalorian") into "search_query".
If the message is just general game actions (e.g., "I open the door", "I walk forward"), set "needs_search" to false and leave "search_query" empty.

USER MESSAGE: "${userInput}"

CRITICAL: Output ONLY valid JSON:
{"needs_search": true/false, "search_query": "search terms here or empty"}`;

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') fetchUrl = "https://api.x.ai/v1/chat/completions";
        else if (provider === 'googleai') fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        else if (provider === 'lmstudio' || provider === 'openai') fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

        const payloadOptions = getReasoningPayloadOptions(provider, 'helper');
        const maxTokens = getCompletionBudget(HELPER_MAX_TOKENS, provider, payloadOptions, MIN_HELPER_RESPONSE_TOKENS);
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: buildAuthHeaders(apiKey, provider),
            body: buildFetchPayload(model, [{ role: 'system', content: promptInstructions }], 0.1, maxTokens, 1.0, 0, 0, provider,
                provider === 'lmstudio' || provider === 'openai'
                    ? { type: "object", properties: { needs_search: { type: "boolean" }, search_query: { type: "string" } }, required: ["needs_search", "search_query"], additionalProperties: false }
                    : null,
                payloadOptions
            )
        });

        if (response.ok) {
            const data = await response.json();
            const parsed = await parseStructuredModelOutput(getChoiceContentOrThrow(data, 'Fandom precheck'), {
                requiredKeys: ['needs_search', 'search_query'],
                jsonExample: '{"needs_search":true,"search_query":"Darth Vader"}',
                label: 'Fandom precheck'
            });
            return { needs_search: !!parsed.needs_search, query: parsed.search_query || '' };
        }
    } catch (err) { console.error("Fandom precheck error:", err); }

    return { needs_search: false, query: '' };
}

async function performFandomSearch(query, presetKey) {
    if (!query) return '';
    if (window.OdysseyRetrieval) {
        const results = await window.OdysseyRetrieval.searchFandom(query, presetKey, 3, window.worldInfo || {});
        return window.OdysseyRetrieval.formatSearchResults('LORE WIKI RESULT', results);
    }

    const presetData = WORLD_PRESETS[presetKey];
    if (!presetData || !presetData.wikiUrl) return '';
    try {
        console.log(`Querying ${presetData.name} Fandom Wiki for:`, query);
        // Process wikiUrl to extract origin since API is at root /api.php
        const urlObj = new URL(presetData.wikiUrl);
        // Sometimes wookieepedia has a specific path like starwars.fandom.com/pt/api.php if localized, but default english is starwars.fandom.com/api.php
        // Just use origin + /api.php which covers 99% of Fandom sites. For awoiaf it's awoiaf.westeros.org/api.php 
        // We will construct it by replacing the /wiki/ or /index.php/ part with /api.php
        let apiEndpointStr = presetData.wikiUrl;
        if (apiEndpointStr.includes('/wiki/')) {
            apiEndpointStr = apiEndpointStr.replace('/wiki/', '/api.php');
        } else if (apiEndpointStr.includes('/index.php/')) {
            apiEndpointStr = apiEndpointStr.replace('/index.php/', '/api.php');
        } else {
            apiEndpointStr = urlObj.origin + '/api.php';
        }

        const searchUrl = `${apiEndpointStr}?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;

        const res = await fetch(searchUrl);
        const data = await res.json();
        if (data.query && data.query.search && data.query.search.length > 0) {
            // Grab the top result snippet and clean HTML tags
            let topHit = data.query.search[0];
            let cleanSnippet = topHit.snippet.replace(/<\/?[^>]+(>|$)/g, "");
            return `LORE WIKI RESULT FOR "${topHit.title}": ${cleanSnippet}`;
        }
    } catch (err) {
        console.error("Fandom search failed:", err);
    }
    return '';
}

function getActiveLoreLookupKey() {
    const presetKey = (window.worldInfo?.world?.preset || '').toLowerCase();
    const wikiConfig = window.OdysseyRetrieval?.getWorldWikiConfig(presetKey, window.worldInfo || {});
    return wikiConfig?.key || presetKey;
}

async function retrieveFandomLoreForMessage(message) {
    const loreKey = getActiveLoreLookupKey();
    if (!loreKey) return '';

    const presetData = WORLD_PRESETS[loreKey] || window.OdysseyRetrieval?.getWorldWikiConfig(loreKey, window.worldInfo || {});
    if (!presetData) return '';

    const fandomContext = await runFandomPreCheck(message, loreKey);
    if (fandomContext && fandomContext.needs_search && fandomContext.query) {
        return await performFandomSearch(fandomContext.query, loreKey);
    }
    return '';
}

async function retrieveVectorRagContext(userInput) {
    if (!window.OdysseyRetrieval || !userInput) return '';
    const allData = {
        worldInfo: window.worldInfo || {},
        playerInfo: window.playerInfo || {},
        gameState: window.gamestate || {},
        summaryText: window.gameSummaryText || ''
    };
    return await window.OdysseyRetrieval.buildRagContext(userInput, allData);
}


// ============================================================
// TURN ENGINE (send, regenerate, streaming)
// ============================================================

async function gatherTurnContext(action) {
    const context = { internalLore: '', ragData: '', wikiData: '', braveData: '', fandomData: '' };
    if (!action) return context;

    context.internalLore = retrieveInternalLore(action);
    context.ragData = await retrieveVectorRagContext(action);

    const searchContext = await runWikipediaPreCheck(action);
    if (searchContext && searchContext.needs_search && searchContext.query) {
        const [wikiResult, braveResult] = await Promise.all([
            performWikipediaSearch(searchContext.query),
            performBraveSearch(searchContext.query)
        ]);
        context.wikiData = wikiResult;
        context.braveData = braveResult;
    }

    context.fandomData = await retrieveFandomLoreForMessage(action);
    return context;
}

function refreshSystemPromptWithContext(context = {}) {
    if (!Array.isArray(window.chatHistory)) window.chatHistory = [];
    const allData = {
        worldInfo: window.worldInfo || {},
        playerInfo: window.playerInfo || {},
        gameState: window.gamestate || {}
    };
    const content = buildGameSystemPrompt(
        allData,
        window.gameSummaryText || '',
        context.internalLore || '',
        context.wikiData || '',
        context.fandomData || '',
        localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter',
        context.ragData || '',
        context.braveData || ''
    );
    if (window.chatHistory[0]?.role === 'system') {
        window.chatHistory[0].content = content;
    } else {
        window.chatHistory.unshift({ role: 'system', content });
    }
}

function isResponseStreamingEnabled() {
    return localStorage.getItem('jsonAdventure_streamResponses') !== 'false';
}

// Decodes a JSON string field from an incomplete JSON document, so narration can be shown
// while the rest of the turn object is still arriving. Returns null until the field starts.
function extractPartialJsonStringField(raw, field) {
    const match = new RegExp(`"${field}"\\s*:\\s*"`).exec(raw);
    if (!match) return null;

    const escapes = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };
    let out = '';
    let i = match.index + match[0].length;
    while (i < raw.length) {
        const ch = raw[i];
        if (ch === '"') return out;
        if (ch !== '\\') {
            out += ch;
            i++;
            continue;
        }
        const next = raw[i + 1];
        if (next === undefined) break;
        if (next === 'u') {
            const hex = raw.slice(i + 2, i + 6);
            if (hex.length < 4) break;
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
            continue;
        }
        out += escapes[next] ?? next;
        i += 2;
    }
    return out;
}

// Reads an OpenAI-style SSE stream and returns a response shaped like a non-streamed completion.
async function readChatCompletionStream(response, onContent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let finishReason = '';

    const handleLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;

        let chunk;
        try {
            chunk = JSON.parse(data);
        } catch (e) {
            return;
        }
        if (chunk.error) {
            const detail = chunk.error.message || JSON.stringify(chunk.error);
            throw new Error(`API returned status ${chunk.error.code || 500}: ${detail}`);
        }
        const choice = chunk.choices?.[0];
        const delta = choice?.delta?.content;
        if (typeof delta === 'string' && delta) {
            content += delta;
            if (onContent) onContent(content);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
            handleLine(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
        }
    }
    handleLine(buffer + decoder.decode());

    return { choices: [{ message: { content }, finish_reason: finishReason }] };
}

async function requestGameTurnFromModel({ label = 'game turn', temperatureFallback = 0.8, onNarration = null } = {}) {
    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const temp = parseFloat(localStorage.getItem('jsonAdventure_apiTemperature')) || temperatureFallback;
    const maxTokens = Math.max(parseInt(localStorage.getItem('jsonAdventure_apiMaxTokens'), 10) || 0, DEFAULT_MAX_TOKENS);
    const topP = parseFloat(localStorage.getItem('jsonAdventure_apiTopP')) || 1.0;
    const presPen = parseFloat(localStorage.getItem('jsonAdventure_apiPresencePenalty')) || 0.0;
    const freqPen = parseFloat(localStorage.getItem('jsonAdventure_apiFrequencyPenalty')) || 0.0;

    const stream = isResponseStreamingEnabled();
    const payloadOptions = getReasoningPayloadOptions(provider, 'main');
    const completionBudget = getCompletionBudget(maxTokens, provider, payloadOptions, MIN_MAIN_RESPONSE_TOKENS);
    // History entries carry local bookkeeping (turnId, variants); providers only get role/content.
    const messages = window.chatHistory.map(message => ({ role: message.role, content: message.content }));

    const response = await fetch(getChatCompletionsUrl(provider, baseUrl), {
        method: 'POST',
        headers: buildAuthHeaders(apiKey, provider),
        body: buildFetchPayload(model, messages, temp, completionBudget, topP, presPen, freqPen, provider, gameOutputSchema,
            stream ? { ...payloadOptions, stream: true } : payloadOptions)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errText}`);
    }

    const isEventStream = (response.headers.get('content-type') || '').includes('text/event-stream');
    const data = stream && isEventStream && response.body
        ? await readChatCompletionStream(response, raw => {
            const narration = extractPartialJsonStringField(raw, 'textoutput');
            if (narration !== null && onNarration) onNarration(narration);
        })
        : await response.json();

    return parseStructuredModelOutput(getChoiceContentOrThrow(data, label), {
        requiredKeys: GAME_TURN_REQUIRED_KEYS,
        jsonExample: GAME_TURN_JSON_EXAMPLE,
        label
    });
}

// Shows streamed narration in a temporary message until the final turn replaces it.
function createStreamingNarrationView(chatMessages, loadingMsg) {
    let view = null;
    let pendingText = '';
    let frame = 0;

    const render = () => {
        frame = 0;
        const nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 120;
        if (!view) {
            view = createMessageShell('ai', 'streaming-message');
            if (loadingMsg) loadingMsg.style.display = 'none';
            chatMessages.appendChild(view.msgDiv);
        }
        view.content.innerHTML = renderMarkdownSafe(pendingText);
        if (nearBottom) chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    return {
        update(text) {
            pendingText = text;
            if (!frame) frame = window.requestAnimationFrame(render);
        },
        remove() {
            if (frame) window.cancelAnimationFrame(frame);
            frame = 0;
            if (view) view.msgDiv.remove();
            view = null;
        }
    };
}

function extractTurnNarration(content) {
    const parsed = tryParseJsonObject(content);
    return parsed?.textoutput || String(content || '');
}

function getPlayerHealth(gameState = window.gamestate) {
    const health = Number(gameState?.stats?.health);
    return Number.isFinite(health) ? health : null;
}

function captureAssistantVariant(content, usage = null) {
    return {
        content,
        usage,
        gameState: deepCloneJson(window.gamestate || {}),
        playerInfo: deepCloneJson(window.playerInfo || { player: {} })
    };
}

function beginTurnUsage() {
    return window.OdysseyUsage ? window.OdysseyUsage.beginScope('turn') : null;
}

async function endTurnUsage(scope) {
    return window.OdysseyUsage && scope ? await window.OdysseyUsage.endScope(scope) : null;
}

// Alternate versions are only kept for the newest reply; sending a new turn commits the one shown.
function commitAssistantVariants() {
    (window.chatHistory || []).forEach(message => {
        if (message.role !== 'assistant') return;
        delete message.variants;
        delete message.variantIndex;
    });
}

function appendGameTurnResult(aiJson, chatMessages, usage = null) {
    const aiText = JSON.stringify(aiJson);
    const assistantMsg = { role: 'assistant', content: aiText };
    if (usage) assistantMsg.usage = usage;
    window.chatHistory.push(assistantMsg);
    const displayText = processGameTurnJson(aiText);
    const aiMsg = createChatMessage('ai', displayText, { usage });
    chatMessages.appendChild(aiMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return { assistantMsg, displayText, aiMsg };
}

function finishGameTurn({ displayText, aiMsg, previousHealth }) {
    refreshChatMessageControls();
    saveCurrentGame();
    setTimeout(() => summarizeOldMessages(), 100);

    if (localStorage.getItem('jsonAdventure_enableAutoImage') === 'true') {
        triggerImageGeneration();
    }

    notifyResponseFinished({ ok: true, body: displayText });
    maybeAutoNarrate(displayText, aiMsg);
    checkForGameOver(previousHealth);
}

function appendTurnErrorCard(chatMessages, title, err) {
    const card = `<div class="error-card" style="background: var(--bg-tertiary); border-left: 4px solid var(--accent-color); padding: 15px; border-radius: 8px; margin: 10px 0;"><strong>${window.OdysseyIcons.html('warning')} ${escapeHtml(title)}</strong><p style="margin-top: 5px; color: var(--text-muted);">${escapeHtml(formatErrorForUser(err))}</p></div>`;
    chatMessages.appendChild(createChatMessage('ai', card, { isError: true }));
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    if (!message || chatGenerationState.isGenerating) return;

    await sendChatMessageFromText(message);
}

async function sendChatMessageFromText(message, options = {}) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage || chatGenerationState.isGenerating) return;

    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    setChatGenerationActive(true);
    storePendingChatTurn(cleanMessage);
    hideStuckHints();
    _stopActiveTtsAudio();

    if (chatInput && chatInput.value.trim() === cleanMessage) {
        chatInput.value = '';
        resizeChatInput(chatInput);
        clearChatDraft();
    } else if (!chatInput || !chatInput.value.trim()) {
        clearChatDraft();
    }

    commitAssistantVariants();
    const snapshot = createDesktopTurnSnapshot(cleanMessage);
    const previousHealth = getPlayerHealth();

    const userMsg = createChatMessage('user', cleanMessage, { turnId: snapshot.id });
    chatMessages.appendChild(userMsg);
    const usageScope = beginTurnUsage();

    let loadingMsg = createGenerationLoader(options.fromPending ? 'Resuming the last turn...' : 'Checking notes...');
    chatMessages.appendChild(loadingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const stream = createStreamingNarrationView(chatMessages, loadingMsg);

    try {
        const promptedMessage = await runPrompter(cleanMessage);

        const loaderContent = loadingMsg.querySelector('.generation-loader-text');
        if (loaderContent) loaderContent.textContent = 'Building story threads...';

        const context = await gatherTurnContext(cleanMessage);
        window.chatHistory.push({ role: 'user', content: promptedMessage, turnId: snapshot.id });
        refreshSystemPromptWithContext(context);

        const aiJson = await requestGameTurnFromModel({
            label: 'game turn',
            temperatureFallback: 0.8,
            onNarration: text => stream.update(text)
        });

        const usage = await endTurnUsage(usageScope);
        stream.remove();
        removeGenerationLoader(loadingMsg);
        loadingMsg = null;
        const { displayText, aiMsg } = appendGameTurnResult(aiJson, chatMessages, usage);

        await appendDesktopTurnSnapshot(snapshot);
        clearPendingChatTurn();
        finishGameTurn({ displayText, aiMsg, previousHealth });
    } catch (err) {
        endTurnUsage(usageScope);
        stream.remove();
        if (loadingMsg) removeGenerationLoader(loadingMsg);

        // Undo everything the turn touched, including a partially applied state update.
        restoreRuntimeState(snapshot.before);
        userMsg.remove();
        refreshChatMessageControls();

        clearPendingChatTurn();
        restoreFailedPromptToInput(cleanMessage);
        appendTurnErrorCard(chatMessages, 'Connection Error', err);
        notifyResponseFinished({ ok: false, body: formatErrorForUser(err) });
    } finally {
        setChatGenerationActive(false);
    }
}

async function regenerateLastAI() {
    if (chatGenerationState.isGenerating || !Array.isArray(window.chatHistory)) return;

    const lastIndex = window.chatHistory.length - 1;
    const replacedMsg = window.chatHistory[lastIndex];
    const userHistoryMsg = window.chatHistory[lastIndex - 1];
    if (replacedMsg?.role !== 'assistant' || userHistoryMsg?.role !== 'user') return;

    const chatMessages = document.getElementById('chat-messages');
    const aiNodes = getTurnAiMessageNodes();
    const replacedNode = aiNodes[aiNodes.length - 1] || null;

    setChatGenerationActive(true);
    hideStuckHints();
    _stopActiveTtsAudio();

    // Keep the reply being replaced (and the state it produced) so the player can page back to it.
    const variants = Array.isArray(replacedMsg.variants) && replacedMsg.variants.length
        ? replacedMsg.variants
        : [captureAssistantVariant(replacedMsg.content, replacedMsg.usage || null)];
    const rollbackState = captureRuntimeState();
    const usageScope = beginTurnUsage();

    const snapshots = await loadDesktopTurnSnapshots();
    const snapshotIndex = findSnapshotIndex(snapshots, userHistoryMsg.turnId, userHistoryMsg, lastIndex - 1);
    let previousHealth = getPlayerHealth();
    if (snapshotIndex >= 0) {
        const before = snapshots[snapshotIndex].before;
        previousHealth = getPlayerHealth(before.gameState);
        restoreRuntimeState(before);
        window.chatHistory.push(deepCloneJson(userHistoryMsg));
    } else {
        // No snapshot for this turn (it predates rewind support), so only the reply is replaced.
        window.chatHistory.pop();
    }

    if (replacedNode) replacedNode.remove();
    let loadingMsg = createGenerationLoader('Revisiting the last scene...');
    chatMessages.appendChild(loadingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const stream = createStreamingNarrationView(chatMessages, loadingMsg);

    try {
        const action = getOriginalUserPrompt(userHistoryMsg.content);
        const context = await gatherTurnContext(action);
        refreshSystemPromptWithContext(context);

        const aiJson = await requestGameTurnFromModel({
            label: 'regenerated game turn',
            temperatureFallback: 0.85,
            onNarration: text => stream.update(text)
        });

        const usage = await endTurnUsage(usageScope);
        stream.remove();
        removeGenerationLoader(loadingMsg);
        loadingMsg = null;
        const { assistantMsg, displayText, aiMsg } = appendGameTurnResult(aiJson, chatMessages, usage);
        variants.push(captureAssistantVariant(assistantMsg.content, usage));
        assistantMsg.variants = variants;
        assistantMsg.variantIndex = variants.length - 1;

        finishGameTurn({ displayText, aiMsg, previousHealth });
    } catch (err) {
        endTurnUsage(usageScope);
        stream.remove();
        if (loadingMsg) removeGenerationLoader(loadingMsg);

        restoreRuntimeState(rollbackState);
        if (replacedNode) chatMessages.appendChild(replacedNode);
        refreshChatMessageControls();
        appendTurnErrorCard(chatMessages, 'Regeneration failed', err);
        notifyResponseFinished({ ok: false, body: formatErrorForUser(err) });
    } finally {
        setChatGenerationActive(false);
    }
}

async function showAssistantVariant(delta) {
    if (chatGenerationState.isGenerating) return;
    const message = window.chatHistory?.[window.chatHistory.length - 1];
    if (message?.role !== 'assistant' || !Array.isArray(message.variants)) return;

    const current = Number.isInteger(message.variantIndex) ? message.variantIndex : message.variants.length - 1;
    const next = Math.min(Math.max(current + delta, 0), message.variants.length - 1);
    if (next === current) return;

    const variant = message.variants[next];
    message.variantIndex = next;
    message.content = variant.content;
    if (variant.usage) message.usage = variant.usage;
    else delete message.usage;
    window.gamestate = deepCloneJson(variant.gameState || {});
    window.playerInfo = deepCloneJson(variant.playerInfo || { player: {} });
    refreshGameStateUI();

    const aiNodes = getTurnAiMessageNodes();
    const latestNode = aiNodes[aiNodes.length - 1];
    if (latestNode) latestNode.replaceWith(createChatMessage('ai', extractTurnNarration(variant.content), { usage: variant.usage }));
    refreshChatMessageControls();
    await saveCurrentGame();
}

// ============================================================
// GAME OVER
// ============================================================

function checkForGameOver(previousHealth = null) {
    const health = getPlayerHealth();
    if (health === null || !window.gamestate) return;
    if (health > 0) {
        delete window.gamestate.gameOverAcknowledged;
        return;
    }
    // Already dead before this turn and the player chose to keep playing.
    if (previousHealth !== null && previousHealth <= 0) return;
    delete window.gamestate.gameOverAcknowledged;
    if (typeof showGameOverScreen === 'function') showGameOverScreen();
}

async function acknowledgeGameOver() {
    if (window.gamestate) window.gamestate.gameOverAcknowledged = true;
    if (typeof hideGameOverScreen === 'function') hideGameOverScreen();
    await saveCurrentGame();
}

// ============================================================
// "I'M STUCK" HINTS
// ============================================================

const stuckHintState = { loading: false, requestId: 0 };

function hideStuckHints() {
    stuckHintState.requestId++;
    stuckHintState.loading = false;
    const container = document.getElementById('hint-chips');
    if (container) {
        container.hidden = true;
        container.replaceChildren();
    }
    const button = document.getElementById('hint-btn');
    if (button) button.disabled = false;
}

function renderStuckHints(suggestions, statusText = '') {
    const container = document.getElementById('hint-chips');
    if (!container) return;
    container.replaceChildren();
    container.hidden = false;

    if (statusText) {
        const status = document.createElement('span');
        status.className = 'hint-chip-status';
        status.textContent = statusText;
        container.appendChild(status);
    }

    suggestions.forEach(suggestion => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'hint-chip';
        chip.textContent = suggestion;
        chip.title = 'Put this in the input box (you can edit it before sending)';
        chip.onclick = () => {
            setChatInputText(suggestion, true);
            hideStuckHints();
        };
        container.appendChild(chip);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'hint-chip hint-chip-close';
    close.innerHTML = window.OdysseyIcons.html('x');
    close.title = 'Hide suggestions';
    close.onclick = hideStuckHints;
    container.appendChild(close);
}

function buildStuckHintPrompt() {
    const recent = (window.chatHistory || [])
        .filter(message => message.role !== 'system')
        .slice(-6)
        .map(message => message.role === 'assistant'
            ? `NARRATOR: ${extractTurnNarration(message.content)}`
            : `PLAYER: ${getOriginalUserPrompt(message.content)}`)
        .join('\n\n');
    const state = window.gamestate || {};
    const activeQuests = (state.quests || [])
        .filter(quest => (quest.status || 'active') === 'active')
        .map(quest => `${quest.name}${quest.description ? ` — ${quest.description}` : ''}`);

    return `You help a player who is stuck in a text adventure. Suggest exactly 3 distinct, concrete things the player character could do next.

RULES:
- Ground every suggestion in the current scene, the people present, the inventory, and open goals.
- Write each one as a first-person action the player could type, under 15 words (e.g. "I ask the innkeeper who rented the upstairs room.").
- Offer different approaches (e.g. talk, investigate, move on). Do not reveal secrets the player has not discovered.

PLAYER: ${JSON.stringify(window.playerInfo?.player?.name || 'the player')}
STATS: ${JSON.stringify(state.stats || {})}
INVENTORY: ${(state.inventory || []).map(item => item.name).filter(Boolean).join(', ') || 'nothing'}
OPEN QUESTS: ${activeQuests.join('; ') || 'none recorded'}

ADVENTURE SUMMARY:
${window.gameSummaryText || 'None'}

RECENT SCENES:
${recent || 'The adventure has just begun.'}

Output ONLY JSON: {"suggestions": ["...", "...", "..."]}`;
}

async function requestStuckHints() {
    if (stuckHintState.loading || chatGenerationState.isGenerating) return;

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    const requestId = ++stuckHintState.requestId;
    stuckHintState.loading = true;
    const button = document.getElementById('hint-btn');
    if (button) button.disabled = true;
    renderStuckHints([], 'Thinking of options...');

    try {
        const schema = { type: 'object', properties: { suggestions: { type: 'array', items: { type: 'string' } } }, required: ['suggestions'], additionalProperties: false };
        const payloadOptions = getReasoningPayloadOptions(provider, 'helper');
        const maxTokens = getCompletionBudget(HELPER_MAX_TOKENS, provider, payloadOptions, MIN_HELPER_RESPONSE_TOKENS);
        const response = await fetch(getChatCompletionsUrl(provider, baseUrl), {
            method: 'POST',
            headers: buildAuthHeaders(apiKey, provider),
            body: buildFetchPayload(model, [{ role: 'user', content: buildStuckHintPrompt() }], 0.9, maxTokens, 1.0, 0, 0, provider,
                provider === 'lmstudio' || provider === 'openai' ? schema : null,
                payloadOptions)
        });
        if (!response.ok) throw new Error(`API returned status ${response.status}: ${await response.text()}`);

        const data = await response.json();
        const parsed = await parseStructuredModelOutput(getChoiceContentOrThrow(data, 'hint suggestions'), {
            requiredKeys: ['suggestions'],
            jsonExample: '{"suggestions":["I search the desk for letters.","I ask the guard about the curfew.","I head back to the docks."]}',
            label: 'hint suggestions'
        });
        if (requestId !== stuckHintState.requestId) return;

        const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3);
        if (!suggestions.length) throw new Error('The AI returned no suggestions.');
        renderStuckHints(suggestions);
    } catch (err) {
        if (requestId !== stuckHintState.requestId) return;
        console.error('Hint request failed:', err);
        renderStuckHints([], `Could not get suggestions: ${formatErrorForUser(err)}`);
    } finally {
        if (requestId === stuckHintState.requestId) {
            stuckHintState.loading = false;
            if (button) button.disabled = false;
        }
    }
}

// ============================================================
// AUTO NARRATION
// ============================================================

function isAutoNarrationEnabled() {
    return localStorage.getItem('jsonAdventure_ttsAutoPlay') === 'true'
        && (localStorage.getItem('jsonAdventure_ttsProvider') || 'none') !== 'none';
}

function maybeAutoNarrate(text, aiMsg) {
    if (!isAutoNarrationEnabled()) return;
    const button = aiMsg ? aiMsg.querySelector('[data-tts-button="true"]') : null;
    playTTS(text, button, { auto: true });
}

// ============================================================
// SPEND TRACKING (per save)
// ============================================================
// usage-tracker.js records every OpenRouter call; this adds each one to the open save's
// usage.json and keeps the sidebar totals current.

let saveUsageTotals = null;

function initSaveUsage(savedUsage) {
    if (!window.OdysseyUsage) return;
    saveUsageTotals = window.OdysseyUsage.addTotals(window.OdysseyUsage.emptyTotals(), savedUsage?.totals || {});
    updateUsageWidget();
}

// Spend from the new-game wizard happens before the save exists; it is added once it does.
async function attachSetupUsageToSave(gameId) {
    const scope = window.setupUsageScope;
    window.setupUsageScope = null;
    const totals = await endTurnUsage(scope);
    let saved = null;
    if (totals && gameId && window.tauriBridge?.addUsage) {
        saved = (await window.tauriBridge.addUsage(gameId, totals))?.usage || null;
    }
    initSaveUsage(saved || (totals ? { totals } : null));
}

function updateUsageWidget() {
    const widget = document.getElementById('usage-widget');
    const U = window.OdysseyUsage;
    if (!widget || !U) return;

    const session = U.getSession();
    const saveTotals = saveUsageTotals || U.emptyTotals();
    widget.hidden = !U.isVisible() || (saveTotals.calls === 0 && session.calls === 0);
    if (widget.hidden) return;

    [['usage-save', saveTotals, 'This save (all sessions, including Telegram/CLI turns)'], ['usage-session', session, 'Since Odyssey was opened']].forEach(([id, totals, label]) => {
        const value = document.getElementById(id);
        if (!value) return;
        value.textContent = `${U.formatCost(totals.cost)} · ${U.formatTokens(totals.promptTokens + totals.completionTokens)} tokens`;
        value.parentElement.title = `${label}\n${U.describeTotals(totals)}`;
    });
}

if (window.OdysseyUsage) {
    window.OdysseyUsage.onRecord((usage, meta) => {
        if (meta.scope?.kind === 'setup') return;
        const gameId = getActiveGameId();
        if (gameId && saveUsageTotals) {
            window.OdysseyUsage.addTotals(saveUsageTotals, usage);
            if (window.tauriBridge?.addUsage) window.tauriBridge.addUsage(gameId, usage);
        }
        updateUsageWidget();
    });
}


async function triggerImageGeneration() {
    if (localStorage.getItem('jsonAdventure_enableImage') !== 'true') return;

    const btn = document.getElementById('regenerate-image-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = window.OdysseyIcons.html('loader'); }

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
        if (gameId && window.tauriBridge) {
            try {
                const baseImgData = await window.tauriBridge.getBaseImage(gameId);
                if (baseImgData.dataUri) {
                    baseImageUrl = baseImgData.dataUri;
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

            if (gameId && window.tauriBridge) {
                await window.tauriBridge.updateImage(gameId, url);
            }
        }
    } catch (e) {
        console.error("Auto image gen error:", e);
    }

    if (btn) { btn.disabled = false; btn.innerHTML = window.OdysseyIcons.html('refresh'); }
}


// ============================================================
// SPEECH TO TEXT (STT) — OpenRouter hold-to-talk
// ============================================================

const sttRuntimeState = {
    isRecording: false,
    isTranscribing: false,
    isFinishing: false,
    mediaRecorder: null,
    mediaStream: null,
    chunks: [],
    pointerId: null,
    startedAt: 0,
    stopRequested: false
};

const STT_MIN_RECORD_MS = 250;

function getSttApiKey() {
    const openRouterKey = localStorage.getItem('jsonAdventure_apiKey_openrouter') || '';
    if (openRouterKey) return openRouterKey;

    const activeProvider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    return activeProvider === 'openrouter'
        ? (localStorage.getItem('jsonAdventure_openRouterApiKey') || '')
        : '';
}

function getSttModel() {
    const manual = (localStorage.getItem('jsonAdventure_sttManualModel') || '').trim();
    if (manual) return manual;
    return localStorage.getItem('jsonAdventure_sttModel') || 'openai/whisper-1';
}

function isSttEnabled() {
    return localStorage.getItem('jsonAdventure_sttEnabled') !== 'false';
}

function updateMicButtonState() {
    const micBtn = document.getElementById('mic-btn');
    if (!micBtn) return;

    const finishing = sttRuntimeState.isFinishing;
    const transcribing = sttRuntimeState.isTranscribing;
    const busy = finishing || transcribing;
    const recording = sttRuntimeState.isRecording;
    const generating = !!(typeof chatGenerationState !== 'undefined' && chatGenerationState.isGenerating);
    const hardDisabled = (busy || generating) && !recording;

    micBtn.classList.toggle('recording', recording);
    micBtn.classList.toggle('busy', busy);
    micBtn.classList.toggle('is-off', !isSttEnabled() && !recording && !busy);
    micBtn.disabled = hardDisabled;
    micBtn.setAttribute('aria-busy', busy || recording ? 'true' : 'false');

    if (transcribing) {
        micBtn.title = 'Transcribing...';
    } else if (finishing) {
        micBtn.title = 'Finishing recording...';
    } else if (recording) {
        micBtn.title = 'Release to finish';
    } else if (!isSttEnabled()) {
        micBtn.title = 'STT disabled — enable in Settings → Voice';
    } else if (generating) {
        micBtn.title = 'Wait for generation to finish';
    } else {
        micBtn.title = 'Hold to talk';
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read audio'));
        reader.readAsDataURL(blob);
    });
}

function mimeToAudioFormat(mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
    if (mime.includes('flac')) return 'flac';
    if (mime.includes('aac')) return 'aac';
    return 'webm';
}

function pickMediaRecorderMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ];
    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
}

async function getSttMediaStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone capture is not supported in this environment.');
    }
    const deviceId = (localStorage.getItem('jsonAdventure_sttMicDeviceId') || '').trim();
    if (deviceId) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } }
            });
        } catch (err) {
            const name = err && err.name;
            if (name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                localStorage.removeItem('jsonAdventure_sttMicDeviceId');
                return navigator.mediaDevices.getUserMedia({ audio: true });
            }
            throw err;
        }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
}

function stopSttMediaStream() {
    if (sttRuntimeState.mediaStream) {
        try {
            sttRuntimeState.mediaStream.getTracks().forEach(t => t.stop());
        } catch (e) { /* ignore */ }
    }
    sttRuntimeState.mediaStream = null;
}

async function transcribeAudioViaOpenRouter(audioBlob) {
    const apiKey = getSttApiKey();
    if (!apiKey) {
        throw new Error('No OpenRouter API key. Configure it in Settings → API Settings.');
    }
    const model = getSttModel();
    if (!model) {
        throw new Error('No STT model selected. Configure it in Settings → Voice.');
    }
    if (!audioBlob || !audioBlob.size) {
        throw new Error('Recording was empty. Hold the mic a bit longer and try again.');
    }

    const base64 = await blobToBase64(audioBlob);
    const format = mimeToAudioFormat(audioBlob.type);
    const language = (localStorage.getItem('jsonAdventure_sttLanguage') || '').trim();

    const body = {
        model,
        input_audio: {
            data: base64,
            format
        }
    };
    if (language) body.language = language;

    const headers = buildAuthHeaders(apiKey, 'openrouter');
    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`STT failed (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const text = (data && data.text != null) ? String(data.text).trim() : '';
    if (!text) {
        throw new Error('No speech detected. Try again closer to the microphone.');
    }
    return text;
}

function insertSttTranscript(text) {
    const chatInput = document.getElementById('chat-input');
    const existing = chatInput ? String(chatInput.value || '') : '';
    const transcript = String(text || '').trim();
    if (!transcript) return;
    if (existing.trim()) {
        const needsSpace = !/\s$/.test(existing);
        setChatInputText(existing + (needsSpace ? ' ' : '') + transcript, true);
    } else {
        setChatInputText(transcript, true);
    }
}

async function startSttRecording(micBtn, pointerId) {
    if (sttRuntimeState.isRecording || sttRuntimeState.isFinishing || sttRuntimeState.isTranscribing) return;
    if (typeof chatGenerationState !== 'undefined' && chatGenerationState.isGenerating) return;
    if (!isSttEnabled()) {
        alert('Speech-to-text is disabled. Enable it in Settings → Voice.');
        return;
    }
    if (!getSttApiKey()) {
        alert('No OpenRouter API key. Configure it in Settings → API Settings.');
        return;
    }
    if (typeof MediaRecorder === 'undefined') {
        alert('MediaRecorder is not available in this browser/WebView.');
        return;
    }

    sttRuntimeState.stopRequested = false;
    sttRuntimeState.chunks = [];
    sttRuntimeState.pointerId = pointerId;

    try {
        const stream = await getSttMediaStream();
        if (sttRuntimeState.stopRequested) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        sttRuntimeState.mediaStream = stream;
        const mimeType = pickMediaRecorderMimeType();
        const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        sttRuntimeState.mediaRecorder = recorder;
        sttRuntimeState.chunks = [];

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                sttRuntimeState.chunks.push(event.data);
            }
        };

        recorder.start(100);
        sttRuntimeState.isRecording = true;
        sttRuntimeState.startedAt = Date.now();
        if (micBtn && pointerId != null && micBtn.setPointerCapture) {
            try { micBtn.setPointerCapture(pointerId); } catch (e) { /* ignore */ }
        }
        updateMicButtonState();
    } catch (err) {
        console.error('STT start failed:', err);
        stopSttMediaStream();
        sttRuntimeState.mediaRecorder = null;
        sttRuntimeState.isRecording = false;
        sttRuntimeState.pointerId = null;
        updateMicButtonState();
        const msg = (err && err.name === 'NotAllowedError')
            ? 'Microphone permission denied. Allow mic access and try again.'
            : ('Could not start recording: ' + (err.message || err));
        alert(msg);
    }
}

async function finishSttRecording() {
    if (sttRuntimeState.isFinishing || sttRuntimeState.isTranscribing) {
        sttRuntimeState.stopRequested = true;
        return;
    }
    if (!sttRuntimeState.isRecording && !sttRuntimeState.mediaRecorder) {
        sttRuntimeState.stopRequested = true;
        return;
    }

    sttRuntimeState.isFinishing = true;
    const recorder = sttRuntimeState.mediaRecorder;
    const duration = Date.now() - (sttRuntimeState.startedAt || 0);
    sttRuntimeState.isRecording = false;
    sttRuntimeState.pointerId = null;
    updateMicButtonState();

    try {
        const blob = await new Promise((resolve) => {
            if (!recorder || recorder.state === 'inactive') {
                resolve(new Blob(sttRuntimeState.chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' }));
                return;
            }
            recorder.onstop = () => {
                resolve(new Blob(sttRuntimeState.chunks, { type: recorder.mimeType || 'audio/webm' }));
            };
            try {
                recorder.stop();
            } catch (e) {
                resolve(new Blob(sttRuntimeState.chunks, { type: recorder.mimeType || 'audio/webm' }));
            }
        });

        stopSttMediaStream();
        sttRuntimeState.mediaRecorder = null;
        sttRuntimeState.chunks = [];

        if (duration < STT_MIN_RECORD_MS || !blob.size) {
            return;
        }

        sttRuntimeState.isTranscribing = true;
        updateMicButtonState();
        try {
            const text = await transcribeAudioViaOpenRouter(blob);
            insertSttTranscript(text);
        } catch (err) {
            console.error('STT transcription failed:', err);
            alert(err.message || String(err));
        } finally {
            sttRuntimeState.isTranscribing = false;
        }
    } finally {
        sttRuntimeState.isFinishing = false;
        updateMicButtonState();
    }
}

function wireMicHoldToTalk(micBtn) {
    if (!micBtn) return;
    let keyboardHoldActive = false;

    const onPointerDown = (e) => {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        startSttRecording(micBtn, e.pointerId);
    };

    const onPointerEnd = (e) => {
        if (sttRuntimeState.pointerId != null && e.pointerId !== sttRuntimeState.pointerId) return;
        if (!sttRuntimeState.isRecording && !sttRuntimeState.mediaRecorder) {
            sttRuntimeState.stopRequested = true;
            return;
        }
        e.preventDefault();
        finishSttRecording();
    };

    const isHoldKey = (e) => e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter';

    const onKeyDown = (e) => {
        if (!isHoldKey(e)) return;
        e.preventDefault();
        if (e.repeat || keyboardHoldActive) return;
        keyboardHoldActive = true;
        startSttRecording(micBtn, null);
    };

    const onKeyUp = (e) => {
        if (!isHoldKey(e) || !keyboardHoldActive) return;
        e.preventDefault();
        keyboardHoldActive = false;
        finishSttRecording();
    };

    micBtn.addEventListener('pointerdown', onPointerDown);
    micBtn.addEventListener('pointerup', onPointerEnd);
    micBtn.addEventListener('pointercancel', onPointerEnd);
    micBtn.addEventListener('lostpointercapture', onPointerEnd);
    micBtn.addEventListener('keydown', onKeyDown);
    micBtn.addEventListener('keyup', onKeyUp);
    micBtn.addEventListener('blur', () => {
        if (!keyboardHoldActive) return;
        keyboardHoldActive = false;
        finishSttRecording();
    });
    micBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    updateMicButtonState();
}

// ============================================================
// TEXT TO SPEECH (TTS)
// ============================================================

const ttsRuntimeState = {
    isGenerating: false,
    activeAudio: null,
    activeObjectUrl: null
};

function _getTtsButtons() {
    return Array.from(document.querySelectorAll('[data-tts-button="true"]'));
}

function _setTtsGenerating(isGenerating, activeButton = null) {
    ttsRuntimeState.isGenerating = isGenerating;
    _getTtsButtons().forEach(button => {
        const isActive = button === activeButton;
        button.disabled = isGenerating;
        button.classList.toggle('is-loading', isGenerating && isActive);
        button.setAttribute('aria-busy', isGenerating && isActive ? 'true' : 'false');
        button.title = isGenerating
            ? (isActive ? 'Generating audio...' : 'TTS is already generating')
            : 'Play Audio';
    });
}

function _stopActiveTtsAudio() {
    if (ttsRuntimeState.activeAudio) {
        try {
            ttsRuntimeState.activeAudio.pause();
            ttsRuntimeState.activeAudio.removeAttribute('src');
            ttsRuntimeState.activeAudio.load();
        } catch (err) {
            console.warn('Unable to stop active TTS audio:', err);
        }
    }

    if (ttsRuntimeState.activeObjectUrl) {
        URL.revokeObjectURL(ttsRuntimeState.activeObjectUrl);
    }

    ttsRuntimeState.activeAudio = null;
    ttsRuntimeState.activeObjectUrl = null;
}

// Plays audio from a URL or data-URI, returns a Promise so callers can catch play() errors
async function _playAudioUrl(url, options = {}) {
    _stopActiveTtsAudio();

    const audio = new Audio(url);
    const objectUrl = options.revokeObjectUrl ? url : null;

    ttsRuntimeState.activeAudio = audio;
    ttsRuntimeState.activeObjectUrl = objectUrl;

    const clearIfCurrent = () => {
        if (ttsRuntimeState.activeAudio !== audio) return;
        if (ttsRuntimeState.activeObjectUrl) URL.revokeObjectURL(ttsRuntimeState.activeObjectUrl);
        ttsRuntimeState.activeAudio = null;
        ttsRuntimeState.activeObjectUrl = null;
    };

    audio.addEventListener('ended', clearIfCurrent, { once: true });
    audio.addEventListener('error', clearIfCurrent, { once: true });

    // Warm up AudioContext with a silent buffer to keep the user-gesture token alive
    // across async fetch calls (prevents autoplay-policy silent failures)
    try {
        await audio.play();
    } catch (e) {
        clearIfCurrent();
        throw new Error('Audio playback blocked: ' + e.message + '. Try clicking the button again.');
    }
}

function _buildKokoroVoiceString(voiceMix) {
    if (!voiceMix || voiceMix.length === 0) return 'af_bella';
    if (voiceMix.length === 1) return voiceMix[0].voice;
    // Kokoro-FastAPI blend format: "voice1(weight1)+voice2(weight2)"
    // Weights are relative integers — Kokoro normalizes them automatically
    return voiceMix
        .filter(v => v.voice && (parseFloat(v.weight) || 0) > 0)
        .map(v => `${v.voice}(${Math.round(parseFloat(v.weight) || 1)})`)
        .join('+');
}

// options.auto marks automatic narration of a new turn: problems are logged instead of shown
// as popups, since the player did not click anything.
async function playTTS(text, sourceButton = null, options = {}) {
    if (ttsRuntimeState.isGenerating) return;
    const notice = (message) => {
        if (options.auto) console.warn('Auto narration skipped:', message);
        else alert(message);
    };

    const provider = localStorage.getItem('jsonAdventure_ttsProvider') || 'none';
    if (provider === 'none') {
        notice("TTS is disabled. Enable it in Settings → Voice / TTS.");
        return;
    }

    // Strip markdown symbols that TTS might pronounce literally
    const pureText = text.replace(/[*_#`~>]/g, '').trim();
    if (!pureText) return;

    _setTtsGenerating(true, sourceButton);

    try {
        if (provider === 'xai') {
            const apiKey  = localStorage.getItem('jsonAdventure_ttsXaiKey') || '';
            if (!apiKey) { notice("No xAI API key. Configure it in Settings → Voice / TTS."); return; }
            const voiceId = localStorage.getItem('jsonAdventure_ttsXaiVoice') || 'eve';
            const lang    = localStorage.getItem('jsonAdventure_ttsXaiLang')  || 'auto';

            const res = await fetch('https://api.x.ai/v1/tts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: pureText,
                    voice_id: voiceId,
                    language: lang,
                    output_format: {codec: 'mp3', sample_rate: 24000, bit_rate: 128000}
                })
            });
            if (!res.ok) throw new Error(`xAI TTS ${res.status}: ${await res.text()}`);
            const blob = await res.blob();
            await _playAudioUrl(URL.createObjectURL(blob), { revokeObjectUrl: true });
            return;
        }

        if (provider === 'google') {
            const apiKey = localStorage.getItem('jsonAdventure_ttsGoogleKey') || '';
            if (!apiKey) { notice("No Google API key. Configure it in Settings → Voice / TTS."); return; }
            const voiceName = localStorage.getItem('jsonAdventure_ttsGoogleVoice') || 'en-US-Neural2-F';
            const rate      = parseFloat(localStorage.getItem('jsonAdventure_ttsSpeed')) || 1.0;

            const res = await fetch(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        input: {text: pureText},
                        voice: {languageCode: voiceName.slice(0, 5), name: voiceName},
                        audioConfig: {audioEncoding: 'MP3', speakingRate: rate}
                    })
                }
            );
            if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
            const data = await res.json();
            await _playAudioUrl('data:audio/mp3;base64,' + data.audioContent);
            return;
        }

        // OpenAI-compatible path (covers 'openai' and 'kokoro')
        let baseUrl, apiKey, model, voice;
        const speed = parseFloat(localStorage.getItem('jsonAdventure_ttsSpeed')) || 1.0;

        if (provider === 'kokoro') {
            baseUrl = (localStorage.getItem('jsonAdventure_ttsBaseUrl') || 'http://127.0.0.1:8880').replace(/\/+$/, '') + '/v1/audio/speech';
            apiKey  = 'dummy';
            model   = 'kokoro';
            const mix = (() => {
                try { return JSON.parse(localStorage.getItem('jsonAdventure_ttsVoiceMix') || '[]'); } catch(e) { return []; }
            })();
            voice = _buildKokoroVoiceString(mix.length > 0 ? mix : [{voice: 'af_bella', weight: 100}]);
        } else {
            // openai / lmstudio-compatible
            baseUrl = (localStorage.getItem('jsonAdventure_ttsOpenAiUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/audio/speech';
            apiKey  = localStorage.getItem('jsonAdventure_ttsApiKey')  || '';
            model   = localStorage.getItem('jsonAdventure_ttsModel')   || 'tts-1';
            voice   = localStorage.getItem('jsonAdventure_ttsVoice')   || 'alloy';
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({model, input: pureText, voice, speed, response_format: 'mp3'})
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const blob = await response.blob();
        await _playAudioUrl(URL.createObjectURL(blob), { revokeObjectUrl: true });

    } catch (err) {
        console.error("TTS Error:", err);
        notice("TTS failed: " + err.message);
    } finally {
        _setTtsGenerating(false, sourceButton);
    }
}
