import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, StatusBar, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
    Home: undefined;
    Camera: undefined;
    Details: { card_id: string };
    Profile: undefined;
};

export default function ProfileScreen() {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [ownerName, setOwnerName] = useState('');
    const [savingName, setSavingName] = useState(false);

    const fetchStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || '');
                const { data, error } = await supabase
                    .from('usage_tracking')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (data) setStats(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchOwnerName = async () => {
        try {
            const name = await AsyncStorage.getItem('user_owner_name');
            if (name) setOwnerName(name);
        } catch (e) {
            console.error("Failed to load owner name", e);
        }
    };

    const saveOwnerName = async () => {
        setSavingName(true);
        try {
            await AsyncStorage.setItem('user_owner_name', ownerName);
            Alert.alert("Sukces", "Dane właściciela zostały zapisane.");
        } catch (e) {
            Alert.alert("Błąd", "Nie udało się zapisać danych.");
            console.error(e);
        } finally {
            setSavingName(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchOwnerName()]);
        setLoading(false);
        setRefreshing(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

    const dailyLimit = 10;

    // UI Logic: Check if stats are from today. If not, show 0.
    // Use local date to match user expectations (midnight local time).
    const getLocalYYYYMMDD = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = getLocalYYYYMMDD();
    const isToday = stats?.last_action_date === today;
    const used = isToday ? (stats?.daily_actions_count || 0) : 0;

    const progress = Math.min(used / dailyLimit, 1);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{userEmail.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.email}>{userEmail}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Free Plan</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dane Właściciela</Text>
                    <View style={commonStyles.card}>
                        <Text style={styles.helperText}>
                            Wpisz swoje imię i nazwisko. Będzie ono automatycznie wstawiane do wiadomości (SMS, Email) jako Twój podpis.
                        </Text>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={[commonStyles.input, styles.nameInput]}
                                value={ownerName}
                                onChangeText={setOwnerName}
                                placeholder="Np. Jan Kowalski"
                            />
                            <TouchableOpacity style={styles.saveButton} onPress={saveOwnerName} disabled={savingName}>
                                {savingName ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="save-outline" size={20} color="white" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Daily Usage</Text>
                    <View style={commonStyles.card}>
                        <View style={styles.usageRow}>
                            <Text style={styles.usageLabel}>Actions Used</Text>
                            <Text style={styles.usageValue}>{used} / {dailyLimit}</Text>
                        </View>
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: progress >= 1 ? colors.error : colors.primary }]} />
                        </View>
                        <Text style={styles.usageNote}>Resets daily at midnight UTC</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Lifetime Statistics</Text>
                    <View style={commonStyles.card}>
                        <View style={styles.statRow}>
                            <View style={styles.statIcon}>
                                <Ionicons name="scan" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.statLabel}>Total Scans</Text>
                            <Text style={styles.statValue}>{stats?.total_scans || 0}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statRow}>
                            <View style={styles.statIcon}>
                                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.statLabel}>Total Emails</Text>
                            <Text style={styles.statValue}>{stats?.total_emails || 0}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statRow}>
                            <View style={styles.statIcon}>
                                <Ionicons name="image-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.statLabel}>Images Processed</Text>
                            <Text style={styles.statValue}>{stats?.total_images || 0}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.versionText}>BizCard Pro v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
    },
    email: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    badge: {
        backgroundColor: colors.surfaceVariant,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    usageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    usageLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    usageValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    progressContainer: {
        height: 8,
        backgroundColor: colors.surfaceVariant,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    usageNote: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'right',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    statIcon: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    statLabel: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 44, // Align with text start
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff0f0', // Light red
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffcdcd',
    },
    signOutText: {
        color: colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
    versionText: {
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 20,
    },
    helperText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    nameInput: {
        flex: 1,
    },
    saveButton: {
        backgroundColor: colors.primary,
        width: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    }
});
