import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

// NOTE: SpaceGrotesk_600SemiBold is intentionally not loaded — that weight's
// static font file has broken glyph outlines for several capitals (B, L, D,
// N get clipped on Android) regardless of line-height. Use 700Bold instead.
export function useAppFonts() {
  return useFonts({
    SpaceGrotesk_700Bold,
    SpaceGrotesk_500Medium,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
}
