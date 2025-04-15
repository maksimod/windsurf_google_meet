/**
 * Google Meet Subtitle Extractor
 * 
 * Это расширение извлекает и отображает субтитры Google Meet в консоли с
 * интеллектуальным разделением на фразы.
 */

// Конфигурация
const DEBUG_MODE = false;           // Выключить режим отладки
const BASE_PHRASE_TIME_THRESHOLD = 2; // Базовый порог времени в секундах для определения новой фразы
const MIN_DIFF_LENGTH = 3;          // Минимальная длина изменения для обработки
const COMPACT_SEPARATOR = true;     // Компактный разделитель между фразами

// База данных для хранения субтитров
const subtitleDB = {
  fullText: "",            // Полный текст субтитров
  lastUpdateTime: 0,       // Время последнего обновления
  currentPhrase: "",       // Текущая фраза, накапливаемая для вывода
  phraseHistory: [],       // История фраз для отладки
  lastPhraseStart: 0,      // Время начала текущей фразы
  wordBuffer: "",          // Буфер для обработки частичных слов
  avgWordsPerSecond: 0,    // Средняя скорость речи
  totalWords: 0,           // Общее количество слов для статистики
  totalTime: 0             // Общее время для статистики
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
 * Находит различия между двумя текстами с учетом границ слов
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
    let diff = newText.slice(commonPrefixLength);
    
    // Проверяем, не разрезали ли мы слово
    if (commonPrefixLength > 0 && 
        oldText.charAt(commonPrefixLength - 1).match(/[a-zа-яё]/i) && 
        diff.charAt(0).match(/[a-zа-яё\.]/i)) {
      
      // Находим начало слова в старом тексте
      let wordStart = commonPrefixLength - 1;
      while (wordStart > 0 && oldText.charAt(wordStart - 1).match(/[a-zа-яё]/i)) {
        wordStart--;
      }
      
      // Ищем конец слова в новом тексте
      let wordEnd = 0;
      while (wordEnd < diff.length && diff.charAt(wordEnd).match(/[a-zа-яё\.]/i)) {
        wordEnd++;
      }
      
      // Берем полное слово из нового текста вместо частичного
      const fullWord = newText.substring(wordStart, commonPrefixLength + wordEnd);
      const wordInOldText = oldText.substring(wordStart, commonPrefixLength);
      
      // Если слово изменилось, заменяем его полностью
      if (fullWord !== wordInOldText && fullWord.includes(wordInOldText)) {
        return " " + fullWord;
      }
    }
    
    return diff;
  }
  
  // Если не нашли общего начала, это может быть полная замена
  return newText;
}

/**
 * Очищает повторяющиеся фрагменты текста и объединяет частичные слова
 * @param {string} text - Текст для очистки
 * @returns {string} - Очищенный текст
 */
