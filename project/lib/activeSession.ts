import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracks the id of the workout session this device most recently started but
 * hasn't finished. Used to decide whether to warn about an in-progress workout
 * before starting a new one — so old, abandoned sessions in the database don't
 * trigger a false "workout in progress" warning.
 */
const KEY = 'solo.activeSessionId';

export async function setActiveSession(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // storage is best-effort
  }
}

export async function getActiveSession(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // storage is best-effort
  }
}
