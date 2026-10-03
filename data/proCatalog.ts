// Pro-контент: здесь только названия — для карточек с замком. Сам контент
// выдаёт ядро тем, у кого есть Pro (core/content/pro.json, GET /api/content/pro).
// Сгенерировано при разделении контента; при добавлении Pro-кейса в ядро
// добавьте сюда его карточку.

// Без названия диагноза — оно и есть ответ кейса
export const PRO_DIAG = [
  {
    "id": "d6",
    "level": 2,
    "patient": "Николай, 55 лет"
  },
  {
    "id": "d7",
    "level": 2,
    "patient": "Виктор, 48 лет"
  },
  {
    "id": "d8",
    "level": 2,
    "patient": "Никита, 14 лет"
  },
  {
    "id": "d9",
    "level": 2,
    "patient": "Сергей, 52 года"
  },
  {
    "id": "d10",
    "level": 2,
    "patient": "Ольга, 45 лет"
  },
  {
    "id": "d11",
    "level": 2,
    "patient": "Людмила, 50 лет"
  },
  {
    "id": "d12",
    "level": 2,
    "patient": "Марина, 43 года"
  },
  {
    "id": "d13",
    "level": 2,
    "patient": "Роман, 35 лет"
  },
  {
    "id": "d14",
    "level": 3,
    "patient": "Наталья, 41 год"
  },
  {
    "id": "d15",
    "level": 3,
    "patient": "Вера, 62 года"
  },
  {
    "id": "d16",
    "level": 3,
    "patient": "Мама с Мишей, 3 года"
  },
  {
    "id": "d17",
    "level": 3,
    "patient": "Константин, 44 года"
  }
];

export const PRO_COMM = [
  {
    "id": "c5",
    "name": "Алексей, 39 лет",
    "type": "VIP / доминантный",
    "goal": "Уважать время. Говорить конкретно и быстро. Показать экспертизу без лишних слов.",
    "stagesCount": 3
  },
  {
    "id": "c6",
    "name": "Соня, 7 лет (и мама)",
    "type": "Ребёнок — первый визит",
    "goal": "Создать безопасный первый опыт. Работать через игру. Тактично перехватить инициативу у мамы.",
    "stagesCount": 3
  },
  {
    "id": "c7",
    "name": "Павел, 33 года",
    "type": "Недоверчивый / «второе мнение»",
    "goal": "Объяснить логику каждого решения. Стать союзником, а не авторитетом.",
    "stagesCount": 3
  },
  {
    "id": "c8",
    "name": "Татьяна, 45 лет",
    "type": "Пассивный / безразличный",
    "goal": "Получить осознанное информированное согласие. Активно вовлечь пациента. Задокументировать решение.",
    "stagesCount": 3
  }
];

export const PRO_CONSULT = [
  {
    "id": "orthopedics",
    "title": "Ортопедия",
    "icon": "diamond-outline",
    "color": "#2E7D32",
    "bg": "#E8F5E9",
    "scriptsCount": 3
  },
  {
    "id": "surgery",
    "title": "Хирургия",
    "icon": "cut-outline",
    "color": "#993C1D",
    "bg": "#FAECE7",
    "scriptsCount": 4
  },
  {
    "id": "ortho",
    "title": "Ортодонтия",
    "icon": "git-branch-outline",
    "color": "#F57F17",
    "bg": "#FFF8E1",
    "scriptsCount": 6
  }
];

export const PRO_PROCEDURES = [
  {
    "icon": "◈",
    "name": "Дентальная имплантация",
    "stepsCount": 7
  },
  {
    "icon": "◍",
    "name": "Синуслифтинг",
    "stepsCount": 6
  },
  {
    "icon": "◌",
    "name": "Пластика мягких тканей (рецессия)",
    "stepsCount": 7
  },
  {
    "icon": "◇",
    "name": "Виниры",
    "stepsCount": 6
  },
  {
    "icon": "▣",
    "name": "Искусственные коронки",
    "stepsCount": 5
  },
  {
    "icon": "◫",
    "name": "Съёмное протезирование",
    "stepsCount": 6
  },
  {
    "icon": "◎",
    "name": "Брекет-система",
    "stepsCount": 6
  },
  {
    "icon": "◌",
    "name": "Элайнеры",
    "stepsCount": 5
  },
  {
    "icon": "◯",
    "name": "Съёмные пластинки",
    "stepsCount": 4
  },
  {
    "icon": "◉",
    "name": "Мини-винты (ТАД)",
    "stepsCount": 5
  },
  {
    "icon": "◑",
    "name": "Пластика уздечки",
    "stepsCount": 5
  },
  {
    "icon": "◐",
    "name": "Ретейнеры",
    "stepsCount": 5
  }
];

/** ИИ-Пациенты без Pro (с остальными разговор открывает Pro). Тот же список — в core/src/content.ts. */
export const FREE_PATIENT_IDS = ['anx', 'rat'];
