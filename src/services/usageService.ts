import { supabase } from '../lib/supabase';

const DAILY_LIMIT = 10;

export type ActionType = 'scan' | 'email' | 'image';

const getLocalYYYYMMDD = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const checkAndIncrementAction = async (actionType: ActionType): Promise<{ allowed: boolean; message?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        console.log("checkAndIncrementAction: Session User:", user?.id);

        if (!user) {
            console.error("checkAndIncrementAction: User is null despite App thinking logged in.");
            return { allowed: false, message: "User not logged in." };
        }

        // Fetch usage tracking
        let { data, error } = await supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Row might not exist if trigger failed or pre-existing user
            // Try to insert
            const { data: newData, error: insertError } = await supabase
                .from('usage_tracking')
                .insert([{ user_id: user.id }])
                .select()
                .single();

            if (insertError) {
                console.error("Error creating usage tracking:", insertError);
                return { allowed: false, message: "System error: could not create tracking." };
            }
            data = newData;
        } else if (error) {
            console.error("Error fetching usage:", error);
            return { allowed: true };
        }

        const today = getLocalYYYYMMDD();
        const lastActionDate = data.last_action_date;

        let newDailyCount = data.daily_actions_count;

        if (lastActionDate !== today) {
            newDailyCount = 0;
        }

        if (newDailyCount >= DAILY_LIMIT) {
            return {
                allowed: false,
                message: `Osiągnąłeś dzienny limit ${DAILY_LIMIT} akcji. Zapraszamy jutro!`
            };
        }

        // Increment counts
        const updates: any = {
            daily_actions_count: newDailyCount + 1,
            last_action_date: today,
        };

        if (actionType === 'scan') updates.total_scans = (data.total_scans || 0) + 1;
        if (actionType === 'email') updates.total_emails = (data.total_emails || 0) + 1;
        if (actionType === 'image') updates.total_images = (data.total_images || 0) + 1;

        const { error: updateError } = await supabase
            .from('usage_tracking')
            .update(updates)
            .eq('user_id', user.id);

        if (updateError) {
            console.error("Error updating usage:", updateError);
        }

        return { allowed: true };

    } catch (error) {
        console.error("Error in checkAndIncrementAction:", error);
        return { allowed: true };
    }
};

export const checkActionLimit = async (): Promise<{ allowed: boolean; message?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        console.log("checkActionLimit: Session User:", user?.id);

        if (!user) return { allowed: false, message: "User not logged in" };

        const { data, error } = await supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error || !data) return { allowed: true };

        const today = getLocalYYYYMMDD();

        if (data.last_action_date !== today) return { allowed: true };

        if (data.daily_actions_count >= DAILY_LIMIT) {
            return {
                allowed: false,
                message: `Osiągnąłeś dzienny limit ${DAILY_LIMIT} akcji. Zapraszamy jutro!`
            };
        }
        return { allowed: true };
    } catch (e) {
        return { allowed: true };
    }
}

export const incrementActionCount = async (actionType: ActionType): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) return;

        let { data } = await supabase.from('usage_tracking').select('*').eq('user_id', user.id).single();
        if (!data) {
            const { data: newData } = await supabase.from('usage_tracking').insert([{ user_id: user.id }]).select().single();
            data = newData;
        }
        if (!data) return;

        const today = getLocalYYYYMMDD();

        let newDailyCount = data.daily_actions_count;
        if (data.last_action_date !== today) {
            newDailyCount = 0;
        }

        const updates: any = {
            daily_actions_count: newDailyCount + 1,
            last_action_date: today,
        };

        if (actionType === 'scan') updates.total_scans = (data.total_scans || 0) + 1;
        if (actionType === 'email') updates.total_emails = (data.total_emails || 0) + 1;
        if (actionType === 'image') updates.total_images = (data.total_images || 0) + 1;

        await supabase.from('usage_tracking').update(updates).eq('user_id', user.id);

    } catch (e) {
        console.error(e);
    }
}
