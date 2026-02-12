import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { analyzeBusinessCard, generateEmbedding, generateSearchContext } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../services/storageService';
import { checkActionLimit } from '../services/usageService';
import { processImage } from '../services/imageProcessingService';
import { BusinessCard } from '../types';

type RootStackParamList = {
    Home: undefined;
    Camera: undefined;
    Details: { card_id: string };
};

type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {
    const navigation = useNavigation<CameraScreenNavigationProp>();
    const [processing, setProcessing] = useState(false);

    // State for captured photos
    const [frontPhoto, setFrontPhoto] = useState<{ uri: string, base64: string } | null>(null);
    const [backPhoto, setBackPhoto] = useState<{ uri: string, base64: string } | null>(null);
    const [step, setStep] = useState<'front' | 'back' | 'review'>('front');

    const handleCamera = async (isFront: boolean) => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission to access camera is required!");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 2],
                quality: 0.8,
                base64: true,
            });

            await handleImageSelection(result, isFront);
        } catch (error) {
            console.error("Camera Error:", error);
            Alert.alert("Error", "Failed to open camera");
        }
    };

    const handleGallery = async (isFront: boolean) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 2],
                quality: 0.8,
                base64: true,
            });

            await handleImageSelection(result, isFront);
        } catch (error) {
            console.error("Gallery Error:", error);
            Alert.alert("Error", "Failed to pick image");
        }
    };

    const handleImageSelection = async (result: ImagePicker.ImagePickerResult, isFront: boolean) => {
        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const asset = result.assets[0];
        const uri = asset.uri;

        try {
            const processed = await processImage(uri);
            const photoData = {
                uri: processed.uri,
                base64: processed.base64 || asset.base64 || "", // Use processed base64 or fallback to picker's
            };

            if (isFront) {
                setFrontPhoto(photoData);
                setStep('back');
            } else {
                setBackPhoto(photoData);
                setStep('review');
            }
        } catch (e) {
            console.error("Processing failed", e);
            Alert.alert("Error", "Failed to process image");
        }
    };


    const processCard = async () => {
        if (!frontPhoto) return;

        try {
            // Check usage limit first
            try {
                const limitCheck = await checkActionLimit();
                if (!limitCheck.allowed) {
                    Alert.alert("Limit Reached", limitCheck.message || "Daily limit reached.");
                    return;
                }
            } catch (limitError) {
                console.error("Limit check failed, proceeding anyway:", limitError);
            }

            setProcessing(true);

            // 1. Analyze with AI
            const analysis = await analyzeBusinessCard(frontPhoto.base64, backPhoto?.base64);
            console.log("AI Analysis:", analysis);

            // 2. Upload Images
            // 2. Upload Images
            const frontUrl = await uploadImage(frontPhoto.uri);
            let backUrl = undefined;
            if (backPhoto) {
                backUrl = await uploadImage(backPhoto.uri);
            }

            // 3. Generate Search Context & Embedding
            const cardData: Partial<BusinessCard> = {
                first_name: analysis.first_name || '',
                last_name: analysis.last_name || '',
                company: analysis.company || '',
                email: analysis.email || '',
                phone: analysis.phone || '',
                job_title: analysis.job_title || '',
                address: analysis.address || '',
                scope_of_work: analysis.scope_of_work || '',
                event_note: analysis.event_note || '',
                industry: analysis.industry || '',
                ice_breakers: analysis.ice_breakers || null,
                social_links: analysis.social_links || null,
                follow_up_needed: analysis.follow_up_needed || false,
                follow_up_suggestion: analysis.follow_up_suggestion || null,
                image_url: frontUrl || '',
                back_image_url: backUrl || undefined,
            };

            const searchContext = generateSearchContext(cardData);
            let embedding: number[] | undefined = undefined;
            try {
                if (searchContext) {
                    embedding = await generateEmbedding(searchContext);
                }
            } catch (e) {
                console.error("Embedding generation failed, skipping:", e);
            }

            // 4. Save to Database
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const { data, error } = await supabase.from('business_cards').insert([
                {
                    ...cardData,
                    user_id: user.id,
                    search_context: searchContext,
                    embedding: embedding,
                }
            ]).select();

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            if (data && data.length > 0) {
                Alert.alert("Success", "Business card saved!");
                navigation.replace('Details', { card_id: data[0].id });
            }

        } catch (error) {
            console.error("Processing Error:", error);
            Alert.alert("Error", "Failed to process card. Please try again.");
        } finally {
            setProcessing(false);
        }
    }

    const reset = () => {
        setFrontPhoto(null);
        setBackPhoto(null);
        setStep('front');
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>
                    {step === 'front' ? 'Scan Front of Card' :
                        step === 'back' ? 'Scan Back of Card (Optional)' : 'Review'}
                </Text>

                <View style={styles.previewSection}>
                    {frontPhoto ? (
                        <View style={styles.cardPreview}>
                            <Text style={styles.label}>Front Side</Text>
                            <Image source={{ uri: frontPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
                        </View>
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderText}>No Front Image</Text>
                        </View>
                    )}

                    {backPhoto && (
                        <View style={styles.cardPreview}>
                            <Text style={styles.label}>Back Side</Text>
                            <Image source={{ uri: backPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
                        </View>
                    )}
                </View>

                <View style={styles.controls}>
                    {step === 'front' && (
                        <>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => handleCamera(true)}>
                                <Text style={styles.primaryButtonText}>Capture Front</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => handleGallery(true)}>
                                <Text style={styles.secondaryButtonText}>Select from Gallery</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'back' && (
                        <>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => handleCamera(false)}>
                                <Text style={styles.primaryButtonText}>Capture Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => handleGallery(false)}>
                                <Text style={styles.secondaryButtonText}>Select from Gallery</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.secondaryButton, { marginTop: 20 }]} onPress={() => processCard()}>
                                <Text style={styles.secondaryButtonText}>Skip Back & Analyze</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'review' && (
                        <>
                            <TouchableOpacity style={styles.primaryButton} onPress={processCard} disabled={processing}>
                                <Text style={styles.primaryButtonText}>Analyze Card</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={reset} disabled={processing}>
                                <Text style={styles.secondaryButtonText}>Start Over</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {processing && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <Text style={styles.loadingText}>Analyzing...</Text>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#333',
        textAlign: 'center',
    },
    previewSection: {
        width: '100%',
        marginBottom: 30,
        alignItems: 'center',
    },
    cardPreview: {
        width: '100%',
        marginBottom: 20,
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#666',
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: 'white',
    },
    placeholder: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#999',
    },
    controls: {
        width: '100%',
        alignItems: 'center',
        gap: 15,
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    secondaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007AFF',
        backgroundColor: 'transparent',
    },
    secondaryButtonText: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingBox: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    permissionContainer: { // Legacy style, keeping just in case or removing if unused
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        textAlign: 'center',
        marginBottom: 20,
    }
});
