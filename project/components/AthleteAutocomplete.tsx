import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { User } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface AthleteAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  editable?: boolean;
  groupAthleteNames: string[];
}

export function AthleteAutocomplete({
  value,
  onChangeText,
  placeholder = 'Enter athlete name',
  style,
  editable = true,
  groupAthleteNames,
}: AthleteAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions =
    editable && value.length >= 1 && groupAthleteNames.length > 0
      ? groupAthleteNames.filter((name) =>
          name.toLowerCase().includes(value.toLowerCase())
        )
      : [];

  const handleSelectSuggestion = (name: string) => {
    onChangeText(name);
    setShowSuggestions(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, !editable && styles.inputReadOnly, style]}
        placeholder={placeholder}
        placeholderTextColor={colors.dark.textSecondary}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(editable && groupAthleteNames.length > 0);
        }}
        onFocus={() => {
          if (editable && value.length >= 1 && groupAthleteNames.length > 0) {
            setShowSuggestions(true);
          }
        }}
        onBlur={() => setShowSuggestions(false)}
        editable={editable}
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((name, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(name)}
              >
                <User size={16} color={colors.dark.primary} />
                <Text style={styles.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  inputReadOnly: {
    opacity: 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    marginTop: spacing.xs,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    zIndex: 2000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  suggestionText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
  },
});
