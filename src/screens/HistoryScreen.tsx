import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { COLORS, FONTS, TEXT } from '../theme';
import type { AppData, DoseRecord, ISODate } from '../types/domain';

interface HistoryScreenProps {
  data: AppData;
}

interface HistoryRow {
  record: DoseRecord;
  medicineName: string;
}

const STATUS_META: Record<
  DoseRecord['status'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }
> = {
  taken: { label: 'TAKEN', icon: 'checkmark-circle', color: COLORS.primary, soft: COLORS.primarySoft },
  delayed: { label: 'DELAYED', icon: 'time', color: COLORS.warning, soft: COLORS.warningSoft },
  pending: { label: 'PENDING', icon: 'ellipse-outline', color: COLORS.muted, soft: COLORS.card },
};

function formatDateHeading(date: ISODate): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function HistoryScreen({ data }: HistoryScreenProps) {
  const groups = useMemo(() => {
    const byDate = new Map<ISODate, HistoryRow[]>();
    for (const record of Object.values(data.doseRecords)) {
      if (record.status === 'pending') continue;
      const medicine = data.medicines.find((item) => item.id === record.medicineId);
      const row: HistoryRow = {
        record,
        medicineName: medicine?.name ?? 'Deleted medicine',
      };
      const bucket = byDate.get(record.date);
      if (bucket) bucket.push(row);
      else byDate.set(record.date, [row]);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) => b.record.scheduledAt.localeCompare(a.record.scheduledAt)),
      }));
  }, [data.doseRecords, data.medicines]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HISTORY</Text>
        <Text style={styles.title}>Dose log</Text>
        <Text style={styles.subtitle}>Every dose you've marked taken or delayed.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="time-outline" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyText}>
              Doses you mark taken or delayed on the Today screen will show up here.
            </Text>
          </GlassCard>
        ) : (
          groups.map(({ date, rows }) => (
            <View key={date} style={styles.group}>
              <Text style={styles.dateHeading}>{formatDateHeading(date)}</Text>
              <GlassCard style={styles.card}>
                {rows.map((row, index) => {
                  const meta = STATUS_META[row.record.status];
                  return (
                    <View
                      key={row.record.id}
                      style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
                    >
                      <View style={[styles.statusIcon, { backgroundColor: meta.soft }]}>
                        <Ionicons name={meta.icon} size={18} color={meta.color} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.medicineName}>{row.medicineName}</Text>
                        <Text style={styles.rowDetail}>
                          Scheduled {formatClockTime(row.record.scheduledAt)}
                          {row.record.status === 'taken' && row.record.takenAt
                            ? ` · Taken ${formatClockTime(row.record.takenAt)}`
                            : ''}
                          {row.record.status === 'delayed' && row.record.delayedUntil
                            ? ` · Delayed to ${formatClockTime(row.record.delayedUntil)}`
                            : ''}
                        </Text>
                      </View>
                      <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  );
                })}
              </GlassCard>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
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
  subtitle: {
    ...TEXT.body,
    marginTop: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 20,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  group: {
    gap: 10,
  },
  dateHeading: {
    ...TEXT.h3,
    color: COLORS.muted,
    paddingLeft: 2,
  },
  card: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  medicineName: {
    ...TEXT.h3,
  },
  rowDetail: {
    ...TEXT.caption,
    marginTop: 3,
  },
  statusLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FONTS.bodyExtraBold,
    letterSpacing: 0.6,
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
  },
});
