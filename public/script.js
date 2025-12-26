class Portfolio {
    constructor() {
        this.works = [];
        this.currentIndex = 0;
        this.token = localStorage.getItem('portfolio-token');
        this.isAdmin = !!this.token;

        this.init();
    }

    async init() {
        await this.loadWorks();
        this.setupEventListeners();
        this.renderWorks();
        this.preventImageDownload();
        this.checkAdminStatus();

        // Проверяем авторизацию при загрузке
        if (this.isAdmin) {
            await this.verifyToken();
        }
    }

    async verifyToken() {
        try {
            // Простая проверка токена
            const response = await fetch('/api/verify-token', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                this.logout();
                this.showToast('Сессия истекла, войдите снова', 'error');
            }
        } catch (error) {
            // Игнорируем ошибки проверки
        }
    }

    async loadWorks() {
        try {
            const response = await fetch('/api/works');
            if (!response.ok) throw new Error('Ошибка загрузки работ');
            this.works = await response.json();
            this.renderWorks();
        } catch (error) {
            console.error('Error loading works:', error);
            this.showToast('Ошибка загрузки работ. Проверьте подключение к серверу.', 'error');
            // Показываем пустое состояние
            this.showEmptyState();
        }
    }

    async login(password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.token;
                localStorage.setItem('portfolio-token', this.token);
                this.isAdmin = true;
                this.showToast('Успешный вход в панель администратора', 'success');
                this.checkAdminStatus();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Неверный пароль');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
            return false;
        }
    }

    logout() {
        this.token = null;
        this.isAdmin = false;
        localStorage.removeItem('portfolio-token');
        this.checkAdminStatus();
        this.showToast('Вы вышли из системы', 'success');
    }

    checkAdminStatus() {
        const adminBtn = document.getElementById('admin-toggle');
        const addWorkBtn = document.getElementById('add-work-btn');

        if (adminBtn && addWorkBtn) {
            if (this.isAdmin) {
                adminBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                adminBtn.title = 'Выйти';
                adminBtn.onclick = () => this.logout();
                addWorkBtn.style.display = 'flex';
            } else {
                adminBtn.innerHTML = '<i class="fas fa-lock"></i>';
                adminBtn.title = 'Войти';
                adminBtn.onclick = () => this.showLoginModal();
                addWorkBtn.style.display = 'none';
            }
        }
    }

    showLoginModal() {
        const password = prompt('Введите пароль администратора:');
        if (password) {
            this.login(password);
        }
    }

    showEmptyState() {
        const grid = document.getElementById('works-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.works.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
        }
    }

    renderWorks() {
        const grid = document.getElementById('works-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.works.length === 0) {
            this.showEmptyState();
            return;
        }

        emptyState.style.display = 'none';
        grid.innerHTML = '';

        this.works.forEach((work, index) => {
            const workElement = this.createWorkElement(work, index);
            grid.appendChild(workElement);
        });

        this.renderAdminWorks();
    }

    createWorkElement(work, index) {
        const div = document.createElement('div');
        div.className = 'work-item';
        div.dataset.index = index;

        // Используем thumbnail если есть, иначе основное изображение
        const imageUrl = work.thumbnail || work.image || '';

        div.innerHTML = `
            <img src="${imageUrl}" 
                 alt="${work.title}" 
                 class="work-image"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxMTEiLz48cGF0aCBkPSJNMzUgMzVIMzBWNjBINjVWNTVINzBVNjVIMzVWNzBINjVWNjVINzBWNzVIMzBWMzVINzVWNDBINzBWMzVINjVWNDBIMzVWNTBINDBWNDVIMzVWNTBINDVWNDVINDBWNTBINVYzNUgxNVY0MEgxMFYzNUg1VjQ1SDEwVjQwSDE1VjQ1SDVWNTBIMjVWNDVIMjBWNTVIMjVWNTVIMjBWNjBIMjVWNTBIMzVWNTVIMzBWNjBIMjVWNTVIMjBWNjVIMzVWNjBIMzAifSBmaWxsPSIjMzMzIi8+PC9zdmc+'">
            <div class="work-info">
                <h3 class="work-title">${work.title}</h3>
                ${work.description ? `<p class="work-description">${work.description}</p>` : ''}
            </div>
        `;

        div.addEventListener('click', () => this.openModal(index));
        return div;
    }

    renderAdminWorks() {
        const container = document.getElementById('admin-works-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.works.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 1rem;">Работ пока нет</p>';
            return;
        }

        this.works.forEach((work, index) => {
            const div = document.createElement('div');
            div.className = 'admin-work-item';

            div.innerHTML = `
                <div class="admin-work-info">
                    <h5>${work.title}</h5>
                    ${work.description ? `<p>${work.description.substring(0, 50)}${work.description.length > 50 ? '...' : ''}</p>` : ''}
                    <small style="color: #666; font-size: 0.8rem;">${work.date || 'Без даты'}</small>
                </div>
                <div class="admin-work-actions">
                    <button class="action-btn edit-btn" data-index="${index}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            container.appendChild(div);
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.deleteWork(index);
            });
        });

        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.editWork(index);
            });
        });
    }

    async openModal(index) {
        this.currentIndex = index;
        await this.updateModal();

        const modal = document.getElementById('image-modal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    async updateModal() {
        const work = this.works[this.currentIndex];
        const modalImage = document.getElementById('modal-image');
        const blurBackground = document.getElementById('blur-background');
        const title = document.getElementById('image-title');
        const description = document.getElementById('image-description');

        try {
            const imageUrl = work.image;
            modalImage.src = imageUrl;
            blurBackground.style.backgroundImage = `url(${imageUrl})`;

            modalImage.style.opacity = '0';
            setTimeout(() => {
                modalImage.style.transition = 'opacity 0.5s ease';
                modalImage.style.opacity = '1';
            }, 100);
        } catch (error) {
            console.error('Error loading image for modal:', error);
        }

        title.textContent = work.title;
        description.textContent = work.description || '';
    }

    closeModal() {
        const modal = document.getElementById('image-modal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    nextWork() {
        this.currentIndex = (this.currentIndex + 1) % this.works.length;
        this.updateModal();
    }

    prevWork() {
        this.currentIndex = (this.currentIndex - 1 + this.works.length) % this.works.length;
        this.updateModal();
    }

    async addWork(workData) {
        if (!this.isAdmin) {
            this.showToast('Требуется авторизация', 'error');
            return false;
        }

        const formData = new FormData();
        formData.append('title', workData.title);
        formData.append('description', workData.description || '');
        formData.append('image', workData.image);

        try {
            const response = await fetch('/api/works', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                const newWork = await response.json();
                this.works.unshift(newWork);
                this.renderWorks();
                this.showToast('Работа успешно добавлена!', 'success');
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при добавлении работы');
            }
        } catch (error) {
            console.error('Error adding work:', error);
            this.showToast(error.message, 'error');
            return false;
        }
    }

    async deleteWork(index) {
        if (!this.isAdmin) {
            this.showToast('Требуется авторизация', 'error');
            return;
        }

        const work = this.works[index];
        if (!work) return;

        if (!confirm(`Вы уверены, что хотите удалить работу "${work.title}"?`)) return;

        try {
            const response = await fetch(`/api/works/${work.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.works.splice(index, 1);
                this.renderWorks();
                this.showToast('Работа удалена', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при удалении работы');
            }
        } catch (error) {
            console.error('Error deleting work:', error);
            this.showToast(error.message, 'error');
        }
    }

    editWork(index) {
        const work = this.works[index];
        if (!work) return;

        document.getElementById('work-title').value = work.title;
        document.getElementById('work-description').value = work.description || '';

        const form = document.getElementById('add-work-form');
        form.dataset.editIndex = index;
        form.dataset.editId = work.id;

        document.querySelector('.admin-header h3').innerHTML = '<i class="fas fa-edit"></i> Редактировать работу';
        document.getElementById('submit-btn').innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';

        document.querySelector('.form-group:nth-child(3)').style.display = 'none';

        document.getElementById('admin-panel').classList.add('active');

        this.showToast('Редактирование работы', 'success');
    }

    async updateWork(index, workData) {
        if (!this.isAdmin) {
            this.showToast('Требуется авторизация', 'error');
            return;
        }

        const work = this.works[index];
        if (!work) return;

        try {
            const response = await fetch(`/api/works/${work.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: workData.title,
                    description: workData.description || ''
                })
            });

            if (response.ok) {
                const updatedWork = await response.json();
                this.works[index] = updatedWork;
                this.renderWorks();
                this.showToast('Работа обновлена!', 'success');
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при обновлении работы');
            }
        } catch (error) {
            console.error('Error updating work:', error);
            this.showToast(error.message, 'error');
            return false;
        }
    }

    setupEventListeners() {
        // Открытие админ-панели
        const addWorkBtn = document.getElementById('add-work-btn');
        if (addWorkBtn) {
            addWorkBtn.addEventListener('click', () => {
                this.resetForm();
                document.getElementById('admin-panel').classList.add('active');
            });
        }

        const adminToggle = document.getElementById('admin-toggle');
        if (adminToggle) {
            adminToggle.addEventListener('click', () => {
                if (this.isAdmin) {
                    this.logout();
                } else {
                    this.showLoginModal();
                }
            });
        }

        // Закрытие админ-панели
        const closeAdmin = document.getElementById('close-admin');
        if (closeAdmin) {
            closeAdmin.addEventListener('click', () => {
                this.closeAdminPanel();
            });
        }

        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeAdminPanel();
            });
        }

        // Модальное окно
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => this.closeModal());
        }

        // Навигация в модальном окне
        const nextArea = document.getElementById('next-area');
        if (nextArea) {
            nextArea.addEventListener('click', () => this.nextWork());
        }

        const prevArea = document.getElementById('prev-area');
        if (prevArea) {
            prevArea.addEventListener('click', () => this.prevWork());
        }

        // Клавиатура
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('image-modal')?.classList.contains('active')) return;

            switch (e.key) {
                case 'ArrowRight':
                    this.nextWork();
                    break;
                case 'ArrowLeft':
                    this.prevWork();
                    break;
                case 'Escape':
                    this.closeModal();
                    break;
            }
        });

        // Загрузка файлов
        const fileInput = document.getElementById('work-image');
        const fileInfo = document.getElementById('file-info');
        const filePreview = document.getElementById('file-preview');
        const browseBtn = document.querySelector('.browse-btn');

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Проверяем размер файла
                const maxSize = 50 * 1024 * 1024; // 50MB
                if (file.size > maxSize) {
                    this.showToast('Файл слишком большой. Максимальный размер: 50MB', 'error');
                    fileInput.value = '';
                    return;
                }

                // Проверяем тип файла
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
                if (!allowedTypes.includes(file.type)) {
                    this.showToast('Разрешены только изображения (JPG, PNG, GIF, WebP, BMP, TIFF)', 'error');
                    fileInput.value = '';
                    return;
                }

                fileInfo.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

                // Показываем превью
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (filePreview) {
                        filePreview.innerHTML = `<img src="${e.target.result}" alt="Превью">`;
                        filePreview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        // Форма добавления/редактирования работы
        const form = document.getElementById('add-work-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const title = document.getElementById('work-title')?.value.trim();
                const description = document.getElementById('work-description')?.value.trim();
                const imageInput = document.getElementById('work-image');

                if (!title) {
                    this.showToast('Введите название работы', 'error');
                    return;
                }

                const isEditing = !!form.dataset.editIndex;

                if (!isEditing && (!imageInput || !imageInput.files.length)) {
                    this.showToast('Выберите изображение', 'error');
                    return;
                }

                // Показываем индикатор загрузки
                const submitBtn = document.getElementById('submit-btn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
                submitBtn.disabled = true;

                try {
                    if (isEditing) {
                        // Редактирование существующей работы
                        const index = parseInt(form.dataset.editIndex);
                        const updateData = { title, description };

                        // Если загружено новое изображение
                        if (imageInput && imageInput.files.length) {
                            updateData.image = imageInput.files[0];
                        }

                        await this.updateWork(index, updateData);
                        this.closeAdminPanel();
                    } else {
                        // Добавление новой работы
                        const file = imageInput.files[0];

                        const success = await this.addWork({
                            title,
                            description,
                            image: file
                        });

                        if (success) {
                            this.closeAdminPanel();
                            form.reset();
                            if (filePreview) {
                                filePreview.style.display = 'none';
                            }
                            if (fileInfo) {
                                fileInfo.textContent = 'Выберите файл...';
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error saving work:', error);
                    // Сообщение об ошибке уже показано в методах addWork/updateWork
                } finally {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            });
        }

        // Drag & Drop для загрузки файлов
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const dropArea = document.querySelector('.file-upload');
        if (!dropArea) return;

        const fileInput = document.getElementById('work-image');
        const fileInfo = document.getElementById('file-info');
        const filePreview = document.getElementById('file-preview');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            dropArea.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            dropArea.style.borderColor = '#666';
        }

        function unhighlight() {
            dropArea.style.backgroundColor = '';
            dropArea.style.borderColor = '#333';
        }

        dropArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length) {
                // Создаем событие change для input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(files[0]);
                fileInput.files = dataTransfer.files;

                // Триггерим событие change
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        }
    }

    resetForm() {
        const form = document.getElementById('add-work-form');
        if (!form) return;

        form.reset();
        delete form.dataset.editIndex;
        delete form.dataset.editId;

        const adminHeader = document.querySelector('.admin-header h3');
        const submitBtn = document.getElementById('submit-btn');
        const filePreview = document.getElementById('file-preview');
        const fileInfo = document.getElementById('file-info');
        const imageField = document.querySelector('.form-group:nth-child(3)');

        if (adminHeader) {
            adminHeader.innerHTML = '<i class="fas fa-plus"></i> Добавить работу';
        }

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Загрузить работу';
            submitBtn.disabled = false;
        }

        if (imageField) {
            imageField.style.display = 'block';
        }

        if (filePreview) {
            filePreview.style.display = 'none';
        }

        if (fileInfo) {
            fileInfo.textContent = 'Выберите файл...';
        }
    }

    closeAdminPanel() {
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            adminPanel.classList.remove('active');
        }
        this.resetForm();
    }

    preventImageDownload() {
        // Запрет контекстного меню на изображениях
        document.addEventListener('contextmenu', (e) => {
            if (e.target.tagName === 'IMG' || e.target.classList.contains('work-item')) {
                e.preventDefault();
                this.showToast('Загрузка изображений отключена', 'error');
                return false;
            }
        });

        // Запрет перетаскивания
        document.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });

        // Запрет выделения
        document.addEventListener('selectstart', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                return false;
            }
        });

        // Защита от копирования через Ctrl+C
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                if (e.target.tagName === 'IMG') {
                    e.preventDefault();
                    return false;
                }
            }
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Вспомогательные методы для работы с изображениями
    async processImageForUpload(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Создаем превью
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Максимальный размер превью
                    const maxSize = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Рисуем с высоким качеством
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Получаем Data URL для превью
                    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    resolve({
                        original: file,
                        preview: previewDataUrl,
                        width: img.width,
                        height: img.height
                    });
                };

                img.onerror = () => {
                    reject(new Error('Ошибка загрузки изображения'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };

            reader.readAsDataURL(file);
        });
    }

    // Метод для получения защищенного изображения
    getProtectedImageUrl(imagePath) {
        if (!this.isAdmin) {
            // Для обычных пользователей используем обычный URL
            return imagePath;
        }

        // Для администратора можно использовать защищенный endpoint
        if (imagePath.includes('/uploads/')) {
            const filename = imagePath.split('/uploads/')[1];
            return `/api/protect-image/${filename}?token=${this.token}`;
        }

        return imagePath;
    }

    // Метод для проверки состояния сервера
    async checkServerStatus() {
        try {
            const response = await fetch('/api/health', {
                method: 'HEAD',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Метод для очистки кэша
    clearCache() {
        localStorage.removeItem('portfolio-cache');
        this.showToast('Кэш очищен', 'success');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.portfolio = new Portfolio();

    // Глобальные хоткеи для отладки (только в development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D для сброса в демо-режим
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                localStorage.clear();
                window.location.reload();
            }

            // Ctrl+Shift+L для логина
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                const password = prompt('Введите пароль для входа:');
                if (password) {
                    window.portfolio.login(password);
                }
            }
        });
    }

    // Отслеживаем изменения в сети
    window.addEventListener('online', () => {
        window.portfolio.showToast('Соединение восстановлено', 'success');
        window.portfolio.loadWorks();
    });

    window.addEventListener('offline', () => {
        window.portfolio.showToast('Потеряно соединение с интернетом', 'error');
    });
});

// Полифил для async/await в старых браузерах
if (typeof Promise === 'undefined' || typeof Object.assign === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.polyfill.io/v3/polyfill.min.js?features=default,es2015,es2016,es2017';
    document.head.appendChild(script);
}