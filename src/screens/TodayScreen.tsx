import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { TimeField } from '../components/TimeField';
import { cancelDoseReminder, scheduleDoseReminder } from '../notifications';
import { buildTimeline, delayDose } from '../scheduling/schedule';
import { playSound } from '../sounds';
import { COLORS, FONTS, GRADIENTS, TEXT } from '../theme';
import type {
  AppData,
  DoseTimelineItem,
  MealName,
  MedicineSchedule,
  TimeOfDay,
  UpdateAppData,
} from '../types/domain';
import { formatISODate, formatTime, isValidTimeOfDay } from '../utils/dateTime';

interface TodayScreenProps {
  data: AppData;
  updateData: UpdateAppData;
  onOpenMedicines: () => void;
}

const MEAL_LABELS: Record<MealName, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

function describeSchedule(schedule: MedicineSchedule): string {
  if (schedule.type === 'fixed') return 'Fixed time';
  if (schedule.offsetMinutes === 0) return `With ${schedule.meal}`;
  return `${schedule.offsetMinutes} min ${schedule.relation} ${schedule.meal}`;
}

export function TodayScreen({ data, updateData, onOpenMedicines }: TodayScreenProps) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const today = useMemo(() => formatISODate(new Date()), []);
  const timeline = useMemo(() => buildTimeline(data, today), [data, today]);
  const doseItems = timeline.filter((item) => item.type === 'dose');
  const remainingCount = doseItems.filter((item) => item.status !== 'taken').length;
  const [editingMeal, setEditingMeal] = useState<MealName>();
  const [mealTime, setMealTime] = useState('');
  const [mealError, setMealError] = useState<string>();

  function openMealEditor(meal: MealName) {
    setEditingMeal(meal);
    setMealTime(data.mealOverrides[today]?.times[meal] ?? data.mealDefaults[meal]);
    setMealError(undefined);
  }

  function saveMealOverride() {
    if (!editingMeal || !isValidTimeOfDay(mealTime)) {
      setMealError('Use a valid 24-hour time such as 08:45.');
      return;
    }
    const meal = editingMeal;
    updateData((current) => ({
      ...current,
      mealOverrides: {
        ...current.mealOverrides,
        [today]: {
          date: today,
          times: {
            ...current.mealOverrides[today]?.times,
            [meal]: mealTime as TimeOfDay,
          },
        },
      },
    }));
    setEditingMeal(undefined);
  }

  function useDefaultMealTime() {
    if (!editingMeal) return;
    const meal = editingMeal;
    updateData((current) => {
      const currentOverride = current.mealOverrides[today];
      if (!currentOverride) return current;
      const times = { ...currentOverride.times };
      delete times[meal];
      const mealOverrides = { ...current.mealOverrides };
      if (Object.keys(times).length === 0) delete mealOverrides[today];
      else mealOverrides[today] = { date: today, times };
      return { ...current, mealOverrides };
    });
    setEditingMeal(undefined);
  }

  // Schedule a real OS notification (plus a follow-up nudge if ignored) for
  // each dose that doesn't have one yet, so reminders fire even if the app
  // is closed. Runs whenever the timeline changes.
  useEffect(() => {
    const upcoming = timeline.filter(
      (item): item is DoseTimelineItem =>
        item.type === 'dose' && item.status !== 'taken' && item.scheduledAt.getTime() > Date.now(),
    );
    for (const item of upcoming) {
      if (data.doseRecords[item.id]?.notificationId) continue;
      scheduleDoseReminder(item.medicine.name, item.scheduledAt).then((result) => {
        if (result.status !== 'scheduled') return;
        updateData((current) => {
          const existing = current.doseRecords[item.id];
          if (existing?.notificationId) return current;
          return {
            ...current,
            doseRecords: {
              ...current.doseRecords,
              [item.id]: {
                id: item.id,
                medicineId: item.medicine.id,
                scheduleId: item.schedule.id,
                date: today,
                scheduledAt: item.scheduledAt.toISOString(),
                status: 'pending',
                notificationId: result.notificationId,
                followUpNotificationId: result.followUpNotificationId,
              },
            },
          };
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  function markTaken(item: DoseTimelineItem) {
    const now = new Date().toISOString();
    const existing = data.doseRecords[item.id];
    cancelDoseReminder(existing?.notificationId, existing?.followUpNotificationId);
    playSound('complete');
    updateData((current) => ({
      ...current,
      doseRecords: {
        ...current.doseRecords,
        [item.id]: {
          ...current.doseRecords[item.id],
          id: item.id,
          medicineId: item.medicine.id,
          scheduleId: item.schedule.id,
          date: today,
          scheduledAt:
            current.doseRecords[item.id]?.scheduledAt ?? item.scheduledAt.toISOString(),
          status: 'taken',
          takenAt: now,
          notificationId: undefined,
          followUpNotificationId: undefined,
        },
      },
    }));
  }

  function delay(item: DoseTimelineItem) {
    const existing = data.doseRecords[item.id];
    cancelDoseReminder(existing?.notificationId, existing?.followUpNotificationId);
    playSound('snooze');
    const delayedUntil = delayDose(item.scheduledAt, data.snoozeMinutes).toISOString();
    updateData((current) => ({
      ...current,
      doseRecords: {
        ...current.doseRecords,
        [item.id]: {
          ...current.doseRecords[item.id],
          id: item.id,
          medicineId: item.medicine.id,
          scheduleId: item.schedule.id,
          date: today,
          scheduledAt:
            current.doseRecords[item.id]?.scheduledAt ?? item.scheduledAt.toISOString(),
          status: 'delayed',
          delayedUntil,
          notificationId: undefined,
          followUpNotificationId: undefined,
        },
      },
    }));
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, isNarrow && styles.headerNarrow]}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <Text style={styles.title}>
          {new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryWrap}>
          <LinearGradient
            colors={GRADIENTS.summary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryLabelRow}>
              <View style={styles.summaryIcon}>
                <Ionicons name="medical" size={16} color={COLORS.ink} />
              </View>
              <Text style={styles.summaryLabel}>DOSES REMAINING</Text>
            </View>
            <Text style={styles.summaryValue}>{remainingCount}</Text>
            <Text style={styles.summaryHint}>
              {doseItems.length === 0
                ? 'Add a medicine to start your reminder schedule.'
                : `${doseItems.length - remainingCount} of ${doseItems.length} taken today`}
            </Text>
            {doseItems.length === 0 ? (
              <View style={styles.summaryAction}>
                <Button label="Add medicine" variant="secondary" onPress={onOpenMedicines} />
              </View>
            ) : null}
          </LinearGradient>
        </View>

          <View style={[styles.sectionHeader, isNarrow && styles.sectionHeaderNarrow]}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionMeta}>Tap a meal card to change its time</Text>
        </View>

        {timeline.map((item) => (
          <View key={item.id} style={styles.timelineRow}>
            <Text style={[styles.time, isNarrow && styles.timeNarrow]}>
              {formatTime(item.scheduledAt)}
            </Text>
            <View style={[styles.timelineRule, isNarrow && styles.timelineRuleNarrow]}>
              <View
                style={[
                  styles.timelineDot,
                  item.type === 'dose' && styles.doseDot,
                  item.type === 'dose' && item.status === 'taken' && styles.takenDot,
                ]}
              />
            </View>
            {item.type === 'meal' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Change ${MEAL_LABELS[item.meal]} time for today`}
                onPress={() => openMealEditor(item.meal)}
                style={({ pressed }) => [styles.eventCardPressable, pressed && styles.pressedCard]}
              >
                <GlassCard style={styles.eventCard}>
                  <View style={styles.mealRow}>
                    <View style={styles.mealRowText}>
                      <Text style={styles.eventTitle}>{MEAL_LABELS[item.meal]}</Text>
                      <Text style={styles.eventDetail}>
                        {item.isOverridden ? 'Changed for today' : 'Default time — tap to change'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                  </View>
                </GlassCard>
              </Pressable>
            ) : (
              <GlassCard style={styles.eventCard}>
                <>
                  <View style={styles.doseHeading}>
                    <View style={styles.doseHeadingText}>
                      <Text style={styles.eventTitle}>{item.medicine.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.doseStatus,
                        item.status === 'taken' && styles.takenStatus,
                        item.status === 'delayed' && styles.delayedStatus,
                        item.status !== 'taken' && item.scheduledAt.getTime() < Date.now() && styles.missedStatus,
                      ]}
                    >
                      <Text
                        style={[
                          styles.doseStatusText,
                          item.status === 'taken' && styles.takenStatusText,
                          item.status !== 'taken' &&
                            item.scheduledAt.getTime() < Date.now() &&
                            styles.missedStatusText,
                        ]}
                      >
                        {item.status !== 'taken' && item.scheduledAt.getTime() < Date.now()
                          ? 'MISSED'
                          : item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.doseAmount}>
                    {item.medicine.amount} pill{item.medicine.amount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.eventDetail}>{describeSchedule(item.schedule)}</Text>
                  {item.status !== 'taken' ? (
                    <View style={styles.doseActions}>
                      <View style={styles.doseActionButton}>
                        <Button label="Taken" onPress={() => markTaken(item)} />
                      </View>
                      <View style={styles.doseActionButton}>
                        <Button
                          label={`+${data.snoozeMinutes} min`}
                          variant="secondary"
                          onPress={() => delay(item)}
                        />
                      </View>
                    </View>
                  ) : null}
                </>
              </GlassCard>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={editingMeal !== undefined}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingMeal(undefined)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close meal time editor"
            style={StyleSheet.absoluteFill}
            onPress={() => setEditingMeal(undefined)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Today’s {editingMeal ? MEAL_LABELS[editingMeal].toLowerCase() : ''}
            </Text>
            <Text style={styles.modalText}>Only today’s linked reminders will move.</Text>
            <TimeField
              label="Time"
              value={mealTime}
              onChangeValue={(value) => {
                setMealTime(value);
                setMealError(undefined);
              }}
              error={mealError}
            />
            <View style={[styles.modalActions, isNarrow && styles.modalActionsNarrow]}>
              <View style={styles.modalActionButton}>
                <Button label="Use default" variant="secondary" onPress={useDefaultMealTime} />
              </View>
              <View style={styles.modalActionButton}>
                <Button label="Save for today" onPress={saveMealOverride} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  headerNarrow: {},
  eyebrow: {
    ...TEXT.eyebrow,
  },
  title: {
    ...TEXT.h1,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  summaryWrap: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 18,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  summaryLabel: {
    color: COLORS.ink,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.bodyExtraBold,
    letterSpacing: 1.2,
  },
  summaryValue: {
    ...TEXT.stat,
    color: COLORS.ink,
    marginTop: 6,
  },
  summaryHint: {
    color: COLORS.ink,
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 300,
    marginTop: 2,
    fontFamily: FONTS.bodyMedium,
  },
  summaryAction: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionHeaderNarrow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 4,
  },
  sectionTitle: {
    ...TEXT.h2,
  },
  sectionMeta: {
    ...TEXT.caption,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  time: {
    color: COLORS.ink,
    width: 66,
    paddingTop: 15,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.bodyBold,
  },
  timeNarrow: {
    width: 56,
    fontSize: 11,
  },
  timelineRule: {
    width: 22,
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  timelineRuleNarrow: {
    width: 16,
  },
  timelineDot: {
    position: 'absolute',
    top: 18,
    left: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  doseDot: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  takenDot: {
    backgroundColor: '#6E6890',
    borderColor: '#6E6890',
  },
  eventCard: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    marginBottom: 14,
  },
  eventCardPressable: {
    flex: 1,
  },
  pressedCard: {
    opacity: 0.75,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealRowText: {
    flex: 1,
  },
  eventTitle: {
    ...TEXT.h2,
  },
  doseAmount: {
    color: COLORS.primary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONTS.display,
    marginTop: 6,
  },
  eventDetail: {
    ...TEXT.body,
    marginTop: 6,
  },
  doseHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  doseHeadingText: {
    flex: 1,
  },
  doseStatus: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warningSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  takenStatus: {
    backgroundColor: COLORS.primarySoft,
  },
  delayedStatus: {
    backgroundColor: COLORS.warningSoft,
  },
  missedStatus: {
    backgroundColor: COLORS.dangerSoft,
  },
  doseStatusText: {
    color: COLORS.warning,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: FONTS.bodyExtraBold,
  },
  takenStatusText: {
    color: COLORS.primary,
  },
  missedStatusText: {
    color: COLORS.danger,
  },
  doseActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  doseActionButton: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 4, 20, 0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1C1636',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  modalTitle: {
    ...TEXT.h1,
    fontSize: 19,
    lineHeight: 24,
  },
  modalText: {
    ...TEXT.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionsNarrow: {
    flexDirection: 'column',
  },
  modalActionButton: {
    flex: 1,
  },
});
