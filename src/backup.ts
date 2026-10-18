import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseAppData } from './storage/storage';
import type { AppData } from './types/domain';

const BACKUP_FILE_NAME = 'medicine-reminder-backup.json';

export type ExportResult = 'shared' | 'unsupported' | 'error';

/** Writes the full app data to a JSON file and opens the native share sheet (save to Files, Drive, email, etc). */
export async function exportAppData(data: AppData): Promise<ExportResult> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return 'unsupported';

    const file = new File(Paths.cache, BACKUP_FILE_NAME);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(data, null, 2));

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your Medicine Reminder backup',
    });
    return 'shared';
  } catch {
    return 'error';
  }
}

export type ImportResult =
  | { status: 'imported'; data: AppData }
  | { status: 'cancelled' }
  | { status: 'invalid' }
  | { status: 'error' };

/** Lets the user pick a previously exported JSON file and parses it back into AppData. */
export async function importAppData(): Promise<ImportResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || picked.assets.length === 0) {
      return { status: 'cancelled' };
    }

    const file = new File(picked.assets[0].uri);
    const content = await file.text();
    const raw: unknown = JSON.parse(content);
    // Notification ids from another device/session are meaningless here —
    // drop them so the app's own refresh-on-open logic reschedules cleanly.
    const data = parseAppData(raw, { dropNotificationIds: true });
    if (!data) return { status: 'invalid' };

    return { status: 'imported', data };
  } catch {
    return { status: 'error' };
  }
}
