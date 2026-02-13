import MapComponentNative from './MapComponent.native';
import MapComponentWeb from './MapComponent.web';
import { Platform } from 'react-native';

const MapComponent = Platform.OS === 'web' ? MapComponentWeb : MapComponentNative;

export default MapComponent;