function cleanDuplicates(text) {
  // Обработка частичных слов
  if (text.match(/^\W*[a-zа-яё]/i) && 
      subtitleDB.currentPhrase.length > 0 && 
      subtitleDB.currentPhrase.slice(-1).match(/[a-zа-яё]/i)) {
    
    // Находим конец последнего слова в текущей фразе
    let lastWordEnd = subtitleDB.currentPhrase.length;
    let lastWordStart = lastWordEnd - 1;
    
    while (lastWordStart >= 0 && 
           subtitleDB.currentPhrase.charAt(lastWordStart).match(/[a-zа-яё]/i)) {
      lastWordStart--;
    }
    
    lastWordStart++; // Корректировка до начала слова
    
    const lastWord = subtitleDB.currentPhrase.substring(lastWordStart);
    
    // Находим начало первого слова в новом тексте
    let firstWordEnd = 0;
    while (firstWordEnd < text.length && 
           (text.charAt(firstWordEnd).match(/[a-zа-яё\.]/i) || 
            text.charAt(firstWordEnd) === '.')) {
      firstWordEnd++;
    }
    
    const firstWord = text.substring(0, firstWordEnd);
    
    // Если это продолжение слова, объединяем
    if (firstWord.match(/^[a-zа-яё\.]+$/i) && 
        (lastWord + firstWord).match(/[a-zа-яё]+\.[a-zа-яё]+/i)) {
      
      // Добавляем индикатор для последующей замены
      subtitleDB.wordBuffer = lastWord + firstWord;
      text = text.substring(firstWordEnd);
      
      // Удаляем точку внутри слова
      subtitleDB.wordBuffer = subtitleDB.wordBuffer.replace(/([a-zа-яё])\.([a-zа-яё])/gi, "$1$2");
    }
  }

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
 * Корректирует текст фразы, исправляя распространенные артефакты
 * @param {string} text - Текст для коррекции
 * @returns {string} - Скорректированный текст
 */
function correctPhrase(text) {
  return text
    // Убираем точки внутри слов
    .replace(/([a-zа-яё])\.([a-zа-яё])/gi, "$1$2")
    // Дополнительная очистка точек внутри слов в более широком контексте
    .replace(/(\b[a-zа-яё]+)\.([a-zа-яё]+\b)/gi, "$1$2")
    // Добавляем пробелы после знаков препинания
    .replace(/([,.!?;:])([a-zа-яё0-9])/gi, "$1 $2")
    // Исправляем лишние пробелы перед знаками препинания
    .replace(/\s+([,.!?;:])/g, "$1")
    // Исправляем случаи "точка-пробел-точка"
    .replace(/\.\s\./g, ".")
    // Убираем множественные пробелы
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Проверяет, является ли текст завершенным предложением
 * @param {string} text - Текст для проверки
 * @returns {boolean} - true, если предложение завершено
 */
function isSentenceComplete(text) {
  // Текст заканчивается на один из знаков конца предложения с пробелом или в конце строки
  return /([.!?]\s|[.!?]$)/.test(text);
}

/**
 * Вычисляет динамический порог времени на основе скорости речи
 * @returns {number} - Динамический порог в секундах
 */
function getDynamicTimeThreshold() {
  // Если история фраз еще небольшая, используем базовый порог
  if (subtitleDB.phraseHistory.length < 3) {
    return BASE_PHRASE_TIME_THRESHOLD;
  }
  
  // Вычисляем среднюю длину фраз
  const recentPhrases = subtitleDB.phraseHistory.slice(-5);
  const avgPhraseLength = recentPhrases.reduce((sum, p) => 
    sum + (p.text.split(/\s+/).length), 0) / recentPhrases.length;
  
  // Если данных о скорости речи недостаточно, используем приближение на основе длины
  if (subtitleDB.avgWordsPerSecond <= 0) {
    // Короткие фразы - больший порог, длинные фразы - меньший порог
    return Math.min(3, Math.max(2, 15 / avgPhraseLength)); // Минимум 2 секунды
  }
  
  // Используем статистику скорости речи для расчета порога
  // Быстрая речь - меньший порог, медленная речь - больший порог
  const wordsPerSecondThreshold = 3; // Средняя скорость речи ~3 слова в секунду
  
  let dynamicThreshold = BASE_PHRASE_TIME_THRESHOLD * 
    (wordsPerSecondThreshold / subtitleDB.avgWordsPerSecond);
  
  // Ограничиваем значения разумными пределами
  return Math.min(4, Math.max(2, dynamicThreshold)); // Минимум 2 секунды
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
  subtitleDB.wordBuffer = "";
  subtitleDB.avgWordsPerSecond = 0;
  subtitleDB.totalWords = 0;
  subtitleDB.totalTime = 0;
  
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
  
  // Очищаем потенциальные дубликаты и обрабатываем частичные слова
  const cleanedDiff = cleanDuplicates(diffText);
  
  // Если разница пустая или только пробелы, пропускаем это обновление
  if (!cleanedDiff.trim() && !subtitleDB.wordBuffer) return;
  
  // Получаем динамический порог времени
  const phraseTimeThreshold = getDynamicTimeThreshold();
  
  debugLog(`Обнаружено изменение через ${deltaTime.toFixed(2)}с: '${cleanedDiff}' (порог: ${phraseTimeThreshold.toFixed(2)}с)`, 
           deltaTime < phraseTimeThreshold ? "success" : "warning");
  
  // Определяем, является ли это продолжением или новой фразой
  // Используем ТОЛЬКО временной порог для определения новой фразы
  const isNewPhrase = deltaTime >= phraseTimeThreshold;
  
  if (!isNewPhrase) {
    // Продолжаем текущую фразу
    if (subtitleDB.currentPhrase) {
      // Если у нас есть буфер слова, заменяем последнее слово в текущей фразе
      if (subtitleDB.wordBuffer) {
        // Находим конец последнего слова в текущей фразе
        let lastWordEnd = subtitleDB.currentPhrase.length;
        let lastWordStart = lastWordEnd - 1;
        
        while (lastWordStart >= 0 && 
               subtitleDB.currentPhrase.charAt(lastWordStart).match(/[a-zа-яё]/i)) {
          lastWordStart--;
        }
        
        lastWordStart++; // Корректировка до начала слова
        
        // Заменяем последнее слово
        subtitleDB.currentPhrase = subtitleDB.currentPhrase.substring(0, lastWordStart) + 
                                   subtitleDB.wordBuffer;
        
        subtitleDB.wordBuffer = ""; // Очищаем буфер
      }
      
      // Избегаем дублирования контента при добавлении
      if (cleanedDiff.trim()) {
        // Проверяем на дублирование последних слов
        const lastWords = subtitleDB.currentPhrase.split(/\s+/).slice(-3).join(' ');
        const newWords = cleanedDiff.trim();
        
        // Если новый контент не дублирует конец текущей фразы
        if (!lastWords.endsWith(newWords) && !newWords.startsWith(lastWords)) {
          subtitleDB.currentPhrase += " " + newWords;
        } else {
          // В случае частичного перекрытия, находим наиболее полную версию
          const mergedText = mergeOverlappingTexts(lastWords, newWords);
          subtitleDB.currentPhrase = subtitleDB.currentPhrase.substring(0, 
            subtitleDB.currentPhrase.length - lastWords.length) + mergedText;
        }
      }
      
      // Применяем коррекцию текста
      subtitleDB.currentPhrase = correctPhrase(subtitleDB.currentPhrase);
      
      // Выводим ТОЛЬКО текущую фразу, не весь текст
      console.log(subtitleDB.currentPhrase);
    } else {
      // Если текущей фразы нет, начинаем новую
      subtitleDB.currentPhrase = correctPhrase(cleanedDiff);
      subtitleDB.lastPhraseStart = updateTime;
      
      // Выводим разделитель для новых фраз
      if (COMPACT_SEPARATOR) {
        console.log('▃▃▃ НОВАЯ ФРАЗА ▃▃▃');
      } else {
        console.log('');
        console.log('%c▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ НОВАЯ ФРАЗА ▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃', 'color: red; font-weight: bold; font-size: 16px; background-color: yellow;');
        console.log('');
      }
      console.log(subtitleDB.currentPhrase);
    }
  } else {
    // Обнаружен временной разрыв - это новая фраза
    
    // Если есть текущая фраза, финализируем её и сохраняем в историю
    if (subtitleDB.currentPhrase) {
      // Финальная коррекция текста
      const finalPhrase = correctPhrase(subtitleDB.currentPhrase);
      
      // Обновляем статистику для расчета скорости речи
      const phraseDuration = (subtitleDB.lastUpdateTime - subtitleDB.lastPhraseStart) / 1000;
      const wordCount = finalPhrase.split(/\s+/).length;
      
      subtitleDB.totalWords += wordCount;
      subtitleDB.totalTime += phraseDuration;
      
      if (subtitleDB.totalTime > 0) {
        subtitleDB.avgWordsPerSecond = subtitleDB.totalWords / subtitleDB.totalTime;
      }
      
      // Сохраняем фразу в историю
      subtitleDB.phraseHistory.push({
        text: finalPhrase,
        startTime: subtitleDB.lastPhraseStart,
        endTime: subtitleDB.lastUpdateTime,
        wordCount: wordCount,
        duration: phraseDuration
      });
      
      // Ограничиваем размер истории
      if (subtitleDB.phraseHistory.length > 50) {
        subtitleDB.phraseHistory.shift();
      }
    }
    
    // Начинаем новую фразу
    subtitleDB.currentPhrase = correctPhrase(cleanedDiff);
    subtitleDB.lastPhraseStart = updateTime;
    subtitleDB.wordBuffer = ""; // Сбрасываем буфер слова
    
    // Выводим разделитель для новых фраз
    if (COMPACT_SEPARATOR) {
      console.log('▃▃▃ НОВАЯ ФРАЗА ▃▃▃');
    } else {
      console.log('');
      console.log('%c▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ НОВАЯ ФРАЗА ▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃', 'color: red; font-weight: bold; font-size: 16px; background-color: yellow;');
      console.log('');
    }
    console.log(subtitleDB.currentPhrase);
  }
  
  // Обновляем состояние
  subtitleDB.fullText = currentText;
  subtitleDB.lastUpdateTime = updateTime;
}

/**
 * Объединяет перекрывающиеся тексты, устраняя дублирование
 * @param {string} oldText - Существующий текст
 * @param {string} newText - Новый текст
 * @returns {string} - Объединенный текст без дублирования
 */
function mergeOverlappingTexts(oldText, newText) {
  // Если один из текстов пустой, возвращаем другой
  if (!oldText) return newText;
  if (!newText) return oldText;
  
  // Ищем максимальное перекрытие
  let maxOverlap = 0;
  for (let i = 1; i <= Math.min(oldText.length, newText.length); i++) {
    if (oldText.endsWith(newText.substring(0, i))) {
      maxOverlap = i;
    }
  }
  
  // Если найдено перекрытие, объединяем тексты
  if (maxOverlap > 0) {
    return oldText + newText.substring(maxOverlap);
  }
  
  // Если нет перекрытия, просто добавляем пробел между
  return oldText + " " + newText;
}

// Инициализация расширения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
