import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const commonStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12, // Google-style rounded corners
        padding: 16,
        marginVertical: 8,
        marginHorizontal: 16,
        // Google-style subtle shadow (elevation 1 equivalent)
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    input: {
        backgroundColor: colors.surfaceVariant,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: 'transparent', // Default no border
    },
    inputActive: {
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderWidth: 2,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 24, // Pill shape
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '500', // Google Sans Medium equivalent
    },
    secondaryButton: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '500',
    },
    title: {
        fontSize: 22, // Google-like heading size
        fontWeight: '400', // Regular weight, not bold
        color: colors.text,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '400',
    },
    shadow: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    }
});
