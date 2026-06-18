import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import * as Minio from 'minio';
import dotenv from 'dotenv';
import axios from 'axios';
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

// Хранилище состояния пользователей
interface UserSession {
  photos: Array<{
    fileId: string;
    fileName: string;
    fileSize: number;
  }>;
  selectedOptions: string[];
  requestId?: number;
}

const userSessions = new Map<number, UserSession>();

// Доступные услуги детейлинга
const DETAILING_OPTIONS = [
  { id: 'cleaning', text: 'Химчистка обивки' },
  { id: 'leather', text: 'Чистка кожи / кондиционирование' },
  { id: 'ozone', text: 'Удаление запахов (озонирование)' },
  { id: 'plastic', text: 'Полировка пластиковых панелей' },
  { id: 'mats', text: 'Чистка ковриков' },
  { id: 'protection', text: 'Обработка защитными составами' },
];

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

// Функция для получения или создания сессии пользователя
function getSession(userId: number): UserSession {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      photos: [],
      selectedOptions: [],
    });
  }
  return userSessions.get(userId)!;
}

// Функция для сброса сессии
function resetSession(userId: number) {
  userSessions.delete(userId);
}

// Функция для загрузки фото в МинИО
async function uploadPhotoToMinio(
  fileId: string,
  userId: number,
  requestId: number,
  photoIndex: number
): Promise<string> {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  
  const fileName = `user_${userId}/request_${requestId}/photo_${photoIndex}.jpg`;
  const bucketName = process.env.MINIO_BUCKET_ORIGINAL || 'detailing-original';
  
  await minioClient.putObject(bucketName, fileName, buffer, buffer.length, {
    'Content-Type': 'image/jpeg',
  });
  
  return fileName;
}

// Функция для показа меню выбора услуг
function showOptionsMenu(ctx: any) {
  const session = getSession(ctx.from.id);
  
  const keyboard = DETAILING_OPTIONS.map(option => {
    const isSelected = session.selectedOptions.includes(option.id);
    const icon = isSelected ? '[x]' : '[ ]';
    return [Markup.button.callback(`${icon} ${option.text}`, `toggle_${option.id}`)];
  });
  
  keyboard.push([
    Markup.button.callback('Сгенерировать', 'generate'),
    Markup.button.callback('Отмена', 'cancel'),
  ]);
  
  return Markup.inlineKeyboard(keyboard);
}

// Bot Логика

bot.start(async (ctx) => {
  resetSession(ctx.from.id);
  
  await ctx.reply(
    'Привет!\n\n' +
    'Я помогу вам увидеть, как будет выглядеть салон вашего автомобиля после детейлинга.\n\n' +
    'Отправьте мне от 3 до 10 фотографий салона (разные ракурсы: сиденья, панель, коврики, потолок).\n\n' +
    'Требования к фото:\n' +
    '- Формат: JPG или PNG\n' +
    '- Размер: до 10 МБ каждое\n' +
    '- Количество: от 3 до 10 штук\n\n' +
    'Когда загрузите все фото, я предложу выбрать услуги детейлинга.'
  );
});

//  команда /cancel
bot.command('cancel', async (ctx) => {
  resetSession(ctx.from.id);
  await ctx.reply('Загрузка отменена. Отправьте /start, чтобы начать заново.');
});

//  команда /status
bot.command('status', async (ctx) => {
  const session = getSession(ctx.from.id);
  const photosCount = session.photos.length;
  const optionsCount = session.selectedOptions.length;
  
  await ctx.reply(
    `Текущий статус:\n\n` +
    `Загружено фото: ${photosCount}/10 (минимум 3)\n` +
    `Выбрано услуг: ${optionsCount}\n\n` +
    `${photosCount < 3 ? 'Продолжайте загружать фото...' : 'Можно переходить к выбору услуг!'}`
  );
});

