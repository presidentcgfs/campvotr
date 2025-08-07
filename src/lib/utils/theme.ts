export type Theme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validateHexColor(input: string): boolean {
  return HEX.test(input.trim());
}

export function normalizeHexColor(input: string): string {
  let c = input.trim();
  if (!c.startsWith('#')) c = `#${c}`;
  if (c.length === 4) {
    // #abc -> #aabbcc
    c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return c.toLowerCase();
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', normalizeHexColor(theme.primaryColor));
  root.style.setProperty('--color-secondary', normalizeHexColor(theme.secondaryColor));
  root.style.setProperty('--color-accent', normalizeHexColor(theme.accentColor));

  // Derive additional colors as needed for dark mode compatibility
  // Keep it simple; UI can use these variables
  root.style.setProperty('--button-bg', 'var(--color-primary)');
  root.style.setProperty('--button-text', '#ffffff');
  root.style.setProperty('--link-color', 'var(--color-primary)');
}

