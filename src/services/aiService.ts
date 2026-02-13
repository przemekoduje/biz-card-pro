import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

import { incrementActionCount } from './usageService';
import { BusinessCard } from '../types';

export const analyzeBusinessCard = async (frontBase64: string, backBase64?: string): Promise<any> => {
    try {
        const content: any[] = [
            { type: "text", text: "Analyze this business card image. Extract details in PURE JSON format (no markdown, no backticks).\n\nMANDATORY: You must generate a list of 3-5 relevant 'industry' tags based on the card's context in POLISH (e.g., if it says 'Plumbing', add ['Hydraulika', 'Budownictwo', 'Konserwacja']).\n\nALSO MANDATORY: Generate 'ice_breakers' object with 3 fields: 'email', 'linkedin', 'sms'.\n- 'email': Professional follow-up email in Polish.\n- 'linkedin': Professional connection request in Polish.\n- 'sms': MUST be exactly this format: 'Hej tu [Twoje Imię]. Dziękuję za spotkanie i miłą rozmowę. Pozostanę w kontakcie.' (Do NOT use the name from the card as the sender).\n\nSOCIAL LINKS: Start searching for or inferring likely social media links based on the company name, person's name, or handles visible on the card. Return a 'social_links' object with fields: 'linkedin' (personal profile), 'linkedin_company' (company page), 'instagram', 'facebook', 'youtube'. Only include a link if you are highly confident it exists or if it is explicitly on the card. If not found/unsure, omit the field.\n\nFOLLOW UP: Analyze the text to identify if a follow-up is relevant (e.g., specific date mentioned, or general business context). If relevant, set 'follow_up_needed' to true. Also generate a 'follow_up_suggestion' string (e.g., '2 days', '1 week', 'Next Monday') based on urgency or standard business ettiquette. If no specific context, suggest '3 days'.\n\nFields: first_name, last_name, company, email, phone, job_title, address, scope_of_work (Describe in POLISH), industry (comma-separated string of tags in POLISH), ice_breakers (object), social_links (object), follow_up_needed (boolean), follow_up_suggestion (string), event_note. Return ONLY the JSON object." },
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
            content.push({ type: "text", text: "The second image is the back of the card. Use it to extract scope_of_work or additional details. Refine the industry tags based on this side too." });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
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

        let parsedData;
        try {
            parsedData = JSON.parse(responseContent);
        } catch (parseError) {
            console.error("Failed to parse OpenAI response:", responseContent);
            throw new Error("Failed to process business card data (Invalid JSON).");
        }

        // Increment scan count after successful analysis
        await incrementActionCount('scan');

        return parsedData;

    } catch (error) {
        console.error("Error analyzing card:", error);
        throw error;
    }
};

export const expandSearchQuery = async (query: string): Promise<string[]> => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: `Generate a list of 5-10 related keywords, synonyms, and industry terms for the search query: "${query}" in POLISH. 
                    For example, if query is "Okna", return ["Okna", "Drzwi", "Szklenie", "Stolarka", "PCV", "Szyby", "Montaż"].
                    Return ONLY a JSON array of strings.`
                }
            ],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) return [query];

        const parsed = JSON.parse(content);
        return parsed.keywords || [query];
    } catch (error) {
        console.error("Error expanding query:", error);
        return [query];
    }
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
};

export const generateSearchContext = (card: Partial<BusinessCard>): string => {
    const parts = [
        card.first_name,
        card.last_name,
        card.company,
        card.job_title,
        card.address,
        card.scope_of_work,
        card.event_note,
        card.industry // AI generated and User tags combined here
    ];
    return parts.filter(Boolean).join(' ');
};
