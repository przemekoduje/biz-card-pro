import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { colors } from '../theme/colors';
import { BusinessCard } from '../types';
import { MapComponentProps } from './MapComponent.types';

export default function MapComponent({ cards, onMarkerPress, onClusterPress }: MapComponentProps) {
    return (
        <ClusteredMapView
            style={styles.map}
            initialRegion={{
                latitude: 52.2297, // Warsaw default
                longitude: 21.0122,
                latitudeDelta: 10,
                longitudeDelta: 10,
            }}
            clusterColor={colors.primary}
            clusterTextColor={colors.white}
            onClusterPress={(cluster, markers) => {
                if (markers && markers.length > 0) {
                    // Logic to extract cards from markers
                    // We match based on coordinates as a heuristic
                    const markerCoords = markers.map((m: any) => {
                        const lat = m.coordinate?.latitude || m.geometry?.coordinates[1] || m.latitude;
                        const lng = m.coordinate?.longitude || m.geometry?.coordinates[0] || m.longitude;
                        return `${lat},${lng}`;
                    });

                    const matchedCards = cards.filter(c => {
                        if (!c.latitude || !c.longitude) return false;
                        return markerCoords.includes(`${c.latitude},${c.longitude}`);
                    });

                    if (matchedCards.length > 0) {
                        onClusterPress(matchedCards);
                        return false; // Stop zooming
                    }
                }
                return true;
            }}
        >
            {cards.map(card => {
                if (card.latitude && card.longitude) {
                    return (
                        <Marker
                            key={card.id}
                            coordinate={{ latitude: card.latitude, longitude: card.longitude }}
                        >
                            <Callout onPress={() => onMarkerPress(card.id)}>
                                <View style={styles.calloutContainer}>
                                    <Text style={styles.calloutTitle}>{card.company || 'Unknown Company'}</Text>
                                    <Text style={styles.calloutSubtitle}>{card.first_name} {card.last_name}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    );
                }
                return null;
            })}
        </ClusteredMapView>
    );
}

const styles = StyleSheet.create({
    map: {
        width: '100%',
        height: '100%',
    },
    calloutContainer: {
        padding: 5,
        minWidth: 100,
    },
    calloutTitle: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#666',
    },
});
