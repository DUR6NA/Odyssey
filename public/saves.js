// ============================================================
// SAVES.JS - Game saves and chat history persistence
// ============================================================


async function saveCurrentGame() {
    const id = typeof currentGameFolder !== 'undefined' && currentGameFolder ? currentGameFolder : window.currentGameFolder;
    if (!id) return;
    try {
        if (window.tauriBridge) {
            await window.tauriBridge.updateGame({
                id: id,
                gameState: window.gamestate || {},
                chatHistory: window.chatHistory || [],
                summary: window.gameSummaryText || '',
                npcLedger: { npcs: window.gamestate?.npcs || [] },
                locationsLedger: { locations: window.gamestate?.locations || [] }
            });
        }
    } catch (e) { console.error("Auto-save failed:", e); }
}

async function summarizeOldMessages() {
    // We expect the system prompt at index 0 and then pairs of user/assistant messages.
    // Let's summarize when history exceeds 15 messages (1 system + 14 conversation messages).
    // We will extract the oldest 6 conversation messages (index 1 to 6) to summarize.
    const threshold = 15;
    const numToSummarize = 6;

    if (!window.chatHistory || window.chatHistory.length <= threshold) return;

    // Extract the messages to summarize (indices 1 to numToSummarize)
    const messagesToSummarize = window.chatHistory.slice(1, numToSummarize + 1);

    // Format them for the AI
    const historyText = messagesToSummarize.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const summarizePrompt = `You are a chronicler. Summarize the following recent events and merge them with the existing story summary. Keep crucial names, items, and state changes. Be concise.

EXISTING SUMMARY:
${window.gameSummaryText || "None"}

RECENT EVENTS TO SUMMARIZE AND MERGE:
${historyText}

Output ONLY the new merged narrative summary. Do not include introductory text like "Here is the summary."`;

    const provider = localStorage.getItem('jsonAdventure_apiProvider') || 'openrouter';
    const baseUrl = localStorage.getItem('jsonAdventure_apiBaseUrl') || '';
    const apiKey = localStorage.getItem('jsonAdventure_openRouterApiKey');
    const model = localStorage.getItem('jsonAdventure_openRouterModel') || 'openai/gpt-3.5-turbo';

    try {
        let fetchUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (provider === 'xai') {
            fetchUrl = "https://api.x.ai/v1/chat/completions";
        } else if (provider === 'googleai') {
            fetchUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        } else if (provider === 'lmstudio' || provider === 'openai') {
            fetchUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: buildAuthHeaders(apiKey),
            body: buildFetchPayload(model, [
                { role: 'user', content: summarizePrompt }
            ], 0.3, 1000, 1.0, 0, 0, provider, null)
        });

        if (response.ok) {
            const data = await response.json();
            const newSummary = data.choices[0].message.content.trim();

            // Update the running game summary
            window.gameSummaryText = newSummary;

            // Splice those oldest messages out of the active sliding window buffer
            window.chatHistory.splice(1, numToSummarize);

            // Persist the changes
            saveCurrentGame();
            console.log("Chat history summarized and sliding window updated.");
        }
    } catch (err) {
        console.error("Background summarization error:", err);
    }
}
