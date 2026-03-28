/**
 * OnCallAfterHours Design Tokens
 *
 * Mirror of CSS custom properties in globals.css.
 * Use these when you need token values in TypeScript (charts, dynamic styles).
 * For normal styling, use Tailwind utility classes.
 *
 * HSL values are "H S% L%" strings — wrap with hsl() in JS:
 *   `hsl(${tokens.colors.primary})`
 */

export const tokens = {
  colors: {
    primary: "0 72% 51%",
    primaryForeground: "0 0% 100%",

    secondary: "220 14% 96%",
    secondaryForeground: "220 20% 20%",

    background: "30 25% 98%",
    foreground: "220 20% 14%",

    muted: "220 14% 96%",
    mutedForeground: "220 9% 46%",

    accent: "0 72% 96%",
    accentForeground: "0 72% 38%",

    destructive: "0 84% 60%",
    destructiveForeground: "0 0% 100%",

    card: "0 0% 100%",
    cardForeground: "220 20% 14%",

    border: "220 13% 91%",
    input: "220 13% 91%",
    ring: "0 72% 51%",
  },

  radius: "0.5rem",

  fontFamily: {
    sans: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
} as const;

/**
 * Pre-computed hex values for chart libraries that don't accept HSL.
 * These are the resolved values of the HSL tokens above.
 */
export const chartColors = {
  primary: "#dc2626",
  primaryLight: "#fce4e4",
  muted: "#6b7280",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  foreground: "#1e293b",
  border: "#e2e8f0",
} as const;

export type ThemeTokens = typeof tokens;
