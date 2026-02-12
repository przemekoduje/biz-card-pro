export interface BusinessCard {
    id: string;
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone?: string;
    job_title?: string;
    address?: string;
    scope_of_work?: string;
    event_note: string;
    image_url: string;
    back_image_url?: string;
    industry?: string;
    user_id?: string;
    created_at?: string;
    search_context?: string; // Hybrid content column
    embedding?: number[]; // Vector embedding
    ice_breakers?: {
        email: string;
        linkedin: string;
        sms: string;
    };
    social_links?: {
        linkedin?: string;
        linkedin_company?: string;
        instagram?: string;
        facebook?: string;
        youtube?: string;
    };
    last_contact_date?: string;
    follow_up_needed?: boolean;
    follow_up_suggestion?: string;
}

export interface ContactInfo {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone?: string;
    job_title?: string;
    address?: string;
    scope_of_work?: string;
    event_note?: string;
    industry?: string;
}
