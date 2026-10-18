import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav, type AppScreen } from './src/components/BottomNav';
import { EMPTY_APP_DATA } from './src/constants/defaults';
import { useAppFonts } from './src/fonts';
import {
  cancelNotificationBatch,
  scheduleSleepReminderBatch,
  scheduleWaterReminderBatch,
  scheduleWeeklyAlarm,
} from './src/notifications';
import { AlarmsScreen } from './src/screens/AlarmsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MedicinesScreen } from './src/screens/MedicinesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { loadAppData, saveAppData } from './src/storage/storage';
import { COLORS, FONTS, GRADIENTS } from './src/theme';
import type { AppData, UpdateAppData } from './src/types/domain';

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string>();
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const isMounted = useRef(true);
  const hasRefreshedWaterReminder = useRef(false);
  const hasRefreshedSleepReminder = useRef(false);
  const hasRefreshedWeeklyAlarms = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    loadAppData()
      .then((stored) => {
        if (isMounted.current) setData(stored);
      })
      .catch(() => {
        if (isMounted.current) setStorageError('Saved data could not be loaded.');
      })
      .finally(() => {
        if (isMounted.current) setIsLoading(false);
      });

    return () => {
      isMounted.current = false;
    };
  }, []);

  // The water reminder is only ever scheduled a few days ahead (OS local
  // notifications can't be anchored to a clock time indefinitely — see
  // notifications.ts), so extend that window once each time the app opens.
  useEffect(() => {
    if (isLoading || hasRefreshedWaterReminder.current || !data.waterReminder.enabled) return;
    hasRefreshedWaterReminder.current = true;
    cancelNotificationBatch(data.waterReminder.notificationIds)
      .then(() =>
        scheduleWaterReminderBatch(
          data.waterReminder.startTime,
          data.waterReminder.mode,
          data.waterReminder.intervalHours,
          data.waterReminder.weekdays,
        ),
      )
      .then((result) => {
        if (result.status !== 'scheduled' || !isMounted.current) return;
        updateData((current) => ({
          ...current,
          waterReminder: { ...current.waterReminder, notificationIds: result.notificationIds },
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data.waterReminder.enabled]);

  // Same reasoning as above, for the sleep reminder.
  useEffect(() => {
    if (isLoading || hasRefreshedSleepReminder.current || !data.sleepReminder.enabled) return;
    hasRefreshedSleepReminder.current = true;
    cancelNotificationBatch(data.sleepReminder.notificationIds)
      .then(() => scheduleSleepReminderBatch(data.sleepReminder.time))
      .then((result) => {
        if (result.status !== 'scheduled' || !isMounted.current) return;
        updateData((current) => ({
          ...current,
          sleepReminder: { ...current.sleepReminder, notificationIds: result.notificationIds },
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data.sleepReminder.enabled]);

  // Same reasoning again, for every weekly-repeating alarm.
  useEffect(() => {
    if (isLoading || hasRefreshedWeeklyAlarms.current) return;
    const weeklyAlarms = data.alarms.filter((alarm) => alarm.repeat === 'weekly');
    if (weeklyAlarms.length === 0) return;
    hasRefreshedWeeklyAlarms.current = true;

    Promise.all(
      weeklyAlarms.map(async (alarm) => {
        await cancelNotificationBatch(alarm.notificationIds);
        const result = await scheduleWeeklyAlarm(alarm.title, alarm.notes, alarm.time, alarm.weekdays ?? []);
        return { id: alarm.id, notificationIds: result.status === 'scheduled' ? result.notificationIds : [] };
      }),
    ).then((updates) => {
      if (!isMounted.current) return;
      updateData((current) => ({
        ...current,
        alarms: current.alarms.map((alarm) => {
          const update = updates.find((item) => item.id === alarm.id);
          return update ? { ...alarm, notificationIds: update.notificationIds } : alarm;
        }),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const updateData = useCallback<UpdateAppData>((updater) => {
    setData((current) => {
      const next = updater(current);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => saveAppData(next))
        .then(() => {
          if (isMounted.current) setStorageError(undefined);
        })
        .catch(() => {
          if (isMounted.current) {
            setStorageError('Changes could not be saved on this device.');
          }
        });
      return next;
    });
  }, []);

  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <LinearGradient colors={GRADIENTS.background} style={styles.appBackground}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
            <StatusBar style="light" />
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.loadingText}>Loading your schedule…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={GRADIENTS.background}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.appBackground}
      >
        <View pointerEvents="none" style={styles.orbTop} />
        <View pointerEvents="none" style={styles.orbMid} />
        <View pointerEvents="none" style={styles.orbBottom} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
          <StatusBar style="light" />
          {storageError ? (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorText}>{storageError}</Text>
            </View>
          ) : null}

          <View style={styles.screenContainer}>
            {activeScreen === 'today' ? (
              <TodayScreen
                data={data}
                updateData={updateData}
                onOpenMedicines={() => setActiveScreen('medicines')}
              />
            ) : null}
            {activeScreen === 'medicines' ? (
              <MedicinesScreen data={data} updateData={updateData} />
            ) : null}
            {activeScreen === 'alarms' ? (
              <AlarmsScreen data={data} updateData={updateData} />
            ) : null}
            {activeScreen === 'history' ? <HistoryScreen data={data} /> : null}
            {activeScreen === 'settings' ? (
              <SettingsScreen data={data} updateData={updateData} />
            ) : null}
          </View>

          <BottomNav active={activeScreen} onChange={setActiveScreen} />
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
    fontFamily: FONTS.bodyMedium,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
  },
  orbTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(194, 155, 255, 0.08)',
    top: -140,
    right: -140,
  },
  orbMid: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 143, 207, 0.05)',
    top: 300,
    left: -120,
  },
  orbBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(95, 245, 210, 0.06)',
    bottom: -180,
    right: -160,
  },
});
