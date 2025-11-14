// Renderer code for index.html (objects list)
let objects = JSON.parse(localStorage.getItem('smeta_objects')) || [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    renderObjects();
    loadUsers();
    loadContractors();
    initDynamicHeader();
    const addBtn = document.getElementById('add-object-btn');
    if (addBtn) addBtn.addEventListener('click', addObject);
});

// Скачать список объектов (Electron capture или печать)
async function downloadObjectList(){
    const target = document.querySelector('.main-content') || document.body;
    const rect = target.getBoundingClientRect();
    const captureRect = {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
    };
    const date = new Date();
    const ts = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;
    const filename = `Список_объектов_${ts}.png`;
    try{
        if (window.smetaAPI && window.smetaAPI.captureRegion){
            const res = await window.smetaAPI.captureRegion(captureRect, filename);
            if (!res || !res.ok){
                fallbackPrint(target);
            }
        } else {
            fallbackPrint(target);
        }
    } catch(e){
        fallbackPrint(target);
    }
}

function fallbackPrint(target){
    try{ target.classList.add('print'); window.print(); }
    finally{ setTimeout(()=>target.classList.remove('print'), 500); }
}

// Добавление нового объекта
function addObject() {
    // Последовательный ID (displayId) начиная с 1
    const nextDisplayId = (()=>{
        const max = objects.reduce((m,o)=>{
            const d = Number(o.displayId||0); return d>m?d:m;
        },0);
        return max+1;
    })();
    const objectId = Date.now().toString();
    // Сохранение объекта
    objects.push({
    id: objectId,
    displayId: nextDisplayId,
        name: 'Новый объект',
        clientName: '',
        clientPhone: '',
        startDate: '',
        endDate: '',
        area: '', // Площадь
        block: '', // Блок
        type: 'жилой', // Тип объекта: жилой | не жилой
        address: '', // Адрес объекта
        photo: null, // Фото объекта (общий вид)
        status: 'в работе', // Статус: в работе | завершен | пауза | отменен
        data: {
            plan: { groups: [] },
            fact: { groups: [] },
            income: { rows: [] },
            // default settings: supply and stock tabs disabled until user enables in object data modal
            settings: { enableSupply: false, enableStock: false }
        }
    });
    saveObjects();
    renderObjects();
}

// Обновление названия объекта
function updateObjectName(objectId, name) {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
        object.name = name;
        saveObjects();
    }
}

function updateClientField(objectId, field, value) {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
        object[field] = value;
        saveObjects();
    }
}

// Открытие объекта
function openObject(objectId) {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
        // Прямо открываем без попытки читать значения со списка (здесь только отображение)
        const idx = objects.findIndex(o=>o.id===object.id);
        if (idx !== -1) { objects[idx] = object; saveObjects(); }
        localStorage.setItem('current_object', JSON.stringify(object));
        window.location.href = 'object.html';
    }
}

// Удаление объекта
function deleteObject(objectId) {
    if (confirm('Вы уверены, что хотите удалить этот объект?')) {
        objects = objects.filter(obj => obj.id !== objectId);
        saveObjects();
        renderObjects();
    }
}

