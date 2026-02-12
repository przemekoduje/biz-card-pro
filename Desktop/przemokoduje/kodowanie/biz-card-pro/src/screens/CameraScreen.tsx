import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { analyzeBusinessCard } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../services/storageService';
import { checkActionLimit } from '../services/usageService';

type RootStackParamList = {
    Home: undefined;
    Camera: undefined;
    Details: { card_id: string };
};

type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {
    const navigation = useNavigation<CameraScreenNavigationProp>();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [processing, setProcessing] = useState(false);

    // State for captured photos
    const [frontPhoto, setFrontPhoto] = useState<{ uri: string, base64: string } | null>(null);
    const [backPhoto, setBackPhoto] = useState<{ uri: string, base64: string } | null>(null);
    const [step, setStep] = useState<'front' | 'back' | 'review'>('front');

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>We need your permission to show the camera</Text>
                    <TouchableOpacity onPress={requestPermission} style={styles.button}>
                        <Text style={styles.text}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const handlePicture = async () => {
        if (cameraRef.current && !processing) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.5,
                });

                if (photo && photo.base64) {
                    if (step === 'front') {
                        setFrontPhoto({ uri: photo.uri, base64: photo.base64 });
                        setStep('back'); // Move to next step primarily, user can skip
                    } else if (step === 'back') {
                        setBackPhoto({ uri: photo.uri, base64: photo.base64 });
                        setStep('review');
                    }
                }
            } catch (error) {
                console.error(error);
                Alert.alert("Error", "Failed to take picture");
            }
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            if (asset.base64) {
                if (step === 'front') {
                    setFrontPhoto({ uri: asset.uri, base64: asset.base64 });
                    setStep('back');
                } else if (step === 'back') {
                    setBackPhoto({ uri: asset.uri, base64: asset.base64 });
                    setStep('review');
                }
            }
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
            // Ensure analyzeBusinessCard is updated to accept optional second argument
            const analysis = await analyzeBusinessCard(frontPhoto.base64, backPhoto?.base64);
            console.log("AI Analysis:", analysis);

            // 2. Upload Images
            const frontUrl = await uploadImage(frontPhoto.uri);
            let backUrl = null;
            if (backPhoto) {
                backUrl = await uploadImage(backPhoto.uri);
            }

            // 3. Save to Database
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const { data, error } = await supabase.from('business_cards').insert([
                {
                    user_id: user.id,
                    first_name: analysis.first_name || '',
                    last_name: analysis.last_name || '',
                    company: analysis.company || '',
                    email: analysis.email || '',
                    phone: analysis.phone || '',
                    job_title: analysis.job_title || '',
                    address: analysis.address || '',
                    scope_of_work: analysis.scope_of_work || '',
                    event_note: analysis.event_note || '',
                    image_url: frontUrl,
                    back_image_url: backUrl,
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

    // Render Preview
    if (step === 'review' || (step === 'back' && frontPhoto)) {
        return (
            <View style={styles.container}>
                <View style={styles.previewContainer}>
                    <Text style={styles.label}>Front Side:</Text>
                    {frontPhoto && <Image source={{ uri: frontPhoto.uri }} style={styles.previewImage} resizeMode="contain" />}

                    {backPhoto ? (
                        <>
                            <Text style={styles.label}>Back Side:</Text>
                            <Image source={{ uri: backPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
                        </>
                    ) : (
                        <Text style={styles.label}>Back Side: {step === 'review' ? 'None' : 'Optional'}</Text>
                    )}
                </View>

                <View style={styles.actionContainer}>
                    {step === 'back' && (
                        <>
                            <Text style={styles.instruction}>Scan Back Side (Optional)</Text>
                            <CameraView style={styles.miniCamera} ref={cameraRef} facing="back" />
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.secondaryButton} onPress={() => processCard()}>
                                    <Text style={styles.secondaryButtonText}>Skip & Analyze</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.captureButtonSmall} onPress={handlePicture} />
                            </View>
                        </>
                    )}

                    {step === 'review' && (
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={reset} disabled={processing}>
                                <Text style={styles.secondaryButtonText}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryButton} onPress={processCard} disabled={processing}>
                                <Text style={styles.primaryButtonText}>Analyze Card</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {processing && (
                    <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <Text style={styles.loadingText}>Analyzing...</Text>
                        </View>
                    </View>
                )}
            </View>
        )
    }

    // Default Camera View (Front)
    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} ref={cameraRef} facing="back">
                <View style={styles.overlay}>
                    <Text style={styles.overlayText}>Scan Front Side</Text>
                </View>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={pickImage} disabled={processing}>
                        <Text style={styles.text}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.captureButton]} onPress={handlePicture} disabled={processing}>
                        <View style={styles.innerCircle} />
                    </TouchableOpacity>
                    <View style={styles.spacer} />
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    miniCamera: {
        height: 200,
        width: '100%',
        marginVertical: 10,
    },
    previewContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: 'white',
    },
    actionContainer: {
        padding: 20,
        backgroundColor: 'white',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: 150,
        backgroundColor: '#f0f0f0',
        marginBottom: 10,
    },
    label: {
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5,
    },
    instruction: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        margin: 64,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    button: {
        alignItems: 'center',
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonSmall: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
        borderWidth: 5,
        borderColor: '#ddd',
        marginLeft: 20,
    },
    innerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: 'black',
    },
    text: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    spacer: {
        width: 50
    },
    overlay: {
        position: 'absolute',
        top: 50,
        width: '100%',
        alignItems: 'center',
    },
    overlayText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
        minWidth: 150,
        alignItems: 'center',
        marginLeft: 10,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButton: {
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#007AFF',
        minWidth: 100,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    loadingOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingBox: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 18,
        color: 'white',
    },
});
