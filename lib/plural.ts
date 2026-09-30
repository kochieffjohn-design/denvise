/**
 * Русское склонение по числу: plural(4, ['кейс', 'кейса', 'кейсов']) → '4 кейса'.
 * Формы: для 1, для 2–4, для 5–20 (и 11–14 в любом разряде).
 */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${form}`;
}

type Forms = [string, string, string];
export const CASE_FORMS: Forms = ['кейс', 'кейса', 'кейсов'];
export const PSYCHOTYPE_FORMS: Forms = ['психотип', 'психотипа', 'психотипов'];
export const SCRIPT_FORMS: Forms = ['скрипт', 'скрипта', 'скриптов'];
export const PROTOCOL_FORMS: Forms = ['протокол', 'протокола', 'протоколов'];
export const DIRECTION_FORMS: Forms = ['направление', 'направления', 'направлений'];
export const SCENARIO_FORMS: Forms = ['сценарий', 'сценария', 'сценариев'];
export const STATION_FORMS: Forms = ['станция', 'станции', 'станций'];
export const CONDITION_FORMS: Forms = ['состояние', 'состояния', 'состояний'];
