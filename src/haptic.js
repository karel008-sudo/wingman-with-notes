// Safe wrapper — works on Android, gracefully fails on iOS Safari
export const haptic = {
  light:   () => navigator.vibrate?.(8),
  medium:  () => navigator.vibrate?.(20),
  success: () => navigator.vibrate?.([10, 60, 20]),
  pr:      () => navigator.vibrate?.([20, 60, 20, 60, 40]),
  warning: () => navigator.vibrate?.([30, 80, 30]),
}
