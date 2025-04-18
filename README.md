# Google Meet Subtitle Extractor

Это расширение для браузера, которое извлекает субтитры из Google Meet и выводит их в консоль браузера в удобном формате.

## Функциональность

- Извлекает субтитры из Google Meet в реальном времени
- Выводит только текст субтитров без лишней информации
- Разделяет субтитры на фразы, при этом не разделяет продолжающуюся речь одного человека
- Работает автоматически при открытии Google Meet

## Установка

1. Скачайте или клонируйте этот репозиторий
2. Откройте Chrome и перейдите на страницу `chrome://extensions/`
3. Включите "Режим разработчика" (переключатель в правом верхнем углу)
4. Нажмите на кнопку "Загрузить распакованное расширение"
5. Выберите папку с расширением

## Использование

1. Присоединитесь к встрече в Google Meet
2. Включите субтитры в Google Meet (кнопка "CC" в нижней части экрана)
3. Откройте консоль разработчика (F12 или правый клик -> Inspect -> Console)
4. Наблюдайте за субтитрами, которые будут отображаться в консоли

## Примечания

- Расширение работает только на странице meet.google.com
- Для корректной работы необходимо включить субтитры в самом Google Meet
- Если структура DOM Google Meet изменится, может потребоваться обновление селекторов в content.js
