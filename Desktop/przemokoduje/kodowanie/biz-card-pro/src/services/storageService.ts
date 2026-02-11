import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

export const uploadImage = async (uri: string): Promise<string | null> => {
    try {
        const fileName = `${Date.now()}.jpg`;
        const filePath = `${fileName}`;

        const formData = new FormData();
        formData.append('file', {
            uri: uri,
            name: fileName,
            type: 'image/jpeg',
        } as any);

        const { data, error } = await supabase.storage
            .from('business-cards')
            .upload(filePath, formData);

        if (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Upload Error', error.message);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from('business-cards')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Error in uploadImage:', error);
        Alert.alert('Upload Error', (error as any).message || 'Unknown error');
        return null;
    }
};
