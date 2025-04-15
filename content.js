/**
 * Google Meet Subtitle Extractor
 * 
 * Это расширение извлекает и отображает субтитры Google Meet в консоли с
 * интеллектуальным разделением на фразы.
 */

// Конфигурация
const DEBUG_MODE = true;            // Включить режим отладки
const PHRASE_TIME_THRESHOLD = 2;    // Порог времени в секундах для определения новой фразы
const MIN_DIFF_LENGTH = 3;          // Минимальная длина изменения для обработки

// База данных для хранения субтитров
const subtitleDB = {
  fullText: "",            // Полный текст субтитров
  lastUpdateTime: 0,       // Время последнего обновления
  currentPhrase: "",       // Текущая фраза, накапливаемая для вывода
  phraseHistory: [],       // История фраз для отладки
  lastPhraseStart: 0       // Время начала текущей фразы
};

/**
 * Функция вывода отладочной информации
 */
function debugLog(message, type = 'info') {
  if (!DEBUG_MODE) return;
  
  let style = 'font-weight: bold;';
  
  switch (type) {
    case 'error':
      style += 'color: red;';
      break;
    case 'warning':
      style += 'color: orange;';
      break;
    case 'success':
      style += 'color: green;';
      break;
    case 'info':
    default:
      style += 'color: blue;';
      break;
  }
  
  console.log(`%c[DEBUG] ${message}`, style);
}

/**
 * Находит различия между двумя текстами
 * @param {string} oldText - Старый текст
 * @param {string} newText - Новый текст
 * @returns {string} - Текст, добавленный в новой версии
 */
function findTextDiff(oldText, newText) {
  if (!oldText) return newText;
  
  // Пытаемся найти точное добавление в конец
  if (newText.startsWith(oldText)) {
    return newText.slice(oldText.length);
  }
  
  // Более сложная ситуация - ищем наибольшее общее начало
  let commonPrefixLength = 0;
  const minLength = Math.min(oldText.length, newText.length);
  
  for (let i = 0; i < minLength; i++) {
    if (oldText[i] === newText[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }
  
  // Если нашли общее начало, возвращаем разницу
  if (commonPrefixLength > 0) {
    return newText.slice(commonPrefixLength);
  }
  
  // Если не нашли общего начала, это может быть полная замена
  return newText;
}

/**
 * Очищает повторяющиеся фрагменты текста
 * @param {string} text - Текст для очистки
 * @returns {string} - Очищенный текст
 */
function cleanDuplicates(text) {
  // Простая очистка для небольших фрагментов
  const words = text.split(/\s+/);
  if (words.length <= 3) return text;
  
  // Проверяем повторяющиеся 3-словные последовательности
  const cleaned = [];
  for (let i = 0; i < words.length; i++) {
    if (i + 3 <= words.length) {
      const chunk = words.slice(i, i + 3).join(' ');
      const remaining = words.slice(i + 3).join(' ');
      
      if (remaining.includes(chunk)) {
        // Пропускаем этот фрагмент, так как он повторяется дальше
        i += 2;
        continue;
      }
    }
    
    cleaned.push(words[i]);
  }
  
  return cleaned.join(' ');
}

/**
 * Инициализация обнаружения субтитров
 */
function init() {
  // Сбрасываем базу данных
  subtitleDB.fullText = "";
  subtitleDB.lastUpdateTime = Date.now();
  subtitleDB.currentPhrase = "";
  subtitleDB.phraseHistory = [];
  subtitleDB.lastPhraseStart = Date.now();
  
  debugLog('Обнаружение субтитров инициализировано - АКТИВИРОВАН РЕЖИМ ИНТЕЛЛЕКТУАЛЬНОГО РАЗДЕЛЕНИЯ ФРАЗ', 'success');
  
  // Настраиваем наблюдатель для обнаружения изменений в DOM
  const observer = new MutationObserver(findSubtitles);
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Ищем субтитры периодически
  setInterval(findSubtitles, 300);
}

/**
 * Находит элементы с субтитрами на странице
 */
function findSubtitles() {
  // Список возможных селекторов для элементов субтитров Google Meet
  const selectors = [
    '[jsname="tgaKEf"]',             // Основной селектор
    '.VIpgJd-yAWNEb-VIpgJd-fmcmS',   // Альтернативный селектор
    '.CNusmb',                       // Еще один альтернативный
    '.a4cQT',                        // Дополнительный селектор
    '.TBMuR',                        // Еще один возможный селектор
    '[jscontroller="QEg9te"]'        // Селектор на основе контроллера
  ];
  
  // Перебираем селекторы, пока не найдем субтитры
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Обрабатываем каждый найденный элемент с субтитрами
      for (const element of elements) {
        if (element && element.textContent) {
          const text = element.textContent.trim();
          if (text) {
            processSubtitle(text);
          }
        }
      }
      return; // Останавливаемся после обработки элементов
    }
  }
}

