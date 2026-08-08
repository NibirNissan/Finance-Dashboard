import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCreateExpense } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { ExpenseInput } from '@workspace/api-client-react';

const CATEGORIES = ['Utilities', 'Bazar', 'One-Time'] as const;
type Category = (typeof CATEGORIES)[number];

const TYPES = ['recurring', 'one-time'] as const;
type ExpenseType = (typeof TYPES)[number];

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface PickerRowProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel?: (v: T) => string;
}

function PickerRow<T extends string>({
  label,
  options,
  value,
  onChange,
  getLabel,
}: PickerRowProps<T>) {
  const colors = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(opt);
              }}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderRadius: 8,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color: active ? colors.primaryForeground : colors.foreground,
                    fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {getLabel ? getLabel(opt) : opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AddExpenseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Utilities');
  const [type, setType] = useState<ExpenseType>('one-time');
  const [date, setDate] = useState(todayString());

  const topPad = Platform.OS === 'web' ? 67 + 20 : insets.top + 20;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : insets.bottom + 90;

  const mutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
        setTitle('');
        setAmount('');
        setCategory('Utilities');
        setType('one-time');
        setDate(todayString());
        Alert.alert('Saved', 'Expense logged successfully.');
      },
      onError: (err) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', `Couldn't save expense: ${err.message}`);
      },
    },
  });

  function validateDate(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function handleSubmit() {
    const parsedAmount = parseFloat(amount);
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Enter a valid amount greater than 0.');
      return;
    }
    if (!validateDate(date)) {
      Alert.alert('Validation', 'Date must be in YYYY-MM-DD format.');
      return;
    }

    const body: ExpenseInput = {
      title: title.trim(),
      amount: parsedAmount,
      category,
      date,
      type,
    };

    mutation.mutate({ data: body });
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
      borderRadius: 10,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
          gap: 20,
        }}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Add Expense</Text>

        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Electricity bill"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
            testID="input-title"
          />
        </View>

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount (USD)</Text>
          <View style={[styles.amountWrapper, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10 }]}>
            <Text style={[styles.currencySign, { color: colors.mutedForeground }]}>$</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              returnKeyType="done"
              testID="input-amount"
            />
          </View>
        </View>

        {/* Category */}
        <PickerRow
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />

        {/* Type */}
        <PickerRow
          label="Type"
          options={TYPES}
          value={type}
          onChange={setType}
          getLabel={(v) => (v === 'recurring' ? 'Recurring' : 'One-Time')}
        />

        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Date (YYYY-MM-DD)
          </Text>
          <TextInput
            style={inputStyle}
            placeholder={todayString()}
            placeholderTextColor={colors.mutedForeground}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            returnKeyType="done"
            testID="input-date"
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={mutation.isPending}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: mutation.isPending ? colors.muted : colors.primary,
              borderRadius: 12,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="btn-submit"
        >
          <Feather
            name={mutation.isPending ? 'loader' : 'check'}
            size={20}
            color={colors.primaryForeground}
          />
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {mutation.isPending ? 'Saving…' : 'Save Expense'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  currencySign: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    paddingVertical: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillText: {
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
