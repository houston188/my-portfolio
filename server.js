// server/server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Автоматическое определение порта для Railway
const PORT = process.env.PORT || 3000;

// Безопасный SECRET_KEY (Railway предоставляет или используем дефолтный)
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

// Пароль администратора - ОБЯЗАТЕЛЬНО измени в Railway Dashboard!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Настройка CORS для Railway
const allowedOrigins = [
    'https://*.railway.app',
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, из мобильных приложений)
        if (!origin) return callback(null, true);

        if (allowedOrigins.some(allowedOrigin => {
            return origin === allowedOrigin ||
                origin.match(new RegExp(`^${allowedOrigin.replace('*.', '.*\\.')}$`));
        })) {
            return callback(null, true);
        }

        console.log(`CORS блокирован для origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Папки для статических файлов
const uploadsDir = '/app/uploads';
sed - i "54s|path.join(__dirname, 'thumbnails')|'/app/thumbnails'|" server.js

// Создаем папки если их нет
[uploadsDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Создана папка: ${dir}`);
    }
});

// Обслуживаем статические файлы
app.use('/uploads', express.static(uploadsDir));
app.use('/thumbnails', express.static(thumbnailsDir));
app.use(express.static(path.join(__dirname, './public')));

// Настройка Multer для Railway (в памяти для ephemeral storage)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|tiff/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения (JPG, PNG, GIF, WebP, BMP, TIFF)'));
        }
    }
});

// Путь к файлу с работами
const worksFilePath = path.join(__dirname, 'works.json');

// Инициализация works.json если его нет
if (!fs.existsSync(worksFilePath)) {
    fs.writeFileSync(worksFilePath, JSON.stringify([]), 'utf8');
    console.log('Создан файл works.json');
}

// Middleware аутентификации
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        req.user = user;
        next();
    });
};

// === API ЭНДПОИНТЫ ===

// 1. Проверка здоровья (для Railway)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'portfolio-api',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        railway: process.env.RAILWAY_ENVIRONMENT ? 'true' : 'false'
    });
});

// 2. Логин администратора
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Пароль обязателен' });
    }

    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign(
            { userId: 'admin', role: 'admin' },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            message: 'Успешная авторизация',
            expiresIn: '7d',
            user: { role: 'admin' }
        });
    } else {
        res.status(401).json({ error: 'Неверный пароль' });
    }
});

// 3. Проверка токена
app.get('/api/verify-token', authenticate, (req, res) => {
    res.json({
        valid: true,
        user: req.user,
        expiresIn: '7d'
    });
});

// 4. Получение всех работ (публичный)
app.get('/api/works', (req, res) => {
    try {
        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);

        // Добавляем полные URL для изображений
        const worksWithFullUrls = works.map(work => ({
            ...work,
            image: work.image.startsWith('http') ? work.image :
                `${req.protocol}://${req.get('host')}${work.image}`,
            thumbnail: work.thumbnail ?
                (work.thumbnail.startsWith('http') ? work.thumbnail :
                    `${req.protocol}://${req.get('host')}${work.thumbnail}`) : null
        }));

        res.json(worksWithFullUrls);
    } catch (error) {
        console.error('Ошибка чтения works.json:', error);
        res.status(500).json({ error: 'Ошибка загрузки работ' });
    }
});

