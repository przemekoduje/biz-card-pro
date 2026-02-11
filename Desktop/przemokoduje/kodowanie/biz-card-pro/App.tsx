import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import DetailsScreen from './src/screens/DetailsScreen';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Details: { card_id: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Business Cards' }} />
        <Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'Scan Card' }} />
        <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Card Details' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
