/**
 * PiaCalendar.js
 * @version 1.1.0
 * @author Yavuz Gedik
 * @description Lite, Vanilla JS, Bootstrap 5 Calendar with CRUD, Responsive Grid & Backend Hooks
 * @github https://github.com/yavuzgedik/PiaCalendar
 */
class PiaCalendar {
    static _isCssInjected = false;
    static _instances = new WeakMap();

    constructor(element, options = {}) {
        // Eğer bu elementte zaten bir takvim başlatılmışsa, mevcut olanı döndür
        if (PiaCalendar._instances.has(element)) {
            return PiaCalendar._instances.get(element);
        }

        this.element = element;
        this.options = Object.assign({}, PiaCalendar.getDefaultOptions(), options);
        
        // HTML üzerinden (data-pia-events) doğrudan veri basma desteği
        let inlineEvents = [];
        try {
            const dataEvents = this.element.getAttribute('data-pia-events');
            if (dataEvents) inlineEvents = JSON.parse(dataEvents);
        } catch(e) { 
            console.error("PiaCalendar: Geçersiz JSON verisi (data-pia-events)", e); 
        }

        // Tarih Durumu (State)
        this.currentDate = this.options.initialDate ? new Date(this.options.initialDate) : new Date();
        this.events = inlineEvents; // Başlangıç verisi [{ id, title, date, description, color }]
        
        // Modal Referansı
        this.modalInstance = null;
        this.activeEventId = null; // Düzenlenmekte olan etkinlik

        this._init();
        PiaCalendar._instances.set(element, this);
        this.element.dataset.piaInitialized = "true";
    }

    static getDefaultOptions() {
        return {
            locale: 'tr-TR',
            startDayOfWeek: 1, // 1: Pazartesi, 0: Pazar
            theme: 'primary',
            // API Hooks (Varsayılan null döndürür, böylece inline veriyi ezmez)
            onFetchEvents: async (year, month) => null,
            onFetchEventDetail: async (id) => null, 
            onAddEvent: async (eventData) => ({ ...eventData, id: Date.now().toString() }),
            onUpdateEvent: async (id, eventData) => true,
            onDeleteEvent: async (id) => true,
            // Metinler
            texts: {
                today: 'Bugün',
                addEvent: 'Etkinlik Ekle',
                editEvent: 'Etkinliği Düzenle',
                save: 'Kaydet',
                delete: 'Sil',
                cancel: 'İptal',
                title: 'Başlık',
                description: 'Açıklama',
                loading: 'Yükleniyor...'
            }
        };
    }

