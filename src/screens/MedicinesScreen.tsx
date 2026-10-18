import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { COLORS, FONTS, TEXT } from '../theme';
import type { AppData, Medicine, UpdateAppData } from '../types/domain';
import { formatTime } from '../utils/dateTime';
import { MedicineFormScreen } from './MedicineFormScreen';

interface MedicinesScreenProps {
  data: AppData;
  updateData: UpdateAppData;
}

function summaryLine(medicine: Medicine): string {
  const count = medicine.schedules.length;
  return `${count}x daily · ${medicine.totalQuantity} pills left · runs out ${medicine.endDate}`;
}

export function MedicinesScreen({ data, updateData }: MedicinesScreenProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine>();

  const overview = useMemo(() => {
    const active = data.medicines.filter((medicine) => medicine.enabled).length;
    const totalPills = data.medicines.reduce((sum, medicine) => sum + medicine.totalQuantity, 0);

    let lastTaken: { name: string; when: string } | undefined;
    for (const record of Object.values(data.doseRecords)) {
      if (record.status !== 'taken' || !record.takenAt) continue;
      if (!lastTaken || record.takenAt > lastTaken.when) {
        const medicine = data.medicines.find((item) => item.id === record.medicineId);
        lastTaken = { name: medicine?.name ?? 'Medicine', when: record.takenAt };
      }
    }

    return { active, totalPills, lastTaken };
  }, [data.medicines, data.doseRecords]);

  function openNew() {
    setEditingMedicine(undefined);
    setEditorOpen(true);
  }

  function openEdit(medicine: Medicine) {
    setEditingMedicine(medicine);
    setEditorOpen(true);
  }

  function saveMedicine(medicine: Medicine) {
    updateData((current) => {
      const existingIndex = current.medicines.findIndex((item) => item.id === medicine.id);
      const medicines = [...current.medicines];
      if (existingIndex >= 0) medicines[existingIndex] = medicine;
      else medicines.push(medicine);
      return { ...current, medicines };
    });
    setEditorOpen(false);
    setEditingMedicine(undefined);
  }

  function setEnabled(medicine: Medicine, enabled: boolean) {
    updateData((current) => ({
      ...current,
      medicines: current.medicines.map((item) =>
        item.id === medicine.id
          ? { ...item, enabled, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function deleteMedicine(medicine: Medicine) {
    Alert.alert(
      `Delete ${medicine.name}?`,
      'Its saved dose history will also be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            updateData((current) => {
              const doseRecords = Object.fromEntries(
                Object.entries(current.doseRecords).filter(
                  ([, record]) => record.medicineId !== medicine.id,
                ),
              );
              return {
                ...current,
                medicines: current.medicines.filter((item) => item.id !== medicine.id),
                doseRecords,
              };
            }),
        },
      ],
    );
  }

  if (editorOpen) {
    return (
      <MedicineFormScreen
        medicine={editingMedicine}
        onCancel={() => {
          setEditorOpen(false);
          setEditingMedicine(undefined);
        }}
        onSave={saveMedicine}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MEDICINES</Text>
          <Text style={styles.title}>Your medicines</Text>
        </View>
        <Button
          label="Add"
          onPress={openNew}
          icon={<Ionicons name="add" size={18} color={COLORS.primaryInk} />}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {data.medicines.length > 0 ? (
          <View style={styles.overviewRow}>
            <GlassCard style={styles.overviewChip}>
              <Ionicons name="medical-outline" size={16} color={COLORS.accent} />
              <Text style={styles.overviewValue}>{data.medicines.length}</Text>
              <Text style={styles.overviewLabel}>total</Text>
            </GlassCard>
            <GlassCard style={styles.overviewChip}>
              <Ionicons name="power-outline" size={16} color={COLORS.primary} />
              <Text style={styles.overviewValue}>{overview.active}</Text>
              <Text style={styles.overviewLabel}>active</Text>
            </GlassCard>
            <GlassCard style={styles.overviewChip}>
              <Ionicons name="layers-outline" size={16} color={COLORS.warning} />
              <Text style={styles.overviewValue}>{overview.totalPills}</Text>
              <Text style={styles.overviewLabel}>pills left</Text>
            </GlassCard>
            <GlassCard style={styles.overviewChip}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
              {overview.lastTaken ? (
                <>
                  <Text style={styles.overviewValue} numberOfLines={1}>
                    {overview.lastTaken.name}
                  </Text>
                  <Text style={styles.overviewLabel}>
                    last taken {formatTime(new Date(overview.lastTaken.when))}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.overviewValue}>—</Text>
                  <Text style={styles.overviewLabel}>nothing taken yet</Text>
                </>
              )}
            </GlassCard>
          </View>
        ) : null}

        {data.medicines.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="medical-outline" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>No medicines yet</Text>
            <Text style={styles.emptyText}>
              Enter the exact medicine, amount, and timing from your instructions.
            </Text>
            <Button label="Add your first medicine" onPress={openNew} />
          </GlassCard>
        ) : (
          data.medicines.map((medicine) => (
            <GlassCard
              key={medicine.id}
              style={[styles.card, !medicine.enabled && styles.cardDisabled]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeading}>
                  <Text style={styles.name}>{medicine.name}</Text>
                </View>
                <Switch
                  accessibilityLabel={`${medicine.enabled ? 'Disable' : 'Enable'} ${medicine.name}`}
                  value={medicine.enabled}
                  onValueChange={(enabled) => setEnabled(medicine, enabled)}
                  trackColor={{ false: '#4A466B', true: '#33DCB6' }}
                  thumbColor={medicine.enabled ? COLORS.primary : '#EDEBFA'}
                />
              </View>
              <Text style={styles.amount}>
                {medicine.amount} pill{medicine.amount === 1 ? '' : 's'} per dose
              </Text>
              <Text style={styles.meta}>{summaryLine(medicine)}</Text>
              <View style={styles.actions}>
                <View style={styles.actionButton}>
                  <Button label="Edit" variant="secondary" onPress={() => openEdit(medicine)} />
                </View>
                <View style={styles.actionButton}>
                  <Button
                    label="Delete"
                    variant="danger"
                    onPress={() => deleteMedicine(medicine)}
                  />
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    minHeight: 74,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  eyebrow: {
    ...TEXT.eyebrow,
  },
  title: {
    ...TEXT.h1,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  overviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewChip: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 13,
    gap: 3,
  },
  overviewValue: {
    ...TEXT.h3,
    marginTop: 4,
  },
  overviewLabel: {
    ...TEXT.caption,
  },
  emptyCard: {
    padding: 20,
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    ...TEXT.h2,
  },
  emptyText: {
    ...TEXT.body,
    marginBottom: 2,
  },
  card: {
    padding: 18,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeading: {
    flex: 1,
  },
  name: {
    ...TEXT.h2,
  },
  amount: {
    color: COLORS.primary,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONTS.bodyBold,
    marginTop: 10,
  },
  meta: {
    ...TEXT.caption,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
  },
});
