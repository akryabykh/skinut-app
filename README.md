# Скинуться

Мобильное веб-приложение для расчета совместных расходов.

## Что уже есть

- Участники проекта.
- Расходы с плательщиком и списком участников.
- Автоматический расчет итоговых переводов.
- Сохранение прогресса в браузере через `localStorage`.
- Шаринг расчета через ссылку с данными, если Supabase не подключен.
- Облачное сохранение через Supabase, если настроен `config.js`.
- PWA manifest и service worker.

## Запуск локально

```bash
python3 -m http.server 8000
```

После запуска открыть:

```text
http://127.0.0.1:8000
```

## Публикация в облако

### Вариант 1: GitHub Pages

1. Создать пустой репозиторий на GitHub.
2. Добавить remote:

```bash
git remote add origin https://github.com/USER/REPO.git
```

3. Отправить код:

```bash
git push -u origin main
```

4. В GitHub открыть `Settings -> Pages`.
5. В `Build and deployment` выбрать:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Сайт будет доступен по адресу:

```text
https://USER.github.io/REPO/
```

### Вариант 2: Vercel

1. Импортировать GitHub-репозиторий в Vercel.
2. Framework Preset: `Other`.
3. Build Command: пусто.
4. Output Directory: пусто или `./`.
5. После деплоя Vercel выдаст публичный URL.

## Подключение Supabase

1. Создать проект в Supabase.
2. Открыть `SQL Editor`.
3. Выполнить SQL из файла `supabase/schema.sql`.
4. Скопировать `config.example.js` в `config.js`.
5. Вставить в `config.js` значения:

```js
window.SPLIT_APP_CONFIG = {
  supabaseUrl: "https://your-project-ref.supabase.co",
  supabaseAnonKey: "your-anon-public-key"
};
```

После этого приложение будет сохранять проект в Supabase и делиться ссылкой вида:

```text
http://127.0.0.1:8000/?project=abc123
```

Для MVP таблица открыта на чтение и запись по публичной ссылке. Это нормально для простого шаринга без логина, но позже стоит добавить права доступа, владельцев проектов или секрет редактирования.

Если приложение открывается локально с телефона по IP компьютера, можно временно добавить:

```js
publicBaseUrl: "http://10.168.1.66:8001/"
```

В облачном деплое это поле обычно не нужно: ссылка будет строиться от реального домена.

## Следующий шаг

Создать Supabase-проект, вставить ключи в `config.js`, проверить сохранение с двух устройств.
