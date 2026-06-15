import express from 'express';
import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// Инициализация MinIO клиента
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

// Функция для создания бакетов при старте
async function initBuckets() {
  const buckets = [
    process.env.MINIO_BUCKET_ORIGINAL || 'detailing-original',
    process.env.MINIO_BUCKET_RESULT || 'detailing-result'
  ];
  for (const bucket of buckets) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, 'us-east-1');
      console.log(`Бакет ${bucket} создан`);
    }
  }
}

// Telegram Bot Логика
bot.start(async (ctx) => {
  await ctx.reply('Привет! 👋\n\nОтправь мне от 3 до 10 фото салона автомобиля, и я покажу, как он будет выглядеть после детейлинга!\n\nДоступные услуги:\n• Химчистка обивки\n• Чистка кожи / кондиционирование\n• Удаление запахов (озонирование)\n• Полировка пластиковых панелей\n• Чистка ковриков\n• Обработка защитными составами');
});

bot.on('photo', async (ctx) => {
  await ctx.reply('Фото получено! Сейчас я создам полноценную логику обработки... (Шаг 2 в разработке)');
});

// Запуск
async function bootstrap() {
  await initBuckets();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(` Сервер запущен, Порт: ${PORT}`));
  
  bot.launch(() => console.log('ТГ бот в работе!'));
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

bootstrap();