// 5. Добавление новой работы (только админ)
app.post('/api/works', authenticate, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Изображение обязательно' });
        }

        const { title, description } = req.body;

        if (!title || title.trim() === '') {
            // Удаляем загруженный файл
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Название работы обязательно' });
        }

        // Читаем существующие работы
        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);

        // Создаем новую работу
        const newWork = {
            id: `work_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            title: title.trim(),
            description: (description || '').trim(),
            image: `/uploads/${req.file.filename}`,
            thumbnail: `/uploads/${req.file.filename}`, // В production здесь должно быть создание миниатюр
            date: new Date().toLocaleDateString('ru-RU'),
            createdAt: new Date().toISOString(),
            fileSize: req.file.size,
            fileType: req.file.mimetype
        };

        // Добавляем в начало массива
        works.unshift(newWork);

        // Сохраняем обратно
        fs.writeFileSync(worksFilePath, JSON.stringify(works, null, 2), 'utf8');

        // Добавляем полный URL для ответа
        const responseWork = {
            ...newWork,
            image: `${req.protocol}://${req.get('host')}${newWork.image}`,
            thumbnail: `${req.protocol}://${req.get('host')}${newWork.thumbnail}`
        };

        res.status(201).json(responseWork);

    } catch (error) {
        console.error('Ошибка добавления работы:', error);

        // Удаляем файл в случае ошибки
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Ошибка при добавлении работы',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 6. Обновление работы (только админ)
app.put('/api/works/:id', authenticate, (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Название работы обязательно' });
        }

        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);
        const workIndex = works.findIndex(w => w.id === id);

        if (workIndex === -1) {
            return res.status(404).json({ error: 'Работа не найдена' });
        }

        works[workIndex] = {
            ...works[workIndex],
            title: title.trim(),
            description: (description || '').trim(),
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(worksFilePath, JSON.stringify(works, null, 2), 'utf8');

        res.json(works[workIndex]);

    } catch (error) {
        console.error('Ошибка обновления работы:', error);
        res.status(500).json({ error: 'Ошибка при обновлении работы' });
    }
});

// 7. Удаление работы (только админ)
app.delete('/api/works/:id', authenticate, (req, res) => {
    try {
        const { id } = req.params;

        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);
        const workIndex = works.findIndex(w => w.id === id);

        if (workIndex === -1) {
            return res.status(404).json({ error: 'Работа не найдена' });
        }

        const work = works[workIndex];

        // Удаляем файлы изображений
        if (work.image) {
            const imagePath = path.join(uploadsDir, path.basename(work.image));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Удаляем из массива
        works.splice(workIndex, 1);
        fs.writeFileSync(worksFilePath, JSON.stringify(works, null, 2), 'utf8');

        res.json({
            success: true,
            message: 'Работа удалена',
            deletedId: id
        });

    } catch (error) {
        console.error('Ошибка удаления работы:', error);
        res.status(500).json({ error: 'Ошибка при удалении работы' });
    }
});

// 8. Статистика (только админ)
app.get('/api/stats', authenticate, (req, res) => {
    try {
        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);

        // Считаем общий размер файлов
        let totalSize = 0;
        const uploadsFiles = fs.readdirSync(uploadsDir);
        uploadsFiles.forEach(file => {
            const stat = fs.statSync(path.join(uploadsDir, file));
            totalSize += stat.size;
        });

        res.json({
            totalWorks: works.length,
            totalSize: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            lastWork: works[0] ? works[0].title : 'Нет работ'
        });

    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// 9. Резервное копирование (только админ)
app.get('/api/backup', authenticate, (req, res) => {
    try {
        const data = fs.readFileSync(worksFilePath, 'utf8');
        const works = JSON.parse(data);

        const backup = {
            timestamp: new Date().toISOString(),
            count: works.length,
            works: works
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio-backup.json');
        res.json(backup);

    } catch (error) {
        console.error('Ошибка создания бэкапа:', error);
        res.status(500).json({ error: 'Ошибка создания резервной копии' });
    }
});

// Обслуживание SPA - все остальные маршруты ведут на index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 50MB' });
        }
        return res.status(400).json({ error: 'Ошибка загрузки файла' });
    }

    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Портфолио запущено!
    📍 Порт: ${PORT}
    🌐 Локальный URL: http://localhost:${PORT}
    🔐 Пароль администратора: ${ADMIN_PASSWORD}
    ⚠️  ВНИМАНИЕ: Измените пароль в Railway Dashboard!
    
    📊 Статус API: http://localhost:${PORT}/api/health
    📁 Загруженные файлы: ${uploadsDir}
    💾 Данные работ: ${worksFilePath}
    `);

    // Предупреждение если используется дефолтный пароль
    if (ADMIN_PASSWORD === 'admin123') {
        console.warn('\n⚠️  ⚠️  ⚠️  ВНИМАНИЕ БЕЗОПАСНОСТИ! ⚠️  ⚠️  ⚠️');
        console.warn('Вы используете дефолтный пароль администратора!');
        console.warn('Пожалуйста, установите SECRET_KEY и ADMIN_PASSWORD в Railway Dashboard');
    }
});