// Обработка фото
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const session = getSession(userId);
  

  if (session.requestId) {
    await ctx.reply('Вы уже завершили загрузку фото. Используйте /start для нового запроса.');
    return;
  }
  
  // Получаем самое большое фото
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  // Проверка на undefined
  if (!photo.file_size) {
    await ctx.reply('Ошибка: не удалось получить размер фото.');
    return;
  }
  
  // Проверка размера (10 МБ = 10 * 1024 * 1024 байт)
  const maxSize = 10 * 1024 * 1024;
  if (photo.file_size > maxSize) {
    await ctx.reply('Фото слишком большое. Максимальный размер: 10 МБ.');
    return;
  }
  
  // Проверка количества фото
  if (session.photos.length >= 10) {
    await ctx.reply('Вы уже загрузили максимальное количество фото (10 штук).');
    return;
  }
  
  // Добавляем фото в сессию
  session.photos.push({
    fileId: photo.file_id,
    fileName: `photo_${session.photos.length + 1}.jpg`,
    fileSize: photo.file_size,
  });
  
  const currentCount = session.photos.length;
  
  if (currentCount < 3) {
    await ctx.reply(
      `Фото ${currentCount} загружено!\n\n` +
      `Загрузите еще ${3 - currentCount} фото (минимум 3).`
    );
  } else if (currentCount < 10) {
    await ctx.reply(
      `Фото ${currentCount} загружено!\n\n` +
      `Загрузите еще фото или нажмите "Выбрать услуги", когда будете готовы.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Выбрать услуги', 'show_options')],
        [Markup.button.callback('Отмена', 'cancel')],
      ])
    );
  } else {
    await ctx.reply(
      `Все 10 фото загружены!\n\n` +
      `Теперь выберите услуги детейлинга:`,
      showOptionsMenu(ctx)
    );
  }
});

// Обработка callback-кнопок
bot.on('callback_query', async (ctx) => {
  // Проверка на наличие data
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.callbackQuery.data) {
    return;
  }
  
  const userId = ctx.from.id;
  const session = getSession(userId);
  const data = ctx.callbackQuery.data;
  
  // Показать меню опций
  if (data === 'show_options') {
    if (session.photos.length < 3) {
      await ctx.answerCbQuery('Загрузите минимум 3 фото');
      return;
    }
    await ctx.editMessageText('Выберите услуги детейлинга:', showOptionsMenu(ctx));
  }
  
  // Переключение опции
  if (data.startsWith('toggle_')) {
    const optionId = data.replace('toggle_', '');
    const index = session.selectedOptions.indexOf(optionId);
    
    if (index === -1) {
      session.selectedOptions.push(optionId);
    } else {
      session.selectedOptions.splice(index, 1);
    }
    
    await ctx.editMessageText('Выберите услуги детейлинга:', showOptionsMenu(ctx));
    await ctx.answerCbQuery();
  }
  
  // Генерация
  if (data === 'generate') {
    if (session.photos.length < 3) {
      await ctx.answerCbQuery('Загрузите минимум 3 фото');
      return;
    }
    
    if (session.selectedOptions.length === 0) {
      await ctx.answerCbQuery('Выберите хотя бы одну услугу');
      return;
    }
    
    await ctx.answerCbQuery('Начинаю обработку...');
    await ctx.editMessageText('Обрабатываю ваш запрос...\n\nЭто может занять несколько минут.');
    
    try {
      // Создаем пользователя в БД
      let user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId: BigInt(userId),
            username: ctx.from.username || null,
          },
        });
      }
      
      const request = await prisma.request.create({
        data: {
          userId: user.id,
          status: 'PENDING',
          options: session.selectedOptions,
        },
      });
      
      // Загружаем фото в MinIO
      for (let i = 0; i < session.photos.length; i++) {
        const photo = session.photos[i];
        const originalUrl = await uploadPhotoToMinio(photo.fileId, userId, request.id, i + 1);
        
        await prisma.image.create({
          data: {
            requestId: request.id,
            originalUrl: originalUrl,
          },
        });
      }
      
      session.requestId = request.id;
      
      await ctx.editMessageText(
        `Запрос создан!\n\n` +
        `Фото: ${session.photos.length} шт.\n` +
        `Услуги: ${session.selectedOptions.length} шт.\n\n` +
        `Ваш запрос в очереди на обработку.\n` +
        `Я уведомлю вас, когда результат будет готов.\n\n` +
        `ID запроса: #${request.id}`
      );
      
      // Здесь будет вызов AI (Шаг 3)
      console.log(`Создан запрос #${request.id} для пользователя ${userId}`);
      
    } catch (error) {
      console.error('Ошибка при создании запроса:', error);
      await ctx.editMessageText('Произошла ошибка при обработке запроса. Попробуйте позже.');
    }
  }
  
  // Отмена
  if (data === 'cancel') {
    resetSession(userId);
    await ctx.editMessageText('Операция отменена. Отправьте /start, чтобы начать заново.');
  }
});

// Запуск
async function bootstrap() {
  console.log('Ожидание готовности сервисов...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    await initBuckets();
    console.log('MinIO готов');
  } catch (error) {
    console.error('Ошибка подключения к MinIO:', error);
  }
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  
  bot.launch(() => console.log('Telegram bot started'));
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

bootstrap();