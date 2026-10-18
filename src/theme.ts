export const COLORS = {
  background: '#0A0A1A',
  backgroundMid: '#170F35',
  backgroundEnd: '#1C1142',
  card: 'rgba(255, 255, 255, 0.07)',
  cardStrong: 'rgba(255, 255, 255, 0.12)',
  cardPressed: 'rgba(255, 255, 255, 0.18)',
  input: 'rgba(10, 10, 26, 0.45)',
  ink: '#F9F7FF',
  muted: '#ADA8CC',
  subtle: '#8B85B8',
  primary: '#5FF5D2',
  primaryPressed: '#33DCB6',
  primaryInk: '#04261F',
  primarySoft: 'rgba(95, 245, 210, 0.16)',
  accent: '#B99BFF',
  accentPressed: '#A874FF',
  accentInk: '#241243',
  accentSoft: 'rgba(185, 155, 255, 0.16)',
  border: 'rgba(255, 255, 255, 0.14)',
  borderStrong: 'rgba(255, 255, 255, 0.26)',
  danger: '#FF9FB0',
  dangerSoft: 'rgba(255, 99, 129, 0.16)',
  warning: '#FFD37A',
  warningSoft: 'rgba(255, 195, 90, 0.16)',
} as const;

export const GRADIENTS = {
  background: ['#0A0A1A', '#170F35', '#1C1142'] as const,
  summary: ['#1E4A44', '#332A56'] as const,
  primaryButton: ['#5FF5D2', '#33DCB6'] as const,
} as const;

export const FONTS = {
  // SpaceGrotesk_600SemiBold is deliberately unused — see src/fonts.ts.
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Shared type scale. Every custom-font style carries an explicit lineHeight —
 * without one, the web fonts' cap-height clips against RN's auto line box.
 * SpaceGrotesk in particular has unusually tall cap-height metrics, so
 * display styles use a generous ~1.5x ratio (plain 1.3x still clipped caps
 * on Android). Use these presets directly (or spread + override) instead of
 * one-off fontFamily/fontSize pairs, so headings stay consistent everywhere.
 */
export const TEXT = {
  eyebrow: {
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    color: COLORS.accent,
  },
  h1: {
    fontFamily: FONTS.display,
    fontSize: 21,
    lineHeight: 32,
    color: COLORS.ink,
  },
  h2: {
    // SpaceGrotesk_600SemiBold has a broken glyph outline for several
    // capitals (B, L, D, N) that gets clipped on Android regardless of
    // line-height — use the 700 weight everywhere instead, it's clean.
    fontFamily: FONTS.display,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.ink,
  },
  h3: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.ink,
  },
  stat: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 50,
    color: COLORS.ink,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  bodyStrong: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.ink,
  },
  caption: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
  },
  link: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.accent,
  },
} as const;
