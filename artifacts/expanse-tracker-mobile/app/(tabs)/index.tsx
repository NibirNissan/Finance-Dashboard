import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useDeleteExpense,
  useGetMonthlySummary,
  useListExpenses,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@workspace/api-client-react';

const CATEGORIES = ['Utilities', 'Bazar', 'One-Time'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, string> = {
  Utilities: '#4a7fa5',
  Bazar: '#6a9e6a',
  'One-Time': '#c47c2b',
};

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  // dateStr may be YYYY-MM-DD or a full ISO timestamp — normalize to date only
  const datePart = dateStr.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function SummaryCard() {
  const colors = useColors();
  const { data: summary, isLoading } = useGetMonthlySummary(
    { month: currentMonth() },
    { query: { queryKey: ['monthly-summary', currentMonth()] } }
  );

  if (isLoading) {
    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color={colors.primaryForeground} />
      </View>
    );
  }

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.primary, borderRadius: 16 }]}>
      <Text style={[styles.summaryLabel, { color: colors.primaryForeground, opacity: 0.7 }]}>
        This Month
      </Text>
      <Text style={[styles.summaryTotal, { color: colors.primaryForeground }]}>
        {formatCurrency(summary?.total ?? 0)}
      </Text>
      <Text style={[styles.summaryCount, { color: colors.primaryForeground, opacity: 0.7 }]}>
        {summary?.transactionCount ?? 0} transaction{(summary?.transactionCount ?? 0) !== 1 ? 's' : ''}
      </Text>

      {/* Category breakdown */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => {
          const catData = summary?.byCategory?.find((c) => c.category === cat);
          return (
            <View key={cat} style={styles.catItem}>
              <View
                style={[
                  styles.catDot,
                  { backgroundColor: CATEGORY_COLORS[cat] },
                ]}
              />
              <Text style={[styles.catLabel, { color: colors.primaryForeground, opacity: 0.8 }]}>
                {cat}
              </Text>
              <Text style={[styles.catAmount, { color: colors.primaryForeground }]}>
                {formatCurrency(catData?.total ?? 0)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ExpenseItem({ expense, onDelete }: { expense: Expense; onDelete: (id: number) => void }) {
  const colors = useColors();
  const category = expense.category as Category;
  const catColor = CATEGORY_COLORS[category] ?? colors.mutedForeground;

  return (
    <View
      style={[
        styles.expenseItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 12,
        },
      ]}
    >
      <View style={[styles.catIndicator, { backgroundColor: catColor }]} />
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseTitle, { color: colors.foreground }]} numberOfLines={1}>
          {expense.title}
        </Text>
        <View style={styles.expenseMeta}>
          <Text style={[styles.expenseDate, { color: colors.mutedForeground }]}>
            {formatDate(expense.date)}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.typeText, { color: colors.mutedForeground }]}>
              {expense.type === 'recurring' ? '↻' : '✦'} {expense.type}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.expenseAmount, { color: colors.foreground }]}>
        {formatCurrency(expense.amount)}
      </Text>
      <Pressable
        onPress={() => onDelete(expense.id)}
        style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 1 }]}
        testID={`delete-expense-${expense.id}`}
      >
        <Feather name="trash-2" size={16} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading, isError, refetch, isRefetching } = useListExpenses({
    query: { queryKey: ['expenses'] },
  });

  const deleteMutation = useDeleteExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      },
    },
  });

  const handleDelete = useCallback(
    (id: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Delete Expense', 'Remove this expense?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id }),
        },
      ]);
    },
    [deleteMutation]
  );

  const topPad =
    Platform.OS === 'web'
      ? 67 + 16
      : insets.top + 16;

  const bottomPad =
    Platform.OS === 'web'
      ? 84 + 34
      : insets.bottom + 90;

  if (isError) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          Couldn't load expenses
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={expenses as Expense[]}
        keyExtractor={(item) => String(item.id)}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
          gap: 10,
        }}
        ListHeaderComponent={
          <>
            <Text style={[styles.screenTitle, { color: colors.foreground }]}>Expenses</Text>
            <SummaryCard />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              All Expenses
            </Text>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <View style={[styles.empty, { borderColor: colors.border, borderRadius: 12 }]}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No expenses yet
              </Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                Tap Add to log your first expense
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ExpenseItem expense={item as Expense} onDelete={handleDelete} />
        )}
        scrollEnabled={expenses.length > 0}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  summaryCard: {
    padding: 20,
    marginBottom: 20,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryTotal: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    lineHeight: 48,
  },
  summaryCount: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  categoryRow: {
    gap: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  catAmount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    gap: 10,
    minHeight: 64,
    paddingRight: 12,
  },
  catIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  expenseInfo: {
    flex: 1,
    paddingVertical: 12,
    gap: 4,
  },
  expenseTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseDate: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  expenseAmount: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  deleteBtn: {
    padding: 8,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
