/**
 * Semantic design tokens synced from the sibling Expanse Tracker web artifact.
 * Light palette: warm cream/navy. Dark palette: deep navy/gold.
 * radius = 12 (0.75rem from --radius: .75rem)
 */

const colors = {
  light: {
    text: '#1a2c3d',
    tint: '#243a50',

    background: '#f5f0e8',
    foreground: '#1a2c3d',

    card: '#faf8f4',
    cardForeground: '#1a2c3d',

    primary: '#243a50',
    primaryForeground: '#faf8f4',

    secondary: '#e5dfd1',
    secondaryForeground: '#1a2c3d',

    muted: '#e7e1d3',
    mutedForeground: '#697785',

    accent: '#f5c442',
    accentForeground: '#1a2c3d',

    destructive: '#d43a22',
    destructiveForeground: '#faf8f4',

    border: '#dbd5c8',
    input: '#dbd5c8',
  },

  dark: {
    text: '#f2ede4',
    tint: '#f5c442',

    background: '#0d1e2c',
    foreground: '#f2ede4',

    card: '#172534',
    cardForeground: '#f2ede4',

    primary: '#f5c442',
    primaryForeground: '#1a2c3d',

    secondary: '#27394a',
    secondaryForeground: '#f2ede4',

    muted: '#27394a',
    mutedForeground: '#9ea9b4',

    accent: '#f5c442',
    accentForeground: '#1a2c3d',

    destructive: '#e0533d',
    destructiveForeground: '#f2ede4',

    border: '#35495a',
    input: '#35495a',
  },

  radius: 12,
};

export default colors;
