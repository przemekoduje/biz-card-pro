import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Image, RefreshControl, Button, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { BusinessCard } from '../types';
import { expandSearchQuery } from '../services/aiService';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { Ionicons } from '@expo/vector-icons';

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
            headerShown: false, // Custom header for Google style
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
            style={commonStyles.card}
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                            {item.follow_up_needed && !item.last_contact_date && (
                                <View style={styles.notificationDot} />
                            )}
                        </View>
                        {(item.job_title || item.company) && (
                            <Text style={styles.jobTitle}>
                                {item.job_title}
                                {item.job_title && item.company ? ' • ' : ''}
                                {item.company}
                            </Text>
                        )}
                        {item.industry && <Text style={styles.industryBadge}>{item.industry}</Text>}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Google-style Top Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search your cards"
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {isExpanding && <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />}
                    <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                        <View style={styles.profileIcon}><Text style={{ color: 'white', fontWeight: 'bold' }}>P</Text></View>
                    </TouchableOpacity>
                </View>

                {/* Smart Search Toggle */}
                <TouchableOpacity
                    style={[styles.smartToggle, smartSearchEnabled && styles.smartToggleActive]}
                    onPress={() => setSmartSearchEnabled(!smartSearchEnabled)}
                >
                    <Ionicons name={smartSearchEnabled ? "sparkles" : "sparkles-outline"} size={14} color={smartSearchEnabled ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.smartToggleText, smartSearchEnabled && styles.smartToggleTextActive]}>
                        {smartSearchEnabled ? " AI Search On" : " AI Search Off"}
                    </Text>
                </TouchableOpacity>

                {smartSearchEnabled && expandedKeywords.length > 0 && searchQuery.length > 2 && (
                    <Text style={styles.smartSearchText}>
                        Scanning for: {expandedKeywords.slice(0, 3).join(', ')}...
                    </Text>
                )}
            </View>

            <View style={styles.filterContainer}>
                <TouchableOpacity onPress={() => setSortBy('date_desc')} style={[styles.filterChip, sortBy === 'date_desc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'date_desc' && styles.filterTextActive]}>Recent</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortBy('name_asc')} style={[styles.filterChip, sortBy === 'name_asc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'name_asc' && styles.filterTextActive]}>Name</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortBy('company_asc')} style={[styles.filterChip, sortBy === 'company_asc' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, sortBy === 'company_asc' && styles.filterTextActive]}>Company</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredAndSortedCards}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchCards} colors={[colors.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486776.png' }} style={{ width: 100, height: 100, opacity: 0.5, marginBottom: 20 }} />
                            <Text style={styles.emptyText}>No business cards yet</Text>
                            <Text style={styles.emptySubtext}>Tap the + button to add one</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Camera')}
            >
                <Ionicons name="camera" size={28} color="white" />
                <Text style={styles.fabText}>Scan</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchSection: {
        paddingTop: 50,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent', // Seamless transition usually
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceVariant,
        borderRadius: 24, // Pill shape
        paddingHorizontal: 16,
        paddingVertical: 8,
        height: 50,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: colors.text,
    },
    profileIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary, // Placeholder color
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    loadingIndicator: {
        marginLeft: 8,
    },
    smartToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    smartToggleActive: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    smartToggleText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
        marginLeft: 4,
    },
    smartToggleTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    smartSearchText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background,
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: colors.primary, // Or very light blue
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    filterTextActive: {
        color: colors.white,
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 100,
    },
    // Card styles are imported from commonStyles, but we can override interior here
    cardContent: {
        flexDirection: 'row',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surfaceVariant,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    avatarInitial: {
        color: colors.white,
        fontSize: 20,
        fontWeight: 'bold',
    },
    cardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '600', // Google Sans Medium
        color: colors.text,
        marginBottom: 2,
    },
    jobTitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    industryBadge: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '500',
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        // Changed to Material 3 FAB style (often secondary container)
        // actually let's use primary for better contrast
        backgroundColor: colors.primary,
        borderRadius: 16, // Material 3 rounded square/pill
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    notificationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.error,
        marginLeft: 8,
        marginTop: 6,
    },
});
