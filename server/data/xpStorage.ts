import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'denvise_stats_v2';
const DIAG_KEY = 'denvise_diag_done';

export type Stats = {
  xp: number;
  diagCases: number;
  commScenarios: number;
  exams: number;
  lastUpdated: number;
  streak: number;
  lastActivityDate: string;
};

const DEFAULT: Stats = {
  xp: 0,
  diagCases: 0,
  commScenarios: 0,
  exams: 0,
  lastUpdated: Date.now(),
  streak: 0,
  lastActivityDate: '',
};

export async function getStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function calcStreak(current: Stats): number {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  if (current.lastActivityDate === today) return current.streak;
  if (current.lastActivityDate === yesterday) return current.streak + 1;
  return 1;
}

export async function addXP(
  amount: number,
  type: 'diag' | 'comm' | 'exam'
): Promise<Stats> {
  try {
    const current = await getStats();
    const newStreak = calcStreak(current);
    const updated: Stats = {
      xp: current.xp + amount,
      diagCases: type === 'diag' ? current.diagCases + 1 : current.diagCases,
      commScenarios: type === 'comm' ? current.commScenarios + 1 : current.commScenarios,
      exams: type === 'exam' ? current.exams + 1 : current.exams,
      lastUpdated: Date.now(),
      streak: newStreak,
      lastActivityDate: getTodayString(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT;
  }
}

export async function resetStats(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(DIAG_KEY);
}

export async function getDiagDone(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DIAG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function markDiagDone(caseId: string): Promise<string[]> {
  try {
    const current = await getDiagDone();
    if (current.includes(caseId)) return current;
    const updated = [...current, caseId];
    await AsyncStorage.setItem(DIAG_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function resetDiagDone(): Promise<void> {
  await AsyncStorage.removeItem(DIAG_KEY);
}