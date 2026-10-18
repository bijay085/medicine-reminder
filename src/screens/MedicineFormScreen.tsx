import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AI_MEDICINE_PROMPT, parseMedicineJson } from '../aiImport';
import { Button } from '../components/Button';
import { ChoiceChips } from '../components/ChoiceChips';
import { DateField } from '../components/DateField';
import { Field } from '../components/Field';
import { GlassCard } from '../components/GlassCard';
import { TimeField } from '../components/TimeField';
import { calculateEndDate, dailyPillUsage, daysOfSupply } from '../scheduling/schedule';
import { playSound } from '../sounds';
import { COLORS, TEXT } from '../theme';
import type { MealName, Medicine, MedicineSchedule, TimeOfDay } from '../types/domain';
import { formatISODate, isValidISODate, isValidTimeOfDay } from '../utils/dateTime';

interface MedicineFormScreenProps {
  medicine?: Medicine;
  onCancel: () => void;
  onSave: (medicine: Medicine) => void;
}

interface ScheduleDraft {
  id: string;
  type: 'meal' | 'fixed';
  meal: MealName;
  fixedTime: string;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSchedule(): ScheduleDraft {
  return {
    id: createId('schedule'),
    type: 'meal',
    meal: 'breakfast',
    fixedTime: '20:00',
  };
}

function scheduleToDraft(schedule: MedicineSchedule): ScheduleDraft {
  if (schedule.type === 'fixed') {
    return { id: schedule.id, type: 'fixed', meal: 'breakfast', fixedTime: schedule.time };
  }
  return { id: schedule.id, type: 'meal', meal: schedule.meal, fixedTime: '20:00' };
}

export function MedicineFormScreen({ medicine, onCancel, onSave }: MedicineFormScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const today = useMemo(() => formatISODate(new Date()), []);
  const [name, setName] = useState(medicine?.name ?? '');
  const [amount, setAmount] = useState(String(medicine?.amount ?? 1));
  const [totalQuantity, setTotalQuantity] = useState(String(medicine?.totalQuantity ?? 30));
  const [startDate, setStartDate] = useState<string>(medicine?.startDate ?? today);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(
    medicine?.schedules.length ? medicine.schedules.map(scheduleToDraft) : [newSchedule()],
  );
  const [error, setError] = useState<string>();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiJson, setAiJson] = useState('');
  const [aiError, setAiError] = useState<string>();

  async function copyAiPrompt() {
    await Clipboard.setStringAsync(AI_MEDICINE_PROMPT);
    Alert.alert(
      'Prompt copied',
      'Paste it into any AI chat, add your prescription details, then paste the JSON it gives you back here.',
    );
  }

  function applyAiJson() {
    const parsed = parseMedicineJson(aiJson);
    if (!parsed) {
      setAiError("That doesn't look like valid JSON in the expected shape — check it matches the prompt's format.");
      return;
    }

    setName(parsed.name);
    setAmount(String(parsed.amountPerDose));
    setTotalQuantity(String(parsed.totalQuantity));
    setStartDate(parsed.startDate);
    setSchedules(
      parsed.schedules.map((entry) =>
        entry.type === 'meal'
          ? { id: createId('schedule'), type: 'meal', meal: entry.meal, fixedTime: '20:00' }
          : { id: createId('schedule'), type: 'fixed', meal: 'breakfast', fixedTime: entry.time },
      ),
    );
    setAiJson('');
    setAiError(undefined);
    setAiOpen(false);
  }

