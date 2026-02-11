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