    /**
     * Pia Felsefesi: Sayfadaki mevcut ve sonradan eklenecek takvimleri otomatik yakalar.
     * @param {Object} globalOptions Tüm takvimlere uygulanacak varsayılan ayarlar (API hook'ları vb.)
     */
    static observeDOM(globalOptions = {}) {
        const initElements = (rootNode) => {
            const elements = rootNode.querySelectorAll ? rootNode.querySelectorAll('[data-pia-calendar]') : [];
            elements.forEach(el => {
                if (!el.dataset.piaInitialized) {
                    new PiaCalendar(el, globalOptions);
                }
            });
        };

        // Sayfa yüklendiğinde mevcut olanları başlat
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initElements(document));
        } else {
            initElements(document);
        }

        // Sonradan DOM'a eklenenleri dinle (AJAX, Fetch vs. ile gelen içerikler)
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && node.matches('[data-pia-calendar]')) {
                                initElements(node.parentNode);
                            } else {
                                initElements(node);
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    async _init() {
        PiaCalendar.injectCSS();
        this._createModalDOM();
        this.render();
        await this.loadEvents();
    }

    static injectCSS() {
        if (this._isCssInjected) return;
        const style = document.createElement('style');
        style.textContent = `
            .pia-calendar { display: flex; flex-direction: column; font-family: inherit; }
            .pia-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
            
            /* Desktop Grid (Standart) */
            .pia-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background-color: var(--bs-border-color-translucent); border: 1px solid var(--bs-border-color-translucent); border-radius: var(--bs-border-radius); overflow: hidden; }
            
            /* Hücre ve Başlık Ayarları */
            .pia-day-header { background-color: var(--bs-gray-100); padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; font-size: 0.9rem; color: var(--bs-gray-700); }
            .pia-day-cell { background-color: #fff; min-height: 120px; padding: 0.5rem; cursor: pointer; transition: background-color 0.2s; display: flex; flex-direction: column; min-width: 0; }
            .pia-day-cell:hover { background-color: var(--bs-gray-50); }
            
            /* Diğer Ay Günleri Stili */
            .pia-day-cell.pia-other-month { background-color: var(--bs-gray-100); }
            .pia-day-cell.pia-other-month .pia-day-number { color: var(--bs-gray-500); }
            .pia-day-cell.pia-other-month .pia-event { opacity: 0.65; }
            .pia-day-cell.pia-other-month .pia-event:hover { opacity: 0.9; }

            .pia-day-cell.pia-today { background-color: rgba(var(--bs-primary-rgb), 0.05); }
            
            .pia-day-number { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; text-align: right; display: block; }
            .pia-day-cell.pia-today .pia-day-number { color: var(--bs-primary); font-size: 1rem; }
            
            /* İçerik ve Taşma (Truncate) Ayarları */
            .pia-events-container { flex-grow: 1; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; scrollbar-width: none; min-width: 0; }
            .pia-events-container::-webkit-scrollbar { display: none; }
            .pia-event { background-color: var(--bs-primary); color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: opacity 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.1); display: block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .pia-event:hover { opacity: 0.8; }
            
            .pia-loader { display: none; margin-left: 10px; font-size: 0.9rem; color: var(--bs-secondary); }
            .pia-calendar.loading .pia-loader { display: inline-block; }
            .pia-calendar.loading .pia-grid { opacity: 0.6; pointer-events: none; }
            
            /* Mobil ve Tablet Uyum (Responsive) Stilleri */
            @media (max-width: 768px) {
                .pia-grid { 
                    grid-template-columns: var(--pia-grid-cols-mobile, repeat(7, minmax(80px, 1fr))); 
                    overflow-x: auto; 
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    scroll-snap-type: x mandatory;
                }
                .pia-day-header, .pia-day-cell { scroll-snap-align: start; }
                .pia-day-header { padding: 0.4rem 0.2rem; font-size: 0.8rem; }
                .pia-day-cell { min-height: 80px; padding: 0.25rem; }
                .pia-day-number { font-size: 0.85rem; margin-bottom: 0.25rem; }
                .pia-event { font-size: 0.65rem; padding: 0.1rem 0.25rem; margin-bottom: 2px; }
                .pia-header h4 { font-size: 1.1rem; }
                .pia-header .btn { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
            }
            @media (max-width: 576px) {
                .pia-day-cell { min-height: 65px; }
                .pia-day-number { font-size: 0.75rem; }
                .pia-event { font-size: 0.6rem; border-radius: 2px; }
            }
        `;
        document.head.appendChild(style);
        this._isCssInjected = true;
    }

    // --- RENDER İŞLEMLERİ ---

    render() {
        this.element.innerHTML = '';
        this.element.className = 'pia-calendar';

        // Üst Kısım (Header)
        const header = document.createElement('div');
        header.className = 'pia-header';
        
        const monthYearFormatter = new Intl.DateTimeFormat(this.options.locale, { month: 'long', year: 'numeric' });
        const monthName = monthYearFormatter.format(this.currentDate);

        header.innerHTML = `
            <div class="d-flex align-items-center">
                <h4 class="mb-0 fw-bold text-capitalize">${monthName}</h4>
                <span class="pia-loader"><i class="fas fa-spinner fa-spin"></i> ${this.options.texts.loading}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-1" data-action="prev"><i class="fas fa-chevron-left"></i></button>
                <button class="btn btn-sm btn-outline-primary me-1" data-action="today">${this.options.texts.today}</button>
                <button class="btn btn-sm btn-outline-secondary" data-action="next"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;

        // Olay Dinleyicileri
        header.querySelector('[data-action="prev"]').addEventListener('click', () => this.changeMonth(-1));
        header.querySelector('[data-action="next"]').addEventListener('click', () => this.changeMonth(1));
        header.querySelector('[data-action="today"]').addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
            this.loadEvents();
        });

        this.element.appendChild(header);

        // Izgara (Grid)
        const grid = document.createElement('div');
        grid.className = 'pia-grid';

        // --- MOBİL İÇİN AKTİF GÜN SÜTUN GENİŞLİĞİ HESAPLAMASI ---
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === this.currentDate.getFullYear() && today.getMonth() === this.currentDate.getMonth();
        
        if (isCurrentMonth) {
            let todayIndex = today.getDay() - this.options.startDayOfWeek;
            if (todayIndex < 0) todayIndex += 7; // Pazar vb. düzeltmesi
            
            let colsMobile = [];
            for (let i = 0; i < 7; i++) {
                if (i === todayIndex) colsMobile.push('minmax(150px, 2fr)');
                else colsMobile.push('minmax(70px, 1fr)');
            }
            grid.style.setProperty('--pia-grid-cols-mobile', colsMobile.join(' '));
        } else {
            grid.style.setProperty('--pia-grid-cols-mobile', 'repeat(7, minmax(85px, 1fr))');
        }

        this._renderDaysOfWeek(grid);
        this._renderMonthDays(grid);

        this.element.appendChild(grid);
        this._renderEvents();
        
        // Mobilde aktif güne kaydırma tetiklemesi (sadece aktif aydaysa çalışır)
        if (isCurrentMonth) {
            this._scrollToToday();
        }
    }

    _scrollToToday() {
        setTimeout(() => {
            const grid = this.element.querySelector('.pia-grid');
            const todayCell = this.element.querySelector('.pia-today');
            
            if (grid && todayCell && window.innerWidth <= 768) {
                const scrollPos = todayCell.offsetLeft - (grid.clientWidth / 2) + (todayCell.clientWidth / 2);
                grid.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        }, 50);
    }

    _renderDaysOfWeek(grid) {
        const formatter = new Intl.DateTimeFormat(this.options.locale, { weekday: 'short' });
        const baseDate = new Date(2021, 0, 4); // 4 Ocak 2021 Pazartesi
        for (let i = 0; i < 7; i++) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + i + (this.options.startDayOfWeek === 0 ? -1 : 0));
            
            const cell = document.createElement('div');
            cell.className = 'pia-day-header text-capitalize';
            cell.textContent = formatter.format(d);
            grid.appendChild(cell);
        }
    }

    _formatDateString(year, monthIndex, day) {
        const d = new Date(year, monthIndex, day);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _createDayCell(grid, dateStr, dayNum, customClass = '') {
        const cell = document.createElement('div');
        cell.className = `pia-day-cell ${customClass}`;
        cell.dataset.date = dateStr;
        
        cell.innerHTML = `
            <span class="pia-day-number">${dayNum}</span>
            <div class="pia-events-container" data-container-date="${dateStr}"></div>
        `;

        cell.addEventListener('click', (e) => {
            if(e.target.closest('.pia-event')) return;
            this.openModal(dateStr);
        });

        grid.appendChild(cell);
    }

    _renderMonthDays(grid) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        let firstDayIndex = firstDayOfMonth.getDay() - this.options.startDayOfWeek;
        if (firstDayIndex < 0) firstDayIndex += 7;

        const totalDays = lastDayOfMonth.getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        // Önceki Ayın Boşlukları
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevMonthLastDay - i;
            const dateStr = this._formatDateString(year, month - 1, dayNum);
            this._createDayCell(grid, dateStr, dayNum, 'pia-other-month');
        }

        // Mevcut Ayın Günleri
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = this._formatDateString(year, month, day);
            const customClass = (isCurrentMonth && day === today.getDate()) ? 'pia-today' : '';
            this._createDayCell(grid, dateStr, day, customClass);
        }

        // Sonraki Ayın Boşlukları
        const totalCells = firstDayIndex + totalDays;
        const remainingCells = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
        
        for (let i = 1; i <= remainingCells; i++) {
            const dateStr = this._formatDateString(year, month + 1, i);
            this._createDayCell(grid, dateStr, i, 'pia-other-month');
        }
    }

    _renderEvents() {
        this.element.querySelectorAll('.pia-events-container').forEach(el => el.innerHTML = '');

        this.events.forEach(event => {
            const container = this.element.querySelector(`[data-container-date="${event.date}"]`);
            if (container) {
                const eventEl = document.createElement('div');
                eventEl.className = `pia-event ${event.color ? 'bg-' + event.color : 'bg-' + this.options.theme}`;
                eventEl.textContent = event.title;
                eventEl.title = event.description || event.title;
                
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openModal(event.date, event);
                });

                container.appendChild(eventEl);
            }
        });
    }

    // --- VERİ VE KONTROL İŞLEMLERİ ---

    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.render();
        this.loadEvents();
    }

    async loadEvents() {
        this.element.classList.add('loading');
        try {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth() + 1;
            
            const fetchedEvents = await this.options.onFetchEvents(year, month);
            if (fetchedEvents) this.events = fetchedEvents;
            
            this._renderEvents();
            
            const today = new Date();
            if (today.getFullYear() === this.currentDate.getFullYear() && today.getMonth() === this.currentDate.getMonth()) {
                this._scrollToToday();
            }

        } catch (error) {
            console.error("PiaCalendar: Etkinlikler yüklenemedi.", error);
        } finally {
            this.element.classList.remove('loading');
        }
    }

    // --- MODAL VE CRUD İŞLEMLERİ ---

    _createModalDOM() {
        if (document.getElementById('piaCalendarModal')) return;

        const t = this.options.texts;
        const modalHTML = `
        <div class="modal fade" id="piaCalendarModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title fw-bold" id="piaModalTitle">${t.addEvent}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="piaEventForm">
                            <input type="hidden" id="piaEventDate">
                            <div class="mb-3">
                                <label class="form-label text-muted small fw-bold">${t.title}</label>
                                <input type="text" class="form-control" id="piaEventTitle" required placeholder="Örn: Toplantı">
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted small fw-bold">${t.description}</label>
                                <textarea class="form-control" id="piaEventDesc" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted small fw-bold">Renk (Opsiyonel)</label>
                                <select class="form-select" id="piaEventColor">
                                    <option value="primary">Mavi (Varsayılan)</option>
                                    <option value="success">Yeşil</option>
                                    <option value="danger">Kırmızı</option>
                                    <option value="warning">Sarı</option>
                                    <option value="info">Açık Mavi</option>
                                    <option value="dark">Siyah</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-light">
                        <button type="button" class="btn btn-danger me-auto d-none" id="piaBtnDelete">${t.delete}</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t.cancel}</button>
                        <button type="button" class="btn btn-primary" id="piaBtnSave">${t.save}</button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('piaBtnSave').addEventListener('click', () => this._handleSave());
        document.getElementById('piaBtnDelete').addEventListener('click', () => this._handleDelete());
    }

    async openModal(date, event = null) {
        const modalEl = document.getElementById('piaCalendarModal');
        if (!this.modalInstance) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }

        const t = this.options.texts;
        const form = document.getElementById('piaEventForm');
        const titleEl = document.getElementById('piaModalTitle');
        const btnDelete = document.getElementById('piaBtnDelete');
        const btnSave = document.getElementById('piaBtnSave');

        form.reset();
        document.getElementById('piaEventDate').value = date;
        
        const displayDate = new Intl.DateTimeFormat(this.options.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));

        if (event) {
            this.activeEventId = event.id;
            titleEl.textContent = `${t.editEvent} (${displayDate})`;
            btnDelete.classList.remove('d-none');
            
            btnSave.disabled = true;
            form.classList.add('opacity-50'); 
            
            try {
                let eventDetails = event;
                const fetchedDetails = await this.options.onFetchEventDetail(event.id);
                if(fetchedDetails) eventDetails = fetchedDetails;

                document.getElementById('piaEventTitle').value = eventDetails.title || '';
                document.getElementById('piaEventDesc').value = eventDetails.description || '';
                document.getElementById('piaEventColor').value = eventDetails.color || 'primary';
            } catch (error) {
                console.error("PiaCalendar: Etkinlik detayı çekilemedi", error);
                alert("Veri yüklenirken hata oluştu!");
                this.modalInstance.hide();
                return;
            } finally {
                btnSave.disabled = false;
                form.classList.remove('opacity-50');
            }
        } else {
            this.activeEventId = null;
            titleEl.textContent = `${t.addEvent} (${displayDate})`;
            document.getElementById('piaEventColor').value = 'primary';
            btnDelete.classList.add('d-none');
        }

        this.modalInstance.show();
    }

    async _handleSave() {
        const titleInput = document.getElementById('piaEventTitle');
        if (!titleInput.value.trim()) {
            titleInput.classList.add('is-invalid');
            return;
        }
        titleInput.classList.remove('is-invalid');

        const btnSave = document.getElementById('piaBtnSave');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const eventData = {
            date: document.getElementById('piaEventDate').value,
            title: titleInput.value.trim(),
            description: document.getElementById('piaEventDesc').value.trim(),
            color: document.getElementById('piaEventColor').value
        };

        try {
            if (this.activeEventId) {
                await this.options.onUpdateEvent(this.activeEventId, eventData);
                const index = this.events.findIndex(e => e.id === this.activeEventId);
                if (index !== -1) this.events[index] = { ...this.events[index], ...eventData };
            } else {
                const newEvent = await this.options.onAddEvent(eventData);
                this.events.push(newEvent);
            }
            this._renderEvents();
            this.modalInstance.hide();
        } catch (error) {
            console.error("PiaCalendar: Kaydetme hatası", error);
            alert("Bir hata oluştu!");
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = this.options.texts.save;
        }
    }

    async _handleDelete() {
        if (!this.activeEventId) return;
        if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;

        const btnDelete = document.getElementById('piaBtnDelete');
        const originalText = btnDelete.textContent;
        btnDelete.disabled = true;
        btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await this.options.onDeleteEvent(this.activeEventId);
            this.events = this.events.filter(e => e.id !== this.activeEventId);
            this._renderEvents();
            this.modalInstance.hide();
        } catch (error) {
            console.error("PiaCalendar: Silme hatası", error);
            alert("Silme işlemi başarısız!");
        } finally {
            btnDelete.disabled = false;
            btnDelete.textContent = originalText;
        }
    }
}
