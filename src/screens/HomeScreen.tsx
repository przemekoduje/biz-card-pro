import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Image, RefreshControl, Button, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { BusinessCard } from '../types';
import { expandSearchQuery } from '../services/aiService';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Modal } from 'react-native';
import MapComponent from '../components/MapComponent';

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
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [showMapToast, setShowMapToast] = useState(false);
    const [clusterModalVisible, setClusterModalVisible] = useState(false);
    const [clusterCards, setClusterCards] = useState<BusinessCard[]>([]);

    // Toast effect when switching to map
    useEffect(() => {
        if (viewMode === 'map') {
            setShowMapToast(true);
            const timer = setTimeout(() => setShowMapToast(false), 3000);
            return () => clearTimeout(timer);
        } else {
            setShowMapToast(false);
        }
    }, [viewMode]);

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
                const searchString = `${card.first_name || ''} ${card.last_name || ''} ${card.company || ''} ${card.job_title || ''} ${card.scope_of_work || ''} ${card.address || ''} ${card.industry || ''} ${card.search_context || ''}`.toLowerCase();
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
                {viewMode === 'list' && (
                    <>
                        <TouchableOpacity onPress={() => setSortBy('date_desc')} style={[styles.filterChip, sortBy === 'date_desc' && styles.filterChipActive]}>
                            <Text style={[styles.filterText, sortBy === 'date_desc' && styles.filterTextActive]}>Recent</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSortBy('name_asc')} style={[styles.filterChip, sortBy === 'name_asc' && styles.filterChipActive]}>
                            <Text style={[styles.filterText, sortBy === 'name_asc' && styles.filterTextActive]}>Name</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSortBy('company_asc')} style={[styles.filterChip, sortBy === 'company_asc' && styles.filterChipActive]}>
                            <Text style={[styles.filterText, sortBy === 'company_asc' && styles.filterTextActive]}>Company</Text>
                        </TouchableOpacity>
                    </>
                )}
                <View style={{ flex: 1 }} />
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <Ionicons name="list" size={18} color={viewMode === 'list' ? colors.primary : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
                        onPress={() => setViewMode('map')}
                    >
                        <Feather name="map" size={18} color={viewMode === 'map' ? colors.primary : colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : viewMode === 'map' ? (
                <View style={styles.mapContainer}>
                    <MapComponent
                        cards={filteredAndSortedCards}
                        onMarkerPress={(cardId) => navigation.navigate('Details', { card_id: cardId })}
                        onClusterPress={(cards) => {
                            setClusterCards(cards);
                            setClusterModalVisible(true);
                        }}
                    />
                </View>

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

            {/* Map Toast Notification */}
            {showMapToast && (
                <View style={styles.toastContainer}>
                    <Text style={styles.toastText}>Tutaj zeskanowano wizytówki</Text>
                </View>
            )}

            {/* Cluster Cards Modal */}
            <Modal
                visible={clusterModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setClusterModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Wizytówki w tym rejonie ({clusterCards.length})</Text>
                            <TouchableOpacity onPress={() => setClusterModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={clusterCards}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.miniCard}
                                    onPress={() => {
                                        setClusterModalVisible(false);
                                        navigation.navigate('Details', { card_id: item.id });
                                    }}
                                >
                                    <View style={styles.miniCardAvatar}>
                                        <Text style={styles.miniCardInitial}>{item.company?.[0] || item.first_name?.[0] || '?'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.miniCardTitle} numberOfLines={1}>{item.company || 'Bez firmy'}</Text>
                                        <Text style={styles.miniCardSubtitle} numberOfLines={1}>{item.first_name} {item.last_name}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('Camera')}
            >
                <Ionicons name="camera" size={28} color="white" />
                <Text style={styles.fabText}>Scan</Text>
            </TouchableOpacity>
        </View >
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
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceVariant,
        borderRadius: 20,
        padding: 4,
    },
    viewToggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    viewToggleBtnActive: {
        backgroundColor: colors.surface,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    mapContainer: {
        flex: 1,
        overflow: 'hidden',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    calloutContainer: {
        width: 150,
        padding: 4,
    },
    calloutTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 2,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#666',
    },
    toastContainer: {
        position: 'absolute',
        top: 250, // Below headers
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        zIndex: 100,
    },
    toastText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    closeButton: {
        padding: 4,
    },
    miniCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    miniCardAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    miniCardInitial: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    miniCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    miniCardSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
    },
});