// Отображение списка объектов
function renderObjects() {
    // Всегда берём актуальные данные из localStorage
    objects = JSON.parse(localStorage.getItem('smeta_objects')) || [];
    const objectsList = document.getElementById('objects-list');
    objectsList.innerHTML = '';
    // Filter via search if present
    const searchInput = document.getElementById('object-search');
    let q = (searchInput && searchInput.value || '').trim().toLowerCase();
    const typeFilter = window.__objectTypeFilter || 'Все';
    const filtered = !q ? objects : objects.filter(o => {
        const hay = [o.name, o.clientName, o.clientPhone, o.block, o.type].map(x => (x||'').toLowerCase()).join(' ');
        return hay.includes(q);
    });
    const filteredByType = typeFilter==='Все' ? filtered : filtered.filter(o=> (o.projectType||'') === typeFilter);
    filteredByType.forEach((object) => {
        // Миграция: если нет displayId — присваиваем последовательный
        if (!('displayId' in object)){
            const max = objects.reduce((m,o)=>{ const d=Number(o.displayId||0); return d>m?d:m; },0);
            object.displayId = max+1;
            saveObjects();
        }
        // Миграция статуса
        if (!('status' in object)) {
            object.status = 'в работе';
            saveObjects();
        }
        const objectItem = document.createElement('div');
        objectItem.className = 'object-item';
        objectItem.dataset.id = object.id;
        
        const shortId = formatId(object.id);
            const photoHTML = object.photo
                ? `<div class="object-photo-wrapper"><img src="${object.photo}" alt="Фото"></div>`
                : `<div class="object-photo-wrapper placeholder">Нет фото</div>`;
            // Foreman display (прораб) with mini avatar if present
            const foremanUser = users.find(u=>u.id===object.foremanUserId && (u.status||'активен')==='активен');
            const foremanAvatar = foremanUser ? (foremanUser.photo ? `<div class="mini-avatar"><img src="${foremanUser.photo}" alt="Прораб"></div>` : `<div class="mini-avatar">П</div>`) : '';
            const foremanName = foremanUser ? (foremanUser.fullName||foremanUser.name||'') : '—';
            objectItem.innerHTML = `
                <div class="object-photo-block" onclick="openObject('${object.id}')" title="Открыть объект">
                    ${photoHTML}
                </div>
                <div class="object-data-block">
                    <div class="object-row object-row-line1">
                        <div class="object-num" title="ID объекта">№ ${object.displayId}</div>
                        <div class="object-name clickable" onclick="openObject('${object.id}')" title="Открыть объект">${object.name || 'Без названия'}</div>
                        ${foremanAvatar?`<div class="foreman-block" title="Ответственный прораб" style="display:flex; align-items:center; gap:6px; margin-left:auto;">${foremanAvatar}<span style="font-size:12px; color:#243b53; font-weight:600;">${foremanName}</span></div>`:''}
                    </div>
                    <div class="object-row object-row-line2">
                        <div class="meta-pill">Площадь: <span class="value">${object.area ? object.area : '—'}</span> м²</div>
                        <div class="meta-pill">Блок: <span class="value">${object.block ? object.block : '—'}</span></div>
                        <div class="meta-pill">Тип: <span class="value">${object.type || '—'}</span></div>
                        <div class="status-pill ${((object.status||'активен')==='активен')?'active':'inactive'}">${object.status||'—'}</div>
                    </div>
                    <div class="object-row object-row-line3">
                        <div class="date-block">Начало: <span class="value">${formatDateRU(object.startDate)}</span></div>
                        <div class="date-block">Окончание: <span class="value">${formatDateRU(object.endDate)}</span></div>
                    </div>
                    <div class="object-row object-row-metrics"><div class="object-metrics"></div></div>
                </div>
                <div class="object-actions-block">
                    <div class="actions-dropdown">
                        <button class="btn btn-ghost ellipsis-btn" title="Ещё" onclick="toggleActionsMenu(event)">ещё</button>
                        <div class="actions-menu">
                            <div class="actions-item danger" onclick="deleteObject('${object.id}')">Удалить</div>
                        </div>
                    </div>
                </div>
            `;
        
        objectsList.appendChild(objectItem);
        
        // Ввод теперь выполняется только во вкладке Анализ; здесь только отображение
    // area/block/type теперь редактируются во вкладке Анализ; здесь только отображение

        // Заполнить метрики
        updateMetricsForItem(object.id, objectItem.querySelector('.object-metrics'));
    });
}

// Сохранение объектов
function saveObjects() {
    localStorage.setItem('smeta_objects', JSON.stringify(objects));
}

function formatId(id){
    if (!id) return '—';
    const s = String(id);
    return s.length > 8 ? s.slice(-8).toUpperCase() : s.toUpperCase();
}

function formatDateRU(v){
    if (!v) return '—';
    try{
        // v expected YYYY-MM-DD (from input[type=date]) or Date-parsable
        const d = new Date(v);
        if (isNaN(d.getTime())) return '—';
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }catch(_){ return '—'; }
}

function mapStatusClass(status){
    switch((status||'').toLowerCase()){
        case 'завершен': return 'done';
        case 'пауза': return 'pause';
        case 'отменен': return 'canceled';
        default: return 'progress'; // 'в работе'
    }
}

