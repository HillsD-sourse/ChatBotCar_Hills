# Car Detailing Bot

Telegram-бот для генерации изображений салона автомобиля "до/после" детейлинга с использованием AI.

## Функционал

- Загрузка 3-10 фото салона (JPG/PNG, до 10 МБ)
- Выбор услуг: химчистка, чистка кожи, озонирование, полировка пластика, чистка ковриков, защитные составы
- Генерация 2-3 вариантов результата на каждое фото
- Очередь задач с уведомлениями о готовности
- История запросов в личном кабинете

## Стек

- TypeScript, Node.js, Express
- PostgreSQL, Prisma ORM
- MinIO (S3-совместимое хранилище)
- Telegraf (Telegram Bot API)
- Stable Diffusion / ComfyUI (AI-инференс через Docker)
- Docker, Docker Compose

## Требования

- Node.js 18+
- Docker Desktop
- Git

## Установка

```bash
git clone <repository-url>
cd CarDet
npm install


## Настройка 
- создайте файл .env
BOT_TOKEN=<токен>
DATABASE_URL="postgresql://postgres:123@localhost:5432/detailing_db?schema=public"
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_ORIGINAL=detailing-original
MINIO_BUCKET_RESULT=detailing-result
MINIO_USE_SSL=false
PORT=3000

## Запуск
docker compose up -d
npx prisma db push
npx prisma generate
npm run dev