/**
 * Обработка обновления текста субтитров
 * @param {string} currentText - Текущий полный текст субтитров
 */
function processSubtitle(currentText) {
  // Пропускаем, если текст идентичен последнему
  if (currentText === subtitleDB.fullText) return;
  
  // Текущее время
  const updateTime = Date.now();
  
  // Вычисляем время с момента последнего обновления (в секундах)
  const deltaTime = (updateTime - subtitleDB.lastUpdateTime) / 1000;
  
  // Определяем разницу в тексте
  const diffText = findTextDiff(subtitleDB.fullText, currentText);
  
  // Очищаем потенциальные дубликаты
  const cleanedDiff = cleanDuplicates(diffText);
  
  // Если разница пустая или только пробелы, пропускаем это обновление
  if (!cleanedDiff.trim()) return;
  
  debugLog(`Обнаружено изменение через ${deltaTime.toFixed(2)}с: '${cleanedDiff}'`, 
           deltaTime < PHRASE_TIME_THRESHOLD ? "success" : "warning");
  
  // Определяем, является ли это продолжением или новой фразой
  if (deltaTime < PHRASE_TIME_THRESHOLD) {
    // Продолжаем текущую фразу
    if (subtitleDB.currentPhrase) {
      // Добавляем новый контент к текущей фразе
      subtitleDB.currentPhrase += cleanedDiff;
      
      // Выводим ТОЛЬКО текущую фразу, не весь текст
      console.log(subtitleDB.currentPhrase);
    } else {
      // Если текущей фразы нет, начинаем новую
      subtitleDB.currentPhrase = cleanedDiff;
      subtitleDB.lastPhraseStart = updateTime;
      
      // Выводим разделитель для новых фраз
      console.log('');
      console.log('%c▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ НОВАЯ ФРАЗА ▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃', 'color: red; font-weight: bold; font-size: 16px; background-color: yellow;');
      console.log('');
      console.log(subtitleDB.currentPhrase);
    }
  } else {
    // Обнаружен временной разрыв - это новая фраза
    
    // Если есть текущая фраза, сохраняем её в историю
    if (subtitleDB.currentPhrase) {
      subtitleDB.phraseHistory.push({
        text: subtitleDB.currentPhrase,
        startTime: subtitleDB.lastPhraseStart,
        endTime: subtitleDB.lastUpdateTime
      });
    }
    
    // Начинаем новую фразу
    subtitleDB.currentPhrase = cleanedDiff;
    subtitleDB.lastPhraseStart = updateTime;
    
    // Выводим разделитель для новых фраз
    console.log('');
    console.log('%c▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ НОВАЯ ФРАЗА ▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃', 'color: red; font-weight: bold; font-size: 16px; background-color: yellow;');
    console.log('');
    console.log(subtitleDB.currentPhrase);
  }
  
  // Обновляем состояние
  subtitleDB.fullText = currentText;
  subtitleDB.lastUpdateTime = updateTime;
}

// Инициализация расширения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