// ===== Helpers: totals (Budget/Income/Expense/Balance) =====
function sumPlan(object) {
    let total = 0;
    const groups = object?.data?.plan?.groups || [];
    groups.forEach(g => {
        if (Array.isArray(g.workTypes) && g.workTypes.length) {
            g.workTypes.forEach(wt => {
                (wt.resources || []).forEach(r => {
                    total += Number(r.sum || ((r.quantity||0)*(r.price||0))) || 0;
                });
            });
        } else {
            (g.rows || []).forEach(r => { total += Number(r.sum || 0) || 0; });
        }
    });
    return total;
}
function sumFact(object) {
    let total = 0;
    const groups = object?.data?.fact?.groups || [];
    groups.forEach(g => {
        if (Array.isArray(g.workTypes) && g.workTypes.length) {
            g.workTypes.forEach(wt => {
                (wt.resources || []).forEach(r => {
                    // предполагаем поле sumFact может отсутствовать, fallback на фактическую сумму если появится
                    total += Number(r.sumFact || r.sum || ((r.quantity||0)*(r.price||0))) || 0;
                });
            });
        } else {
            (g.rows || []).forEach(r => { total += Number(r.sumFact || 0) || 0; });
        }
    });
    return total;
}
function sumIncome(object) {
    const rows = object?.data?.income?.rows || [];
    return rows.reduce((s, r) => s + (Number(r.amount || 0) || 0), 0);
}
function formatUZS(n){
    try { return (n||0).toLocaleString('ru-RU'); } catch(_) { return String(n||0); }
}
function updateMetricsForItem(objectId, hostEl){
    if (!hostEl) return;
    const obj = objects.find(o=>o.id===objectId);
    const plan = sumPlan(obj);
    const fact = sumFact(obj);
    const income = sumIncome(obj);
    const balance = (income||0) - (fact||0);
    const area = parseFloat(obj.area);
    const overrun = fact > plan ? fact - plan : 0;
    const saving = plan > fact ? plan - fact : 0;
    const deficit = balance < 0 ? Math.abs(balance) : 0;
    const positiveBalance = balance > 0 ? balance : 0;
    const pricePlan = (area && area>0) ? (plan/area) : null;
    const priceFact = (area && area>0) ? (fact/area) : null;
    const fmt = n=>formatUZS(Math.round(n)); // целочисленные для компактности
    const fmtDec = n=>formatUZS(n.toFixed(2));
    hostEl.innerHTML = `
        <div>
            Приход: <strong>${fmt(income)}</strong> UZS &nbsp; / &nbsp;
            Расход: <strong>${fmt(fact)}</strong> UZS &nbsp; / &nbsp;
            Перерасход: <strong>${overrun?fmt(overrun):'0'}</strong> UZS &nbsp; / &nbsp;
            Экономия: <strong>${saving?fmt(saving):'0'}</strong> UZS
        </div>
        <div style="margin-top:4px;">
            Остаток: <strong>${positiveBalance?fmt(positiveBalance):'0'}</strong> UZS &nbsp; / &nbsp;
            Недостача: <strong>${deficit?fmt(deficit):'0'}</strong> UZS &nbsp; / &nbsp;
            Цена м² (План): <strong>${pricePlan!=null?fmtDec(pricePlan):'—'}</strong> UZS &nbsp; / &nbsp;
            Цена м² (Факт): <strong>${priceFact!=null?fmtDec(priceFact):'—'}</strong> UZS &nbsp; / &nbsp;
            Себестоимость (План): <strong>${fmt(plan)}</strong> UZS &nbsp; / &nbsp;
            Себестоимость (Факт): <strong>${fmt(fact)}</strong> UZS
        </div>
    `;
}

// Tooltip toggle (click) for list view
document.addEventListener('click', (e)=>{
    const icon = e.target.closest && e.target.closest('.help-icon');
    if (icon){
        e.stopPropagation();
        const wrap = icon.closest('.help');
        document.querySelectorAll('.help.show').forEach(h=>{ if (h!==wrap) h.classList.remove('show'); });
        if (wrap) wrap.classList.toggle('show');
    } else {
        document.querySelectorAll('.help.show').forEach(h=>h.classList.remove('show'));
    }
});

// ================== Дропдаун действий (⋯) ==================
function toggleActionsMenu(ev){
    ev.stopPropagation();
    const btn = ev.currentTarget;
    const dropdown = btn.closest('.actions-dropdown');
    if (!dropdown) return;
    const menu = dropdown.querySelector('.actions-menu');
    const isOpen = menu.classList.contains('open');
    // Закрыть все перед открытием
    closeAllActionMenus();
    if (!isOpen){
        menu.classList.add('open');
        // Позиционирование: убедимся, что меню не выходит за ширину окна
        requestAnimationFrame(()=>{
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth - 8){
                menu.style.left = 'auto';
                menu.style.right = '0';
            }
        });
    }
}

function closeAllActionMenus(){
    document.querySelectorAll('.actions-menu.open').forEach(m=>m.classList.remove('open'));
}

document.addEventListener('click', (e)=>{
    // Клик вне меню — закрываем
    if (!e.target.closest('.actions-dropdown')){
        closeAllActionMenus();
    }
});

// Доступность: открытие по клавише Enter/Space на кликабельных элементах
document.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('clickable')){
        e.preventDefault();
        e.target.click();
    }
});

// ================== ПОСТАВЩИКИ (ГЛАВНОЕ МЕНЮ) ==================
let suppliers = JSON.parse(localStorage.getItem('smeta_suppliers')) || [];
function loadSuppliers(){ suppliers = JSON.parse(localStorage.getItem('smeta_suppliers')) || []; renderSuppliers(); }
function saveSuppliers(){ localStorage.setItem('smeta_suppliers', JSON.stringify(suppliers)); }

let editingSupplierId = null;
function bindSupplierUI(){
    const addBtn = document.getElementById('add-supplier-header-btn'); if (addBtn) addBtn.addEventListener('click', ()=>openSupplierMainModal());
    const search = document.getElementById('supplier-search'); if (search) search.addEventListener('input', renderSuppliers);
}
document.addEventListener('DOMContentLoaded', bindSupplierUI);
document.addEventListener('DOMContentLoaded', loadSuppliers);

