class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('portfolio-token');
        this.isAuthenticated = false;

        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        if (this.isAuthenticated) {
            await this.loadWorks();
        }
    }

    async checkAuth() {
        if (!this.token) {
            this.showLogin();
            return;
        }

        try {
            const response = await fetch('/api/verify-token', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.isAuthenticated = true;
                this.showDashboard();
            } else {
                this.showLogin();
            }
        } catch (error) {
            this.showLogin();
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
                this.isAuthenticated = true;
                this.showDashboard();
                await this.loadWorks();
                this.showToast('Успешный вход', 'success');
                return true;
            } else {
                throw new Error('Неверный пароль');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
            return false;
        }
    }

    logout() {
        localStorage.removeItem('portfolio-token');
        this.isAuthenticated = false;
        this.showLogin();
        this.showToast('Вы вышли из системы', 'success');
    }

    showLogin() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    }

    async loadWorks() {
        try {
            const response = await fetch('/api/works');
            if (!response.ok) throw new Error('Ошибка загрузки');
            const works = await response.json();
            this.renderWorks(works);
        } catch (error) {
            console.error('Error loading works:', error);
            this.showToast('Ошибка загрузки работ', 'error');
        }
    }

    renderWorks(works) {
        const container = document.getElementById('admin-works-grid');
        if (!container) return;

        container.innerHTML = '';

        if (works.length === 0) {
            container.innerHTML = '<div class="empty-works"><p>Работ пока нет</p></div>';
            return;
        }

        works.forEach((work, index) => {
            const workElement = this.createWorkElement(work, index);
            container.appendChild(workElement);
        });
    }

    createWorkElement(work, index) {
        const div = document.createElement('div');
        div.className = 'admin-work-card';

        div.innerHTML = `
            <div class="work-card-image">
                <img src="${work.thumbnail || work.image}" alt="${work.title}" loading="lazy">
            </div>
            <div class="work-card-info">
                <h3>${work.title}</h3>
                ${work.description ? `<p>${work.description.substring(0, 100)}${work.description.length > 100 ? '...' : ''}</p>` : ''}
                <div class="work-card-meta">
                    <span>${work.date || 'Без даты'}</span>
                    <span>ID: ${work.id.substring(0, 8)}</span>
                </div>
                <div class="work-card-actions">
                    <button class="btn-small edit-work" data-id="${work.id}">
                        <i class="fas fa-edit"></i> Изменить
                    </button>
                    <button class="btn-small delete-work" data-id="${work.id}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `;

        return div;
    }

    setupEventListeners() {
        // Логин
        const loginBtn = document.getElementById('login-btn');
        const passwordInput = document.getElementById('admin-password');

        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const password = passwordInput?.value;
                if (password) {
                    await this.login(password);
                    if (passwordInput) passwordInput.value = '';
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const password = passwordInput.value;
                    if (password) {
                        await this.login(password);
                        passwordInput.value = '';
                    }
                }
            });
        }

        // Выход
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Загрузка файлов (как в основном скрипте)
        this.setupFileUpload();

        // Форма добавления работы
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

                if (!imageInput || !imageInput.files.length) {
                    this.showToast('Выберите изображение', 'error');
                    return;
                }

                const formData = new FormData();
                formData.append('title', title);
                formData.append('description', description || '');
                formData.append('image', imageInput.files[0]);

                try {
                    const response = await fetch('/api/works', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        },
                        body: formData
                    });

                    if (response.ok) {
                        this.showToast('Работа добавлена!', 'success');
                        form.reset();
                        document.getElementById('file-preview').style.display = 'none';
                        await this.loadWorks();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Ошибка при добавлении работы');
                    }
                } catch (error) {
                    this.showToast(error.message, 'error');
                }
            });
        }
    }

    setupFileUpload() {
        // Аналогично основному скрипту
        const fileInput = document.getElementById('work-image');
        const dropArea = document.querySelector('.file-upload-area');

        if (dropArea && fileInput) {
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
            }

            function unhighlight() {
                dropArea.style.backgroundColor = '';
            }

            dropArea.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;

                if (files.length) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(files[0]);
                    fileInput.files = dataTransfer.files;

                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                }
            });

            dropArea.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Проверки размера и типа файла
                const maxSize = 50 * 1024 * 1024;
                if (file.size > maxSize) {
                    this.showToast('Файл слишком большой. Максимальный размер: 50MB', 'error');
                    fileInput.value = '';
                    return;
                }

                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
                if (!allowedTypes.includes(file.type)) {
                    this.showToast('Разрешены только изображения', 'error');
                    fileInput.value = '';
                    return;
                }

                // Показываем превью
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('file-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Превью">`;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    showToast(message, type = 'success') {
        // Создаем тост, если его нет
        let toast = document.getElementById('admin-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'admin-toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});