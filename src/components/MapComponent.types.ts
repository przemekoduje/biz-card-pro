import { BusinessCard } from '../types';

export interface MapComponentProps {
    cards: BusinessCard[];
    onMarkerPress: (cardId: string) => void;
    onClusterPress: (cards: BusinessCard[]) => void;
}