function openSupplierMainModal(id=null){
    editingSupplierId = id;
    const modal = document.getElementById('supplier-modal-main'); if (!modal) return;
    const title = document.getElementById('supplier-modal-title');
    const name = document.getElementById('supplier-name');
    const contact = document.getElementById('supplier-contact');
    const account = document.getElementById('supplier-account');
    const bank = document.getElementById('supplier-bank');
    const mfo = document.getElementById('supplier-mfo');
    const inn = document.getElementById('supplier-inn');
    const director = document.getElementById('supplier-director');
    const address = document.getElementById('supplier-address');
    if (id){
        const s = suppliers.find(x=>x.id===id); if (!s) return;
        title.textContent = 'Редактировать поставщика';
        name.value=s.name||''; contact.value=s.contactPerson||''; account.value=s.account||''; bank.value=s.bank||''; mfo.value=s.mfo||''; inn.value=s.inn||''; director.value=s.director||''; address.value=s.address||'';
        const statusSel = document.getElementById('supplier-status'); if (statusSel) statusSel.value = (s.status||'активен');
    } else {
        title.textContent = 'Новый поставщик';
        name.value=''; contact.value=''; account.value=''; bank.value=''; mfo.value=''; inn.value=''; director.value=''; address.value='';
        const statusSel = document.getElementById('supplier-status'); if (statusSel) statusSel.value='активен';
    }
    modal.style.display='block';
}
function closeSupplierMainModal(){ const modal=document.getElementById('supplier-modal-main'); if (modal) modal.style.display='none'; editingSupplierId=null; }
function saveSupplierFromMainModal(){
    const name = document.getElementById('supplier-name');
    const contact = document.getElementById('supplier-contact');
    const account = document.getElementById('supplier-account');
    const bank = document.getElementById('supplier-bank');
    const mfo = document.getElementById('supplier-mfo');
    const inn = document.getElementById('supplier-inn');
    const director = document.getElementById('supplier-director');
    const address = document.getElementById('supplier-address');
    const statusSel = document.getElementById('supplier-status');
    const nm = (name.value||'').trim(); if (!nm){ alert('Введите название поставщика'); name.focus(); return; }
    const data = { name:nm, contactPerson:contact.value||'', account:account.value||'', bank:bank.value||'', mfo:mfo.value||'', inn:inn.value||'', director:director.value||'', address:address.value||'', status:(statusSel?.value||'активен') };
    if (editingSupplierId){
        const s = suppliers.find(x=>x.id===editingSupplierId); if (!s) return;
        Object.assign(s, data);
    } else {
        const id = 'sup-'+Date.now().toString(36);
        suppliers.push({ id, ...data });
    }
    saveSuppliers(); closeSupplierMainModal(); renderSuppliers();
}
function deleteSupplierMain(id){ if (!confirm('Удалить поставщика?')) return; suppliers = suppliers.filter(s=>s.id!==id); saveSuppliers(); renderSuppliers(); }
function renderSuppliers(){
    const host = document.getElementById('suppliers-list'); if (!host) return;
    host.innerHTML='';
    const q = (document.getElementById('supplier-search')?.value||'').trim().toLowerCase();
    const statusFilter = (window.__supplierStatusFilter||'Все').toLowerCase();
    const allSorted = suppliers.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'ru'));
    const byStatus = statusFilter==='все' ? allSorted : allSorted.filter(s=> ((s.status||'активен').toLowerCase())===statusFilter);
    const filtered = !q? byStatus : byStatus.filter(s=>{
        const hay=[s.name,s.contactPerson,s.account,s.bank,s.mfo,s.inn,s.director,s.address].map(x=>(x||'').toLowerCase()).join(' ');
        return hay.includes(q);
    });
    if (!filtered.length){ host.innerHTML='<div class="fin-empty">Нет поставщиков</div>'; return; }
    filtered.forEach(s=>{
        const div = document.createElement('div');
        div.className='object-item';
        div.innerHTML = `
            <div class="object-data-block">
                <div class="object-row object-row-line1">
                    <div class="object-name">${s.name||'—'}</div>
                </div>
                <div class="object-row object-row-line2">
                    <div class="meta-pill">Контакт: <span class="value">${s.contactPerson||'—'}</span></div>
                    <div class="meta-pill">ИНН: <span class="value">${s.inn||'—'}</span></div>
                    <div class="meta-pill">Банк: <span class="value">${s.bank||'—'}</span></div>
                    <div class="meta-pill">МФО: <span class="value">${s.mfo||'—'}</span></div>
                </div>
                <div class="object-row object-row-line3">
                    <div class="date-block">Счёт: <span class="value">${s.account||'—'}</span></div>
                    <div class="date-block">Директор: <span class="value">${s.director||'—'}</span></div>
                    <div class="date-block">Адрес: <span class="value">${s.address||'—'}</span></div>
                </div>
            </div>
            <div class="object-actions-block">
                <div class="status-pill ${((s.status||'активен')==='активен')?'active':'inactive'}">${s.status||'активен'}</div>
                <div class="actions-dropdown">
                    <button class="btn btn-ghost ellipsis-btn" title="Ещё" onclick="toggleActionsMenu(event)">ещё</button>
                    <div class="actions-menu">
                        <div class="actions-item" onclick="openSupplierMainModal('${s.id}')">Редактировать</div>
                        <div class="actions-item danger" onclick="deleteSupplierMain('${s.id}')">Удалить</div>
                    </div>
                </div>
            </div>`;
        host.appendChild(div);
    });
}
function renderSupplierStatusChips(){
    const host = document.getElementById('supplier-status-filters'); if (!host) return;
    const statuses = ['Все','активен','не активен'];
    const active = window.__supplierStatusFilter || 'Все';
    host.innerHTML = statuses.map(s=>`<button class="role-chip${active===s?' active':''}" data-supp-status="${s}">${s}</button>`).join('');
    host.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            window.__supplierStatusFilter = btn.getAttribute('data-supp-status');
            renderSupplierStatusChips();
            renderSuppliers();
        });
    });
}
// Экспорт в window для inline-обработчиков
if (typeof window !== 'undefined'){
    window.openSupplierMainModal = openSupplierMainModal;
    window.closeSupplierMainModal = closeSupplierMainModal;
    window.saveSupplierFromMainModal = saveSupplierFromMainModal;
    window.deleteSupplierMain = deleteSupplierMain;
    window.renderSuppliers = renderSuppliers;
}

