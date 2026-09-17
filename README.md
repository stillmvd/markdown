<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo/lockup-on-dark.svg">
    <img src="brand/logo/lockup.svg" alt="Markdown" height="64">
  </picture>
</p>

# MARKDOWN

Нативное десктопное приложение для просмотра и редактирования Markdown файлов на Windows. Построено на Tauri 2 + React 19.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078d4)
![License](https://img.shields.io/badge/license-MIT-green)

## Возможности

### Просмотр Markdown

- Рендеринг с полной поддержкой **GitHub Flavored Markdown** (GFM): таблицы, зачёркивания, чек-листы, автоссылки
- **Подсветка синтаксиса** кода в блоках (140+ языков через highlight.js)
- **Сворачиваемые секции** — заголовки работают как аккордеон, можно сворачивать/разворачивать разделы
- Поддержка HTML внутри Markdown (rehype-raw)
- Внешние ссылки открываются в системном браузере

### Редактирование

- Полнофункциональный редактор на базе **CodeMirror 6** с подсветкой Markdown-синтаксиса
- **Контекстное меню** по правому клику на выделенном тексте:
  - Форматирование: жирный, курсив, зачёркнутый, инлайн-код
  - Вставка: ссылка, цитата, список, нумерованный список
  - Заголовки H1–H6 (подменю)
  - Блок кода с выбором языка из списка
- Тема редактора синхронизирована с темой приложения (One Dark / Light)
- Переключение просмотр/редактирование: `Ctrl+E`

### Файловые операции

- **Открытие** файлов `.md` / `.markdown` через диалог (`Ctrl+O`)
- **Сохранение** с автоопределением пути (`Ctrl+S`), Save As для новых файлов
- **Создание** нового файла
- **Drag & Drop** — перетащите `.md` файл в окно приложения
- **Ассоциация файлов** — `.md` и `.markdown` файлы можно открывать двойным кликом
- **Single Instance** — повторный запуск с файлом откроет его в уже запущенном экземпляре

### Боковая панель папок

- Кнопка **"Открыть папку"** в тулбаре для выбора рабочей директории
- Рекурсивное дерево `.md` файлов с раскрываемыми папками
- Подсветка текущего открытого файла
- Скрытые файлы/папки (начинающиеся с `.`) игнорируются
- Папки без `.md` файлов не отображаются
- Выбранная папка сохраняется между сессиями

### Оглавление (Table of Contents)

- Автоматическая генерация из заголовков документа
- Навигация по клику с плавной прокруткой к заголовку
- Иерархический отступ по уровню заголовка (H1–H6)

### Поиск

- **Поиск по документу** с подсчётом совпадений
- Навигация вперёд/назад по результатам (`Enter` / `Shift+Enter`)
- Закрытие по `Escape`

### Статусная строка

- Количество слов, символов, строк
- Расчётное время чтения (мин)
- Индикатор несохранённых изменений
- Полный путь к файлу

### Недавние файлы

- **Экран приветствия** с кнопкой открытия и списком последних 10 файлов
- Быстрый доступ к недавним файлам одним кликом
- Список сохраняется между сессиями

### Темы

- **Тёмная** и **светлая** тема с переключением в один клик
- Заголовок окна Windows (titlebar) синхронизирован с темой
- Тема сохраняется между сессиями
- Кастомные стили для скроллбара под каждую тему

### Экспорт

- **Печать / PDF** через системный диалог печати (`window.print`)

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+O` | Открыть файл |
| `Ctrl+S` | Сохранить |
| `Ctrl+E` | Переключить просмотр/редактирование |

## Технологический стек

| Слой | Технология |
|------|-----------|
| Runtime | [Tauri 2](https://tauri.app/) |
| Backend | Rust |
| Frontend | [React 19](https://react.dev/) + TypeScript 5.8 |
| Сборка | [Vite 7](https://vite.dev/) |
| Стили | [Tailwind CSS 3](https://tailwindcss.com/) |
| Редактор | [CodeMirror 6](https://codemirror.net/) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm + rehype-highlight + rehype-slug + rehype-raw |
| Хранилище | tauri-plugin-store |
| Диалоги | tauri-plugin-dialog |

## Структура проекта

```
src/
  App.tsx                     # Главный компонент, состояние приложения
  App.css                     # Стили: markdown-body, toolbar, скроллбары
  components/
    Toolbar.tsx               # Панель инструментов с условными кнопками
    Editor.tsx                # CodeMirror редактор
    Viewer.tsx                # Markdown рендерер со сворачиваемыми секциями
    FolderSidebar.tsx         # Дерево .md файлов папки
    TableOfContents.tsx       # Боковая панель оглавления
    StatusBar.tsx             # Статистика документа
    SearchBar.tsx             # Поиск по документу
    WelcomeScreen.tsx         # Экран приветствия с недавними файлами
    ContextMenu.tsx           # Контекстное меню форматирования
    CodeLanguagePicker.tsx    # Выбор языка для блока кода
    DragDropOverlay.tsx       # Оверлей при перетаскивании файла
  hooks/
    useFile.ts                # Логика открытия/сохранения/создания файлов
    useTheme.ts               # Тема + синхронизация titlebar
    useRecentFiles.ts         # Список недавних файлов
    useKeyboard.ts            # Глобальные горячие клавиши
  lib/
    markdown-utils.ts         # Парсинг заголовков, разделение на секции
    statistics.ts             # Подсчёт слов, символов, строк, времени чтения
    codemirror-setup.ts       # Расширения CodeMirror
  types/
    index.ts                  # ViewMode, Theme, RecentFile, FileEntry, и др.

src-tauri/
  src/lib.rs                  # Rust: read_file, write_file, list_md_files
  tauri.conf.json             # Конфигурация Tauri
  capabilities/default.json   # Разрешения плагинов
```

## Установка и запуск

### Требования

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) >= 1.77
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Разработка

```bash
npm install
npm run tauri dev
```

### Сборка

```bash
npm run tauri build
```

Результат: `src-tauri/target/release/markdown-viewer.exe` + NSIS-инсталлятор в `src-tauri/target/release/bundle/nsis/`.
