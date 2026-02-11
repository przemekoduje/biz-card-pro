import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

export const analyzeBusinessCard = async (frontBase64: string, backBase64?: string): Promise<any> => {
    try {
        const content: any[] = [
            { type: "text", text: "Analyze this business card image (it might be front, back, or both combined) and extract the following information in JSON format:\n    - first_name\n    - last_name\n    - company\n    - email\n    - phone\n    - job_title\n    - address\n    - scope_of_work (offer details, services list)\n    - industry (Generate a COMMA-SEPARATED list of relevant industry keywords, synonyms, and related products/services based on the company name and content. Example: 'Joinery, Windows, Doors, PVC, Montage'. Use your knowledge about the company if recognized.)\n    - event_note (if any handwritten note or context is visible)\n    \n    Return ONLY valid JSON." },
            {
                type: "image_url",
                image_url: {
                    "url": `data:image/jpeg;base64,${frontBase64}`,
                },
            },
        ];

        if (backBase64) {
            content.push({
                type: "image_url",
                image_url: {
                    "url": `data:image/jpeg;base64,${backBase64}`,
                },
            });
            content.push({ type: "text", text: "The second image is the back of the card. Use it to extract scope_of_work or additional details." });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: content,
                },
            ],
            response_format: { type: "json_object" },
        });

        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
            throw new Error("No content returned from OpenAI");
        }

        return JSON.parse(responseContent);
    } catch (error) {
        console.error("Error analyzing card:", error);
        throw error;
    }
};

export const expandSearchQuery = async (query: string): Promise<string[]> => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: `Generate a list of 5-10 related keywords, synonyms, and industry terms for the search query: "${query}". 
                    For example, if query is "Windows", return ["Windows", "Doors", "Glazing", "Joinery", "PVC", "Glass", "Installation"].
                    Return ONLY a JSON array of strings.`
                }
            ],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) return [query];

        const parsed = JSON.parse(content);
        // Handle different possible JSON structures that GPT might return, though we asked for array
        // Ideally it returns { "keywords": [...] } or just the array if valid JSON
        // Since we enforced json_object, it likely returns an object. Let's adjust prompt or parsing.

        // Let's assume it returns { "keywords": [...] } based on common behavior with json_object
        // But safer to ask for specific key.
        return parsed.keywords || [query];
    } catch (error) {
        console.error("Error expanding query:", error);
        return [query]; // Fallback to original query
    }
};
