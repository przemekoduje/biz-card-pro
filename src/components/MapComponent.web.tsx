import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BusinessCard } from '../types';
import { MapComponentProps } from './MapComponent.types';
import { colors } from '../theme/colors';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Webpack/Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const defaultIcon = new Icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function MapComponent({ cards, onMarkerPress }: MapComponentProps) {
    if (Platform.OS !== 'web') return null;

    // Center on Warsaw or first card
    const initialCenter: [number, number] = [52.2297, 21.0122];

    return (
        <View style={styles.container}>
            <style>
                {`
                    .leaflet-container {
                        height: 100%;
                        width: 100%;
                    }
                `}
            </style>
            <MapContainer center={initialCenter} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {cards.map(card => {
                    if (card.latitude && card.longitude) {
                        return (
                            <Marker
                                key={card.id}
                                position={[card.latitude, card.longitude]}
                                icon={defaultIcon}
                                eventHandlers={{
                                    click: () => {
                                        // onMarkerPress(card.id) // Optional: Trigger nav immediately?
                                    },
                                }}
                            >
                                <Popup>
                                    <div
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => onMarkerPress(card.id)}
                                    >
                                        <strong>{card.company || 'Unknown'}</strong><br />
                                        {card.first_name} {card.last_name}
                                        <br />
                                        <small style={{ color: colors.primary }}>Click for details</small>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })}
            </MapContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden', // Ensure map stays in container
    },
});
