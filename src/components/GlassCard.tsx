import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '../theme';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

/**
 * Glass-style card: a solid dark fill (not a real backdrop blur — expo-blur's
 * BlurView needs a `blurTarget` to actually blur on this SDK, and without it
 * silently no-ops to fully transparent, which just let the busy background
 * show straight through) plus a faint gradient sheen and hairline border for
 * the "frosted" look.
 *
 * `style` (flex/padding/gap/margin/etc from callers) goes on the wrapper
 * itself — that's the actual visible bordered box, so layout props like
 * `flex: 1` need to land there, not on some inner view. The sheen sits in
 * its own absolutely-filled, clipped layer; the content view under it has
 * no overflow:hidden of its own, since nesting custom-font text inside an
 * overflow:hidden container was clipping capital letters on Android.
 */
export function GlassCard({ children, style, radius = 18 }: GlassCardProps) {
  return (
    <View style={[styles.wrapper, { borderRadius: radius }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheenClip, { borderRadius: radius }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#16112C',
  },
  sheenClip: {
    overflow: 'hidden',
  },
});
