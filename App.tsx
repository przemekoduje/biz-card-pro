import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import DetailsScreen from './src/screens/DetailsScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SmartSplashScreen from './src/components/SmartSplashScreen';
import { View, ActivityIndicator } from 'react-native';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Details: { card_id: string };
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (!isSplashFinished) {
    return <SmartSplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
        {session && session.user ? (
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Business Cards' }} />
                <Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'Scan Card' }} />
                <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Card Details' }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
            </Stack.Navigator>
        ) : (
            <AuthScreen />
        )}
    </NavigationContainer>
  );
}
