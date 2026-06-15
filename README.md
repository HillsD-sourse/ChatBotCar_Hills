Car Detailing Bot
Telegram-бот для визуализации результатов детейлинга салона автомобиля с использованием искусственного интеллекта.
Описание
Приложение позволяет пользователям загружать фотографии салона автомобиля и получать AI-сгенерированные изображения "до/после" обработки с учетом выбранных услуг детейлинга.
Основные возможности:
Загрузка 3-10 фотографий салона (JPG, PNG, до 10 МБ)
Выбор услуг детейлинга через интерактивное меню:
Химчистка обивки
Чистка кожи / кондиционирование
Удаление запахов (озонирование)
Полировка пластиковых панелей
Чистка ковриков
Обработка защитными составами
Генерация 2-3 вариантов результата для каждого фото
Сохранение истории запросов в личном кабинете
Асинхронная обработка с очередью задач
Технологический стек
Backend: TypeScript + Node.js + Express
Database: PostgreSQL + Prisma ORM
Storage: MinIO (S3-совместимое хранилище)
Bot Framework: Telegraf
AI/ML: Stable Diffusion / ComfyUI (через Docker-контейнер)
Containerization: Docker + Docker Compose
Установка и запуск
Предварительные требования
Node.js 18+ (LTS)
Docker Desktop
Git
Шаги установки
Клонируйте репозиторий:
bash
1 git clone <repository-url>
2 cd CarDet
Установите зависимости:
bash
1 npm install
Настройте переменные окружения:
Создайте файл .env в корне проекта:
env
"
BOT_TOKEN=your_bot_token_here


DATABASE_URL="postgresql://postgres:123@localhost:5432/detailing_db?schema=public"


MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_ORIGINAL=detailing-original
MINIO_BUCKET_RESULT=detailing-result
MINIO_USE_SSL=false


PORT=3000
"
Запустите инфраструктуру (PostgreSQL + MinIO):
bash
1 docker compose up -d
Примените миграции базы данных:
bash
1 npx prisma db push
2 npx prisma generate
Запустите приложение:
bash
1 npm run dev
Приложение будет доступно на http://localhost:3000
Использование
Найдите бота в Telegram по username
Отправьте команду /start
Загрузите от 3 до 10 фотографий салона автомобиля
Выберите нужные услуги детейлинга через интерактивное меню
Дождитесь обработки (обычно 1-2 минуты)
Получите 2-3 варианта результата для каждого фото
Команды бота:
/start - Начать работу с ботом
/history - Показать историю запросов
/help - Справка по использованию
Структура проекта
CarDet/
├── src/
│   └── index.ts          # Точка входа приложения
├── prisma/
│   └── schema.prisma     # Схема базы данных
├── docker-compose.yml    # Конфигурация Docker
├── package.json          # Зависимости проекта
├── tsconfig.json         # Конфигурация TypeScript
└── .env                  # Переменные окружения

Схема базы данных
Таблицы:
User - пользователи (telegram_id, username)
Request - запросы на обработку (статус, выбранные опции)
Image - изображения (оригинал + 3 варианта результата)
Статусы запросов:
PENDING - ожидает обработки
PROCESSING - в процессе генерации
COMPLETED - обработка завершена
FAILED - ошибка при обработке
Разработка
Сборка для продакшена:
bash
1 npm run build
2 npm start
Остановка Docker-контейнеров:
bash
1 docker compose down
Просмотр логов:
bash
1 docker compose logs -f
Примечания
AI-генерация использует ControlNet для сохранения геометрии салона
Все изображения хранятся в MinIO (S3-совместимое хранилище)
Проект не содержит Python-кода (AI работает через Docker-контейнер с API)