// ================== ТАБЫ ГЛАВНОЙ СТРАНИЦЫ ==================
function switchMainTab(tab, btn){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    const el = document.getElementById('tab-'+tab);
    if (el) el.classList.add('active');
    applyHeaderForTab(tab);
    if (tab==='users'){ renderUsers(); } else if (tab==='objects'){ renderObjects(); } else if (tab==='contractors'){ renderContractorStatusChips(); renderContractors(); } else if (tab==='suppliers'){ renderSupplierStatusChips(); renderSuppliers(); }
}

// ================== ПОЛЬЗОВАТЕЛИ ==================
let users = JSON.parse(localStorage.getItem('smeta_users')) || [];
const USER_ROLES = ['Заказчик','Прораб','Директор','Финансист','Складчик','Бухгалтер','Плановик'];
// Допускаем только активен; неактивных не отображаем в списках и выпадающих
const USER_STATUSES = ['активен'];

function loadUsers(){ users = JSON.parse(localStorage.getItem('smeta_users')) || []; renderUsers(); }
function saveUsers(){ localStorage.setItem('smeta_users', JSON.stringify(users)); }

// ===== Модалка пользователя =====
let editingUserId = null;
function openUserModal(id=null){
    editingUserId = id;
    const modal = document.getElementById('user-modal'); if (!modal) return;
    const title = document.getElementById('user-modal-title');
    const fullname = document.getElementById('user-fullname');
    const roleSel = document.getElementById('user-role');
    const phoneInp = document.getElementById('user-phone');
    const chatInp = document.getElementById('user-chat');
    const statusSel = document.getElementById('user-status');
    const photoPrev = document.getElementById('user-photo-preview');
    // populate selects
    roleSel.innerHTML = USER_ROLES.map(r=>`<option value="${r}">${r}</option>`).join('');
    statusSel.innerHTML = USER_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('');
    delete photoPrev.dataset.photoData;
    if (id){
        const u = users.find(x=>x.id===id); if (!u) return;
        title.textContent = 'Редактировать пользователя';
        fullname.value = u.fullName || u.name || '';
        roleSel.value = u.role || 'Заказчик';
        phoneInp.value = u.phone || '';
        chatInp.value = u.chatId || '';
        statusSel.value = (u.status && USER_STATUSES.includes(u.status)) ? u.status : 'активен';
        photoPrev.innerHTML = u.photo ? `<img src="${u.photo}" alt="Фото">` : 'Нет фото';
    } else {
        title.textContent = 'Новый пользователь';
        fullname.value=''; roleSel.value='Заказчик'; phoneInp.value=''; chatInp.value=''; statusSel.value='активен'; photoPrev.innerHTML='Нет фото';
    }
    modal.style.display='block';
}
function closeUserModal(){ const modal = document.getElementById('user-modal'); if (modal) modal.style.display='none'; editingUserId=null; }
document.addEventListener('DOMContentLoaded', ()=>{
    const photoInput = document.getElementById('user-photo-input');
    if (photoInput){
        photoInput.addEventListener('change', ()=>{
            const file = photoInput.files && photoInput.files[0]; if (!file) return;
            const reader = new FileReader(); reader.onload = e=>{
                const prev = document.getElementById('user-photo-preview'); if (prev) { prev.innerHTML = `<img src="${e.target.result}" alt="Фото">`; prev.dataset.photoData = e.target.result; }
            }; reader.readAsDataURL(file);
        });
    }
});
function saveUserFromModal(){
    const fullname = document.getElementById('user-fullname');
    const roleSel = document.getElementById('user-role');
    const phoneInp = document.getElementById('user-phone');
    const chatInp = document.getElementById('user-chat');
    const statusSel = document.getElementById('user-status');
    const photoPrev = document.getElementById('user-photo-preview');
    const fullNameVal = (fullname.value||'').trim();
    if (!fullNameVal){ alert('Введите ФИО пользователя'); fullname.focus(); return; }
    if (editingUserId){
        const u = users.find(x=>x.id===editingUserId); if (!u) return;
        u.fullName = fullNameVal; u.name = fullNameVal; u.role = roleSel.value; u.phone = phoneInp.value; u.chatId = chatInp.value; u.status = statusSel.value; if (photoPrev.dataset.photoData) u.photo = photoPrev.dataset.photoData;
    } else {
        const id = Date.now().toString();
        users.push({ id, fullName: fullNameVal, name: fullNameVal, role: roleSel.value, phone: phoneInp.value, chatId: chatInp.value, status: statusSel.value, photo: photoPrev.dataset.photoData||null });
    }
    saveUsers(); closeUserModal(); renderUsers();
}

