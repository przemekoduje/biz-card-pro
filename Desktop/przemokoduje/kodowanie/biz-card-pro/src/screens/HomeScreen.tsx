import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Image, RefreshControl, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { BusinessCard } from '../types';
import { expandSearchQuery } from '../services/aiService';

type RootStackParamList = {
    Home: undefined;
    Camera: undefined;
    Details: { card_id: string };
    Profile: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'company_asc';

// Simple debounce hook implementation
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function HomeScreen() {
    const navigation = useNavigation<HomeScreenNavigationProp>();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ marginRight: 15 }}>
                    <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
                </View>
            ),
        });
    }, [navigation]);

    const [cards, setCards] = useState<BusinessCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('date_desc');
    const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
    const [isExpanding, setIsExpanding] = useState(false);
    const [smartSearchEnabled, setSmartSearchEnabled] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 1000); // 1s delay for AI

    const fetchCards = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('business_cards')
            .select('*');

        if (error) {
            console.error('Error fetching cards:', error);
        } else {
            setCards(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchCards();
        });

        return unsubscribe;
    }, [navigation]);

    // Effect to trigger AI expansion when debounced query changes
    useEffect(() => {
        const expand = async () => {
            if (smartSearchEnabled && debouncedSearchQuery.trim().length > 2) {
                setIsExpanding(true);
                const keywords = await expandSearchQuery(debouncedSearchQuery);
                console.log("Expanded keywords:", keywords);
                setExpandedKeywords(keywords);
                setIsExpanding(false);
            } else {
                setExpandedKeywords([]);
            }
        };

        expand();
    }, [debouncedSearchQuery, smartSearchEnabled]);

    const filteredAndSortedCards = useMemo(() => {
        let result = [...cards];

        // Filter
        if (searchQuery) {
            // Use expanded keywords if available and query matches debounced query (approx)
            // otherwise use current query
            const keywordsToUse = (smartSearchEnabled && expandedKeywords.length > 0 && searchQuery.includes(debouncedSearchQuery))
                ? expandedKeywords
                : [searchQuery];

            result = result.filter(card => {
                const searchString = `${card.first_name || ''} ${card.last_name || ''} ${card.company || ''} ${card.job_title || ''} ${card.scope_of_work || ''} ${card.address || ''} ${card.industry || ''}`.toLowerCase();
                return keywordsToUse.some(keyword => searchString.includes(keyword.toLowerCase()));
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'date_desc':
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                case 'date_asc':
                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                case 'name_asc':
                    const nameA = `${a.first_name} ${a.last_name}`.trim();
                    const nameB = `${b.first_name} ${b.last_name}`.trim();
                    return nameA.localeCompare(nameB);
                case 'company_asc':
                    return (a.company || '').localeCompare(b.company || '');
                default:
                    return 0;
            }
        });

        return result;
    }, [cards, searchQuery, sortBy, expandedKeywords, debouncedSearchQuery, smartSearchEnabled]);

    const renderItem = ({ item }: { item: BusinessCard }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Details', { card_id: item.id })}
        >
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarContainer}>
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.avatar} resizeMode="cover" />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitial}>{item.first_name?.[0] || item.company?.[0] || '?'}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                        {item.job_title ? <Text style={styles.jobTitle}>{item.job_title}</Text> : null}
                        <Text style={styles.company}>{item.company}</Text>
                        {item.industry ? <Text style={styles.industryBadge}>{item.industry}</Text> : null}
                    </View>
                </View>
                <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>Added: {new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Cards</Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name, company, title, industry..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {isExpanding && <ActivityIndicator size="small" color="#007AFF" style={styles.loadingIndicator} />}
                </View>

                <TouchableOpacity
                    style={[styles.smartToggle, smartSearchEnabled && styles.smartToggleActive]}
                    onPress={() => setSmartSearchEnabled(!smartSearchEnabled)}
                >
                    <Text style={[styles.smartToggleText, smartSearchEnabled && styles.smartToggleTextActive]}>
                        {smartSearchEnabled ? "✨ Smart Search ON" : "Lasting Smart Search OFF"}
                    </Text>
                </TouchableOpacity>

                {smartSearchEnabled && expandedKeywords.length > 0 && searchQuery.length > 2 && (
                    <Text style={styles.smartSearchText}>
                        Smart Search: {expandedKeywords.slice(0, 3).join(', ')}...
                    </Text>
                )}
            </View>

            <View style={styles.filterContainer}>
                <TouchableOpacity onPress={() => setSortBy('date_desc')} style={[styles.filterChip, sortBy === 'date_desc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'date_desc' && styles.filterTextActive]}>Newest</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortBy('name_asc')} style={[styles.filterChip, sortBy === 'name_asc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'name_asc' && styles.filterTextActive]}>A-Z</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortBy('company_asc')} style={[styles.filterChip, sortBy === 'company_asc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'company_asc' && styles.filterTextActive]}>Company</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredAndSortedCards}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchCards} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No cards found.</Text>
                            <Text style={styles.emptySubtext}>Tap + to scan a new business card.</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Camera')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: 'white',
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        color: 'black',
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'white',
        paddingBottom: 15,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E5EA',
        borderRadius: 10,
        paddingRight: 10,
    },
    searchInput: {
        flex: 1,
        padding: 10,
        fontSize: 16,
    },
    loadingIndicator: {
        marginLeft: 5,
    },
    smartSearchText: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 5,
        marginLeft: 5,
        fontStyle: 'italic',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#F2F2F7',
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#E5E5EA',
        marginRight: 10,
    },
    filterChipActive: {
        backgroundColor: 'black',
    },
    filterText: {
        fontSize: 14,
        color: 'black',
    },
    filterTextActive: {
        color: 'white',
        fontWeight: 'bold',
    },
    listContent: {
        padding: 20,
        paddingBottom: 100, // Space for FAB
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        overflow: 'hidden',
    },
    cardContent: {
        padding: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatarContainer: {
        marginRight: 15,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30, // Circle
        backgroundColor: '#f0f0f0',
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#007AFF',
    },
    avatarInitial: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    cardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 2,
    },
    jobTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    company: {
        fontSize: 14,
        color: '#8E8E93',
        fontWeight: '500',
    },
    cardFooter: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F2F2F7',
        paddingTop: 10,
        alignItems: 'flex-end',
    },
    dateText: {
        fontSize: 12,
        color: '#C7C7CC',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#888',
        marginTop: 5,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        backgroundColor: '#007AFF',
        width: 60,
        height: 60,
        borderRadius: 30, // Circle
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    fabText: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: -3,
    },
    smartToggle: {
        marginTop: 10,
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#E5E5EA',
        alignSelf: 'flex-start',
    },
    smartToggleActive: {
        backgroundColor: '#e0f2fe',
    },
    smartToggleText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
    smartToggleTextActive: {
        color: '#007AFF',
    },
    industryBadge: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 2,
        fontWeight: '500',
    },
});
