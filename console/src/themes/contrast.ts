import presets from './presets.json';
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}
export type ThemeOverrides = Partial<Record<'light' | 'dark', Record<string, string>>>;
export function checkThemeContrast(overrides: ThemeOverrides) {
  for (const [mode, preset] of Object.entries(presets)) {
    const colors: Record<string, string> = { ...preset, ...overrides[mode as 'light' | 'dark'] };
    for (const foreground of ['text', 'muted', 'primary', 'danger', 'warning', 'info', 'success']) {
      for (const surface of ['background', 'surface', 'elevated']) {
        if (contrast(colors[foreground], colors[surface]) < 4.5)
          throw new Error(`Contraste insuficiente: ${foreground}/${surface} no tema ${mode}.`);
      }
    }
    if (contrast(colors['primary-foreground'], colors['primary-action']) < 4.5)
      throw new Error(`Contraste insuficiente no botão primário do tema ${mode}.`);
    if (contrast(colors['control-border'], colors.surface) < 3)
      throw new Error(`Contraste insuficiente nos campos do tema ${mode}.`);
  }
}
