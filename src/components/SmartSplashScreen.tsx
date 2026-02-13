import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Props {
    onFinish: () => void;
}

export default function SmartSplashScreen({ onFinish }: Props) {
    const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const slideAnim = useRef(new Animated.Value(50)).current; // Start slightly below

    useEffect(() => {
        const checkFirstLaunch = async () => {
            try {
                const value = await AsyncStorage.getItem('alreadyLaunched');
                if (value === null) {
                    setIsFirstLaunch(true);
                    await AsyncStorage.setItem('alreadyLaunched', 'true');
                } else {
                    setIsFirstLaunch(false);
                }
            } catch (error) {
                setIsFirstLaunch(false); // Default to fast path on error
            }
        };

        checkFirstLaunch();
    }, []);

    useEffect(() => {
        // Enforce a minimum delay for the splash screen to be visible
        // We will ignore isFirstLaunch optimization for now to ensure visibility as requested
        
        Animated.sequence([
            // 1. Fade In Logo
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            // 2. Scale Up Logo slightly
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
            // 3. Slide Up Text (Parallel with previous if desired, but sequence is clearer for debug)
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
            // 4. Wait to catch user's eye
            Animated.delay(2000), 
            // 5. Fade Out everything
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            })
        ]).start(() => {
            // Only finish after the entire sequence is done
            onFinish();
        });

    }, []);

    if (isFirstLaunch === null) return null; // Or a plain white view

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                {/* Ensure the image path is correct relative to this file */}
                <Image 
                    source={require('../../assets/icon.png')} 
                    style={styles.logo} 
                    resizeMode="contain"
                />
            </Animated.View>
            
            {/* Remove conditional isFirstLaunch valid check for now to ensure visibility */}
            <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* <Text style={styles.title}>Biz Card Pro</Text> */}
                <Text style={styles.slogan}>Skanuj. Zapisuj. Zarządzaj.</Text>
                <Text style={styles.subSlogan}>Twoje wizytówki w jednym miejscu.</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Ensure it's on top
    },
    logoContainer: {
        marginBottom: 20,
    },
    logo: {
        width: 150,
        height: 150,
    },
    textContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 10,
    },
    slogan: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    subSlogan: {
        fontSize: 14,
        color: '#666',
    },
});
