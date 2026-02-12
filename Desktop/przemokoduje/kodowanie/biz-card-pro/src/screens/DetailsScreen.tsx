import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, Button, ScrollView, Alert, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { BusinessCard } from '../types';
import * as Contacts from 'expo-contacts';
import { Feather } from '@expo/vector-icons';

type RootStackParamList = {
    Home: undefined;
    Camera: undefined;
    Details: { card_id: string };
};

type DetailsScreenRouteProp = RouteProp<RootStackParamList, 'Details'>;
type DetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Details'>;

export default function DetailsScreen() {
    const route = useRoute<DetailsScreenRouteProp>();
    const navigation = useNavigation<DetailsScreenNavigationProp>();
    const { card_id } = route.params;

    const [card, setCard] = useState<BusinessCard | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [address, setAddress] = useState('');
    const [scopeOfWork, setScopeOfWork] = useState('');
    const [industry, setIndustry] = useState('');
    const [eventNote, setEventNote] = useState('');

    useEffect(() => {
        fetchCard();
    }, [card_id]);

    const fetchCard = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('business_cards')
            .select('*')
            .eq('id', card_id)
            .single();

        if (error) {
            console.error("Error fetching details:", error);
            Alert.alert("Error", "Could not load card details");
            navigation.goBack();
        } else {
            setCard(data);
            setFirstName(data.first_name || '');
            setLastName(data.last_name || '');
            setCompany(data.company || '');
            setEmail(data.email || '');
            setPhone(data.phone || '');
            setJobTitle(data.job_title || '');
            setAddress(data.address || '');
            setScopeOfWork(data.scope_of_work || '');
            setIndustry(data.industry || '');
            setEventNote(data.event_note || '');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('business_cards')
            .update({
                first_name: firstName,
                last_name: lastName,
                company: company,
                email: email,
                phone: phone,
                job_title: jobTitle,
                address: address,
                scope_of_work: scopeOfWork,
                industry: industry,
                event_note: eventNote,
            })
            .eq('id', card_id);

        if (error) {
            console.error("Error updating:", error);
            Alert.alert("Error", "Failed to update card");
        } else {
            Alert.alert("Success", "Card updated!");
            navigation.goBack();
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        Alert.alert(
            "Delete Card",
            "Are you sure you want to delete this card?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase.from('business_cards').delete().eq('id', card_id);
                        if (error) {
                            Alert.alert("Error", "Failed to delete");
                        } else {
                            navigation.goBack();
                        }
                    }
                }
            ]
        );
    };

    const addToContacts = async () => {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
            const contact: Contacts.Contact = {
                contactType: Contacts.ContactTypes.Person,
                name: `${firstName} ${lastName}`,
                [Contacts.Fields.FirstName]: firstName,
                [Contacts.Fields.LastName]: lastName,
                [Contacts.Fields.Company]: company,
                [Contacts.Fields.JobTitle]: jobTitle,
                [Contacts.Fields.Emails]: email ? [{ email: email, isPrimary: true, label: 'work', id: '1' }] : undefined,
                [Contacts.Fields.PhoneNumbers]: phone ? [{ number: phone, isPrimary: true, label: 'mobile', id: '1', countryCode: '' }] : undefined,
                [Contacts.Fields.Addresses]: address ? [{ street: address, label: 'work', id: '1', city: '', country: '', region: '', postalCode: '', isoCountryCode: '' }] : undefined,
            };
            
            try {
                const contactId = await Contacts.addContactAsync(contact);
                if (contactId) {
                    Alert.alert("Success", "Contact saved to phone!");
                }
            } catch (err) {
                console.error(err);
                Alert.alert("Error", "Failed to save contact");
            }
        } else {
            Alert.alert("Permission options", "We need permission to save contacts.");
        }
    };

    if (loading) return <View style={styles.loadingConfig}><ActivityIndicator size="large" /></View>;
    if (!card) return <View><Text>Card not found</Text></View>;

    return (
        <ScrollView style={styles.container}>
            {card.image_url && (
                <Image source={{ uri: card.image_url }} style={styles.image} resizeMode="contain" />
            )}
            {card.back_image_url && (
                <View style={styles.backImageContainer}>
                    <Text style={styles.backImageLabel}>Back Side:</Text>
                    <Image source={{ uri: card.back_image_url }} style={styles.image} resizeMode="contain" />
                </View>
            )}

            <View style={styles.form}>
                <Text style={styles.label}>First Name</Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

                <Text style={styles.label}>Last Name</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

                <Text style={styles.label}>Company</Text>
                <TextInput style={styles.input} value={company} onChangeText={setCompany} />

                <Text style={styles.label}>Job Title</Text>
                <TextInput style={styles.input} value={jobTitle} onChangeText={setJobTitle} />

                <Text style={styles.label}>Industry / Tags (for search)</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={industry}
                    onChangeText={setIndustry}
                    placeholder="e.g. Construction, Windows, Doors, PVC"
                    multiline
                    numberOfLines={3}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

                <Text style={styles.label}>Phone</Text>
                <View style={styles.inputRow}>
                    <TextInput 
                        style={[styles.input, styles.inputFlex]} 
                        value={phone} 
                        onChangeText={setPhone} 
                        keyboardType="phone-pad" 
                    />
                    <TouchableOpacity 
                        style={styles.actionButton} 
                        onPress={() => {
                            if (phone) {
                                Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
                            } else {
                                Alert.alert("No phone number", "Please enter a phone number first.");
                            }
                        }}
                    >
                        <Feather name="phone-call" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Address</Text>
                <TextInput style={[styles.input, styles.textArea]} value={address} onChangeText={setAddress} multiline />

                <Text style={styles.label}>Scope of Work</Text>
                <TextInput style={[styles.input, styles.textArea]} value={scopeOfWork} onChangeText={setScopeOfWork} multiline numberOfLines={4} />

                <Text style={styles.label}>Event Note</Text>
                <TextInput style={[styles.input, styles.textArea]} value={eventNote} onChangeText={setEventNote} multiline numberOfLines={4} />

                <View style={styles.buttonContainer}>
                    <Button title={saving ? "Saving..." : "Save Changes"} onPress={handleSave} disabled={saving} />
                    <View style={{ marginTop: 10 }}>
                        <Button title="Save to Phone Contacts" onPress={addToContacts} color="#34C759" />
                    </View>
                </View>
                <View style={styles.buttonContainer}>
                    <Button title="Delete" color="red" onPress={handleDelete} />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingConfig: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    image: {
        width: '100%',
        height: 200,
        backgroundColor: '#f0f0f0',
    },
    backImageContainer: {
        marginTop: 10,
    },
    backImageLabel: {
        marginLeft: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    form: {
        padding: 20,
        paddingBottom: 50,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 5,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        fontSize: 16,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    buttonContainer: {
        marginTop: 20,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputFlex: {
        flex: 1,
        marginRight: 10,
    },
    actionButton: {
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        height: 48, // Match input height roughly
        width: 48,
    },
});
