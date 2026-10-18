import { createAudioPlayer } from 'expo-audio';

const SOURCES = {
  complete: require('../assets/sounds/complete.wav'),
  snooze: require('../assets/sounds/snooze.wav'),
  add: require('../assets/sounds/add.wav'),
} as const;

/** Plays a short one-shot UI sound effect. Never throws — sound is a nice-to-have. */
export function playSound(name: keyof typeof SOURCES) {
  try {
    const player = createAudioPlayer(SOURCES[name]);
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // already released
      }
    }, 4000);
  } catch {
    // missing file, unsupported platform, etc — silently skip.
  }
}
