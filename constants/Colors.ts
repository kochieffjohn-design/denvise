// constants/Colors.ts — Denvise Design Language v1.0

export const C = {
  // ── Фон и поверхности ──
  bg: '#EEF2F7',
  card: '#FFFFFF',
  sunk: '#F6F8FB',
  border: '#E3E8EF',

  // ── Хедер (тёмно-синий) ──
  navyBase: '#1A2340',
  navyDeep: '#141A30',
  navyGlow: 'rgba(59,130,246,0.32)', // accent 32%
  cardOnDark: '#232E52',

  // ── Нейтральная шкала (текст и линии) ──
  n900: '#1A2340',
  n700: '#3C4661',
  n500: '#64708A',
  n400: '#8B96AC',
  n300: '#C3CAD7',
  n200: '#E3E8EF',
  n100: '#EEF2F7',
  n50:  '#F6F8FB',

  // ── Алиасы для совместимости со старым кодом ──
  white: '#FFFFFF',
  dark: '#1A2340',
  text: '#1A2340',
  text2: '#3C4661',
  muted: '#64708A',
  light: '#EAF1FE', // primary-50

  // ── Акцент Primary ──
  primary50: '#EAF1FE',
  primary500: '#3B82F6',
  primary600: '#2563EB',
  primary: '#3B82F6',
  accent: '#3B82F6',

  // ── Семантика ──
  success: '#16A06B',
  danger: '#D9534A',
  warn: '#E0A53A',

  // ── Радиусы скругления ──
  radiusXs: 8,
  radiusSm: 10,
  radiusMd: 14,   // кнопки
  radiusLg: 20,   // карточки
  radiusXl: 28,   // шторки
  radiusPill: 999,
};

// ── Специальности — единое цветовое семейство (OKLCH L≈0.62 C≈0.13) ──
export const SPECIALTY = {
  therapy: {
    label: 'Терапия',
    labelEn: 'Therapy',
    solid: '#3A6FD8',
    tint: '#ECF1FB',
  },
  surgery: {
    label: 'Хирургия',
    labelEn: 'Surgery',
    solid: '#C2683F',
    tint: '#F9EFE9',
  },
  prosthetics: {
    label: 'Ортопедия',
    labelEn: 'Prosthetics',
    solid: '#2E9C78',
    tint: '#E8F6F0',
  },
  orthodontics: {
    label: 'Ортодонтия',
    labelEn: 'Orthodontics',
    solid: '#BC8F37',
    tint: '#F8F2E2',
  },
  emergency: {
    label: 'Неотложка',
    labelEn: 'Emergency',
    solid: '#7A5BD0',
    tint: '#F0ECFB',
  },
  periodontology: {
    label: 'Пародонтология',
    labelEn: 'Periodontology',
    solid: '#C0547D',
    tint: '#FBECF2',
  },
};

// ── Тени (тонированы в navy, не в чёрный) ──
// Используются как пары (контактная + рассеянная) — см. shadows.ts для готовых стилей
export const SHADOW_TOKENS = {
  e0: { // нажата
    contact: { color: '#1A2340', opacity: 0.05, h: 2, r: 6 },
  },
  e1: { // карточка (покой)
    near:  { color: '#1A2340', opacity: 0.05, h: 1, r: 2 },
    far:   { color: '#1A2340', opacity: 0.06, h: 6, r: 14 },
  },
  e2: { // активная / поднятая
    near:  { color: '#1A2340', opacity: 0.06, h: 2, r: 4 },
    far:   { color: '#1A2340', opacity: 0.11, h: 12, r: 24 },
  },
  buttonAccent: { color: '#3B82F6', opacity: 0.32, h: 8, r: 16 },
};