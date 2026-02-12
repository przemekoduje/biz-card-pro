import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, Button, ScrollView, Alert, ActivityIndicator, TouchableOpacity, Linking, StatusBar, Platform, Modal } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { BusinessCard } from '../types';
import * as Contacts from 'expo-contacts';
import * as Clipboard from 'expo-clipboard';
import * as Calendar from 'expo-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { generateEmbedding, generateSearchContext } from '../services/aiService';

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
    const [selectedIcebreaker, setSelectedIcebreaker] = useState<'email' | 'linkedin' | 'sms' | null>(null);
    const [ownerName, setOwnerName] = useState<string | null>(null);
    const [showImages, setShowImages] = useState(false);

    // Calendar State
    const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
    const [isCalendarModalVisible, setCalendarModalVisible] = useState(false);
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        fetchCard();
        fetchOwnerName();
    }, [card_id]);

    const fetchOwnerName = async () => {
        try {
            const name = await AsyncStorage.getItem('user_owner_name');
            setOwnerName(name || '');
        } catch (e) {
            console.error("Failed to load owner name", e);
        }
    }

    const getFormattedIcebreaker = (type: 'email' | 'linkedin' | 'sms', text: string) => {
        if (!text) return "";
        let formatted = text;
        const nameToUse = ownerName || "[Twoje Imię]";

        formatted = formatted.replace(/\[Twoje Imię\]/gi, nameToUse);
        formatted = formatted.replace(/{Twoje Imię}/gi, nameToUse);

        return formatted;
    }

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

    const handleRemindPress = async () => {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status === 'granted') {
            try {
                const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
                const writableCalendars = calendars.filter(c => c.allowsModifications).sort((a, b) => {
                    // Sort by primary status first, then by title
                    if (a.isPrimary && !b.isPrimary) return -1;
                    if (!a.isPrimary && b.isPrimary) return 1;
                    return a.title.localeCompare(b.title);
                });

                if (writableCalendars.length === 0) {
                    Alert.alert("Brak kalendarzy", "Nie znaleziono kalendarzy z uprawnieniami do zapisu.");
                    return;
                }

                // Set default date based on AI suggestion
                let daysToAdd = 2;
                if (card?.follow_up_suggestion) {
                    if (card.follow_up_suggestion.includes('week')) daysToAdd = 7;
                    else if (card.follow_up_suggestion.includes('1 day')) daysToAdd = 1;
                    else if (card.follow_up_suggestion.includes('tomorrow')) daysToAdd = 1;
                }
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + daysToAdd);
                defaultDate.setHours(10, 0, 0, 0);
                setSelectedDate(defaultDate);

                setCalendars(writableCalendars);
                setCalendarModalVisible(true);
            } catch (e) {
                console.error(e);
                Alert.alert("Błąd", "Nie udało się pobrać kalendarzy.");
            }
        } else {
            Alert.alert("Brak uprawnień", "Potrzebujemy dostępu do kalendarza.");
        }
    };

    const handleCalendarSelect = (calendarId: string) => {
        setSelectedCalendarId(calendarId);
        setCalendarModalVisible(false);
        // Show Date Picker
        setDatePickerVisible(true);
    };

    const handleDateChange = (event: any, date?: Date) => {
        if (event.type === 'dismissed') {
             if (Platform.OS === 'android') setDatePickerVisible(false);
             return;
        }

        if (date) {
            setSelectedDate(date);
            if (Platform.OS === 'android') {
                 setDatePickerVisible(false);
                 createCalendarEvent(date);
            }
        }
    };

    const handleConfirmDate = () => {
        setDatePickerVisible(false);
        createCalendarEvent(selectedDate);
    };

    const createCalendarEvent = async (date: Date) => {
        if (!selectedCalendarId) return;

        try {
            const endDate = new Date(date);
            endDate.setHours(date.getHours() + 1);

            await Calendar.createEventAsync(selectedCalendarId, {
                title: `Follow up: ${firstName} ${lastName} (${company})`,
                startDate: date,
                endDate: endDate,
                notes: `Context: ${scopeOfWork}\nNote: ${eventNote}\nRef: Business Card Pro`,
                timeZone: 'Europe/Warsaw',
            });

            Alert.alert("Sukces", "Dodano przypomnienie do wybranego kalendarza.");
        } catch (e) {
            console.error(e);
            Alert.alert("Błąd", "Nie udało się zapisać wydarzenia.");
        }
    }


    const handleSave = async () => {
        setSaving(true);

        const cardData: Partial<BusinessCard> = {
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
        };

        const searchContext = generateSearchContext(cardData);
        let embedding: number[] | undefined = undefined;
        try {
            if (searchContext) {
                embedding = await generateEmbedding(searchContext);
            }
        } catch (e) {
            console.error("Embedding generation failed, saving without new embedding:", e);
        }

        const updates: any = {
            ...cardData,
            search_context: searchContext,
        };

        if (embedding) {
            updates.embedding = embedding;
        }

        const { error } = await supabase
            .from('business_cards')
            .update(updates)
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

    if (loading) return <View style={styles.loadingConfig}><ActivityIndicator size="large" color={colors.primary} /></View>;
    if (!card) return <View><Text>Card not found</Text></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity
                    style={styles.toggleImagesButton}
                    onPress={() => setShowImages(!showImages)}
                >
                    <Ionicons name={showImages ? "eye-off-outline" : "image-outline"} size={20} color={colors.primary} />
                    <Text style={styles.toggleImagesText}>{showImages ? "Ukryj zdjęcia wizytówki" : "Pokaż zdjęcia wizytówki"}</Text>
                </TouchableOpacity>

                {showImages && (
                    <>
                        {card.image_url && (
                            <View style={styles.imageContainer}>
                                <Image source={{ uri: card.image_url }} style={styles.image} resizeMode="contain" />
                            </View>
                        )}
                        {card.back_image_url && (
                            <View style={styles.imageContainer}>
                                <Text style={styles.backImageLabel}>Back Side</Text>
                                <Image source={{ uri: card.back_image_url }} style={styles.image} resizeMode="contain" />
                            </View>
                        )}
                    </>
                )}

                <View style={styles.form}>
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>First Name</Text>
                            <TextInput style={commonStyles.input} value={firstName} onChangeText={setFirstName} />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Last Name</Text>
                            <TextInput style={commonStyles.input} value={lastName} onChangeText={setLastName} />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Company</Text>
                        <TextInput style={commonStyles.input} value={company} onChangeText={setCompany} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Job Title</Text>
                        <TextInput style={commonStyles.input} value={jobTitle} onChangeText={setJobTitle} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Industry / Tags</Text>
                        <View style={styles.tagContainer}>
                            {industry.split(',').map((tag, index) => {
                                const trimmedTag = tag.trim();
                                if (!trimmedTag) return null;
                                return (
                                    <View key={index} style={styles.tagPill}>
                                        <Text style={styles.tagText}>{trimmedTag}</Text>
                                        <TouchableOpacity onPress={() => {
                                            const tags = industry.split(',').map(t => t.trim()).filter(Boolean);
                                            const newTags = tags.filter((_, i) => i !== index);
                                            setIndustry(newTags.join(', '));
                                        }}>
                                            <Ionicons name="close-circle" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    </View>
                                )
                            })}
                        </View>
                        <View style={styles.addTagContainer}>
                            <TextInput
                                style={[commonStyles.input, styles.tagInput]}
                                placeholder="Add tag..."
                                onSubmitEditing={(e) => {
                                    const newTag = e.nativeEvent.text.trim();
                                    if (newTag) {
                                        const currentTags = industry.split(',').map(t => t.trim()).filter(Boolean);
                                        if (!currentTags.includes(newTag)) {
                                            setIndustry([...currentTags, newTag].join(', '));
                                        }
                                    }
                                }}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.actionInputWrapper}>
                            <TextInput style={[commonStyles.input, styles.actionInput]} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                            {email ? (
                                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${email}`)} style={styles.iconButton}>
                                    <Feather name="mail" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone</Text>
                        <View style={styles.actionInputWrapper}>
                            <TextInput
                                style={[commonStyles.input, styles.actionInput]}
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                            {phone ? (
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)} style={styles.iconButton}>
                                    <Feather name="phone-call" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <TextInput style={[commonStyles.input, styles.textArea]} value={address} onChangeText={setAddress} multiline />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Scope of Work</Text>
                        <TextInput style={[commonStyles.input, styles.textArea]} value={scopeOfWork} onChangeText={setScopeOfWork} multiline numberOfLines={4} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Note</Text>
                        <TextInput style={[commonStyles.input, styles.textArea]} value={eventNote} onChangeText={setEventNote} multiline numberOfLines={4} />
                    </View>

                    {/* Social Media Section */}
                    {card?.social_links && Object.values(card.social_links).some(link => link) && (
                        <View style={styles.assistantContainer}>
                            <Text style={styles.sectionTitle}>Social Media</Text>
                            <View style={styles.socialButtons}>
                                {card.social_links.linkedin && (
                                    <TouchableOpacity style={styles.socialButton} onPress={() => card.social_links?.linkedin && Linking.openURL(card.social_links.linkedin)}>
                                        <FontAwesome5 name="linkedin" size={24} color="#0077B5" />
                                    </TouchableOpacity>
                                )}
                                {card.social_links.linkedin_company && (
                                    <TouchableOpacity style={styles.socialButton} onPress={() => card.social_links?.linkedin_company && Linking.openURL(card.social_links.linkedin_company)}>
                                        <View style={{ position: 'relative' }}>
                                            <FontAwesome5 name="linkedin" size={24} color="#0077B5" />
                                            <View style={styles.companyBadge}>
                                                <Ionicons name="business" size={8} color="white" />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                {card.social_links.instagram && (
                                    <TouchableOpacity style={styles.socialButton} onPress={() => card.social_links?.instagram && Linking.openURL(card.social_links.instagram)}>
                                        <FontAwesome5 name="instagram" size={24} color="#E1306C" />
                                    </TouchableOpacity>
                                )}
                                {card.social_links.facebook && (
                                    <TouchableOpacity style={styles.socialButton} onPress={() => card.social_links?.facebook && Linking.openURL(card.social_links.facebook)}>
                                        <FontAwesome5 name="facebook" size={24} color="#1877F2" />
                                    </TouchableOpacity>
                                )}
                                {card.social_links.youtube && (
                                    <TouchableOpacity style={styles.socialButton} onPress={() => card.social_links?.youtube && Linking.openURL(card.social_links.youtube)}>
                                        <FontAwesome5 name="youtube" size={24} color="#FF0000" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Relationship/Follow-up Section */}
                    {true && (
                        <View style={styles.assistantContainer}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={styles.sectionTitle}>Relacje</Text>
                                {card?.follow_up_needed && (
                                    <View style={{ backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>Sugestia: {card.follow_up_suggestion || 'Kontakt'}</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, justifyContent: 'center' }]} onPress={handleRemindPress}>
                                <Feather name="calendar" size={20} color={colors.primary} />
                                <Text style={[styles.actionButtonText, { color: colors.primary, fontSize: 16 }]}>Przypomnij o kontakcie</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Calendar Selection Modal */}
                    <Modal
                        visible={isCalendarModalVisible}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => setCalendarModalVisible(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Wybierz Kalendarz</Text>
                                <ScrollView style={{ maxHeight: 300 }}>
                                    {calendars.map(cal => (
                                        <TouchableOpacity
                                            key={cal.id}
                                            style={styles.calendarItem}
                                            onPress={() => handleCalendarSelect(cal.id)}
                                        >
                                            <View style={[styles.colorDot, { backgroundColor: cal.color }]} />
                                            <View>
                                                <Text style={styles.calendarName}>{cal.title}</Text>
                                                <Text style={styles.calendarAccount}>{cal.source.name}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity style={styles.closeButton} onPress={() => setCalendarModalVisible(false)}>
                                    <Text style={styles.closeButtonText}>Anuluj</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* DateTimePicker - Platform Specific */}
                    {isDatePickerVisible && (
                        Platform.OS === 'ios' ? (
                            <Modal transparent={true} animationType="fade" visible={isDatePickerVisible} onRequestClose={() => setDatePickerVisible(false)}>
                                <View style={styles.modalOverlay}>
                                    <View style={[styles.modalContent, { padding: 20 }]}>
                                        <Text style={styles.modalTitle}>Wybierz Datę i Czas</Text>
                                        <DateTimePicker
                                            value={selectedDate}
                                            mode="datetime"
                                            display="spinner"
                                            onChange={handleDateChange}
                                            style={{ height: 120, width: '100%' }}
                                        />
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                                            <TouchableOpacity style={{ padding: 10 }} onPress={() => setDatePickerVisible(false)}>
                                                <Text style={{ color: colors.error, fontSize: 16 }}>Anuluj</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={{ padding: 10 }} onPress={handleConfirmDate}>
                                                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Zatwierdź</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </Modal>
                        ) : (
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="default"
                                onChange={handleDateChange}
                            />
                        )
                    )}



                    {/* Contact Assistant Section */}
                    {card?.ice_breakers && (
                        <View style={styles.assistantContainer}>
                            <Text style={styles.sectionTitle}>Asystent Kontaktu</Text>
                            <View style={styles.assistantButtons}>
                                <TouchableOpacity
                                    style={[styles.assistantButton, selectedIcebreaker === 'email' && styles.assistantButtonActive]}
                                    onPress={() => setSelectedIcebreaker(selectedIcebreaker === 'email' ? null : 'email')}
                                >
                                    <Feather name="mail" size={24} color={selectedIcebreaker === 'email' ? colors.white : colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.assistantButton, selectedIcebreaker === 'linkedin' && styles.assistantButtonActive]}
                                    onPress={() => setSelectedIcebreaker(selectedIcebreaker === 'linkedin' ? null : 'linkedin')}
                                >
                                    <FontAwesome5 name="linkedin" size={24} color={selectedIcebreaker === 'linkedin' ? colors.white : colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.assistantButton, selectedIcebreaker === 'sms' && styles.assistantButtonActive]}
                                    onPress={() => setSelectedIcebreaker(selectedIcebreaker === 'sms' ? null : 'sms')}
                                >
                                    <MaterialCommunityIcons name="message-processing-outline" size={24} color={selectedIcebreaker === 'sms' ? colors.white : colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {selectedIcebreaker && card.ice_breakers[selectedIcebreaker] && (
                                <View style={styles.icebreakerContent}>
                                    <Text style={styles.icebreakerText}>
                                        {getFormattedIcebreaker(selectedIcebreaker, card.ice_breakers[selectedIcebreaker])}
                                    </Text>

                                    <View style={styles.icebreakerActions}>
                                        <TouchableOpacity style={styles.actionButton} onPress={async () => {
                                            if (card.ice_breakers && selectedIcebreaker) {
                                                const content = getFormattedIcebreaker(selectedIcebreaker, card.ice_breakers[selectedIcebreaker]);
                                                await Clipboard.setStringAsync(content);
                                                Alert.alert("Skopiowano", "Treść wiadomości została skopiowana do schowka.");
                                            }
                                        }}>
                                            <Feather name="copy" size={16} color={colors.textSecondary} />
                                            <Text style={styles.actionButtonText}>Kopiuj</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionButton, styles.sendButton]} onPress={async () => {
                                            if (!card.ice_breakers || !selectedIcebreaker) return;


                                            const content = getFormattedIcebreaker(selectedIcebreaker, card.ice_breakers[selectedIcebreaker]);

                                            try {
                                                const { error } = await supabase.from('business_cards').update({ last_contact_date: new Date().toISOString() }).eq('id', card_id);
                                                if (error) console.error("Update last contact failed", error);

                                                if (selectedIcebreaker === 'email') {
                                                    const subject = encodeURIComponent(`Kontakt w sprawie współpracy - ${card.company}`);
                                                    const body = encodeURIComponent(content);
                                                    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
                                                    const gmailUrl = `googlegmail:///co?to=${email}&subject=${subject}&body=${body}`;

                                                    Alert.alert(
                                                        "Wybierz aplikację",
                                                        "Z której aplikacji pocztowej chcesz skorzystać?",
                                                        [
                                                            {
                                                                text: "Domyślna (Apple Mail)",
                                                                onPress: () => Linking.openURL(mailtoUrl)
                                                            },
                                                            {
                                                                text: "Gmail",
                                                                onPress: async () => {
                                                                    try {
                                                                        await Linking.openURL(gmailUrl);
                                                                    } catch {
                                                                        Alert.alert("Błąd", "Aplikacja Gmail nie jest zainstalowana lub nie można jej otworzyć.");
                                                                    }
                                                                }
                                                            },
                                                            {
                                                                text: "Anuluj",
                                                                style: "cancel"
                                                            }
                                                        ]
                                                    );
                                                } else if (selectedIcebreaker === 'sms') {
                                                    const body = encodeURIComponent(content);
                                                    await Linking.openURL(`sms:${phone}?body=${body}`);
                                                } else if (selectedIcebreaker === 'linkedin') {
                                                    await Clipboard.setStringAsync(content);
                                                    const query = encodeURIComponent(`${firstName} ${lastName} ${company}`);
                                                    await Linking.openURL(`https://www.linkedin.com/search/results/all/?keywords=${query}`);
                                                    Alert.alert("Otwieram LinkedIn", "Treść została skopiowana. Wklej ją w wiadomości na LinkedIn.");
                                                }
                                            } catch (err) {
                                                Alert.alert("Błąd", "Nie udało się otworzyć aplikacji.");
                                                console.error(err);
                                            }
                                        }}>
                                            <Feather name="send" size={16} color={colors.primary} />
                                            <Text style={[styles.actionButtonText, styles.sendButtonText]}>
                                                {selectedIcebreaker === 'linkedin' ? 'Szukaj & Wyślij' : 'Wyślij'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={commonStyles.primaryButton} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="white" /> : <Text style={commonStyles.primaryButtonText}>Save Changes</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={[commonStyles.secondaryButton, { marginTop: 12 }]} onPress={addToContacts}>
                            <Text style={commonStyles.secondaryButtonText}>Save to Phone Contacts</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.deleteButton, { marginTop: 24 }]} onPress={handleDelete}>
                            <Text style={styles.deleteButtonText}>Delete Card</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    loadingConfig: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    imageContainer: {
        backgroundColor: colors.surfaceVariant,
        padding: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    backImageLabel: {
        alignSelf: 'flex-start',
        marginLeft: 4,
        marginBottom: 8,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    form: {
        padding: 24,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    actionInputWrapper: {
        position: 'relative',
        justifyContent: 'center',
    },
    actionInput: {
        paddingRight: 50,
    },
    iconButton: {
        position: 'absolute',
        right: 12,
        padding: 8,
    },
    buttonContainer: {
        marginTop: 12,
    },
    deleteButton: {
        alignItems: 'center',
        padding: 12,
    },
    deleteButtonText: {
        color: colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
        marginTop: 4,
    },
    tagPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceVariant,
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 14,
        color: colors.text,
        marginRight: 4,
    },
    addTagContainer: {
        marginTop: 4,
    },
    tagInput: {
        height: 40,
        paddingVertical: 8,
    },
    assistantContainer: {
        marginTop: 24,
        padding: 16,
        backgroundColor: colors.surfaceVariant,
        borderRadius: 12,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 16,
    },
    assistantButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    assistantButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    assistantButtonActive: {
        backgroundColor: colors.primary,
    },
    icebreakerContent: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    icebreakerText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    icebreakerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.surfaceVariant,
    },
    actionButtonText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    sendButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    sendButtonText: {
        color: colors.primary,
    },
    toggleImagesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: colors.surfaceVariant,
        marginBottom: 16,
        marginHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    toggleImagesText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.primary,
    },
    socialButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    socialButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    companyBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: colors.textSecondary,
        borderRadius: 6,
        padding: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: colors.text,
        textAlign: 'center',
    },
    calendarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    calendarName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    calendarAccount: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    closeButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 12,
    },
    closeButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});