  const parsedAmount = Number(amount);
  const parsedQuantity = Number(totalQuantity);
  const supplyPreview = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return undefined;
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return undefined;
    const usage = dailyPillUsage(parsedAmount, schedules.length);
    const days = daysOfSupply(parsedQuantity, usage);
    const endDate = isValidISODate(startDate) ? calculateEndDate(startDate, parsedQuantity, usage) : undefined;
    return { days, endDate };
  }, [parsedAmount, parsedQuantity, schedules.length, startDate]);

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setSchedules((current) =>
      current.map((schedule, scheduleIndex) =>
        scheduleIndex === index ? { ...schedule, ...patch } : schedule,
      ),
    );
  }

  function handleSave() {
    if (!name.trim()) {
      setError('Enter the medicine name.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount per dose must be greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter how many pills you have.');
      return;
    }
    if (!isValidISODate(startDate)) {
      setError('Use a valid start date in YYYY-MM-DD format.');
      return;
    }

    const normalizedSchedules: MedicineSchedule[] = [];
    for (const schedule of schedules) {
      if (schedule.type === 'fixed') {
        if (!isValidTimeOfDay(schedule.fixedTime)) {
          setError('Use a valid fixed time in 24-hour HH:mm format.');
          return;
        }
        normalizedSchedules.push({
          id: schedule.id,
          type: 'fixed',
          time: schedule.fixedTime as TimeOfDay,
        });
        continue;
      }
      normalizedSchedules.push({
        id: schedule.id,
        type: 'meal',
        meal: schedule.meal,
        relation: 'after',
        offsetMinutes: 0,
      });
    }

    const usage = dailyPillUsage(parsedAmount, normalizedSchedules.length);
    const endDate = calculateEndDate(startDate, parsedQuantity, usage);
    const now = new Date().toISOString();
    playSound('add');
    onSave({
      id: medicine?.id ?? createId('medicine'),
      name: name.trim(),
      amount: parsedAmount,
      totalQuantity: parsedQuantity,
      startDate,
      endDate,
      schedules: normalizedSchedules,
      enabled: medicine?.enabled ?? true,
      createdAt: medicine?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={COLORS.accent} />
          <Text style={styles.backLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{medicine ? 'Edit medicine' : 'Add medicine'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <GlassCard style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAiOpen((open) => !open)}
            style={styles.aiToggleRow}
          >
            <Ionicons name="sparkles-outline" size={18} color={COLORS.accent} />
            <Text style={styles.aiToggleText}>Fill from AI instead</Text>
            <Ionicons name={aiOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
          </Pressable>
          {aiOpen ? (
            <>
              <Text style={styles.aiHint}>
                Copy the prompt, paste it into any AI chat along with your prescription, then paste
                the JSON it replies with below.
              </Text>
              <Button
                label="Copy AI prompt"
                variant="secondary"
                onPress={copyAiPrompt}
                icon={<Ionicons name="copy-outline" size={18} color={COLORS.ink} />}
              />
              <Field
                label="Paste JSON here"
                value={aiJson}
                onChangeText={(value) => {
                  setAiJson(value);
                  setAiError(undefined);
                }}
                placeholder={'{ "name": ... }'}
                multiline
                style={styles.aiJsonInput}
              />
              {aiError ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Text style={styles.errorText}>{aiError}</Text>
                </View>
              ) : null}
              <Button
                label="Fill form"
                onPress={applyAiJson}
                icon={<Ionicons name="checkmark" size={18} color={COLORS.primaryInk} />}
              />
            </>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Field
            label="Medicine name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Amoxicillin"
            autoCapitalize="words"
          />
          <View style={[styles.twoColumns, isCompact && styles.singleColumn]}>
            <View style={styles.column}>
              <Field
                label="Pills per dose"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="1"
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Pills you have"
                value={totalQuantity}
                onChangeText={setTotalQuantity}
                keyboardType="number-pad"
                placeholder="30"
              />
            </View>
          </View>
          <DateField label="Start date" value={startDate} onChangeValue={setStartDate} />
          {supplyPreview?.endDate ? (
            <View style={styles.supplyPreview}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.accent} />
              <Text style={styles.supplyText}>
                Lasts {supplyPreview.days} day{supplyPreview.days === 1 ? '' : 's'} · runs out{' '}
                {supplyPreview.endDate}
              </Text>
            </View>
          ) : null}
        </GlassCard>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Reminder times</Text>
            <Text style={styles.sectionHint}>Add each daily time for this medicine.</Text>
          </View>
        </View>

        {schedules.map((schedule, index) => (
          <GlassCard key={schedule.id} style={styles.card}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleTitle}>Time {index + 1}</Text>
              {schedules.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove reminder time ${index + 1}`}
                  onPress={() =>
                    setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  style={styles.removeButton}
                >
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <ChoiceChips
              label="Type"
              options={[
                { label: 'With a meal', value: 'meal' },
                { label: 'Fixed time', value: 'fixed' },
              ]}
              value={schedule.type}
              onChange={(value) => updateSchedule(index, { type: value })}
            />
            {schedule.type === 'meal' ? (
              <ChoiceChips
                label="Meal"
                options={[
                  { label: 'Breakfast', value: 'breakfast' },
                  { label: 'Lunch', value: 'lunch' },
                  { label: 'Dinner', value: 'dinner' },
                ]}
                value={schedule.meal}
                onChange={(value) => updateSchedule(index, { meal: value })}
              />
            ) : (
              <TimeField
                label="Fixed time"
                value={schedule.fixedTime}
                onChangeValue={(value) => updateSchedule(index, { fixedTime: value })}
              />
            )}
          </GlassCard>
        ))}

        <Button
          label="Add another time"
          variant="secondary"
          onPress={() => setSchedules((current) => [...current, newSchedule()])}
          icon={<Ionicons name="add-circle-outline" size={18} color={COLORS.ink} />}
        />

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={medicine ? 'Save changes' : 'Add medicine'}
          onPress={handleSave}
          icon={<Ionicons name="checkmark" size={18} color={COLORS.primaryInk} />}
        />
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
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(12, 8, 30, 0.4)',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  backButton: {
    width: 76,
    minHeight: 40,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  backLabel: {
    ...TEXT.link,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...TEXT.h2,
  },
  headerSpacer: {
    width: 76,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: 18,
    gap: 20,
  },
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiToggleText: {
    ...TEXT.h3,
    color: COLORS.accent,
    flex: 1,
  },
  aiHint: {
    ...TEXT.body,
  },
  aiJsonInput: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  singleColumn: {
    flexDirection: 'column',
  },
  column: {
    flex: 1,
  },
  supplyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  supplyText: {
    ...TEXT.caption,
    color: COLORS.accent,
    flex: 1,
  },
  sectionHeader: {
    paddingTop: 2,
  },
  sectionTitle: {
    ...TEXT.h2,
  },
  sectionHint: {
    ...TEXT.caption,
    marginTop: 2,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleTitle: {
    ...TEXT.h3,
  },
  removeButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  removeLabel: {
    ...TEXT.caption,
    color: COLORS.danger,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    ...TEXT.body,
    color: COLORS.danger,
  },
});