function updateUser(id, field, value){
    const u = users.find(x=>x.id===id); if (!u) return;
    if (field==='photo'){ u.photo = value; } else { u[field] = value; }
    if (field==='name'){ u.fullName = value; }
    saveUsers();
}

function deleteUser(id){
    if (!confirm('Удалить пользователя?')) return;
    users = users.filter(u=>u.id!==id); saveUsers(); renderUsers();
}

function triggerUserPhoto(id){
    const inp = document.getElementById('user-photo-input-'+id); if (inp) inp.click();
}
function handleUserPhotoChange(id, input){
    const file = input.files && input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e=>{ updateUser(id,'photo', e.target.result); renderUsers(); };
    reader.readAsDataURL(file);
}

function renderUsers(){
    const list = document.getElementById('users-list'); if (!list) return; list.innerHTML='';
    const searchEl = document.getElementById('user-search');
    const q = (searchEl && searchEl.value || '').trim().toLowerCase();
    const active = users.filter(u=> (u.status||'активен')==='активен');
    const roleFilter = window.__roleFilter || null;
    const base = roleFilter ? active.filter(u=> (u.role||'').toLowerCase() === roleFilter.toLowerCase()) : active;
    const filtered = !q ? base : base.filter(u=>{
        const hay = [u.fullName||u.name, u.role, u.phone, u.chatId].map(x=>(x||'').toLowerCase()).join(' ');
        return hay.includes(q);
    });
    if (!filtered.length){ list.innerHTML='<div class="fin-empty">Нет пользователей</div>'; return; }
    filtered.forEach(u=>{
        const div = document.createElement('div');
        div.className='object-item';
        div.style.alignItems='stretch';
        const photoHTML = u.photo?`<div class="user-photo-wrapper"><img src="${u.photo}" alt="Фото"></div>`:`<div class="user-photo-wrapper placeholder">Фото</div>`;
        div.innerHTML = `
            <div class="user-photo-block" onclick="openUserModal('${u.id}')" title="Редактировать">
                ${photoHTML}
            </div>
            <div class="object-data-block">
                <div class="object-row object-row-line1">
                    <div class="object-name clickable" onclick="openUserModal('${u.id}')">${u.fullName||u.name||'—'}</div>
                </div>
                <div class="object-row object-row-line2">
                        <div class="meta-pill">Роль: <span class="value">${u.role}</span></div>
                        <div class="meta-pill">Телефон: <span class="value">${u.phone||'—'}</span></div>
                        <div class="meta-pill">ChatID: <span class="value">${u.chatId||'—'}</span></div>
                </div>
            </div>
            <div class="object-actions-block">
                <div class="status-pill ${((u.status||'активен')==='активен')?'active':'inactive'}">${u.status||'активен'}</div>
                <div class="actions-dropdown">
                    <button class="btn btn-ghost ellipsis-btn" title="Ещё" onclick="toggleActionsMenu(event)">ещё</button>
                    <div class="actions-menu">
                        <div class="actions-item" onclick="openUserModal('${u.id}')">Редактировать</div>
                        <div class="actions-item danger" onclick="deleteUser('${u.id}')">Удалить</div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function bindUserUI(){
    const addHeaderBtn = document.getElementById('add-user-header-btn');
    if (addHeaderBtn) addHeaderBtn.addEventListener('click', ()=>openUserModal());
    const userSearch = document.getElementById('user-search'); if (userSearch) userSearch.addEventListener('input', renderUsers);
}

// Helper for object page to retrieve users by role (used in object.html modal)
function getUsersByRole(role){ return users.filter(u=>u.role===role && (u.status||'активен')==='активен'); }

// ===== Динамический хедер =====
function initDynamicHeader(){
    bindUserUI();
    bindContractorUI();
    const objSearch = document.getElementById('object-search'); if (objSearch) objSearch.addEventListener('input', renderObjects);
    // Role filter chips render
    renderRoleChips();
    renderObjectTypeChips();
    applyHeaderForTab('objects');
}
function renderRoleChips(){
    const host = document.getElementById('user-role-filters'); if (!host) return;
    const roles = ['Все', ...USER_ROLES];
    host.innerHTML = roles.map(r=>`<button class="role-chip${(window.__roleFilter? (r.toLowerCase()===window.__roleFilter.toLowerCase()): r==='Все')?' active':''}" data-role="${r}">${r}</button>`).join(' ');
    host.querySelectorAll('.role-chip').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            const role = btn.getAttribute('data-role');
            window.__roleFilter = (role==='Все') ? null : role;
            renderRoleChips();
            renderUsers();
        });
    });
}
function applyHeaderForTab(tab){
    const objSearch = document.getElementById('object-search');
    const addObjBtn = document.getElementById('add-object-btn');
    const userSearch = document.getElementById('user-search');
    const addUserBtn = document.getElementById('add-user-header-btn');
    const contrSearch = document.getElementById('contractor-search');
    const addContrBtn = document.getElementById('add-contractor-header-btn');
    const suppSearch = document.getElementById('supplier-search');
    const addSuppBtn = document.getElementById('add-supplier-header-btn');
    if (tab==='users'){
        if (objSearch) objSearch.style.display='none';
        if (addObjBtn) addObjBtn.style.display='none';
        if (userSearch) userSearch.style.display='inline-block';
        if (addUserBtn) addUserBtn.style.display='inline-flex';
        if (contrSearch) contrSearch.style.display='none';
        if (addContrBtn) addContrBtn.style.display='none';
        if (suppSearch) suppSearch.style.display='none';
        if (addSuppBtn) addSuppBtn.style.display='none';
    } else if (tab==='contractors'){
        if (objSearch) objSearch.style.display='none';
        if (addObjBtn) addObjBtn.style.display='none';
        if (userSearch) userSearch.style.display='none';
        if (addUserBtn) addUserBtn.style.display='none';
        if (contrSearch) contrSearch.style.display='inline-block';
        if (addContrBtn) addContrBtn.style.display='inline-flex';
        if (suppSearch) suppSearch.style.display='none';
        if (addSuppBtn) addSuppBtn.style.display='none';
    } else if (tab==='suppliers'){
        if (objSearch) objSearch.style.display='none';
        if (addObjBtn) addObjBtn.style.display='none';
        if (userSearch) userSearch.style.display='none';
        if (addUserBtn) addUserBtn.style.display='none';
        if (contrSearch) contrSearch.style.display='none';
        if (addContrBtn) addContrBtn.style.display='none';
        if (suppSearch) suppSearch.style.display='inline-block';
        if (addSuppBtn) addSuppBtn.style.display='inline-flex';
    } else {
        if (objSearch) objSearch.style.display='inline-block';
        if (addObjBtn) addObjBtn.style.display='inline-flex';
        if (userSearch) userSearch.style.display='none';
        if (addUserBtn) addUserBtn.style.display='none';
        if (contrSearch) contrSearch.style.display='none';
        if (addContrBtn) addContrBtn.style.display='none';
        if (suppSearch) suppSearch.style.display='none';
        if (addSuppBtn) addSuppBtn.style.display='none';
    }
}

function renderObjectTypeChips(){
    const host = document.getElementById('object-type-filters'); if (!host) return;
    const types = ['Все','Инвестиционный','Гос. объект'];
    const active = window.__objectTypeFilter || 'Все';
    host.innerHTML = types.map(t=>`<button class="role-chip${active===t?' active':''}" data-otype="${t}">${t}</button>`).join('');
    host.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            const t = btn.getAttribute('data-otype');
            window.__objectTypeFilter = t;
            renderObjectTypeChips();
            renderObjects();
        });
    });
}

// ================== ПОДРЯДЧИКИ ==================
let contractors = JSON.parse(localStorage.getItem('smeta_contractors')) || [];
function loadContractors(){ contractors = JSON.parse(localStorage.getItem('smeta_contractors')) || []; renderContractors(); }
function saveContractors(){ localStorage.setItem('smeta_contractors', JSON.stringify(contractors)); }

let editingContractorId = null;
function bindContractorUI(){
    const addBtn = document.getElementById('add-contractor-header-btn'); if (addBtn) addBtn.addEventListener('click', ()=>openContractorModal());
    const search = document.getElementById('contractor-search'); if (search) search.addEventListener('input', renderContractors);
}
function renderContractorStatusChips(){
    const host = document.getElementById('contractor-status-filters'); if (!host) return;
    const statuses = ['Все','активен','не активен'];
    const active = window.__contractorStatusFilter || 'Все';
    host.innerHTML = statuses.map(s=>`<button class="role-chip${active===s?' active':''}" data-contr-status="${s}">${s}</button>`).join('');
    host.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            window.__contractorStatusFilter = btn.getAttribute('data-contr-status');
            renderContractorStatusChips();
            renderContractors();
        });
    });
}
function openContractorModal(id=null){
    editingContractorId = id;
    const modal = document.getElementById('contractor-modal'); if (!modal) return;
    const title = document.getElementById('contractor-modal-title');
    const name = document.getElementById('contractor-name');
    const contact = document.getElementById('contractor-contact');
    const phone = document.getElementById('contractor-phone');
    const notes = document.getElementById('contractor-notes');
    const status = document.getElementById('contractor-status');
    if (id){
        const c = contractors.find(x=>x.id===id); if (!c) return;
        title.textContent='Редактировать подрядчика';
        name.value=c.name||''; contact.value=c.contact||''; phone.value=c.phone||''; notes.value=c.notes||''; status.value=c.status||'активен';
    } else {
        title.textContent='Новый подрядчик';
        name.value=''; contact.value=''; phone.value=''; notes.value=''; status.value='активен';
    }
    modal.style.display='block';
}
function closeContractorModal(){ const modal=document.getElementById('contractor-modal'); if (modal) modal.style.display='none'; editingContractorId=null; }
function saveContractorFromModal(){
    const name = document.getElementById('contractor-name');
    const contact = document.getElementById('contractor-contact');
    const phone = document.getElementById('contractor-phone');
    const notes = document.getElementById('contractor-notes');
    const status = document.getElementById('contractor-status');
    const nm = (name.value||'').trim(); if (!nm){ alert('Введите название фирмы'); name.focus(); return; }
    if (editingContractorId){
        const c = contractors.find(x=>x.id===editingContractorId); if (!c) return;
        c.name=nm; c.contact=contact.value||''; c.phone=phone.value||''; c.notes=notes.value||''; c.status=status.value||'активен';
    } else {
        const id = Date.now().toString();
        contractors.push({ id, name:nm, contact:contact.value||'', phone:phone.value||'', notes:notes.value||'', status:status.value||'активен' });
    }
    saveContractors(); closeContractorModal(); renderContractors();
}
function deleteContractor(id){ if (!confirm('Удалить подрядчика?')) return; contractors = contractors.filter(c=>c.id!==id); saveContractors(); renderContractors(); }
function renderContractors(){
    const host = document.getElementById('contractors-list'); if (!host) return;
    host.innerHTML='';
    const q = (document.getElementById('contractor-search')?.value||'').trim().toLowerCase();
    const statusFilter = (window.__contractorStatusFilter||'Все').toLowerCase();
    const allSorted = contractors.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'ru'));
    const byStatus = statusFilter==='все' ? allSorted : allSorted.filter(c=> ((c.status||'активен').toLowerCase())===statusFilter);
    const filtered = !q? byStatus : byStatus.filter(c=>{
        const hay=[c.name,c.phone,c.contact,c.notes,c.contact].map(x=>(x||'').toLowerCase()).join(' ');
        return hay.includes(q);
    });
    if (!filtered.length){ host.innerHTML='<div class="fin-empty">Нет подрядчиков</div>'; return; }
    // Render active first then inactive (but both visible)
    const act = filtered.filter(c=> (c.status||'активен')==='активен');
    const inact = filtered.filter(c=> (c.status||'активен')!=='активен');
    // Do not display separate legend for inactive contractors — show all in one list
    [...act, ...inact].forEach(c=>{
        const div = document.createElement('div');
        div.className='object-item';
        div.innerHTML = `
            <div class="object-data-block">
                <div class="object-row object-row-line1">
                    <div class="object-name">${c.name}</div>
                </div>
                <div class="object-row object-row-line2">
                    <div class="status-pill ${((c.status||'активен')==='активен')?'active':'inactive'}">${c.status||'активен'}</div>
                    <div class="meta-pill">Контакт: <span class="value">${c.contact||'—'}</span></div>
                    <div class="meta-pill">Телефон: <span class="value">${c.phone||'—'}</span></div>
                </div>
            </div>
            <div class="object-actions-block">
                <!-- Edit moved into dropdown actions -->
                <div class="actions-dropdown">
                    <button class="btn btn-ghost ellipsis-btn" title="Ещё" onclick="toggleActionsMenu(event)">ещё</button>
                    <div class="actions-menu">
                        <div class="actions-item" onclick="openContractorModal('${c.id}')">Редактировать</div>
                        <div class="actions-item danger" onclick="deleteContractor('${c.id}')">Удалить</div>
                    </div>
                </div>
            </div>`;
        host.appendChild(div);
    });
}
