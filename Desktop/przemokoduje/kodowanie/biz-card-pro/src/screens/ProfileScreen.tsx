import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [userEmail, setUserEmail] = useState<string>('');

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
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

    const dailyLimit = 10;
    const used = stats?.daily_actions_count || 0;
    const progress = Math.min(used / dailyLimit, 1);

    return (
        <ScrollView 
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{userEmail.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.email}>{userEmail}</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Account Information</Text>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Email:</Text>
                    <Text style={[styles.statValue, {fontSize: 14}]}>{userEmail}</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Usage</Text>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: progress >= 1 ? '#ff3b30' : '#34C759' }]} />
                </View>
                <Text style={styles.progressText}>{used} / {dailyLimit} actions used today</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Lifetime Stats</Text>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Scans:</Text>
                    <Text style={styles.statValue}>{stats?.total_scans || 0}</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Emails:</Text>
                    <Text style={styles.statValue}>{stats?.total_emails || 0}</Text>
                </View>
                 <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Images:</Text>
                    <Text style={styles.statValue}>{stats?.total_images || 0}</Text>
                </View>
            </View>

            <View style={styles.buttonContainer}>
                <Button title="Sign Out" onPress={() => supabase.auth.signOut()} color="#ff3b30" />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 50,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarText: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
    },
    email: {
        fontSize: 18,
        fontWeight: '500',
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#666',
    },
    progressContainer: {
        height: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 10,
    },
    progressBar: {
        height: '100%',
    },
    progressText: {
        textAlign: 'right',
        color: '#666',
        fontSize: 14,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 10,
    },
    statLabel: {
        fontSize: 16,
        color: '#333',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    buttonContainer: {
        marginTop: 20,
    }
});
