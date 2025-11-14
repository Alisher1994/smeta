// ===== Расширенный маршрут статусов заказа =====
const ORDER_STATUS_FLOW = [
    'новая',
    'на утверждение','утверждено',
    'на оплату','оплачено',
    'заказано','доставляется','доставлено',
    'не доставлено','возврат'
];

function orderStatusProgressData(status){
    const idx = ORDER_STATUS_FLOW.indexOf(status);
    return { index: idx, total: ORDER_STATUS_FLOW.length };
}

// Ensure initialization runs when the page loads
document.addEventListener('DOMContentLoaded', ()=>{
    try{ fullObjectInit(); }catch(e){ console.warn('fullObjectInit failed', e); }
});

// Generic accordion toggle by id
// Animate accordion open/close by toggling explicit heights (robust against reflows)
function animateAccordionElement(body, open, toggleEl){
    if (!body) return;
    // ensure overflow hidden while animating
    body.style.overflow = 'hidden';

    const cleanupAfterOpen = ()=>{
        body.style.height = '';
        body.style.overflow = '';
        body.removeEventListener('transitionend', cleanupAfterOpen);
    };

    if (open){
        // open: set display block, measure, animate to scrollHeight, then clear explicit height
        body.style.display = 'block';
        const targetH = body.scrollHeight;
        // start from zero height
        body.style.height = '0px';
        // force reflow
        body.getBoundingClientRect();
        body.style.transition = 'height 260ms ease';
        body.style.height = targetH + 'px';
        body.dataset.open = 'true';
        if (toggleEl) toggleEl.textContent = '▴';
        body.addEventListener('transitionend', cleanupAfterOpen);
    } else {
        // close: animate from current height to zero, then set display none
        const startH = body.scrollHeight;
        body.style.height = startH + 'px';
        // force reflow
        body.getBoundingClientRect();
        body.style.transition = 'height 200ms ease';
        body.style.height = '0px';
        body.dataset.open = 'false';
        if (toggleEl) toggleEl.textContent = '▾';
        const onEndClose = ()=>{
            body.style.display = 'none';
            body.style.height = '';
            body.style.overflow = '';
            body.removeEventListener('transitionend', onEndClose);
        };
        body.addEventListener('transitionend', onEndClose);
    }
}

// Generic accordion toggle by id (uses animateAccordionElement)
function toggleAccordion(id){
    const acc = document.getElementById(id);
    if (!acc) return;
    const body = acc.querySelector('.accordion-body');
    const toggle = acc.querySelector('.accordion-toggle');
    if (!body) return;
    const isOpen = body.dataset.open === 'true' || (body.style.display && body.style.display !== 'none');
    animateAccordionElement(body, !isOpen, toggle);
}

// Backwards-compatible wrapper used in some markup
function togglePlanControlsAccordion(){ toggleAccordion('plan-controls-accordion'); }

function renderOrderStatusTimeline(order){
    const current = order.status;
    const flow = ORDER_STATUS_FLOW;
    return `<div class='order-timeline'>${flow.map(st=>{
        const doneIdx = flow.indexOf(current);
        const isPast = flow.indexOf(st) < doneIdx && current!=='возврат' && current!=='не доставлено';
        const isActive = st===current;
        const cls = isActive? 'active' : (isPast? 'done' : 'pending');
        return `<div class='timeline-step ${cls}' data-status='${st}' onclick="setOrderStatus('${order.id}','${st}')">
            <div class='circle'>${isPast||isActive? '✔' : ''}</div>
            <div class='label'>${st}</div>
        </div>`;
    }).join('')}<div class='timeline-bar'></div></div>`;
}
// Текущий объект
// Blocks logic removed: project works with whole object and tabs directly.

// Если Electron API недоступен — поднимаем объект из localStorage
    if (!(window.smetaAPI && window.smetaAPI.loadProject)) {
        const fromLS = localStorage.getItem('current_object');
        if (fromLS) {
            try { currentObject = JSON.parse(fromLS); } catch (_) {}
            window.currentObject = currentObject;
        }
    }

    // Установка названия объекта (даты теперь редактируются на списке объектов)
    const titleEl = document.getElementById('object-title');
    if (titleEl) titleEl.textContent = currentObject.name;
    // Blocks list UI was removed; nothing to render here.

function fullObjectInit(){
    // Perform the original data loads only once
    if (window.__objectInitDone) return;
    window.__objectInitDone = true;
    migratePlanToWorkTypes();
    loadPlanData();
    loadFactData();
    loadIncomeData();
    loadAnalysisData();
    renderPlanMetaExpenses();
    renderFactMetaExpenses();
    updateChart();
    // initialize accordion heights so visible bodies display correctly and support smooth toggle
    try{ initAccordionHeights(); }catch(_){ }
    // global print shortcut (Ctrl/Cmd+P)
    try{ initGlobalPrintShortcut(); }catch(_){ }
    // Ensure the left sidebar is populated with available objects
    try{ renderObjectSidebarList(); }catch(_){ }
    // Hide print button when running in a browser without the native printing API
    try{
        const pb = document.getElementById('print-plan-btn');
        if (pb){
            if (!(window.smetaAPI && typeof window.smetaAPI.printToPDF === 'function')){
                pb.style.display = 'none';
            } else {
                pb.style.display = 'inline-flex';
            }
        }
    }catch(_){ }
    // Hide supply/stock tabs by default unless enabled in object settings
    try{
        const settings = (currentObject && currentObject.data && currentObject.data.settings) || {};
        const supplyBtn = document.getElementById('tab-btn-supply');
        const stockBtn = document.getElementById('tab-btn-stock');
        if (supplyBtn) supplyBtn.style.display = settings.enableSupply ? 'inline-flex' : 'none';
        if (stockBtn) stockBtn.style.display = settings.enableStock ? 'inline-flex' : 'none';
        try{ const activeTab = document.querySelector('.tab.active'); if (activeTab && ((activeTab.dataset.tab==='supply' && !settings.enableSupply) || (activeTab.dataset.tab==='stock' && !settings.enableStock))){ const analysisBtn = document.querySelector('.tab[data-tab="analysis"]'); if (analysisBtn) switchTab('analysis', analysisBtn); } }catch(_){ }
    }catch(_){ }
}

// Initialize accordion bodies state on page load: ensure displayed bodies have no fixed height
function initAccordionHeights(){
    document.querySelectorAll('.accordion').forEach(acc=>{
        const body = acc.querySelector('.accordion-body');
        if (!body) return;
        const visible = (body.style.display && body.style.display !== 'none') || body.dataset.open === 'true' || window.getComputedStyle(body).display !== 'none' && body.style.height !== '0px';
        if (visible){
            body.style.display = 'block';
            body.style.height = '';
            body.style.overflow = '';
            body.dataset.open = 'true';
            const toggle = acc.querySelector('.accordion-toggle'); if (toggle) toggle.textContent = '▴';
        } else {
            body.style.display = 'none';
            body.style.height = '0px';
            body.dataset.open = 'false';
            const toggle = acc.querySelector('.accordion-toggle'); if (toggle) toggle.textContent = '▾';
        }
    });
}

// Capture Ctrl/Cmd+P globally and route to our print handler (works in browser and Electron)
function initGlobalPrintShortcut(){
    // Debounce repeated events
    let last = 0;
    document.addEventListener('keydown', (ev)=>{
        try{
            const now = Date.now();
            if (now - last < 300) return; // ignore duplicates
            // Accept both Ctrl+P (Windows/Linux) and Meta+P (macOS)
            const isPrint = (ev.ctrlKey || ev.metaKey) && (ev.key && ev.key.toLowerCase() === 'p');
            if (isPrint){
                ev.preventDefault();
                ev.stopPropagation();
                last = now;
                // Route to our unified print handler
                printPlanPDF();
            }
        }catch(e){ console.warn('print shortcut handler error', e); }
    }, { capture: true });
}

function sumBlockPlan(block){
    let total = 0;
    (block?.data?.plan?.groups||[]).forEach(g=>{ total += calculateGroupTotalAny(g); });
    const meta = block?.data?.plan?.metaExpenses || { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    const miscAmt = ((Number(meta.miscPercent)||0) * total)/100;
    const extraAmt = (meta.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    return total + Number(meta.land||0) + Number(meta.permit||0) + Number(meta.project||0) + miscAmt + extraAmt;
}
function sumBlockFact(block){
    let total = 0;
    (block?.data?.fact?.groups||[]).forEach(group=>{
        if (Array.isArray(group.workTypes) && group.workTypes.length){
            group.workTypes.forEach(wt=> (wt.resources||[]).forEach(r=>{ total += Number(r.sumFact||0)||0; }));
        } else {
            total += calculateFactGroupTotal(group.rows||[]);
        }
    });
    const meta = block?.data?.fact?.metaExpenses || { land:0, permit:0, project:0, misc:0, extra:[] };
    const extraAmt = (meta.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    return total + Number(meta.land||0) + Number(meta.permit||0) + Number(meta.project||0) + Number(meta.misc||0) + extraAmt;
}

function addBlockFromGateway(){
    // Block gateway/remove-block flow was removed per project decision.
    // Keep a safe no-op stub to avoid runtime errors from leftover bindings.
    console.warn('addBlockFromGateway called but blocks gateway was removed');
    return;
}

// Stubs for removed blocks/gateway functionality. Keeping these avoids
// runtime errors from remnants that still try to call these names.
function showBlocksGateway(){ console.warn('showBlocksGateway called but removed'); }
function exitBlocksGateway(){ console.warn('exitBlocksGateway called but removed'); }
// Expose for debugging/backwards compatibility
window.showBlocksGateway = showBlocksGateway;
window.exitBlocksGateway = exitBlocksGateway;

function addBlock(){
    // Addition of blocks was removed. Keep as a no-op stub.
    console.warn('addBlock called but block creation was removed');
    return;
}

function onSelectBlock(val){
    if (!val) return; if (val==='__object'){ closeBlockView(); return; }
    if (val==='__all_blocks'){ // aggregate analysis across blocks
        window.__activeBlockId = '__all_blocks';
        window.__editingBlock = false;
        // set UI
        updateBreadcrumb();
        // render aggregated analysis
        loadAnalysisData();
        // show tabs as usual
        return;
    }
    openBlockView(val);
}

function openBlockView(blockId){
    // find block in parent source (if parent exists use it, otherwise currentObject)
    const parentSource = (window.__parentObject) ? window.__parentObject : currentObject;
    const blk = (parentSource.blocks||[]).find(b=>b.id===blockId);
    if (!blk) { alert('Блок не найден'); return; }
    // store parent and switch currentObject to block data wrapper
    window.__parentObject = JSON.parse(JSON.stringify(currentObject));
    window.__parentObjectId = currentObject.id;
    window.__editingBlock = true;
    // set currentObject to a wrapper that points to block data but preserves metadata like id/name
    currentObject = {
        id: blk.id,
        name: (currentObject.name || '') + ' / ' + (blk.name||''),
        isBlock: true,
        _parentId: window.__parentObjectId,
        data: blk.data
    };
    window.currentObject = currentObject;
    window.__activeBlockId = blockId;
    // update UI
    updateBreadcrumb();
    document.getElementById('back-to-object-btn').style.display='inline-flex';
    try{ migratePlanToWorkTypes(); }catch(_){}
    renderPlanGroups(); loadFactData(); loadIncomeData(); loadAnalysisData(); renderSupplyView(); renderStockView(); updateChart();
}

function closeBlockView(){
    if (!window.__editingBlock) return;
    // restore parent object from saved parent reference in local storage (best-effort)
    try{
        // reload parent from localStorage/smeta_objects to get latest saved copy
        let objects = []; try{ objects = JSON.parse(localStorage.getItem('smeta_objects'))||[]; }catch(_){ objects = []; }
        const parent = objects.find(o=> o.id === window.__parentObjectId) || window.__parentObject || null;
        if (parent){ currentObject = parent; window.currentObject = currentObject; }
    }catch(e){ console.warn('closeBlockView restore parent', e); }
    window.__editingBlock = false; window.__activeBlockId = '__object'; window.__parentObject = null; window.__parentObjectId = null;
    document.getElementById('back-to-object-btn').style.display='none';
    renderBlocksList();
    // re-render top-level views
    loadPlanData(); loadFactData(); loadIncomeData(); loadAnalysisData(); renderSupplyView(); renderStockView(); updateChart();
}

function updateBreadcrumb(){
    const bc = document.getElementById('object-breadcrumb'); if(!bc) return;
    if (window.__activeBlockId && window.__activeBlockId !== '__object' && window.__activeBlockId !== '__all_blocks'){
    const parentSource = (window.__parentObject) ? window.__parentObject : currentObject;
    const blk = (parentSource.blocks||[]).find(b=>b.id===window.__activeBlockId) || null;
        bc.textContent = blk ? (`Блок: ${blk.name}`) : '';
    } else if (window.__activeBlockId === '__all_blocks'){
        bc.textContent = 'Анализ: все блоки суммарно';
    } else { bc.textContent = '' }
}

// Печать активной вкладки в PDF через main process
async function printActiveTabPDF(){
    try {
        const active = document.querySelector('.tab-content.active');
        if (!active) return;
        // Временно добавим класс чтобы скрыть лишнее
        active.classList.add('print');
        // Небольшая задержка на перерисовку (если нужно)
        await new Promise(r=>setTimeout(r,50));
        const tabBtn = document.querySelector('.tab.active');
        const tabName = tabBtn ? tabBtn.textContent.trim() : 'Вкладка';
        const safeName = (currentObject?.name || 'Объект').replace(/[\s]+/g,'_');
        const res = await window.smetaAPI.printToPDF(`${safeName}_${tabName}.pdf`);
        active.classList.remove('print');
        if (!res || !res.ok){
            alert('Не удалось сохранить PDF: ' + (res && res.error ? res.error : 'Неизвестная ошибка'));
        }
    } catch(e){
        console.warn('printActiveTabPDF error', e);
        alert('Ошибка при печати PDF: ' + e.message);
    }
}

// Small wrapper for Plan-tab print button (keeps API call centralized)
function printPlanPDF(){
    try{
        // If running inside the desktop app with print support, use the native exporter
        if (window.smetaAPI && typeof window.smetaAPI.printToPDF === 'function'){
            return printActiveTabPDF();
        }
        // Otherwise fall back to the browser print dialog (ask user to confirm)
        const msg = 'Экспорт в PDF через приложение недоступен в этом окружении. Открыть диалог печати браузера?';
        if (confirm(msg)){
            // Add temporary `.print` class to the active tab so print-specific styles apply
            const active = document.querySelector('.tab-content.active');
            if (active) active.classList.add('print');
            // Use afterprint to clean up the print class when the user finishes printing
            const cleanup = ()=>{
                try{ if (active) active.classList.remove('print'); }catch(_){ }
                try{ window.removeEventListener('afterprint', cleanup); }catch(_){ }
            };
            try{ window.addEventListener('afterprint', cleanup); }catch(_){ }
            // Fallback to browser print dialog
            window.print();
            // As a safety fallback, remove the class after a short delay if afterprint doesn't fire
            setTimeout(cleanup, 1500);
        }
    }catch(e){
        console.warn('printPlanPDF error', e);
        alert('Ошибка при печати: ' + (e && e.message ? e.message : 'Неизвестная ошибка'));
    }
}

// Переключение вкладок
function switchTab(tabName, button) {
    // If in gateway mode, ignore tab switches until a block or whole object is opened
    const gateway = document.getElementById('blocks-gateway');
    if (gateway && gateway.style.display === 'block') {
        return;
    }
    // Убираем активный класс со всех вкладок
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Добавляем активный класс к выбранной вкладке
    button.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    // Запомним активную вкладку в sessionStorage
    try{ sessionStorage.setItem('obj_last_tab', tabName); }catch(_){ }
    // Закрываем любые открытые выпадающие меню, чтобы они не мешали на другой вкладке
    document.querySelectorAll('.resource-menu.open, .contractor-menu.open').forEach(m=>m.classList.remove('open'));
    
    if (tabName === 'fact') {
        renderFactGroups();
        // ensure current sub view visibility
        try{ const active = window.__factSub || 'expenses'; switchFactSub(active); }catch(_){}
    } else if (tabName === 'income') {
        loadIncomeData();
        // Страховка: убедимся, что кнопка добавления прихода имеет обработчик
        const addIncomeBtn = document.getElementById('add-income-btn');
        if (addIncomeBtn) {
            addIncomeBtn.onclick = null;
            addIncomeBtn.addEventListener('click', addIncomeRow);
        }
    } else if (tabName === 'analysis') {
        loadAnalysisData();
    } else if (tabName === 'plan') {
        // Always default to "Без фото" when entering Budget tab
        // Checked means hide photos, so set __planShowPhotos = false
        window.__planShowPhotos = false;
        renderPlanGroups();
        // Ensure the checkbox reflects the choice immediately
        try{ const chk = document.getElementById('plan-hide-photos'); if (chk) chk.checked = true; }catch(_){ }
        // Ensure the Plan Groups accordion is collapsed (hidden) when entering Budget tab
        try{
            const pg = document.getElementById('plan-groups-accordion');
            if (pg){
                const body = pg.querySelector('.accordion-body');
                const toggle = pg.querySelector('.accordion-toggle');
                if (body){
                    // collapse immediately (no animation) to avoid visual jump on tab switch
                    body.style.display = 'none';
                    body.style.height = '0px';
                    body.dataset.open = 'false';
                    if (toggle) toggle.textContent = '▾';
                }
            }
        }catch(_){ }
    } else if (tabName === 'supply') {
        ensureSupplyData();
        renderSupplyView();
    } else if (tabName === 'stock') {
        ensureStockData();
        renderStockView();
    }
}
// Sub-tab switcher for Fact
function switchFactSub(which){
    window.__factSub = which;
    const expensesBtn = document.getElementById('fact-sub-expenses-btn');
    const contractorsBtn = document.getElementById('fact-sub-contractors-btn');
    const suppliersBtn = document.getElementById('fact-sub-suppliers-btn');
    const groups = document.getElementById('fact-groups-container');
    const payments = document.getElementById('contractor-payments-container');
    const suppliersDir = document.getElementById('suppliers-directory-container');
    const addBtn = document.getElementById('add-contractor-payment-btn');
    const addSupplierBtn = document.getElementById('add-supplier-btn');
    if (!expensesBtn || !contractorsBtn || !groups || !payments || !addBtn || !suppliersBtn || !suppliersDir || !addSupplierBtn) return;
    if (which==='contractors'){
        expensesBtn.classList.remove('btn-primary');
        contractorsBtn.classList.add('btn-primary');
        if (suppliersBtn) suppliersBtn.classList.remove('btn-primary');
        groups.style.display='none';
        payments.style.display='block';
        suppliersDir.style.display='none';
        addBtn.style.display='inline-flex';
        addSupplierBtn.style.display='none';
        renderContractorPayments();
    } else if (which==='suppliers'){
        contractorsBtn.classList.remove('btn-primary');
        expensesBtn.classList.remove('btn-primary');
        suppliersBtn.classList.add('btn-primary');
        groups.style.display='none';
        payments.style.display='none';
        suppliersDir.style.display='block';
        addBtn.style.display='none';
        addSupplierBtn.style.display='inline-flex';
        renderSuppliersDirectory();
    } else {
        contractorsBtn.classList.remove('btn-primary');
        if (suppliersBtn) suppliersBtn.classList.remove('btn-primary');
        expensesBtn.classList.add('btn-primary');
        groups.style.display='block';
        payments.style.display='none';
        suppliersDir.style.display='none';
        addBtn.style.display='none';
        addSupplierBtn.style.display='none';
        renderFactGroups();
    }
}

// ====== СНАБЖЕНИЕ (PROCUREMENT) ======
// Вспомогательные инициализаторы
function ensureSupplyData(){
    if (!currentObject.data.supply) currentObject.data.supply = { orders: [], compDocs: [] };
    if (!Array.isArray(currentObject.data.supply.orders)) currentObject.data.supply.orders = [];
    if (!Array.isArray(currentObject.data.supply.compDocs)) currentObject.data.supply.compDocs = [];
    if (!Array.isArray(currentObject.data.supply.suppliers)) currentObject.data.supply.suppliers = [];
    if (typeof currentObject.nextOrderSeq !== 'number') currentObject.nextOrderSeq = 1;
    if (typeof currentObject.nextCompSeq !== 'number') currentObject.nextCompSeq = 1;
    if (typeof currentObject.nextZkSeq !== 'number') currentObject.nextZkSeq = 1;
}
// ===== Suppliers Directory Rendering =====
function renderSuppliersDirectory(){
    ensureSupplyData();
    const host = document.getElementById('suppliers-directory-container'); if(!host) return;
    const list = currentObject.data.supply.suppliers || [];
    if (!list.length){ host.innerHTML = '<p style="font-size:13px;color:#6b7785;">Нет поставщиков. Добавьте первого.</p>'; return; }
    const rows = list.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||''))
        .map(s=>`<tr>
            <td>${escapeHtml(s.name||'')}</td>
            <td>${escapeHtml(s.contactPerson||'')}</td>
            <td>${escapeHtml(s.account||'')}</td>
            <td>${escapeHtml(s.bank||'')}</td>
            <td>${escapeHtml(s.mfo||'')}</td>
            <td>${escapeHtml(s.inn||'')}</td>
            <td>${escapeHtml(s.director||'')}</td>
            <td>${escapeHtml(s.address||'')}</td>
            <td><div class='action-btn-set'>
                <button class='action-btn' onclick="editSupplier('${s.id}')">✏ Изм</button>
                <button class='action-btn danger' onclick="deleteSupplier('${s.id}')">🗑 Удалить</button>
            </div></td>
        </tr>`).join('');
    host.innerHTML = `<div style='margin-top:8px;'>
        <table class='smeta-table'><thead><tr>
            <th>Название</th><th>Контакт</th><th>Счёт</th><th>Банк</th><th>МФО</th><th>ИНН</th><th>Директор</th><th>Адрес</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div>`;
}
function openAddSupplierModal(){ ensureSupplyData(); openSupplierModal(); }
function openSupplierModal(supplierId){
    ensureSupplyData();
    let ov = document.getElementById('supplier-modal');
    if (!ov){
        ov = document.createElement('div'); ov.id='supplier-modal'; ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:none;';
        const box = document.createElement('div'); box.id='supplier-modal-box'; box.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;width:560px;max-width:92vw;max-height:90vh;overflow:auto;border-radius:12px;padding:16px;box-shadow: var(--shadow);'; ov.appendChild(box); document.body.appendChild(ov);
    }
    const list = currentObject.data.supply.suppliers || [];
    const rec = (supplierId? list.find(s=>s.id===supplierId) : null) || {};
    const box = document.getElementById('supplier-modal-box');
    box.innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;'>
        <h3 style='margin:0;font-size:18px;font-weight:700;'>${supplierId? 'Редактирование поставщика' : 'Новый поставщик'}</h3>
        <button class='action-btn' onclick="closeSupplierModal()">✕</button>
    </div>
    <div class='supplier-grid'>
        ${['name','contactPerson','account','bank','mfo','inn','director','address'].map(k=>{
            const labelMap = {name:'Название',contactPerson:'Контактное лицо',account:'Счёт',bank:'Банк',mfo:'МФО',inn:'ИНН',director:'Директор',address:'Адрес'};
            return `<div class='field'><label>${labelMap[k]}</label><input type='text' id='sup-field-${k}' value='${escapeHtml(rec[k]||'')}' placeholder='${labelMap[k]}'></div>`;
        }).join('')}
    </div>
    <div style='margin-top:16px;display:flex;gap:8px;'>
        <button class='action-btn primary' onclick="saveSupplier('${supplierId||''}')">Сохранить</button>
        ${supplierId? `<button class='action-btn danger' onclick="deleteSupplier('${supplierId}')">Удалить</button>`:''}
        <button class='action-btn' onclick="closeSupplierModal()">Отмена</button>
    </div>`;
    ov.style.display='block';
}
function closeSupplierModal(){ const ov=document.getElementById('supplier-modal'); if(ov) ov.style.display='none'; }
function saveSupplier(id){
    ensureSupplyData();
    const list = currentObject.data.supply.suppliers;
    const data = {};
    ['name','contactPerson','account','bank','mfo','inn','director','address'].forEach(k=>{ data[k] = (document.getElementById('sup-field-'+k)?.value||'').trim(); });
    if (!data.name){ alert('Название обязательно'); return; }
    if (id){
        const idx = list.findIndex(s=>s.id===id); if(idx>=0) list[idx] = {...list[idx], ...data};
    } else {
        list.push({ id:'sup-'+Date.now().toString(36), ...data });
    }
    saveObject();
    closeSupplierModal();
    renderSuppliersDirectory();
}
function editSupplier(id){ openSupplierModal(id); }
function deleteSupplier(id){
    ensureSupplyData();
    const list = currentObject.data.supply.suppliers; const idx = list.findIndex(s=>s.id===id); if(idx===-1) return;
    if(!confirm('Удалить поставщика?')) return;
    list.splice(idx,1); saveObject(); renderSuppliersDirectory();
}
window.openAddSupplierModal = openAddSupplierModal;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.closeSupplierModal = closeSupplierModal;
window.saveSupplier = saveSupplier;
window.renderSuppliersDirectory = renderSuppliersDirectory;
function ensureStockData(){ if (!currentObject.data.stock) currentObject.data.stock = { movements: [] }; }

// Переключение под-вкладок снабжения
function switchSupplySub(which){
    window.__supplySub = which;
    const bBudget = document.getElementById('supply-sub-budget-btn');
    const bComp = document.getElementById('supply-sub-competitive-btn');
    const bOrders = document.getElementById('supply-sub-orders-btn');
    const budgetBox = document.getElementById('supply-budget-container');
    const compBox = document.getElementById('supply-competitive-container');
    const ordersBox = document.getElementById('supply-orders-container');
    const createBtn = document.getElementById('supply-create-order-btn');
    const createCompBtn = document.getElementById('supply-create-competitive-btn');
    if (!bBudget || !bOrders || !budgetBox || !ordersBox || !createBtn) return;
    if (which==='orders'){
        bBudget.classList.remove('btn-primary');
        if (bComp) bComp.classList.remove('btn-primary');
        bOrders.classList.add('btn-primary');
        budgetBox.style.display='none';
        if (compBox) compBox.style.display='none';
        ordersBox.style.display='block';
        createBtn.style.display='none';
        if (createCompBtn) createCompBtn.style.display='none';
        renderSupplyOrders();
        renderSupplyStatusFilters();
        const stf = document.getElementById('supply-status-filters'); if (stf) stf.style.display='flex';
        const sr = document.getElementById('supply-budget-search'); if (sr) sr.style.display='none';
    } else if (which==='competitive'){
        if (bOrders) bOrders.classList.remove('btn-primary');
        if (bBudget) bBudget.classList.remove('btn-primary');
        if (bComp) bComp.classList.add('btn-primary');
        budgetBox.style.display='none';
        ordersBox.style.display='none';
        if (compBox) compBox.style.display='block';
        createBtn.style.display='none';
        if (createCompBtn) createCompBtn.style.display='none';
        renderCompetitiveList();
        const stf = document.getElementById('supply-status-filters'); if (stf) stf.style.display='none';
        const sr = document.getElementById('supply-budget-search'); if (sr) sr.style.display='none';
    } else {
        bOrders.classList.remove('btn-primary');
        if (bComp) bComp.classList.remove('btn-primary');
        bBudget.classList.add('btn-primary');
        budgetBox.style.display='block';
        if (compBox) compBox.style.display='none';
        ordersBox.style.display='none';
        createBtn.style.display='inline-flex';
        if (createCompBtn) createCompBtn.style.display='inline-flex';
        renderSupplyBudget();
        const stf = document.getElementById('supply-status-filters'); if (stf) stf.style.display='none';
        const sr = document.getElementById('supply-budget-search'); if (sr) sr.style.display='block';
    }
}
// Немедленная экспортная привязка (за пределами try/catch) чтобы избежать ситуаций, когда нижние ошибки прерывают выполнение
if (typeof window !== 'undefined') { window.switchSupplySub = window.switchSupplySub || switchSupplySub; }

function renderSupplyView(){ switchSupplySub(window.__supplySub || 'budget'); }

// Управление фильтрами (этап / вид работ / поставщик)
function setSupplyFilter(key, val){
    if (key==='group'){ window.__supplyFilterGroup = val; window.__supplyFilterWT=''; }
    else if (key==='wt'){ window.__supplyFilterWT = val; }
    else if (key==='supplier'){ window.__supplyFilterSupplier = val; }
    else if (key==='restype'){ window.__supplyFilterResType = val; }
    else if (key==='query'){ window.__supplyFilterQuery = val; }
    renderSupplyBudget();
}

// Подсветка превышения плана без блокировки ввода
function supplyQtyValidate(input){
    const plan = Number(input.getAttribute('data-plan-qty'))||0;
    const already = Number(input.getAttribute('data-ordered'))||0;
    const val = Number(input.value)||0;
    const sum = already + val;
    if (sum > plan && plan>0){
        input.style.borderColor='#d92d20';
        input.style.background='#fff0f0';
        input.title='Сумма заказов превышает план';
    } else {
        input.style.borderColor='var(--border)';
        input.style.background='#fff';
        input.title='';
    }
}
// Экспорт сразу после объявления, чтобы inline oninput имел доступ даже при сбоях ниже
if (typeof window !== 'undefined') { window.supplyQtyValidate = window.supplyQtyValidate || supplyQtyValidate; }

// Таблица выбора ресурсов для заказа с фильтрами и подсветкой
function renderSupplyBudget(){
    ensureSupplyData();
    const host = document.getElementById('supply-budget-container'); if(!host) return;
    const groups = currentObject?.data?.plan?.groups || [];
    const selGroup = window.__supplyFilterGroup || '';
    const selWT = window.__supplyFilterWT || '';
    const selSupplier = window.__supplyFilterSupplier || '';
    // Списки для фильтров
    const groupOptions = ['<option value="">Все этапы</option>'].concat(groups.map(g=>`<option value="${g.id}" ${g.id===selGroup?'selected':''}>${escapeHtml(g.name||'Этап')}</option>`)).join('');
    const groupObj = groups.find(g=>g.id===selGroup);
    const wts = groupObj ? (groupObj.workTypes||[]) : groups.flatMap(g=>g.workTypes||[]);
    const wtOptions = ['<option value="">Все виды работ</option>'].concat(wts.map(w=>`<option value="${w.id}" ${w.id===selWT?'selected':''}>${escapeHtml(w.name||'Вид работ')}</option>`)).join('');
    const supplierSet = new Set();
    groups.forEach(g=>(g.workTypes||[]).forEach(w=>(w.resources||[]).forEach(r=>{ if (r.supplier) supplierSet.add(r.supplier); })));
    const supplierOptions = ['<option value="">Все поставщики</option>'].concat(Array.from(supplierSet).sort().map(s=>`<option value="${escapeHtml(s)}" ${s===selSupplier?'selected':''}>${escapeHtml(s)}</option>`)).join('');
    const selRes = window.__supplyFilterResType || '';
    const resSet = new Set(); groups.forEach(g=> (g.workTypes||[]).forEach(w=> (w.resources||[]).forEach(r=> resSet.add(r.resource||'') )));
    const catalog = resourceCatalog();
    const resOptions = ['<option value="">Все ресурсы</option>'].concat(Array.from(resSet).sort().map(code=>{
        const it = catalog.find(c=>c.code===code);
        return `<option value="${code}" ${code===selRes?'selected':''}>${escapeHtml(it? it.name : (code||'—'))}</option>`;
    }).join(''));
    const q = (window.__supplyFilterQuery||'').trim();

    const orderUsage = computeOrderedQuantities();
    // Построим карту номеров строк плана (№ вида работ.№ ресурса)
    const rowNumberMap = {};
    let wtGlobalIndex = 0;
    groups.forEach(g=>{
        (g.workTypes||[]).forEach(wt=>{
            wtGlobalIndex += 1;
            (wt.resources||[]).forEach((r,ri)=>{ rowNumberMap[r.id] = wtGlobalIndex + '.' + (ri+1); });
        });
    });
    let html = `
    <div style='display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px; align-items:center;'>
        <select class='styled-select' title='Этап' onchange="setSupplyFilter('group', this.value)">${groupOptions}</select>
        <select class='styled-select' title='Вид работ' onchange="setSupplyFilter('wt', this.value)">${wtOptions}</select>
        <select class='styled-select' title='Поставщик' onchange="setSupplyFilter('supplier', this.value)">${supplierOptions}</select>
        <select class='styled-select' title='Тип ресурса' onchange="setSupplyFilter('restype', this.value)">${resOptions}</select>
    </div>`;
    html += '<div class="table-wrapper"><table class="smeta-table"><thead><tr><th>№</th><th>Этап</th><th>Вид работ</th><th class="supply-name-col">Название</th><th>Ед.изм</th><th>План, Заказано, Доступно</th><th>Заказать</th><th>Выбор</th></tr></thead><tbody>';

    groups.forEach(g=>{
        (g.workTypes||[]).forEach(wt=>{
            (wt.resources||[]).forEach(r=>{
                if (selGroup && g.id!==selGroup) return;
                if (selWT && wt.id!==selWT) return;
                if (selSupplier && (r.supplier||'')!==selSupplier) return;
                if (selRes && (r.resource||'')!==selRes) return;
                if (q){ const hay = [r.name||'', wt.name||''].join(' ').toLowerCase(); if (!hay.includes(q.toLowerCase())) return; }
                const planQty = Number(r.quantity)||0;
                const orderedQty = orderUsage[r.id]||0;
                const available = Math.max(planQty - orderedQty, 0);
                const overBase = orderedQty > planQty && planQty>0; // уже превышено
                const num = rowNumberMap[r.id] || '';
                html += `<tr${overBase?" style='background:#fff5f5;'":''}>
                    <td><button class='link-btn plan-jump' title='Перейти к строке бюджета' onclick="jumpToPlanRow('${r.id}')">${num}</button></td>
                    <td>${escapeHtml(g.name||'Этап')}</td>
                    <td>${escapeHtml(wt.name||'Вид работ')}</td>
                    <td>${resourceIconSVG(r.resource)||''}<span style='margin-left:6px;'>${escapeHtml(r.name||'')}</span></td>
                    <td>${escapeHtml(r.unit||'шт')}</td>
                    <td><span style='color:#07407b; font-weight:700;'>${planQty}</span> <span style='color:#111;'>&nbsp;|&nbsp;</span> <span style='color:#6b21a8; font-weight:700;'>${orderedQty}</span> <span style='color:#111;'>&nbsp;|&nbsp;</span> <span style='color:#065f46; font-weight:700;'>${available}</span></td>
                    <td><input type='number' min='0' step='0.01' class='supply-order-qty supply-qty-input' data-plan-qty='${planQty}' data-ordered='${orderedQty}' data-res-id='${r.id}' value='0' oninput='supplyQtyValidate(this)'></td>
                    <td class='center'><input type='checkbox' class='supply-select' data-res-id='${r.id}'></td>
                </tr>`;
            });
        });
    });
    html += '</tbody></table></div>';
    host.innerHTML = html + "<div style='margin-top:8px; font-size:12px; color:#6b7785;'>Можно заказывать больше плана: ячейки с превышением подсвечиваются красным.</div>";
}
function computeOrderedQuantities(){
    const usage = {};
    (currentObject?.data?.supply?.orders||[]).forEach(o=>{
        // Если заказ помечен как возврат – освобождаем доступность (не учитываем)
        if (o.status === 'возврат') return;
        (o.items||[]).forEach(it=>{
            if (!usage[it.planRowId]) usage[it.planRowId]=0;
            usage[it.planRowId] += Number(it.qtyOrdered)||0;
        });
    });
    return usage;
}
// Создание документа заказа из текущего выбора
function createSupplyOrderFromSelection(){
    ensureSupplyData();
    // Собираем отмеченные ресурсы и их количества
    const rows = Array.from(document.querySelectorAll('.supply-select:checked'));
    if (!rows.length){ alert('Не выбраны ресурсы для заказа'); return; }
    const items = [];
    let invalid = false;
    rows.forEach(chk=>{
        const id = chk.getAttribute('data-res-id');
        const qtyInput = document.querySelector(`.supply-order-qty[data-res-id='${id}']`);
        const supplierInput = document.querySelector(`.supply-supplier[data-res-id='${id}']`);
        const qty = qtyInput ? Number(qtyInput.value)||0 : 0;
        if (!qty || qty<=0){ invalid=true; }
        items.push({ planRowId:id, qtyOrdered: qty, supplier: supplierInput ? supplierInput.value.trim() : '' });
    });
    if (invalid){ alert('Для некоторых выбранных ресурсов количество не указано (>0)'); return; }
    // Генерируем документ c разбиением по поставщикам внутри
    const docId = generateOrderId();
    const order = {
        id: docId,
        createdAt: new Date().toISOString().slice(0,10),
        status: 'новая', // статусы: новая, утверждено, на оплату, оплачено, заказано, доставляется, доставлено
        items,
        supplierGroups: groupItemsBySupplier(items),
        photosReceipt: [],
        itemsPhotos: {}, // planRowId -> array of photos
        competitive: {} // planRowId -> [{supplier, price, eta}]
    };
    currentObject.data.supply.orders.push(order);
    saveObject();
    alert('Заказ сформирован: ' + docId);
    switchSupplySub('orders');
}
// Гарантируем доступность функции вне зависимости от последующих ошибок
if (typeof window !== 'undefined') { window.createSupplyOrderFromSelection = window.createSupplyOrderFromSelection || createSupplyOrderFromSelection; }
function groupItemsBySupplier(items){
    const map = {};
    items.forEach(it=>{
        const sup = it.supplier || '—';
        if (!map[sup]) map[sup] = { supplier: sup, status: 'новая', items: [] };
        map[sup].items.push(it);
    });
    return Object.values(map);
}
// ===== Конкурентные документы =====
// Структура compDoc: { id, createdAt, status:'Новый'|'Завершен', items:[{planRowId, qtyPlan, pricePlan, sumPlan, competitors:[{supplier, price, sum, eta, photo, taxRating, license, score}]}] }
function createCompetitiveDocFromSelection(){
    ensureSupplyData();
    const rows = Array.from(document.querySelectorAll('.supply-select:checked'));
    if (!rows.length){ alert('Не выбраны позиции для конкурентного листа'); return; }
    const compId = generateCompetitiveId();
    const items = [];
    rows.forEach(chk=>{
        const id = chk.getAttribute('data-res-id');
        const loc = locatePlanRow(id);
        if (!loc || !loc.row) return;
        const qty = Number(loc.row.quantity)||0;
        const price = Number(loc.row.price)||0;
        items.push({
            planRowId:id,
            name: loc.row.name||'',
            unit: loc.row.unit||'шт',
            resource: loc.row.resource||'M',
            qtyPlan: qty,
            pricePlan: price,
            sumPlan: qty*price,
            competitors: []
        });
    });
    if (!items.length){ alert('Нет валидных позиций'); return; }
    const doc = { id: compId, createdAt:new Date().toISOString().slice(0,10), status:'Новый', items };
    currentObject.data.supply.compDocs.push(doc);
    saveObject();
    switchSupplySub('competitive');
    openCompetitiveDocModal(compId);
}
function generateCompetitiveId(){
    const seq = currentObject.nextCompSeq || 1;
    currentObject.nextCompSeq = seq + 1;
    return `КЛ-${seq}`;
}
function renderCompetitiveList(){
    ensureSupplyData();
    const host = document.getElementById('supply-competitive-container'); if(!host) return;
        const list = (currentObject.data.supply.compDocs || []).filter(doc => doc.status !== 'Завершен');
    if (!list.length){ host.innerHTML = '<p>Нет конкурентных документов.</p>'; return; }
    let html='';
    list.slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')).forEach(d=>{
        const totalPositions = d.items.length;
        const totalSum = d.items.reduce((s,it)=> s + (Number(it.sumPlan)||0),0);
        const menuId = `comp-menu-${d.id}`;
        html += `<div class='supply-order-block'>
            <div class='supply-order-head' style='align-items:center;'>
                <div style='display:flex;flex-direction:column;gap:4px;'>
                    <div style='display:flex; gap:8px; align-items:center;'>
                        <div class='comp-doc-status state-${(d.status||'').replace(/\s+/g,'-')}' onclick="cycleCompetitiveDocStatus('${d.id}')" title='Изменить статус'>${d.status}</div>
                        <div><strong>${d.id}</strong> <span style='color:#6b7785; font-size:12px;'>${d.createdAt}</span></div>
                    </div>
                </div>
                <div class='action-btn-set' style='margin-left:auto;'>
                    <button class='action-btn icon-only' onclick="openCompetitiveDocModal('${d.id}')" title='Открыть' aria-label='Открыть'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M8 3h7l5 5v13H8z"/><path d="M15 3v6h6"/></svg>
                    </button>
                    <button class='action-btn icon-only' onclick="openCompetitiveDocModal('${d.id}')" title='Изменить' aria-label='Изменить'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M3 21h4l11-11-4-4L3 17v4z"/><path d="M14 6l4 4"/></svg>
                    </button>
                    <button class='action-btn icon-only' onclick="printCompetitiveDoc('${d.id}')" title='Скачать/Печать' aria-label='Скачать/Печать'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><polyline points="6 9 6 4 18 4 18 9"/><rect x="6" y="13" width="12" height="8" rx="1"/><line x1="6" y1="9" x2="18" y2="9"/></svg>
                    </button>
                    <button class='action-btn danger icon-only' onclick="deleteCompetitiveDoc('${d.id}')" title='Удалить' aria-label='Удалить'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><polyline points="3 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M8 6V4h8v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
            <div class='supply-order-body'>
                <div style='font-size:12px; color:#6b7785;'>Позиций: ${totalPositions}, Плановая сумма: ${formatCurrency(totalSum)} UZS</div>
            </div>
        </div>`;
    });
    host.innerHTML = html;
}
function toggleCompDocMenu(id){
    document.querySelectorAll('.comp-doc-menu.open').forEach(m=>{ if(m.id!==id) m.classList.remove('open'); });
    const el = document.getElementById(id); if(!el) return; el.classList.toggle('open');
    document.addEventListener('click', function handler(e){
        if (!el.contains(e.target) && !e.target.classList.contains('comp-doc-kebab')){ el.classList.remove('open'); document.removeEventListener('click', handler); }
    });
}
window.toggleCompDocMenu = toggleCompDocMenu;
// Модалка конкурентного документа
function ensureCompetitiveDocModal(){
    let ov = document.getElementById('comp-doc-modal');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id='comp-doc-modal';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);display:none;z-index:10000;';
    const box=document.createElement('div');
    box.id='comp-doc-modal-box';
    box.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;width:96vw;max-width:1250px;max-height:92vh;overflow:auto;border-radius:16px;box-shadow: var(--shadow);padding:0;';
    ov.appendChild(box);
    document.body.appendChild(ov);
    return ov;
}
function openCompetitiveDocModal(id){
    ensureCompetitiveDocModal();
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===id); if(!doc){ alert('Документ не найден'); return; }
    window.__openCompDocId = id;
    const ov=document.getElementById('comp-doc-modal'); if(ov) ov.style.display='block';
    window.__compDocFull = true; // сразу во весь экран
    applyCompDocFullscreen();
    renderCompetitiveDocModal(doc);
}
function closeCompetitiveDocModal(){ const ov=document.getElementById('comp-doc-modal'); if (ov) ov.style.display='none'; window.__openCompDocId=null; }
function renderCompetitiveDocModal(doc){
    const box = document.getElementById('comp-doc-modal-box'); if(!box) return;
        const headTotal = doc.items.reduce((s,it) => s + (Number(it.sumPlan) || 0), 0);
    box.innerHTML = `
    <style>
      .comp-doc-header{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;position:sticky;top:0;background:#fff;z-index:5}
      .comp-doc-title{font-size:18px;font-weight:700}
      .comp-doc-date{color:#6b7785;font-size:12px}
      .comp-doc-actions{margin-left:auto;display:flex;gap:8px}
      .comp-doc-body{padding:12px 16px}
      .comp-doc-summary{font-size:12px;color:#6b7785;margin-bottom:10px}
      .comp-doc-footer{margin-top:16px;display:flex;gap:12px}
      .comp-doc-table-wrapper{max-height:calc(100vh - 160px);overflow:auto}
    .comp-doc-table thead th{position:sticky;top:0;background:#f8fafc;z-index:2}
      .comp-col-index{width:44px}
      .comp-col-item{width:340px}
      .item-block{display:flex;flex-direction:column;gap:4px}
      .item-name{font-weight:700}
      .im-label{color:#64748b;margin-right:4px}
      .comp-col-suppliers{min-width:720px}
    .comp-supplier-block{border:1px solid var(--border);border-radius:8px;padding:8px;margin:6px 0;display:grid;grid-template-columns:1fr;gap:6px}
      .comp-line label{display:block;font-size:11px;color:#475569;margin-bottom:2px}
      .comp-line input[type="text"], .comp-line input[type="number"]{width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px}
      .comp-check{display:inline-flex;gap:6px;align-items:center}
      .photo-line{cursor:pointer}
      .comp-photo-img{width:100%;height:120px;object-fit:cover;border:1px solid var(--border);border-radius:6px}
      .comp-photo-placeholder{height:120px;background:#f1f5f9;border:1px dashed #94a3b8;color:#64748b;border-radius:6px;display:flex;align-items:center;justify-content:center}
      .score-bar{background:#e2e8f0;border-radius:6px;height:22px;overflow:hidden}
      .score-bar-fill{background:#16a34a;color:#fff;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700}
      .winner-line{display:flex;align-items:center;gap:8px}
      .winner-label{color:#16a34a;font-weight:700;font-size:12px}
      .btn-xs{padding:4px 8px;font-size:12px}
    </style>
    <div class='comp-doc-header'>
        <div class='comp-doc-title'>Конкурентный лист <strong>${doc.id}</strong></div>
        <div class='comp-doc-date'>Дата формирования: ${doc.createdAt}</div>
    <div class='comp-doc-status state-${(doc.status||'').replace(/\s+/g,'-')}' onclick="cycleCompetitiveDocStatus('${doc.id}')" title='Изменить статус'>${doc.status}</div>
        <div class='comp-doc-actions'>
            <button class='btn btn-success' onclick="applyCompetitiveWinnerToOrder('${doc.id}')">Сформировать заказ из победителей</button>
            <button class='btn btn-ghost' onclick="printCompetitiveDoc('${doc.id}')">Печать</button>
            <button class='btn btn-danger' onclick="deleteCompetitiveDoc('${doc.id}')">Удалить</button>
            <button class='btn' onclick='closeCompetitiveDocModal()'>Закрыть</button>
        </div>
    </div>
    <div class='comp-doc-body'>
        <div class='comp-doc-summary'>Плановая сумма: <strong>${formatCurrency(headTotal)}</strong> UZS. Балл = цена (до 4) + срок (до 3) + рейтинг (до 2) + лицензия (1). Макс 10.</div>
        ${renderCompetitiveItemsTable(doc)}
    </div>`;
}
function toggleCompDocFullscreen(){
        const ov = document.getElementById('comp-doc-modal');
        const box = document.getElementById('comp-doc-modal-box');
        if (!ov || !box) return;
        window.__compDocFull = !window.__compDocFull;
        if (window.__compDocFull){
                ov.dataset.bg = ov.style.background;
                box.dataset.style = box.getAttribute('style')||'';
                ov.style.background = 'rgba(0,0,0,0.25)';
                box.style.position='fixed';
                box.style.left='0';
                box.style.top='0';
                box.style.transform='none';
                box.style.width='100vw';
                box.style.height='100vh';
                box.style.maxWidth='none';
                box.style.maxHeight='none';
                box.style.borderRadius='0';
                box.style.padding='0';
                box.style.overflow='auto';
        } else {
                // restore to default modal styles
                ov.style.background = ov.dataset.bg || 'rgba(0,0,0,0.45)';
                box.style.position='absolute';
                box.style.left='50%';
                box.style.top='50%';
                box.style.transform='translate(-50%,-50%)';
                box.style.width='96vw';
                box.style.height='';
                box.style.maxWidth='1250px';
                box.style.maxHeight='92vh';
                box.style.borderRadius='16px';
                box.style.padding='0';
                box.style.overflow='auto';
        }
        // update header button label
        if (window.__openCompDocId){
                const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===window.__openCompDocId);
                if (doc) renderCompetitiveDocModal(doc);
        }
}
function applyCompDocFullscreen(){
    const ov = document.getElementById('comp-doc-modal');
    const box = document.getElementById('comp-doc-modal-box');
    if (!ov || !box) return;
    if (window.__compDocFull){
        ov.style.background='rgba(0,0,0,0.25)';
        box.style.position='fixed';
        box.style.left='0';
        box.style.top='0';
        box.style.transform='none';
        box.style.width='100vw';
        box.style.height='100vh';
        box.style.maxWidth='none';
        box.style.maxHeight='none';
        box.style.borderRadius='0';
        box.style.padding='0';
        box.style.overflow='auto';
    } else {
        ov.style.background='rgba(0,0,0,0.45)';
        box.style.position='absolute';
        box.style.left='50%';
        box.style.top='50%';
        box.style.transform='translate(-50%,-50%)';
        box.style.width='96vw';
        box.style.height='';
        box.style.maxWidth='1250px';
        box.style.maxHeight='92vh';
        box.style.borderRadius='16px';
        box.style.padding='0';
        box.style.overflow='auto';
    }
}
function openCompetitiveDocPreviewWindow(docId){
        const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
        const w = window.open('', '_blank'); if(!w){ alert('Откройте всплывающие окна'); return; }
        const total = doc.items.reduce((s,it)=> s + (Number(it.sumPlan)||0),0);
        const html = `<html><head><meta charset='utf-8'><title>${doc.id} – просмотр</title>
        <style>body{font-family:Arial,sans-serif;margin:0;} header{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #ddd;position:sticky;top:0;background:#fff;}
        .wrap{padding:12px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #999;padding:6px;font-size:12px;vertical-align:top;} th{background:#f1f5f9;} .win{background:#e7f9ed;} .score{font-weight:700;}
        button{padding:6px 10px;border:1px solid #ccc;background:#f8fafc;border-radius:6px;cursor:pointer;} button:hover{background:#eef2f7;}
        </style></head><body>
        <header>
            <div><strong>${doc.id}</strong> <span style='color:#6b7785;font-size:12px;'>${doc.createdAt}</span></div>
            <div style='display:flex;gap:8px;'>
                <button onclick='window.print()'>Печать</button>
                <button onclick='window.close()'>Закрыть</button>
            </div>
        </header>
        <div class='wrap'>
            <div>Статус: ${doc.status}. Плановая сумма: ${total.toLocaleString()} UZS</div>
            <table><thead><tr><th>#</th><th>Название</th><th>Кол-во</th><th>Цена план</th><th>Сумма план</th><th colspan='5'>Конкуренты</th></tr></thead><tbody>
            ${(doc.items||[]).map((it,i)=>{
                const comps = (it.competitors||[]).slice(); while(comps.length<5) comps.push({});
                return `<tr><td>${i+1}</td><td>${(it.name||'').replace(/</g,'&lt;')}</td><td>${it.qtyPlan}</td><td>${(it.pricePlan||0).toLocaleString()}</td><td>${(it.sumPlan||0).toLocaleString()}</td>${
                        comps.slice(0,5).map(c=>`<td class='${c.selected?'win':''}'>${(c.supplier||'').replace(/</g,'&lt;')}<br>Цена:${c.price||''}<br>Сум:${c.sum||''}<br>Срок:${(c.eta||'').replace(/</g,'&lt;')}<br>Рейт:${c.taxRating||''}<br>${c.license?'Лиц':''}<br><span class='score'>${c.score||''}</span></td>`).join('')
                    }</tr>`;
            }).join('')}
            </tbody></table>
        </div>
        </body></html>`;
        w.document.write(html); w.document.close(); w.focus();
}
function renderCompetitiveItemsTable(doc, printMode){
    printMode = !!printMode;
    const headers = ['№','Позиция (план / характеристики)','Поставщики'];
    let body='';
    const visibleItems = (doc.status==='Новый') ? (doc.items.filter(it=> !it.applied)) : (doc.items||[]);
    visibleItems.forEach((it,idx)=>{
        const comps = it.competitors||[];
        while(comps.length<5) comps.push({supplier:'',price:0,sum:0,eta:'',photo:'',taxRating:0,license:false,score:0,selected:false,maxQty:''});
        const compBlocks = comps.map((c,i)=>{
            // auto-calc sum from qtyPlan * price
            const qty = Number(it.qtyPlan)||0;
            const priceNum = Number(c.price)||0;
            c.sum = Math.round((qty * priceNum) * 100) / 100;
            const scorePct = c.score? Math.min(100, (c.score/10)*100):0;
            const selectedCls = c.selected? 'winner-selected' : '';
            return `<div class='comp-supplier-block ${selectedCls}'>
                <div class='comp-line supplier-line'>
                    ${printMode?`<div class='supplier-inline'><div class='supplier-name-inline'>${escapeHtml(c.supplier||'')}</div><div class='winner-badge ${c.selected?'selected':''}'>✔</div></div>`:
                    (()=>{ const opts = (currentObject?.data?.supply?.suppliers||[]).slice().sort((a,b)=> (a.name||'').localeCompare(b.name||''))
                        .map(s=>`<option value='${escapeHtml(s.name||'')}' ${s.name===(c.supplier||'')?'selected':''}>${escapeHtml(s.name||'')}</option>`).join('');
                        return `<div class='supplier-inline'>
                            <select data-cfield='supplier' data-row='${idx}' data-cidx='${i}' class='styled-select compd-input supplier-input'><option value=''>— Выберите —</option>${opts}</select>
                            <div class='winner-badge ${c.selected?'selected':''}' onclick=\"toggleCompetitiveWinner('${doc.id}',${idx},${i})\" title='${c.selected?'Снять выбор':'Выбрать победителя'}'>✔</div>
                        </div>`; })()}
                </div>
                <div class='comp-line'>
                    <label>Макс. кол-во поставки</label>
                    ${printMode?`<div>${escapeHtml(c.maxQty||'')}</div>`:`<input type='text' placeholder='Максимальное количество' value='${escapeHtml(c.maxQty||'')}' data-cfield='maxQty' data-row='${idx}' data-cidx='${i}' class='compd-input'>`}
                </div>
                <div class='comp-line'>
                    <label>Цена</label>
                    ${printMode?`<div>${c.price||''}</div>`:`<input type='number' step='0.01' placeholder='Цена за ед.' value='${c.price||''}' data-cfield='price' data-row='${idx}' data-cidx='${i}' class='compd-input'>`}
                </div>
                <div class='comp-line'>
                    <label>Сумма поставки</label>
                    <div class='comp-sum' data-row='${idx}' data-cidx='${i}'>${c.sum||''}</div>
                </div>
                <div class='comp-line'>
                    <label>Срок поставки (дней)</label>
                    ${printMode?`<div>${escapeHtml(c.eta||'')}</div>`:`<input type='text' placeholder='Напр. 5 дней' value='${escapeHtml(c.eta||'')}' data-cfield='eta' data-row='${idx}' data-cidx='${i}' class='compd-input'>`}
                </div>
                <div class='comp-line'>
                    <label>Рейтинг налоговый</label>
                    ${printMode?
                        `<div class='star-rating static'>${[1,2,3,4,5].map(st=>`<svg class='star' viewBox='0 0 20 20' width='20' height='20' style='color:${(c.taxRating||0)>=st?"#f59e0b":"#e5e7eb"}' xmlns='http://www.w3.org/2000/svg'><path fill='currentColor' d='M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z'/></svg>`).join('')}</div>`
                        :
                        `<div class='star-rating'>${[1,2,3,4,5].map(st=>`<button type='button' class='star-btn' title='${st}' onclick=\"setCompetitiveTaxRating('${doc.id}',${idx},${i},${st})\"><svg class='star' viewBox='0 0 20 20' width='22' height='22' style='color:${(c.taxRating||0)>=st?"#f59e0b":"#e5e7eb"}' xmlns='http://www.w3.org/2000/svg'><path fill='currentColor' d='M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z'/></svg></button>`).join('')}</div>`
                    }
                </div>
                <div class='comp-line'>
                    <label class='comp-check'>Лицензия</label>
                    ${printMode?`<div>${c.license?'Да':'Нет'}</div>`:`<select data-cfield='license' data-row='${idx}' data-cidx='${i}' class='compd-input'><option value='no' ${!c.license?'selected':''}>Нет</option><option value='yes' ${c.license?'selected':''}>Да</option></select>`}
                </div>
                ${printMode?'':``}
                <div class='comp-line ${printMode?'':'photo-line'}' data-row='${idx}' data-cidx='${i}' ${printMode?'':`onclick=\"triggerCompPhoto('${doc.id}',${idx},${i})\"`}>
                    ${c.photo?`<img src='${c.photo}' class='comp-photo-img'>`:`<div class='comp-photo-placeholder'>Фото товара</div>`}
                </div>
                <div class='comp-line'>
                    <div class='score-bar' title='Балл: ${c.score||0}'>
                        <div class='score-bar-fill' style='width:${scorePct}%;'>${c.score||0}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
        // Получаем вид работ для отображения
        let wtName = '';
        try { const loc = locatePlanRow(it.planRowId); wtName = loc && loc.wt ? (loc.wt.name||'') : ''; } catch(_) {}
        body += `<tr>
            <td class='comp-col-index'>${idx+1}</td>
            <td class='comp-col-item'>
                <div class='item-block'>
                    <div class='item-name'>${renderResourceBadge(it.resource)} ${escapeHtml(it.name||'')}</div>
                    <div class='item-meta'><span class='im-label'>Ед. изм:</span> ${escapeHtml(it.unit||'шт')}</div>
                    <div class='item-meta'><span class='im-label'>Вид работ:</span> ${escapeHtml(wtName||'')}</div>
                    <div class='item-meta'><span class='im-label'>Кол-во план:</span> ${it.qtyPlan}</div>
                    <div class='item-meta'><span class='im-label'>Цена план:</span> ${formatCurrency(it.pricePlan)}</div>
                    <div class='item-meta'><span class='im-label'>Сумма план:</span> ${formatCurrency(it.sumPlan)}</div>
                </div>
            </td>
            <td class='comp-col-suppliers'><div class='comp-suppliers-row'>${compBlocks}</div></td>
        </tr>`;
    });
    const table = `<div class='table-wrapper comp-doc-table-wrapper'><table class='smeta-table comp-doc-table'><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
    if (!printMode) setTimeout(()=>bindCompetitiveDocInputs(doc.id), 50);
    return table;
}
// Выбор фото через скрытый input: переустанавливаем handler при каждом вызове, чтобы корректно сохранять в нужный слот
function triggerCompPhoto(docId, rowIndex, cidx){
    let hidden = document.getElementById('comp-photo-hidden-input');
    if(!hidden){
        hidden = document.createElement('input');
        hidden.type='file';
        hidden.accept='image/*';
        hidden.className='hidden-file-input';
        hidden.id='comp-photo-hidden-input';
        document.body.appendChild(hidden);
    }
    hidden.onchange = () => {
        const file = hidden.files && hidden.files[0]; if(!file) return;
        const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
        const item = doc.items[rowIndex]; if(!item) return;
        const comp = item.competitors[cidx]; if(!comp) return;
        const reader = new FileReader();
        reader.onload = ev => {
            comp.photo = ev.target.result;
            recomputeCompetitiveScores(doc, item, comp);
            saveObject();
            renderCompetitiveDocModal(doc);
        };
        reader.readAsDataURL(file);
        try{ hidden.value=''; }catch(_){ }
    };
    hidden.click();
}
function bindCompetitiveDocInputs(docId){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    document.querySelectorAll('.compd-input').forEach(inp=>{
        inp.addEventListener('change', e=>{
            const row = Number(inp.getAttribute('data-row')); const cidx = Number(inp.getAttribute('data-cidx')); const field = inp.getAttribute('data-cfield');
            if (!doc.items[row]) return; const comp = doc.items[row].competitors[cidx]; if(!comp) return;
            if (field==='license') { comp.license = (String(inp.value).toLowerCase()==='yes'); }
            else if (field==='price'||field==='taxRating') { comp[field]= Number(inp.value)||0; }
            else { comp[field]= (inp.value||'').toString().trim(); }
            recomputeCompetitiveScores(doc, doc.items[row], comp);
            saveObject();
            renderCompetitiveDocModal(doc);
        });
    });
}
function recomputeCompetitiveScores(doc, item, comp){
    // Новая формула (макс 10):
    // Цена: до 4 баллов (минимальная цена среди заполненных получает 4, остальные пропорционально min/price)
    // Срок поставки: до 3 баллов (<=1 день:3, <=3:2, <=7:1, иначе 0)
    // Рейтинг налоговый: до 2 баллов (taxRating/5*2)
    // Лицензия: 1 балл если есть
    try {
        let filledPrices = [];
        (item.competitors||[]).forEach(c=>{ if (c && c.price>0) filledPrices.push(c.price); });
        const minPrice = filledPrices.length? Math.min(...filledPrices):0;
        let priceScore = 0;
        if (minPrice>0 && comp.price>0){ priceScore = 4 * (minPrice / comp.price); if (priceScore>4) priceScore=4; }
        let days = 999;
        if (comp.eta){ const m = comp.eta.match(/\d+/); if (m) days = Number(m[0])||999; }
        let deliveryScore = 0;
        if (days<=1) deliveryScore = 3; else if (days<=3) deliveryScore = 2; else if (days<=7) deliveryScore = 1; else deliveryScore = 0;
        const tax = Math.min(5, Math.max(0, Number(comp.taxRating)||0));
        const taxScore = (tax/5)*2;
        const licenseScore = comp.license ? 1 : 0;
        comp.score = Math.round((priceScore + deliveryScore + taxScore + licenseScore)*10)/10;
        // Auto-calc sum each time based on price and planned qty
        const qty = Number(item.qtyPlan)||0; const price = Number(comp.price)||0;
        comp.sum = Math.round(qty * price * 100)/100;
    } catch(e){ comp.score = 0; }
}
function selectCompetitiveWinner(docId, rowIndex, compIndex){
    // Deprecated: replaced by toggleCompetitiveWinner
    toggleCompetitiveWinner(docId, rowIndex, compIndex);
}
function toggleCompetitiveWinner(docId, rowIndex, compIndex){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    const item = doc.items[rowIndex]; if(!item) return;
    const comps = item.competitors||[];
    const target = comps[compIndex]; if(!target) return;
    if (target.selected){
        target.selected = false;
    } else {
        comps.forEach(c=> c.selected=false);
        target.selected = true;
    }
    saveObject();
    renderCompetitiveDocModal(doc);
}
function cycleCompetitiveDocStatus(docId){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    const states = ['Новый','Заказ сформирован'];
    const idx = states.indexOf(doc.status);
    doc.status = states[(idx+1)%states.length];
    if (doc.status==='Новый'){ (doc.items||[]).forEach(it=>{ delete it.applied; }); }
    saveObject();
    renderCompetitiveDocModal(doc);
    renderCompetitiveList();
}
function setCompetitiveTaxRating(docId, rowIndex, cidx, value){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    const item = doc.items[rowIndex]; if(!item) return;
    const comp = item.competitors[cidx]; if(!comp) return;
    comp.taxRating = Math.max(0, Math.min(5, Number(value)||0));
    recomputeCompetitiveScores(doc, item, comp);
    saveObject();
    renderCompetitiveDocModal(doc);
}
function markCompetitiveDocDone(docId){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    doc.status = doc.status==='Новый' ? 'Завершен' : 'Новый';
    saveObject();
    renderCompetitiveDocModal(doc);
    renderCompetitiveList();
}
function deleteCompetitiveDoc(docId){
    const list = currentObject.data.supply.compDocs||[];
    const idx = list.findIndex(d=>d.id===docId);
    if (idx===-1) return;
    if(!confirm('Удалить конкурентный документ?')) return;
    list.splice(idx,1);
    saveObject();
    closeCompetitiveDocModal();
    renderCompetitiveList();
}
function applyCompetitiveWinnerToOrder(docId){
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    const supplierMap = {};
    (doc.items||[]).forEach(it=>{
        const win = (it.competitors||[]).find(c=>c.selected && c.supplier);
        if (!win) return;
        const supplier = (win.supplier||'').trim(); if(!supplier) return;
        const qty = Number(it.qtyPlan)||0;
        // Данные плана для названия и единицы
        const info = locatePlanRow(it.planRowId);
        const name = info?.row?.name || it.planRowId;
        const unit = info?.row?.unit || '';
        const price = Number(win.price)||0;
        const sum = Math.round(qty * price * 100)/100;
        if (!supplierMap[supplier]) supplierMap[supplier] = [];
        supplierMap[supplier].push({ planRowId: it.planRowId, name, unit, qtyOrdered: qty, price, sum, comment: '' });
        it.applied = true; // помечаем позицию примененной
    });
    const suppliers = Object.keys(supplierMap);
    if (!suppliers.length){ alert('Нет выбранных победителей'); return; }
    const createdIds = [];
    suppliers.forEach(supplier=>{
        const orderId = generateZkOrderId();
        const items = supplierMap[supplier];
        const order = { id: orderId, type: 'ZK', supplier, createdAt: new Date().toISOString().slice(0,10), status: 'новая', items, photosReceipt: [], itemsPhotos: {}, supplierGroups: [], competitive: {} };
        currentObject.data.supply.orders.push(order);
        createdIds.push(orderId);
    });
    doc.status = 'Заказ сформирован';
    // Снимок документа победителей (как раньше)
    try{
        const snapshot = { id: generateCompetitiveId(), createdAt: new Date().toISOString().slice(0,10), status: 'Заказ сформирован', items: [] };
        (doc.items||[]).forEach(it=>{
            const winList = (it.competitors||[]).filter(c=>c.selected && c.supplier);
            if (winList.length){
                const clone = JSON.parse(JSON.stringify(it));
                clone.competitors = winList;
                delete clone.applied;
                snapshot.items.push(clone);
            }
        });
        if (snapshot.items.length){ currentObject.data.supply.compDocs.push(snapshot); }
    }catch(_){ }
    saveObject();
    alert('Созданы заказы: ' + createdIds.join(', '));
    // Открываем первый созданный
    if (createdIds.length){ openSupplyOrderModal(createdIds[0]); }
    renderCompetitiveDocModal(doc);
    renderCompetitiveList();
}
function printCompetitiveDoc(docId){
    // WYSIWYG print of competitive document modal
    const doc = (currentObject.data.supply.compDocs||[]).find(x=>x.id===docId); if(!doc) return;
    // Ensure modal exists and render content (in hidden state)
    let ov = document.getElementById('comp-doc-modal');
    if (!ov){
        ov = document.createElement('div'); ov.id='comp-doc-modal'; ov.style.cssText='display:none;';
        const box = document.createElement('div'); box.id='comp-doc-modal-box'; ov.appendChild(box); document.body.appendChild(ov);
    }
    // Use existing open logic to populate modal content
    openCompetitiveDocModal(docId);
    // Immediately hide overlay to avoid flicker
    ov.style.display='none';
    const box = document.getElementById('comp-doc-modal-box'); if(!box) return;
    const w = window.open('', '_blank'); if(!w){ alert('Откройте всплывающие окна'); return; }
    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Конкурентный лист ${escapeHtml(doc.id)}</title>
        <link rel='stylesheet' href='styles.css'>
        <style>.comp-doc-header{position:static;}</style>
    </head><body>${box.innerHTML}</body></html>`;
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
}
// Экспорт в глобал во избежание ReferenceError из inline onclick
window.createCompetitiveDocFromSelection = createCompetitiveDocFromSelection;
window.openCompetitiveDocModal = openCompetitiveDocModal;
window.closeCompetitiveDocModal = closeCompetitiveDocModal;
window.selectCompetitiveWinner = selectCompetitiveWinner;
window.setCompetitiveTaxRating = setCompetitiveTaxRating;
window.toggleCompetitiveWinner = toggleCompetitiveWinner;
window.cycleCompetitiveDocStatus = cycleCompetitiveDocStatus;
window.markCompetitiveDocDone = markCompetitiveDocDone;
window.applyCompetitiveWinnerToOrder = applyCompetitiveWinnerToOrder;
window.printCompetitiveDoc = printCompetitiveDoc;
window.toggleCompDocFullscreen = toggleCompDocFullscreen;
window.openCompetitiveDocPreviewWindow = openCompetitiveDocPreviewWindow;
window.deleteCompetitiveDoc = deleteCompetitiveDoc;
window.triggerCompPhoto = triggerCompPhoto;
function generateOrderId(){
    const seq = currentObject.nextOrderSeq || 1;
    const today = new Date();
    const ds = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    currentObject.nextOrderSeq = seq + 1;
    return `PO-${ds}-${String(seq).padStart(3,'0')}`;
}
function generateZkOrderId(){
    const seq = currentObject.nextZkSeq || 1;
    currentObject.nextZkSeq = seq + 1;
    return `ЗК-${String(seq).padStart(3,'0')}`;
}
function renderSupplyOrders(){
    const host = document.getElementById('supply-orders-container'); if(!host) return;
    const orders = currentObject?.data?.supply?.orders || [];
    if (!orders.length){ host.innerHTML = '<p>Нет документов снабжения.</p>'; return; }
    const statusFilter = window.__supplyStatusFilter || 'all';
    const search = (window.__supplyOrderSearch || '').trim().toLowerCase();
    let html='';
    orders.slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')).forEach(o=>{
        if (statusFilter!=='all' && o.status!==statusFilter) return;
        if (search){
            const hay = [o.id, o.status, o.createdAt].join(' ').toLowerCase();
            if (!hay.includes(search)) return;
        }
        const totalItems = o.items.reduce((s,it)=> s + (Number(it.qtyOrdered)||0),0);
        html += `<div class='supply-order-block'>
            <div class='supply-order-head'>
                <div style='display:flex; gap:10px; align-items:center;'>
                    <div class='supply-status status-${o.status.replace(/\s+/g,'-')}' onclick="cycleOrderStatus('${o.id}')" title='Изменить статус'>${o.status}</div>
                    <div><strong>${o.id}</strong> ${o.type==='ZK'?`<span style='color:#059669; font-size:12px; font-weight:500;'>${escapeHtml(o.supplier||'')}</span>`:''} <span style='color:#6b7785; font-size:12px;'>${o.createdAt}</span></div>
                </div>
                <div class='action-btn-set'>
                    <button class='action-btn icon-only' onclick="openSupplyOrderModal('${o.id}')" title='Открыть' aria-label='Открыть'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M8 3h7l5 5v13H8z"/><path d="M15 3v6h6"/></svg>
                    </button>
                    <button class='action-btn icon-only' onclick="openSupplyOrderModal('${o.id}')" title='Изменить' aria-label='Изменить'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M3 21h4l11-11-4-4L3 17v4z"/><path d="M14 6l4 4"/></svg>
                    </button>
                    <button class='action-btn icon-only' onclick="printSupplyOrder('${o.id}')" title='Скачать/Печать' aria-label='Скачать/Печать'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><polyline points="6 9 6 4 18 4 18 9"/><rect x="6" y="13" width="12" height="8" rx="1"/><line x1="6" y1="9" x2="18" y2="9"/></svg>
                    </button>
                    <button class='action-btn danger icon-only' onclick="deleteSupplyOrder('${o.id}')" title='Удалить' aria-label='Удалить'>
                        <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><polyline points="3 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M8 6V4h8v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
            <div class='supply-order-body'>
                <div style='font-size:12px; color:#6b7785;'>Позиций: ${o.items.length}, Всего единиц: ${totalItems}</div>
                ${renderOrderStatusTimeline(o)}
            </div>
        </div>`;
    });
    host.innerHTML = html;
}
window.toggleOrderMenu = toggleOrderMenu;
window.deleteSupplyOrder = deleteSupplyOrder;
                    window.renderSupplyStatusFilters = renderSupplyStatusFilters;
                    window.addCompetitiveRow = addCompetitiveRow;
                    window.removeCompetitiveRow = removeCompetitiveRow;
                    window.pickCompetitiveWinner = pickCompetitiveWinner;
                    window.saveCompetitiveFromModal = saveCompetitiveFromModal;
                    window.printCompetitiveSheet = printCompetitiveSheet;
                    window.closeCompetitiveModal = closeCompetitiveModal;
                    window.cycleSupplierGroupStatus = cycleSupplierGroupStatus;

// ===== Фильтры статуса и поиск в списке документов =====
function renderSupplyStatusFilters(){
    const wrap = document.getElementById('supply-status-filters');
    if (!wrap) return;
    const active = window.__supplyStatusFilter || 'all';
    const chips = ['all'].concat(ORDER_STATUS_FLOW);
    wrap.innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            ${chips.map(k=>`<div class="supply-status-chip ${active===k?'active':''}" data-st="${k}">${k==='all'?'Все':k}</div>`).join('')}
            <input id="supply-orders-search" class="styled-input" placeholder="Поиск по документам" value="${window.__supplyOrderSearch||''}" />
        </div>`;
    wrap.querySelectorAll('.supply-status-chip').forEach(ch=>{
        ch.addEventListener('click', ()=>{ window.__supplyStatusFilter = ch.getAttribute('data-st'); renderSupplyStatusFilters(); renderSupplyOrders(); });
    });
    const input = document.getElementById('supply-orders-search');
    if (input){ input.oninput = (e)=>{ window.__supplyOrderSearch = e.target.value||''; renderSupplyOrders(); } }
}
function renderOrderSupplierGroups(order){
    return order.supplierGroups.map(g=>{
        const qtySum = g.items.reduce((s,it)=> s + (Number(it.qtyOrdered)||0),0);
        return `<div class='supplier-group'>
            <div class='supplier-group-head'>
                <div class='supplier-name'>${escapeHtml(g.supplier)}</div>
                <div class='supplier-status status-${g.status.replace(/\s+/g,'-')}' onclick="cycleSupplierGroupStatus('${order.id}','${g.supplier}')" title='Изменить статус поставщика'>${g.status}</div>
            </div>
            <table class='smeta-table'><thead><tr><th>Ресурс</th><th>Кол-во</th><th>Фото товара</th><th>Конкурентный лист</th></tr></thead><tbody>
                ${g.items.map(it=>renderSupplierItemRow(order,it)).join('')}
            </tbody></table>
        </div>`;
    }).join('');
}
function renderSupplierItemRow(order, it){
    const photos = (order.itemsPhotos[it.planRowId]||[]);
    return `<tr>
        <td>${it.planRowId}</td>
        <td>${it.qtyOrdered}</td>
        <td>${renderItemPhotoSlots(order.id, it.planRowId, photos)}</td>
        <td><button class='icon-btn' onclick="openCompetitiveModal('${it.planRowId}','${order.id}')" title='Конкурентный лист'>⚖</button></td>
    </tr>`;
}
function renderItemPhotoSlots(orderId, planRowId, arr){
    return `<div class='item-photo-grid'>${[0,1,2].map(i=>{
        const img = arr[i]; const inputId = `supp-photo-${orderId}-${planRowId}-${i}`;
        return img?`<div class='supp-slot'><img src='${img}'><button class='thumb-btn' onclick="deleteItemPhoto('${orderId}','${planRowId}',${i})">X</button></div>`:
        `<div class='supp-slot empty' onclick="document.getElementById('${inputId}').click()"><input type='file' id='${inputId}' class='hidden-file-input' accept='image/*' onchange="handleItemPhotoUpload('${orderId}','${planRowId}',${i}, this)"></div>`;
    }).join('')}</div>`;
}
function renderReceiptPhotoGrid(order){
    return `<div class='receipts-grid'>${[0,1,2,3,4,5].map(i=>{
        const img = order.photosReceipt[i]; const inputId = `order-receipt-${order.id}-${i}`;
        return img?`<div class='receipt-slot' title='Чек ${i+1}'><img src='${img}'><div class='slot-actions'><button class='thumb-btn' onclick="deleteOrderReceiptPhoto('${order.id}',${i})">X</button></div></div>`:
        `<div class='receipt-slot empty' onclick="document.getElementById('${inputId}').click()"><input type='file' id='${inputId}' class='hidden-file-input' accept='image/*' onchange="handleOrderReceiptPhoto('${order.id}',${i}, this)"></div>`;
    }).join('')}</div>`;
}
function handleOrderReceiptPhoto(orderId, slot, input){
    const file = input.files&&input.files[0]; if(!file) return; const reader = new FileReader(); reader.onload=e=>{ const o = findOrder(orderId); if(!o) return; o.photosReceipt[slot]=e.target.result; saveObject(); refreshSupplyUI(orderId); }; reader.readAsDataURL(file); try{ input.value=''; }catch(_){ }
}
function deleteOrderReceiptPhoto(orderId, slot){ const o=findOrder(orderId); if(!o) return; o.photosReceipt.splice(slot,1); saveObject(); refreshSupplyUI(orderId); }
function handleItemPhotoUpload(orderId, planRowId, slot, input){ const file=input.files&&input.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=e=>{ const o=findOrder(orderId); if(!o) return; if(!o.itemsPhotos[planRowId]) o.itemsPhotos[planRowId]=[]; o.itemsPhotos[planRowId][slot]=e.target.result; saveObject(); refreshSupplyUI(orderId); }; reader.readAsDataURL(file); try{ input.value=''; }catch(_){ } }
function deleteItemPhoto(orderId, planRowId, slot){ const o=findOrder(orderId); if(!o) return; const arr=o.itemsPhotos[planRowId]; if(!arr) return; arr.splice(slot,1); saveObject(); refreshSupplyUI(orderId); }
function refreshSupplyUI(orderId){
    renderSupplyOrders();
    if (window.__openSupplyOrderId===orderId){ const o=findOrder(orderId); if (o) renderSupplyOrderModalContent(o); }
}
function findOrder(id){ return (currentObject?.data?.supply?.orders||[]).find(o=>o.id===id); }
// Цикл статусов заказа верхнего уровня
function cycleOrderStatus(orderId){
    // Сохраняем обратную совместимость клика по старой пилюле
    const flow = ORDER_STATUS_FLOW;
    const o = findOrder(orderId); if(!o) return;
    let idx = flow.indexOf(o.status);
    if (idx === -1) idx = 0;
    idx = (idx + 1) % flow.length;
    setOrderStatus(orderId, flow[idx]);
}
function setOrderStatus(orderId, status){
    const o = findOrder(orderId); if(!o) return;
    const prev = o.status;
    // При попытке установить отрицательные статусы запросим комментарий
    if ((status==='не доставлено' || status==='возврат') && prev !== status){
        const text = prompt('Укажите причину (будет добавлена в комментарии документа):','');
        if (text && text.trim()){
            o.cancelComment = text.trim();
        } else {
            // Если комментарий не указан — отменяем смену статуса
            return;
        }
    }
    o.status = status;
    // При доставлено – перенос в факт/склад (если раньше не переносили)
    if (status === 'доставлено' && prev !== 'доставлено'){
        // зафиксируем дату доставки если не была задана
        if (!o.deliveryDate) o.deliveryDate = new Date().toISOString().slice(0,10);
        applyDeliveredOrderToFactAndStock(o);
    }
    // При возврат: просто освобождаем доступность (computeOrderedQuantities уже игнорирует), сложный откат факта/склада не трогаем.
    saveObject();
    // Обновляем список и открытую модалку, если была открыта
    refreshSupplyUI(orderId);
}
function cycleSupplierGroupStatus(orderId, supplier){ const o=findOrder(orderId); if(!o) return; const grp=o.supplierGroups.find(g=>g.supplier===supplier); if(!grp) return; const flow=['новая','утверждено','на оплату','оплачено','заказано','доставляется','доставлено']; const idx=flow.indexOf(grp.status); grp.status = flow[(idx+1)%flow.length]; saveObject(); renderSupplyOrders(); if (grp.status==='доставлено'){ applyDeliveredSupplierGroupToFactAndStock(o, grp); } }
// При статусе "доставлено" переносим количество и сумму в факт и создаём складскую запись прихода
function applyDeliveredOrderToFactAndStock(order){
    ensureStockData();
    // Для каждой позиции: найдём плановую строку и увеличим фактические показатели (quantityFact, priceFact, sumFact)
    order.items.forEach(it=>{
        const { group, wt, row } = locatePlanRow(it.planRowId) || {};
        if (!row) return;
        // Найдём группу факта и строку
        let factGroup = currentObject.data.fact.groups.find(g=>g.id===group?.id);
        if (!factGroup){ factGroup = { id: group.id, name: group.name, rows: [] }; currentObject.data.fact.groups.push(factGroup); }
        let factRow = factGroup.rows.find(r=>r.id===row.id);
        if (!factRow){ factRow = { id: row.id, photo: row.photo, receipts: [], purchaseDate: new Date().toISOString().slice(0,10), name: row.name, resource: row.resource, unit: row.unit, quantityFact: 0, priceFact: row.price||0, sumFact:0, comments:'' }; factGroup.rows.push(factRow); }
        factRow.quantityFact += Number(it.qtyOrdered)||0;
        if (row.price){ factRow.priceFact = row.price; }
        factRow.sumFact = (factRow.quantityFact ||0) * (factRow.priceFact||0);
        // Складское движение прихода
        currentObject.data.stock.movements.push({ id:'mv-'+Date.now().toString(36)+Math.random().toString(16).slice(2), type:'приход', date:new Date().toISOString().slice(0,10), planRowId: row.id, qty: Number(it.qtyOrdered)||0, unit: row.unit, resource: row.resource, comment: 'Поступление по заказу '+order.id });
    });
    saveObject();
    renderFactGroups();
    renderStockView();
    loadAnalysisData();
}
function applyDeliveredSupplierGroupToFactAndStock(order, group){
    ensureStockData();
    (group.items||[]).forEach(it=>{
        const { group:pg, wt, row } = locatePlanRow(it.planRowId) || {};
        if (!row) return;
        let factGroup = currentObject.data.fact.groups.find(g=>g.id===pg?.id);
        if (!factGroup){ factGroup = { id: pg.id, name: pg.name, rows: [] }; currentObject.data.fact.groups.push(factGroup); }
        let factRow = factGroup.rows.find(r=>r.id===row.id);
        if (!factRow){ factRow = { id: row.id, photo: row.photo, receipts: [], purchaseDate: new Date().toISOString().slice(0,10), name: row.name, resource: row.resource, unit: row.unit, quantityFact: 0, priceFact: row.price||0, sumFact:0, comments:'' }; factGroup.rows.push(factRow); }
        factRow.quantityFact += Number(it.qtyOrdered)||0;
        if (row.price){ factRow.priceFact = row.price; }
        factRow.sumFact = (factRow.quantityFact ||0) * (factRow.priceFact||0);
        currentObject.data.stock.movements.push({ id:'mv-'+Date.now().toString(36)+Math.random().toString(16).slice(2), type:'приход', date:new Date().toISOString().slice(0,10), planRowId: row.id, qty: Number(it.qtyOrdered)||0, unit: row.unit, resource: row.resource, comment: 'Поступление по заказу '+order.id+' ('+group.supplier+')' });
    });
    saveObject();
    renderFactGroups();
    renderStockView();
    loadAnalysisData();
}
// Печать/скачивание документа заказа: WYSIWYG печать содержимого модалки
function printSupplyOrder(orderId){
    const o = findOrder(orderId); if(!o) return;
    ensureSupplyOrderModal();
    // Отрисуем контент модалки в скрытую коробку (оверлей не показываем)
    renderSupplyOrderModalContent(o);
    const box = document.getElementById('supply-order-modal-box'); if(!box) return;
    const w = window.open('', '_blank');
    if (!w) { alert('Откройте всплывающие окна для печати.'); return; }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(o.id)}</title>
        <link rel="stylesheet" href="styles.css">
        <style>body{background:#fff;} .order-modal-header{position:static;}</style>
    </head><body>${box.innerHTML}</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
}
// ===== Модалка документа заказа =====
function ensureSupplyOrderModal(){
    let overlay = document.getElementById('supply-order-modal');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'supply-order-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:none;z-index:9998;';
    const box = document.createElement('div');
    box.id = 'supply-order-modal-box';
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;max-width:1000px;width:92vw;max-height:90vh;overflow:auto;border-radius:14px;box-shadow: var(--shadow);';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return overlay;
}
function openSupplyOrderModal(orderId){
    const order = findOrder(orderId); if(!order){ alert('Документ не найден'); return; }
    ensureSupplyOrderModal();
    renderSupplyOrderModalContent(order);
    const ov = document.getElementById('supply-order-modal'); if (ov) ov.style.display='block';
    window.__openSupplyOrderId = orderId;
}
function closeSupplyOrderModal(){ const ov=document.getElementById('supply-order-modal'); if (ov) ov.style.display='none'; window.__openSupplyOrderId = null; }
function renderSupplyOrderModalContent(order){
    const box = document.getElementById('supply-order-modal-box'); if(!box) return;
    const supplierTotals = (order.supplierGroups||[]).map(g=>{
        const qty = g.items.reduce((s,it)=> s + (Number(it.qtyOrdered)||0),0);
        return `<div style='display:flex; gap:6px; font-size:12px; align-items:center;'><strong>${escapeHtml(g.supplier)}</strong><span style='color:#6b7785;'>${qty} ед.</span><span class='status-pill ${((g.status||'активен')==='активен')?'active':'inactive'}'>${g.status}</span></div>`;
    }).join('');
    // Отдельный рендер для ZK-заказов (по одному поставщику)
    let zkSection = '';
    if (order.type === 'ZK'){
        const totalSum = (order.items||[]).reduce((s,it)=> s + (Number(it.sum)||0),0);
        // Supplier directory
        ensureSupplyData();
        const suppliers = currentObject.data.supply.suppliers || [];
        const sd = order.supplierDetails || {};
        // Найдём запись поставщика и заблокируем редактирование названия
        const supplierRec = suppliers.find(s=> (s.name||'').toLowerCase() === (order.supplier||'').toLowerCase());
        const supplierPanel = `<div class='analysis-block' style='margin-bottom:12px;'>
            <div class='block-header'><div class='block-title'>Поставщик</div>
                <div class='block-actions' style='display:flex; gap:8px;'>
                    <button class='btn btn-success' id='supplier-save-${order.id}'>Сохранить в справочник</button>
                </div>
            </div>
            <div class='supplier-grid'>
                <div class='field'><label>Поставщик</label><input type='text' class='sup-inp' data-k='name' value='${escapeHtml(order.supplier||sd.name||'')}' placeholder='ООО …' disabled title='Поставщик выбран из конкурентного листа и не редактируется'></div>
                <div class='field'><label>Контактное лицо</label><input type='text' class='sup-inp' data-k='contactPerson' value='${escapeHtml(sd.contactPerson||'')}'></div>
                <div class='field'><label>ИНН</label><input type='text' class='sup-inp' data-k='inn' value='${escapeHtml(sd.inn||'')}'></div>
                <div class='field'><label>Р/с</label><input type='text' class='sup-inp' data-k='account' value='${escapeHtml(sd.account||'')}'></div>
                <div class='field'><label>Адрес</label><input type='text' class='sup-inp' data-k='address' value='${escapeHtml(sd.address||'')}'></div>
                <div class='field'><label>Банк</label><input type='text' class='sup-inp' data-k='bank' value='${escapeHtml(sd.bank||'')}'></div>
                <div class='field'><label>МФО</label><input type='text' class='sup-inp' data-k='mfo' value='${escapeHtml(sd.mfo||'')}'></div>
                <div class='field'><label>ФИО директора</label><input type='text' class='sup-inp' data-k='director' value='${escapeHtml(sd.director||'')}'></div>
            </div>
        </div>`;
        const rows = (order.items||[]).map((it,i)=>`<tr>
            <td>${i+1}</td>
            <td>${escapeHtml(it.name||it.planRowId)}</td>
            <td>${escapeHtml(it.unit||'')}</td>
            <td style='text-align:right;'>${Number(it.qtyOrdered)||0}</td>
            <td style='text-align:right;'>${Number(it.price||0).toFixed(2)}</td>
            <td style='text-align:right;'>${Number(it.sum||0).toFixed(2)}</td>
            <td><input type='text' class='styled-input zk-comment' data-plan='${it.planRowId}' value='${escapeHtml(it.comment||'')}' placeholder='Комментарий'></td>
        </tr>`).join('');
        zkSection = supplierPanel + `<div style='margin-top:18px;'>
            <h3 style='margin:0 0 8px;'>Поставщик: ${escapeHtml(order.supplier||'')}</h3>
            <div class='table-wrapper'><table class='smeta-table'>
                <thead><tr><th>№</th><th>Название товара</th><th>Ед. изм</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Комментарии</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#6b7785;">Нет позиций</td></tr>'}</tbody>
                <tfoot><tr><td colspan='5' style='text-align:right;font-weight:600;'>Итого:</td><td style='text-align:right;font-weight:600;'>${totalSum.toFixed(2)}</td><td></td></tr></tfoot>
            </table></div>
        </div>`;
    }
    box.innerHTML = `
                <div class='order-modal-header'>
            <div style='display:flex; align-items:center; gap:12px; flex-wrap:wrap;'>
                <div style='font-size:18px; font-weight:700; display:flex; align-items:center; gap:12px;'>
                    <span class='order-id-label'>Заказ ${order.id}</span>
                    <button class='status-pill' onclick="cycleOrderStatus('${order.id}')" title='Следующий статус' style='font-size:12px;'>${order.status}</button>
                </div>
                <div style='display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569;'>
                    <div>Дата формирования: <strong>${order.createdAt||'—'}</strong></div>
                    <div>Дата доставки: <strong>${order.deliveryDate|| (order.status==='доставлено'? new Date().toISOString().slice(0,10):'—')}</strong></div>
                </div>
                <div style='margin-left:auto; display:flex; gap:8px; flex-wrap:wrap;'>
                    <button class='btn btn-ghost' onclick="printSupplyOrder('${order.id}')">Печать</button>
                    <button class='btn' onclick='closeSupplyOrderModal()'>Закрыть</button>
                </div>
            </div>
        </div>
        <div class='order-modal-body'>
            <div style='margin-bottom:12px;'>${renderOrderStatusTimeline(order)}</div>
            ${(order.status==='не доставлено' || order.status==='возврат') && order.cancelComment ? `<div class="order-alert"><strong>Причина:</strong> ${escapeHtml(order.cancelComment)}</div>` : ''}
            ${order.type==='ZK' ? zkSection : (renderOrderSupplierGroups(order) || '<div style="color:#6b7785; font-size:13px;">Нет позиций</div>')}
            <div style='margin-top:18px;'>
                <div style='font-size:12px; color:#6b7785; margin-bottom:6px;'>Фото чеков</div>
                ${order.status==='доставлено' ? renderReceiptPhotoGrid(order) : '<div style="color:#6b7785;font-size:12px;">Доступно после статуса "доставлено"</div>'}
            </div>
        </div>`;
    // Привязка инпутов комментариев ZK
    if (order.type==='ZK'){
        box.querySelectorAll('.zk-comment').forEach(inp=>{
            inp.addEventListener('change', e=>{
                updateZkItemComment(order.id, inp.getAttribute('data-plan'), inp.value);
            });
        });
        // supplier change binding
        box.querySelectorAll('.sup-inp').forEach(inp=>{
            inp.addEventListener('change', ()=>{ updateOrderSupplierField(order.id, inp.getAttribute('data-k'), inp.value); });
        });
        const saveBtn = document.getElementById('supplier-save-'+order.id);
        if (saveBtn){ saveBtn.addEventListener('click', ()=>{ saveSupplierFromOrder(order.id); }); }
    }
}
function updateOrderSupplierField(orderId, key, value){
    const o = findOrder(orderId); if(!o) return;
    if (!o.supplierDetails) o.supplierDetails = {};
    // Название поставщика в модалке заказа не редактируется
    if (key==='name'){ return; }
    else { o.supplierDetails[key] = value; }
    saveObject();
}
function saveSupplierFromOrder(orderId){
    ensureSupplyData();
    const o = findOrder(orderId); if(!o) return;
    const sd = o.supplierDetails || {}; const name = o.supplier || sd.name || '';
    if (!name){ alert('Укажите название организации'); return; }
    const list = currentObject.data.supply.suppliers;
    // update if exists by name (case-insensitive)
    const idx = list.findIndex(s=> (s.name||'').toLowerCase() === name.toLowerCase());
    const rec = { id: (idx>=0 ? list[idx].id : ('sup-'+Date.now().toString(36))), name, contactPerson: sd.contactPerson||'', inn: sd.inn||'', account: sd.account||'', address: sd.address||'', bank: sd.bank||'', mfo: sd.mfo||'', director: sd.director||'' };
    if (idx>=0) list[idx] = rec; else list.push(rec);
    saveObject();
    alert('Поставщик сохранён в справочник');
}
function pickSupplierForOrder(orderId, supplierId){
    ensureSupplyData();
    const o = findOrder(orderId); if(!o) return;
    const s = (currentObject.data.supply.suppliers||[]).find(x=>x.id===supplierId); if(!s) return;
    o.supplier = s.name || o.supplier;
    o.supplierDetails = { name: s.name||'', contactPerson: s.contactPerson||'', inn: s.inn||'', account: s.account||'', address: s.address||'', bank: s.bank||'', mfo: s.mfo||'', director: s.director||'' };
    saveObject();
    refreshSupplyUI(orderId);
}
function updateZkItemComment(orderId, planRowId, value){
    const o = findOrder(orderId); if(!o) return;
    const it = (o.items||[]).find(x=>x.planRowId===planRowId); if(!it) return;
    it.comment = (value||'').toString();
    saveObject();
}
function toggleOrderMenu(orderId){
    const el = document.getElementById('order-menu-'+orderId); if(!el) return;
    // Закрываем другие
    document.querySelectorAll('.order-menu.open').forEach(m=>{ if(m!==el) m.classList.remove('open'); });
    el.classList.toggle('open');
}
function deleteSupplyOrder(orderId){
    const list = currentObject?.data?.supply?.orders||[];
    const idx = list.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    if (!confirm('Удалить заказ '+orderId+'?')) return;
    list.splice(idx,1);
    saveObject();
    if (window.__openSupplyOrderId===orderId) closeSupplyOrderModal();
    renderSupplyOrders();
}
// Немедленно экспортируем пункты меню, чтобы избежать ReferenceError из inline onclick
if (typeof window !== 'undefined') {
    window.toggleOrderMenu = window.toggleOrderMenu || toggleOrderMenu;
    window.deleteSupplyOrder = window.deleteSupplyOrder || deleteSupplyOrder;
}
function locatePlanRow(planRowId){
    for (const g of currentObject?.data?.plan?.groups||[]){
        for (const wt of g.workTypes||[]){
            for (const r of wt.resources||[]){ if (r.id===planRowId) return { group:g, wt, row:r }; }
        }
    }
    return null;
}
// Конкурентный лист (упрощённый)
// ===== Конкурентный лист =====
function openCompetitiveModal(planRowId, orderId){
    const order = findOrder(orderId);
    if (!order){ alert('Заказ не найден'); return; }
    if (!order.competitive) order.competitive = {};
    if (!order.competitive[planRowId]) order.competitive[planRowId] = [];
    ensureCompetitiveModal();
    renderCompetitiveModalContent(orderId, planRowId);
}

function ensureCompetitiveModal(){
    let overlay = document.getElementById('comp-modal');
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'comp-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:none;z-index:9999;';
    const box = document.createElement('div');
    box.id = 'comp-modal-box';
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;box-shadow: var(--shadow);width:min(900px,92vw);max-height:90vh;overflow:auto;';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function renderCompetitiveModalContent(orderId, planRowId){
    const overlay = document.getElementById('comp-modal');
    const box = document.getElementById('comp-modal-box');
    if (!overlay || !box) return;
    const order = findOrder(orderId); if(!order) return;
    const list = order.competitive[planRowId] || [];
    const rowInfo = locatePlanRow(planRowId);
    const title = `Конкурентный лист: ${escapeHtml(rowInfo?.row?.name||planRowId)} (Заказ ${orderId})`;
    const rowsHtml = list.map((it,idx)=>{
        const sel = it.selected ? 'checked' : '';
        return `<tr>
            <td><input type='radio' name='comp-winner' ${sel} onclick="pickCompetitiveWinner('${orderId}','${planRowId}',${idx})"></td>
            <td><input type='text' class='comp-supplier' data-idx='${idx}' value='${escapeHtml(it.supplier||'')}' placeholder='Поставщик'></td>
            <td><input type='number' step='0.01' class='comp-price' data-idx='${idx}' value='${Number(it.price||0)}'></td>
            <td><input type='text' class='comp-eta' data-idx='${idx}' value='${escapeHtml(it.eta||'')}' placeholder='Срок поставки'></td>
            <td><input type='text' class='comp-note' data-idx='${idx}' value='${escapeHtml(it.note||'')}' placeholder='Примечание'></td>
            <td><button class='icon-btn' title='Удалить' onclick="removeCompetitiveRow('${orderId}','${planRowId}',${idx})">✕</button></td>
        </tr>`;
    }).join('');
    box.innerHTML = `
        <div style='padding:14px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px;'>
            <div style='font-weight:700; font-size:16px;'>${title}</div>
            <div style='margin-left:auto; display:flex; gap:8px;'>
                <button class='btn btn-secondary' onclick="printCompetitiveSheet('${orderId}','${planRowId}')">Печать</button>
                <button class='btn btn-primary' onclick="saveCompetitiveFromModal('${orderId}','${planRowId}', true)">Сохранить</button>
                <button class='btn' onclick='closeCompetitiveModal()'>Закрыть</button>
            </div>
        </div>
        <div style='padding:12px 16px;'>
            <div style='font-size:12px; color:#6b7785; margin-bottom:8px;'>Добавьте 2–4 предложения поставщиков, отметьте победителя. При сохранении поставщик будет выбран в заказе и плане.</div>
            <div class='table-wrapper'>
                <table class='smeta-table'>
                    <thead><tr><th>Выбор</th><th>Поставщик</th><th>Цена</th><th>Срок</th><th>Примечание</th><th></th></tr></thead>
                    <tbody id='comp-rows'>${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#6b7785;">Нет предложений</td></tr>'}</tbody>
                </table>
            </div>
            <div style='margin-top:8px;'>
                <button class='btn btn-add' onclick="addCompetitiveRow('${orderId}','${planRowId}')">+ Добавить поставщика</button>
            </div>
        </div>`;
    overlay.style.display = 'block';
}

function closeCompetitiveModal(){ const overlay=document.getElementById('comp-modal'); if(overlay) overlay.style.display='none'; }

function addCompetitiveRow(orderId, planRowId){
    const order = findOrder(orderId); if(!order) return;
    if (!order.competitive) order.competitive = {};
    if (!order.competitive[planRowId]) order.competitive[planRowId] = [];
    order.competitive[planRowId].push({ supplier:'', price:0, eta:'', note:'', selected: false });
    saveObject();
    renderCompetitiveModalContent(orderId, planRowId);
}
function removeCompetitiveRow(orderId, planRowId, idx){
    const order = findOrder(orderId); if(!order) return;
    const arr = order.competitive[planRowId] || [];
    arr.splice(idx,1);
    // Ensure only one selected remains if any
    let foundSelected = arr.findIndex(x=>x.selected);
    if (foundSelected<0 && arr.length){ arr[0].selected=false; }
    saveObject();
    renderCompetitiveModalContent(orderId, planRowId);
}
function pickCompetitiveWinner(orderId, planRowId, idx){
    const order = findOrder(orderId); if(!order) return;
    const arr = order.competitive[planRowId] || [];
    arr.forEach((x,i)=> x.selected = (i===idx));
    saveObject();
}
function saveCompetitiveFromModal(orderId, planRowId, applyWinner){
    const order = findOrder(orderId); if(!order) return;
    const arr = order.competitive[planRowId] || [];
    // Read values from inputs
    const box = document.getElementById('comp-modal-box'); if(!box) return;
    const supInputs = box.querySelectorAll('.comp-supplier');
    const priceInputs = box.querySelectorAll('.comp-price');
    const etaInputs = box.querySelectorAll('.comp-eta');
    const noteInputs = box.querySelectorAll('.comp-note');
    supInputs.forEach(inp=>{ const i=Number(inp.getAttribute('data-idx')); if(arr[i]) arr[i].supplier = inp.value.trim(); });
    priceInputs.forEach(inp=>{ const i=Number(inp.getAttribute('data-idx')); if(arr[i]) arr[i].price = Number(inp.value)||0; });
    etaInputs.forEach(inp=>{ const i=Number(inp.getAttribute('data-idx')); if(arr[i]) arr[i].eta = inp.value.trim(); });
    noteInputs.forEach(inp=>{ const i=Number(inp.getAttribute('data-idx')); if(arr[i]) arr[i].note = inp.value.trim(); });
    // Apply winner to order and plan if requested
    if (applyWinner){
        const winner = arr.find(x=>x.selected && x.supplier && (x.price||x.eta));
        if (winner){
            // Update order item supplier
            const item = (order.items||[]).find(it=>it.planRowId===planRowId);
            if (item){ item.supplier = winner.supplier; }
            // Regroup by supplier
            order.supplierGroups = groupItemsBySupplier(order.items||[]);
            // Update plan row supplier
            const loc = locatePlanRow(planRowId);
            if (loc && loc.row){ loc.row.supplier = winner.supplier; }
        }
    }
    saveObject();
    renderSupplyOrders();
    renderSupplyBudget();
    closeCompetitiveModal();
}
function printCompetitiveSheet(orderId, planRowId){
    const order = findOrder(orderId); if(!order) return;
    const arr = order.competitive[planRowId] || [];
    const rowInfo = locatePlanRow(planRowId);
    const title = `Конкурентный лист: ${escapeHtml(rowInfo?.row?.name||planRowId)} (Заказ ${orderId})`;
    const w = window.open('', '_blank'); if(!w){ alert('Откройте всплывающие окна'); return; }
    const body = `
    <html><head><meta charset='utf-8'><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #999;padding:6px;font-size:12px;} .win{background:#e7f5ec;} .right{text-align:right;}</style>
    </head><body>
    <h2>${title}</h2>
    <table><thead><tr><th>#</th><th>Поставщик</th><th>Цена</th><th>Срок</th><th>Примечание</th><th>Победитель</th></tr></thead><tbody>
    ${arr.map((x,i)=>`<tr class='${x.selected?'win':''}'><td>${i+1}</td><td>${escapeHtml(x.supplier||'')}</td><td class='right'>${x.price||0}</td><td>${escapeHtml(x.eta||'')}</td><td>${escapeHtml(x.note||'')}</td><td>${x.selected?'✔':''}</td></tr>`).join('')}
    </tbody></table>
    </body></html>`;
    w.document.write(body); w.document.close(); w.focus(); w.print();
}

// ====== СКЛАД ======
function switchStockSub(which){ window.__stockSub = which; renderStockView(); }
function renderStockView(){
    const incomingBox = document.getElementById('stock-incoming-container');
    const outgoingBox = document.getElementById('stock-outgoing-container');
    const writeoffBox = document.getElementById('stock-writeoff-container');
    if (!incomingBox || !outgoingBox || !writeoffBox) return;
    const active = window.__stockSub || 'incoming';
    incomingBox.style.display = active==='incoming' ? 'block' : 'none';
    outgoingBox.style.display = active==='outgoing' ? 'block' : 'none';
    writeoffBox.style.display = active==='writeoff' ? 'block' : 'none';
    renderStockIncoming(); if (active==='outgoing') renderStockOutgoing(); if (active==='writeoff') renderStockWriteoff();
}
function renderStockIncoming(){ const box=document.getElementById('stock-incoming-container'); if(!box) return; const moves=(currentObject?.data?.stock?.movements||[]).filter(m=>m.type==='приход'); box.innerHTML = stockTableHtml(moves,'Приходы'); }
function renderStockOutgoing(){ const box=document.getElementById('stock-outgoing-container'); if(!box) return; const moves=(currentObject?.data?.stock?.movements||[]).filter(m=>m.type==='расход'); box.innerHTML = stockTableHtml(moves,'Расходы'); }
function renderStockWriteoff(){ const box=document.getElementById('stock-writeoff-container'); if(!box) return; const moves=(currentObject?.data?.stock?.movements||[]).filter(m=>m.type==='списание'); box.innerHTML = stockTableHtml(moves,'Списания'); }
function stockTableHtml(moves, title){
    if(!moves.length) return `<div class='analysis-block'><div class='block-header'><div class='block-title'>${title}</div></div><div class='muted'>Нет записей</div></div>`;
    let rows='';
    moves.forEach((m,i)=>{ rows += `<tr><td>${i+1}</td><td>${m.date||'—'}</td><td>${m.planRowId||'—'}</td><td>${m.qty}</td><td>${m.unit||''}</td><td>${renderResourceBadge(m.resource)}</td><td>${escapeHtml(m.comment||'')}</td></tr>`; });
    return `<div class='analysis-block'><div class='block-header'><div class='block-title'>${title}</div></div><div class='table-wrapper'><table class='smeta-table'><thead><tr><th>№</th><th>Дата</th><th>Ресурс ID</th><th>Кол-во</th><th>Ед.изм</th><th>Ресурс</th><th>Комментарий</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
// Ensure functions are available for inline onclick handlers
try{
    window.switchSupplySub = switchSupplySub;
    window.renderSupplyView = renderSupplyView;
    window.setSupplyFilter = setSupplyFilter;
    window.supplyQtyValidate = supplyQtyValidate;
    window.createSupplyOrderFromSelection = createSupplyOrderFromSelection;
    window.openCompetitiveModal = openCompetitiveModal;
    window.openSupplyOrderModal = openSupplyOrderModal;
    window.closeSupplyOrderModal = closeSupplyOrderModal;
    // stock tab handler too
    window.switchStockSub = switchStockSub;
    // supply orders helpers
    window.renderSupplyStatusFilters = renderSupplyStatusFilters;
    window.cycleOrderStatus = cycleOrderStatus;
    window.printSupplyOrder = printSupplyOrder;
    window.setOrderStatus = setOrderStatus;
}catch(_){ }
    
    // Обновляем график при переключении вкладок
    updateChart();

// Добавление группы в план
function addPlanGroup() {
    const groupId = Date.now().toString();
    const group = {
        id: groupId,
        name: 'Новый этап',
        // Новая иерархия: массив видов работ
        workTypes: []
    };
    
    if (!currentObject.data.plan.groups) {
        currentObject.data.plan.groups = [];
    }
    
    // Добавим дефолтный вид работ с тремя пустыми строками
    const wt = createDefaultWorkType();
    wt.resources = [];
    for (let i=0;i<3;i++){
        wt.resources.push(createEmptyResourceRow());
    }
    group.workTypes.push(wt);

    currentObject.data.plan.groups.push(group);
    saveObject();
    // Persist open state so the newly added group and its first worktype are visible
    window.__openPlanGroups = window.__openPlanGroups || {};
    window.__openPlanWorkTypes = window.__openPlanWorkTypes || {};
    window.__openPlanGroups[groupId] = true;
    if (wt && wt.id) window.__openPlanWorkTypes[wt.id] = true;
    doRenderPlanGroupsPreserveScroll();
    // After render completes and scroll is restored, scroll to the new group and flash it
    setTimeout(()=>{ scrollAndFlashGroup(groupId); }, 220);
}

// Добавление строки ресурса (в первый/дефолтный вид работ)
function addPlanRow(groupId) {
    const group = currentObject.data.plan.groups.find(g => g.id === groupId);
    if (!group) return;
    // Обеспечим наличие хотя бы одного вида работ
    if (!Array.isArray(group.workTypes)) group.workTypes = [];
    if (group.workTypes.length === 0) {
        group.workTypes.push(createDefaultWorkType());
    }
    const wt = group.workTypes[0];
    const row = createEmptyResourceRow();
    if (!Array.isArray(wt.resources)) wt.resources = [];
    wt.resources.push(row);
    saveObject();
    renderPlanGroups();
}

// Удаление группы из плана
function deletePlanGroup(groupId) {
    const group = (currentObject.data.plan.groups || []).find(g => g.id === groupId) || null;
    const name = group ? (group.name || 'Без названия') : 'Без названия';
    if (!confirm(`Вы точно хотите удалить группу "${name}" ?`)) return;
    currentObject.data.plan.groups = currentObject.data.plan.groups.filter(g => g.id !== groupId);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
    renderFactGroups();
    loadAnalysisData();
}

// Удаление строки из группы плана
function deletePlanRow(groupId, rowId) {
    const group = currentObject.data.plan.groups.find(g => g.id === groupId);
    if (group) {
        group.rows = group.rows.filter(r => r.id !== rowId);
        saveObject();
        renderPlanGroups();
        renderFactGroups();
        loadAnalysisData();
    }
}

// Отображение групп плана
function renderPlanGroups() {
    const container = document.getElementById('plan-groups-container');
    container.innerHTML = '';
    
    if (!currentObject.data.plan.groups || currentObject.data.plan.groups.length === 0) {
        // When there are no groups, render nothing (user requested to remove the 'Нет этапов...' message)
        container.innerHTML = '';
        updateGrandTotalPlan();
        // ensure charts remain hidden when no plan data exists
        const charts = document.querySelector('.plan-charts'); if (charts) charts.style.display = 'none';
        return;
    }
    
    // Сквозная нумерация видов работ по всем этапам
    let workTypeCounter = 0;
    // prepare resource filter controls once
    initPlanResourceFilterControls();
    const resFilter = window.__planResourceFilter || 'all';
    // Photos are hidden by default unless explicitly enabled
    const showPhotos = window.__planShowPhotos === true; // default false when undefined
    const searchQuery = (window.__planSearchQuery || '').trim().toLowerCase();

    currentObject.data.plan.groups.forEach((group, gIndex) => {
        const groupSection = document.createElement('div');
        groupSection.className = 'group-section';
        
        // Render Work Types
        const workTypes = Array.isArray(group.workTypes) ? group.workTypes : [];
        let workTypesHtml = '';
        workTypes.forEach((wt)=>{
            workTypeCounter += 1;
            const html = renderWorkTypeTableFiltered(group, wt, workTypeCounter, resFilter, showPhotos, searchQuery);
            if (html) workTypesHtml += html;
        });

    const groupTotal = calculateGroupTotalAny(group);

        // Если фильтр по ресурсу или поиску скрывает все виды работ в этапе — не показываем этап
        if ((resFilter !== 'all' || searchQuery) && workTypesHtml.trim()==='') {
            return; // skip this group entirely
        }

        const groupOpen = (window.__openPlanGroups && window.__openPlanGroups[group.id]) ? true : false;
        const groupBodyStyle = groupOpen ? 'display:block; opacity:1; max-height:none;' : 'display:none; opacity:0; max-height:0;';
        const groupBodyClass = groupOpen ? 'group-body collapsible-body open' : 'group-body collapsible-body';
        groupSection.innerHTML = `
            <div class="group-header" style="display:flex; align-items:center; gap:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="icon-btn collapse-toggle" onclick="toggleGroupCollapse('${group.id}')">▾</button>
                    <span style="font-weight:700; color:var(--text);">Этап</span>
                    <span class="worktype-number">${gIndex+1}</span>
                </div>
                <input type="text" class="group-title" value="${group.name}" onchange="updateGroupName('plan', '${group.id}', this.value)" placeholder="Название этапа" style="flex:1;">
                <div style="display:flex; align-items:center; gap:12px; margin-left:12px;">
                    <div id="group-total-inline-${group.id}" style="font-weight:700; color:var(--text); min-width:120px; text-align:right;">${formatCurrency(groupTotal)}</div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="icon-btn" title="Добавить вид работ" onclick="addWorkType('${group.id}')">+</button>
                        <button class="icon-btn" title="Переместить этап вверх" onclick="moveGroup('${group.id}','up')">↑</button>
                        <button class="icon-btn" title="Переместить этап вниз" onclick="moveGroup('${group.id}','down')">↓</button>
                        <button class="icon-btn" title="Удалить этап" onclick="deletePlanGroup('${group.id}')">✕</button>
                    </div>
                </div>
            </div>
            <div class="${groupBodyClass}" id="group-body-${group.id}" style="${groupBodyStyle}">
                ${workTypesHtml || '<div class="muted" style="padding:8px 0 12px;">Нет видов работ. Добавьте новый вид.</div>'}
            </div>
        `;

    container.appendChild(groupSection);
    // после этапа продолжим сквозную нумерацию видов работ
    });
    
    // Обновить сумму с учётом мета-расходов
    updateGrandTotalPlan();
    // Обновить отображение суммы «Прочие расходы» от процента
    updatePlanMiscAmountPreview();
    // Show charts only if there is plan data
    try{
        const charts = document.querySelector('.plan-charts');
        if (charts){
            const hasGroups = Array.isArray(currentObject.data.plan.groups) && currentObject.data.plan.groups.length > 0;
            charts.style.display = hasGroups ? 'block' : 'none';
        }
    }catch(_){ }
    // Re-apply persisted collapsible state after render to avoid immediate collapse
    try{ applyCollapsibleState(); }catch(_){ }
}

// Ensure DOM collapsible elements match persisted open/closed maps
function applyCollapsibleState(){
    // Groups
    window.__openPlanGroups = window.__openPlanGroups || {};
    document.querySelectorAll('.group-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('group-body-','');
        const shouldOpen = !!window.__openPlanGroups[id];
        if (shouldOpen){
            // show immediately without animation (we're just after a render)
            el.style.display = 'block'; el.style.opacity = '1'; el.classList.add('open'); el.style.maxHeight = '';
        } else {
            el.style.display = 'none'; el.style.opacity = '0'; el.classList.remove('open'); el.style.maxHeight = '0px';
        }
    });
    // WorkTypes
    window.__openPlanWorkTypes = window.__openPlanWorkTypes || {};
    document.querySelectorAll('.worktype-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('worktype-body-','');
        const shouldOpen = !!window.__openPlanWorkTypes[id];
        if (shouldOpen){ el.style.display = 'block'; el.style.opacity = '1'; el.classList.add('open'); el.style.maxHeight = ''; }
        else { el.style.display = 'none'; el.style.opacity = '0'; el.classList.remove('open'); el.style.maxHeight = '0px'; }
    });
}
// Filter-aware renderer wrapper
function renderWorkTypeTableFiltered(group, wt, wtGlobalIndex, resFilter, showPhotos, searchQuery){
    // clone resources respecting filter
    const original = Array.isArray(wt.resources) ? wt.resources : [];
    const byRes = original.filter(r=> resFilter==='all' ? true : (r.resource||'').toUpperCase()===resFilter.toUpperCase());
    const q = (searchQuery||'').trim().toLowerCase();
    let filtered = byRes;
    let wtMatches = false;
    if (q){
        // If WT name matches query — keep WT and filter rows by resource only
        wtMatches = (wt.name||'').toLowerCase().includes(q);
        if (!wtMatches){
            filtered = byRes.filter(r=>{
                const hay = [(r.name||''),(r.comments||''),(r.supplier||'')].map(x=>x.toLowerCase()).join(' ');
                return hay.includes(q);
            });
        }
    }
    // If filtered is empty and WT name doesn't match and resource filter/search active — skip WT
    if ((resFilter!=='all' || q) && filtered.length===0 && !wtMatches) return '';
    return renderWorkTypeTableWithRows(group, wt, wtGlobalIndex, filtered, showPhotos, q);
}
function renderWorkTypeTableWithRows(group, wt, wtGlobalIndex, rowsForRender, showPhotos, q){
    const rows = rowsForRender;
    let rowsHtml='';
    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
    function highlightQuery(text, query){
        if (!query) return escapeHtml(text);
        try{
            const safe = escapeHtml(text);
            const re = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')})`,'gi');
            return safe.replace(re, '<span class="search-hit">$1</span>');
        }catch(_){ return escapeHtml(text); }
    }
    rows.forEach((row,index)=>{
        const isEmpty = !(row.name && row.name.toString().trim().length) || !row.unit || !(Number(row.quantity) > 0) || !(Number(row.price) > 0);
        const trClass = isEmpty ? 'row-empty' : '';
        const hi = (txt)=> highlightQuery(String(txt||''), q);
        rowsHtml += `
        <tr class="${trClass}" id="plan-row-${row.id}">
            <td>${wtGlobalIndex}.${index + 1}</td>
            <td class="photo-col">${ showPhotos ? `<div class=\"photo-cell\">${row.photo ? `<img src=\"${row.photo}\" alt=\"Фото\">` : '<div class=\"photo-placeholder\" style=\"color:#9aa6b2; font-size:11px;\">Фото</div>'}<input type=\"file\" id=\"photo-input-${row.id}\" class=\"photo-input\" accept=\"image/*\" onchange=\"handlePhotoUpload('${group.id}', '${row.id}', this)\"></div>` : '' }</td>
            <td><input type="text" value="${row.name || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'name', this.value)"><div style="font-size:11px; color:#6b7785;">${q?hi(row.name):''}</div></td>
            <td class="resource-cell">${renderResourceSelectorHTML(group.id, row.id, row.resource)}</td>
            <td>
                <select onchange="updatePlanRow('${group.id}', '${row.id}', 'unit', this.value)">
                    <option value="шт" ${row.unit==='шт'?'selected':''}>шт</option>
                    <option value="кг" ${row.unit==='кг'?'selected':''}>кг</option>
                    <option value="м" ${row.unit==='м'?'selected':''}>м</option>
                    <option value="м2" ${row.unit==='м2'?'selected':''}>м2</option>
                    <option value="м3" ${row.unit==='м3'?'selected':''}>м3</option>
                    <option value="пачка" ${row.unit==='пачка'?'selected':''}>пачка</option>
                    <option value="мешок" ${row.unit==='мешок'?'selected':''}>мешок</option>
                    <option value="комплект" ${row.unit==='комплект'?'selected':''}>комплект</option>
                    <option value="л" ${row.unit==='л'?'selected':''}>л</option>
                    <option value="ведро" ${row.unit==='ведро'?'selected':''}>ведро</option>
                    <option value="рейс" ${row.unit==='рейс'?'selected':''}>рейс</option>
                </select>
            </td>
            <td><input id="qty-${row.id}" type="number" value="${row.quantity || 0}" step="0.01" oninput="livePlanRowCalc('${group.id}','${wt.id}','${row.id}')" onchange="updatePlanRow('${group.id}', '${row.id}', 'quantity', parseFloat(this.value)); calculatePlanRowSum('${group.id}', '${row.id}')"></td>
            <td><input id="price-${row.id}" type="text" class="currency-input" value="${formatCurrency(row.price || 0)}" data-original-value="${row.price || 0}" oninput="livePlanRowCalc('${group.id}','${wt.id}','${row.id}')" onblur="const val = parseCurrency(this.value); this.setAttribute('data-original-value', val); this.value = formatCurrency(val); updatePlanRow('${group.id}', '${row.id}', 'price', val); calculatePlanRowSum('${group.id}', '${row.id}')" onfocus="this.value = this.getAttribute('data-original-value') || '0'"></td>
            <td><input id="sum-${row.id}" type="text" class="currency-input" value="${formatCurrency(row.sum || 0)}" readonly style="background-color:#f5f5f5;"></td>
            <td><input type="text" value="${row.comments || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'comments', this.value)"><div style="font-size:11px; color:#6b7785;">${q?hi(row.comments):''}</div></td>
            <td><input type="text" value="${row.supplier || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'supplier', this.value)"><div style="font-size:11px; color:#6b7785;">${q?hi(row.supplier):''}</div></td>
            <td class="actions-cell">
                <div class="actions-flex">
                    <button class="icon-btn" title="Вверх" onclick="moveResource('${group.id}','${wt.id}','${row.id}','up')">↑</button>
                    <button class="icon-btn" title="Вниз" onclick="moveResource('${group.id}','${wt.id}','${row.id}','down')">↓</button>
                    <button class="icon-btn" title="Удалить ресурс" onclick="deleteResourceFromWorkType('${group.id}','${wt.id}','${row.id}')">✕</button>
                </div>
            </td>
        </tr>`;
    });

    const wtTotal = calculateWorkTypeTotal(wt);
    const unitPrice = calculateWorkTypeUnitPrice(wt);
    const photoHeader = '<th class="photo-col">Фото</th>';
    const hi = (txt)=> highlightQuery(String(txt||''), q);
    const wtOpen = (window.__openPlanWorkTypes && window.__openPlanWorkTypes[wt.id]) ? true : false;
    const wtBodyClass = wtOpen ? 'worktype-body collapsible-body open' : 'worktype-body collapsible-body';
    const wtBodyStyle = wtOpen ? 'display:block; opacity:1; max-height:none;' : 'display:none; opacity:0; max-height:0;';
    return `
    <div class="worktype-section" style="margin-bottom:16px;">
        <div class="worktype-header" style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
            <button class="icon-btn collapse-toggle" onclick="toggleWorkTypeCollapse('${group.id}','${wt.id}')">▾</button>
            <span class="worktype-number">${wtGlobalIndex}</span>
            <input type="text" value="${wt.name}" class="group-title" style="max-width:240px; height:36px;" onchange="updateWorkType('${group.id}','${wt.id}','name', this.value)" placeholder="Вид работ">
            ${q?`<span style="font-size:12px; color:#6b7785;">${hi(wt.name)}</span>`:''}
            <select onchange="updateWorkType('${group.id}','${wt.id}','unit', this.value)" style="height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; min-width:110px;">
                <option value="шт" ${wt.unit==='шт'?'selected':''}>шт</option>
                <option value="м2" ${wt.unit==='м2'?'selected':''}>м2</option>
                <option value="м3" ${wt.unit==='м3'?'selected':''}>м3</option>
                <option value="кг" ${wt.unit==='кг'?'selected':''}>кг</option>
                <option value="л" ${wt.unit==='л'?'selected':''}>л</option>
                <option value="комплект" ${wt.unit==='комплект'?'selected':''}>комплект</option>
            </select>
            <input type="number" value="${wt.quantity || 0}" step="0.01" onchange="updateWorkType('${group.id}','${wt.id}','quantity', parseFloat(this.value))" placeholder="0" style="width:120px; height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; font-weight:600; text-align:right;">
            <div style="background:#f8fafc; border:1px solid var(--border); padding:8px 12px; border-radius:8px; font-size:12px; line-height:1.4; min-width:180px; height:36px; display:flex; align-items:center;">
                <span style="color:#2b3440; font-weight:600;" id="wt-unitprice-${wt.id}">${formatCurrency(unitPrice)} UZS</span>
            </div>
            <div style="background:#f8fafc; border:1px solid var(--border); padding:8px 12px; border-radius:8px; font-size:12px; line-height:1.4; min-width:180px; height:36px; display:flex; align-items:center;">
                <span style="color:#2b3440; font-weight:600;" id="wt-total-${wt.id}">${formatCurrency(wtTotal)} UZS</span>
            </div>
            ${renderContractorSelectHTML(group.id, wt.id, wt.contractorId)}
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;">
                <button class="icon-btn" title="Добавить ресурс" onclick="addResourceToWorkType('${group.id}','${wt.id}')">+</button>
                <button class="icon-btn" title="Вверх" onclick="moveWorkType('${group.id}','${wt.id}','up')">↑</button>
                <button class="icon-btn" title="Вниз" onclick="moveWorkType('${group.id}','${wt.id}','down')">↓</button>
                <button class="icon-btn" title="Удалить вид работ" onclick="deleteWorkType('${group.id}','${wt.id}')">✕</button>
            </div>
        </div>
        <div class="${wtBodyClass}" id="worktype-body-${wt.id}" style="${wtBodyStyle}">
            <div class="table-wrapper ${showPhotos? '' : 'compact-resources'}">
            <table class="smeta-table">
                <thead>
                    <tr>
                        <th>№</th>
                        ${photoHeader}
                        <th>Название</th>
                        <th>Ресурс</th>
                        <th>Ед.изм</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Сумма</th>
                        <th>Комментарии</th>
                        <th>Поставщик</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || `<tr><td colspan="${showPhotos? '11':'10'}" style="text-align:center; padding:12px;">Нет ресурсов</td></tr>`}
                </tbody>
            </table>
            </div>
        </div>
    </div>`;
}

// ====== Подрядчики: дропдаун выбора для вида работ ======
function getActiveContractors(){
    try{
        const arr = JSON.parse(localStorage.getItem('smeta_contractors'))||[];
        return arr.filter(c=> (c.status||'активен')==='активен').sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'ru'));
    }catch(_){ return []; }
}
function contractorNameById(id){
    try{
        const arr = JSON.parse(localStorage.getItem('smeta_contractors'))||[];
        const c = arr.find(x=>x.id===id);
        return c ? c.name : '';
    }catch(_){ return ''; }
}
function renderContractorSelectHTML(groupId, workTypeId, contractorId){
    const name = contractorNameById(contractorId) || 'Подрядчик не назначен';
    const menuId = `ctr-menu-${workTypeId}`;
    return `
    <div class="contractor-select">
        <div class="contractor-trigger" onclick="toggleContractorMenu('${menuId}')"><span class="label">${name}</span><span style="margin-left:auto; color:#6b7785;">▾</span></div>
        <div class="contractor-menu" id="${menuId}">
            <input type="text" class="contractor-search" placeholder="Поиск..." oninput="filterContractorMenu('${menuId}', this.value)">
            <div class="contractor-list">${getActiveContractors().map(c=>`<div class=\"contractor-item\" data-name=\"${(c.name||'').toLowerCase()}\" onclick=\"selectContractor('${groupId}','${workTypeId}','${c.id}')\"><div>${c.name}</div>${c.phone?`<div style=\"font-size:11px; color:#6b7785;\">${c.phone}${c.contact? ' • '+c.contact:''}</div>`:''}</div>`).join('') || '<div class="contractor-empty">Нет подрядчиков</div>'}</div>
        </div>
    </div>`;
}
function toggleContractorMenu(id){
    document.querySelectorAll('.contractor-menu.open').forEach(m=>{ if(m.id!==id) m.classList.remove('open'); });
    const el = document.getElementById(id); if (el) el.classList.toggle('open');
}
function filterContractorMenu(id, q){
    const el = document.getElementById(id); if (!el) return; const list = el.querySelector('.contractor-list'); if (!list) return; const query = (q||'').trim().toLowerCase();
    list.querySelectorAll('.contractor-item').forEach(item=>{ const nm=item.getAttribute('data-name')||''; item.style.display = (!query || nm.includes(query)) ? '' : 'none'; });
}
function selectContractor(groupId, workTypeId, contractorId){
    // Сначала закрываем меню, чтобы избежать визуального «залипания»
    document.querySelectorAll('.contractor-menu.open').forEach(m=>m.classList.remove('open'));
    // Затем обновляем подрядчика и перерисовываем
    updateWorkType(groupId, workTypeId, 'contractorId', contractorId);
}
// Initialize resource filter dropdown options
function initPlanResourceFilterControls(){
    try{
        const sel = document.getElementById('plan-resource-filter');
        if (!sel || sel.dataset.initialized) return;
        const cats = resourceCatalog();
        sel.innerHTML = '<option value="all">Все ресурсы</option>' + cats.map(c=>`<option value="${c.code}">${c.name}</option>`).join('');
        sel.dataset.initialized = '1';
        // restore previous selection
        if (window.__planResourceFilter){ sel.value = window.__planResourceFilter; }
        const chk = document.getElementById('plan-hide-photos');
        if (chk){
            // Checked means hide photos; default to checked unless user explicitly enabled photos
            chk.checked = (window.__planShowPhotos !== true);
        }
        const search = document.getElementById('plan-search-input');
        if (search){ search.value = window.__planSearchQuery || ''; }
    }catch(_){ }
}
function setPlanResourceFilter(val){
    window.__planResourceFilter = val || 'all';
    doRenderPlanGroupsPreserveScroll();
}
function togglePlanPhotos(hide){
    // Checkbox checked => hide photos => __planShowPhotos = false
    window.__planShowPhotos = hide ? false : true;
    doRenderPlanGroupsPreserveScroll();
}
function setPlanSearchQuery(val){
    window.__planSearchQuery = val || '';
    doRenderPlanGroupsPreserveScroll();
}

// Перерисовка плана с сохранением позиции прокрутки
function doRenderPlanGroupsPreserveScroll(){
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    renderPlanGroups();
    requestAnimationFrame(()=>{
        window.scrollTo(0, y);
        // sync controls after render
        try{
            const sel = document.getElementById('plan-resource-filter'); if (sel && window.__planResourceFilter) sel.value = window.__planResourceFilter;
            const chk = document.getElementById('plan-hide-photos'); if (chk) chk.checked = (window.__planShowPhotos !== true);
            const search = document.getElementById('plan-search-input'); if (search) search.value = window.__planSearchQuery || '';
        }catch(_){ }
    });
}

// Collapse/expand helpers
function toggleGroupCollapse(groupId){
    window.__openPlanGroups = window.__openPlanGroups || {};
    const body = document.getElementById('group-body-'+groupId);
    if (!body) return;
    const wasOpen = !!window.__openPlanGroups[groupId];
    const willOpen = !wasOpen;
    window.__openPlanGroups[groupId] = willOpen;
    animateToggle(body, willOpen);
}
function toggleWorkTypeCollapse(groupId, workTypeId){
    window.__openPlanWorkTypes = window.__openPlanWorkTypes || {};
    const body = document.getElementById('worktype-body-'+workTypeId);
    if (!body) return;
    const wasOpen = !!window.__openPlanWorkTypes[workTypeId];
    const willOpen = !wasOpen;
    window.__openPlanWorkTypes[workTypeId] = willOpen;
    animateToggle(body, willOpen);
}

function expandAllGroups(){
    window.__openPlanGroups = window.__openPlanGroups || {};
    document.querySelectorAll('.group-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('group-body-','');
        if (id) window.__openPlanGroups[id] = true;
        animateToggle(el, true);
    });
}
function collapseAllGroups(){
    window.__openPlanGroups = window.__openPlanGroups || {};
    document.querySelectorAll('.group-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('group-body-','');
        if (id) window.__openPlanGroups[id] = false;
        animateToggle(el, false);
    });
}
function expandAllWorkTypes(){
    window.__openPlanWorkTypes = window.__openPlanWorkTypes || {};
    document.querySelectorAll('.worktype-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('worktype-body-','');
        if (id) window.__openPlanWorkTypes[id] = true;
        animateToggle(el, true);
    });
}
function collapseAllWorkTypes(){
    window.__openPlanWorkTypes = window.__openPlanWorkTypes || {};
    document.querySelectorAll('.worktype-body.collapsible-body').forEach(el=>{
        const id = el.id && el.id.replace('worktype-body-','');
        if (id) window.__openPlanWorkTypes[id] = false;
        animateToggle(el, false);
    });
}

function animateToggle(el, open){
    try{
        // Immediate show/hide without animation to avoid flicker/re-render conflicts
        if (open){
            el.classList.add('open');
            el.style.display = 'block';
            el.style.opacity = '1';
            el.style.maxHeight = '';
        } else {
            el.classList.remove('open');
            el.style.display = 'none';
            el.style.opacity = '0';
            el.style.maxHeight = '0px';
        }
    }catch(_){ }
}

function scrollAndFlashGroup(groupId){
    try{
        const body = document.getElementById('group-body-'+groupId);
        if (!body){
            // maybe render hasn't finished; retry shortly
            setTimeout(()=> scrollAndFlashGroup(groupId), 200);
            return;
        }
        // scroll the whole group-section into view
        const section = body.closest('.group-section') || body;
        try{ section.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(_){ section.scrollIntoView(); }
        // flash the group header area 3 times using the CSS animation
        section.classList.add('flash-highlight');
        // remove class after the CSS animation (900ms * 5 iterations ~= 4500ms)
        setTimeout(()=>{
            section.classList.remove('flash-highlight');
        }, 4800);
    }catch(_){ }
}

// Обновление данных строки плана
function updatePlanRow(groupId, rowId, field, value) {
    const group = currentObject.data.plan.groups.find(g => g.id === groupId);
    if (group) {
        // Backward compatibility: update first matching row across work types
        const { row, wt } = findResourceRow(group, rowId) || {};
        if (row) {
            row[field] = value;
            // Авто-пересчёт логики: если введена сумма и qty => price; если введены qty и price => sum
            const qty = Number(row.quantity)||0;
            const price = Number(row.price)||0;
            const sum = Number(row.sum)||0;
            if (field === 'sum') {
                // пользователь напрямую ввёл итоговую сумму (через будущее поле) => пересчёт цены если qty>0
                if (qty > 0) {
                    row.price = sum / qty;
                }
            } else if (field === 'quantity' || field === 'price') {
                if (qty > 0 && price > 0) {
                    row.sum = qty * price;
                }
            }
            saveObject();
            doRenderPlanGroupsPreserveScroll(); // перерисуем без потери позиции
            renderFactGroups();
            loadAnalysisData();
        }
    }
}

// Расчет суммы строки плана
function calculatePlanRowSum(groupId, rowId) {
    const group = currentObject.data.plan.groups.find(g => g.id === groupId);
    if (group) {
        const fr = findResourceRow(group, rowId);
        if (fr && fr.row) {
            const qty = Number(fr.row.quantity)||0;
            const price = Number(fr.row.price)||0;
            fr.row.sum = qty * price;
            saveObject();
            doRenderPlanGroupsPreserveScroll();
        }
    }
}

// Обработка загрузки фото
function handlePhotoUpload(groupId, rowId, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            updatePlanRow(groupId, rowId, 'photo', e.target.result);
            // clear input to allow selecting same file again if needed
            try { input.value = ''; } catch (err) {}
            // Перерисовка произойдёт в updatePlanRow
        };
        reader.readAsDataURL(file);
    }
}

// Обновление названия группы
function updateGroupName(type, groupId, name) {
    if (type === 'plan') {
        const group = currentObject.data.plan.groups.find(g => g.id === groupId);
        if (group) {
            group.name = name;
            saveObject();
        }
    }
}

// Расчет итога группы
function calculateGroupTotal(rows) { // legacy (rows array)
    return (rows||[]).reduce((sum, row) => sum + (row.sum || 0), 0);
}
function calculateGroupTotalAny(group){
    if (!group) return 0;
    if (Array.isArray(group.rows) && group.rows.length){ return calculateGroupTotal(group.rows); }
    const wts = Array.isArray(group.workTypes) ? group.workTypes : [];
    let total = 0;
    wts.forEach(wt=>{ total += calculateWorkTypeTotal(wt); });
    return total;
}
function calculateWorkTypeTotal(wt){
    const rows = Array.isArray(wt?.resources) ? wt.resources : [];
    return rows.reduce((s,r)=> s + (Number(r.sum || (r.quantity||0)*(r.price||0)) || 0), 0);
}
function calculateWorkTypeUnitPrice(wt){
    const qty = Number(wt?.quantity || 0);
    const total = calculateWorkTypeTotal(wt);
    return qty > 0 ? (total / qty) : 0;
}

// ======= Helpers for hierarchical plan (Work Types) =======
function createDefaultWorkType(){
    return { id: 'wt-'+Date.now().toString()+Math.random().toString(16).slice(2), name: 'Вид работ', unit: 'шт', quantity: 0, resources: [] };
}
function createEmptyResourceRow(){
    return {
        id: 'res-'+Date.now().toString()+Math.random().toString(16).slice(2),
        photo: null,
        name: '',
        resource: '',
        unit: '',
        quantity: 0,
        price: 0,
        sum: 0,
        comments: '',
        location: null,
        supplier: ''
    };
}
function migratePlanToWorkTypes(){
    try{
        const groups = currentObject?.data?.plan?.groups || [];
        groups.forEach(g=>{
            if (Array.isArray(g.workTypes)) return; // already migrated
            const legacyRows = Array.isArray(g.rows) ? g.rows : [];
            const wt = createDefaultWorkType();
            wt.resources = legacyRows;
            g.workTypes = [wt];
            delete g.rows;
        });
        saveObject();
    }catch(_){/* ignore */}
}
function getGroupPlanRows(group){
    if (!group) return [];
    if (Array.isArray(group.rows)) return group.rows; // legacy fallback
    const wts = Array.isArray(group.workTypes) ? group.workTypes : [];
    const acc = [];
    wts.forEach(wt=>{ (wt.resources||[]).forEach(r=>acc.push(r)); });
    return acc;
}
function findResourceRow(group,rowId){
    if (!group) return null;
    if (Array.isArray(group.rows)){
        const row = group.rows.find(r=>r.id===rowId);
        return row ? { row, legacy:true } : null;
    }
    const wts = Array.isArray(group.workTypes) ? group.workTypes : [];
    for (const wt of wts){
        const row = (wt.resources||[]).find(r=>r.id===rowId);
        if (row) return { row, wt };
    }
    return null;
}
function addWorkType(groupId){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group) return;
    if (!Array.isArray(group.workTypes)) group.workTypes = [];
    const wt = createDefaultWorkType();
    // By default add three empty resource rows with empty fields
    wt.resources = [createEmptyResourceRow(), createEmptyResourceRow(), createEmptyResourceRow()];
    group.workTypes.push(wt);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
}
function moveGroup(groupId, dir){
    const groups = currentObject.data.plan.groups;
    const idx = groups.findIndex(g=>g.id===groupId);
    if (idx < 0) return;
    const target = dir==='up'? idx-1 : idx+1;
    if (target < 0 || target >= groups.length) return;
    const [g] = groups.splice(idx,1);
    groups.splice(target,0,g);
    saveObject();
    renderPlanGroups();
    renderFactGroups();
}
function moveWorkType(groupId, workTypeId, dir){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group || !Array.isArray(group.workTypes)) return;
    const idx = group.workTypes.findIndex(w=>w.id===workTypeId);
    if (idx < 0) return;
    const target = dir==='up'? idx-1 : idx+1;
    if (target < 0 || target >= group.workTypes.length) return;
    const [wt] = group.workTypes.splice(idx,1);
    group.workTypes.splice(target,0,wt);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
}
function updateWorkType(groupId, workTypeId, field, value){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group || !Array.isArray(group.workTypes)) return;
    const wt = group.workTypes.find(w=>w.id===workTypeId);
    if (!wt) return;
    wt[field] = value;
    saveObject();
    renderFactGroups();
    loadAnalysisData();
    doRenderPlanGroupsPreserveScroll();
}
function deleteWorkType(groupId, workTypeId){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group || !Array.isArray(group.workTypes)) return;
    if (!confirm('Удалить этот вид работ?')) return;
    group.workTypes = group.workTypes.filter(w=>w.id!==workTypeId);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
}
function addResourceToWorkType(groupId, workTypeId){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group) return;
    if (!Array.isArray(group.workTypes)) group.workTypes = [];
    const wt = group.workTypes.find(w=>w.id===workTypeId);
    if (!wt) return;
    if (!Array.isArray(wt.resources)) wt.resources = [];
    wt.resources.push({
        id: Date.now().toString(),
        photo:null,
        name:'',
        resource:'M',
        unit:'шт',
        quantity:0,
        price:0,
        sum:0,
        comments:'',
        location:null,
        supplier:''
    });
    saveObject();
    doRenderPlanGroupsPreserveScroll();
    renderFactGroups();
    loadAnalysisData();
}
function deleteResourceFromWorkType(groupId, workTypeId, rowId){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group) return;
    const wt = (group.workTypes||[]).find(w=>w.id===workTypeId);
    if (!wt) return;
    if (!wt.resources) return;
    wt.resources = wt.resources.filter(r=>r.id!==rowId);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
    renderFactGroups();
    loadAnalysisData();
}
function moveResource(groupId, workTypeId, rowId, dir){
    const group = currentObject.data.plan.groups.find(g=>g.id===groupId);
    if (!group) return;
    const wt = (group.workTypes||[]).find(w=>w.id===workTypeId);
    if (!wt || !Array.isArray(wt.resources)) return;
    const idx = wt.resources.findIndex(r=>r.id===rowId);
    if (idx < 0) return;
    const target = dir === 'up' ? idx-1 : idx+1;
    if (target < 0 || target >= wt.resources.length) return;
    const [row] = wt.resources.splice(idx,1);
    wt.resources.splice(target,0,row);
    saveObject();
    doRenderPlanGroupsPreserveScroll();
    renderFactGroups();
    loadAnalysisData();
}
function renderWorkTypeTable(group, wt, wtGlobalIndex){
    const rows = Array.isArray(wt.resources) ? wt.resources : [];
    let rowsHtml='';
    rows.forEach((row,index)=>{
        const isEmpty = !(row.name && row.name.toString().trim().length) || !row.unit || !(Number(row.quantity) > 0) || !(Number(row.price) > 0);
        const trClass = isEmpty ? 'row-empty' : '';
        rowsHtml += `
        <tr class="${trClass}" id="plan-row-${row.id}">
            <td>${wtGlobalIndex}.${index + 1}</td>
            <td>
                <div class="photo-cell">
                    ${row.photo ? `<img src="${row.photo}" alt="Фото">` : '<div class="photo-placeholder" style="color:#9aa6b2; font-size:11px;">Фото</div>'}
                    <input type="file" id="photo-input-${row.id}" class="photo-input" accept="image/*" onchange="handlePhotoUpload('${group.id}', '${row.id}', this)">
                </div>
            </td>
            <td><input type="text" value="${row.name || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'name', this.value)"></td>
            <td class="resource-cell">${renderResourceSelectorHTML(group.id, row.id, row.resource)}</td>
            <td>
                <select onchange="updatePlanRow('${group.id}', '${row.id}', 'unit', this.value)">
                    <option value="шт" ${row.unit==='шт'?'selected':''}>шт</option>
                    <option value="кг" ${row.unit==='кг'?'selected':''}>кг</option>
                    <option value="м" ${row.unit==='м'?'selected':''}>м</option>
                    <option value="м2" ${row.unit==='м2'?'selected':''}>м2</option>
                    <option value="м3" ${row.unit==='м3'?'selected':''}>м3</option>
                    <option value="пачка" ${row.unit==='пачка'?'selected':''}>пачка</option>
                    <option value="мешок" ${row.unit==='мешок'?'selected':''}>мешок</option>
                    <option value="комплект" ${row.unit==='комплект'?'selected':''}>комплект</option>
                    <option value="л" ${row.unit==='л'?'selected':''}>л</option>
                    <option value="ведро" ${row.unit==='ведро'?'selected':''}>ведро</option>
                    <option value="рейс" ${row.unit==='рейс'?'selected':''}>рейс</option>
                </select>
            </td>
            <td><input id="qty-${row.id}" type="number" value="${row.quantity || 0}" step="0.01" oninput="livePlanRowCalc('${group.id}','${wt.id}','${row.id}')" onchange="updatePlanRow('${group.id}', '${row.id}', 'quantity', parseFloat(this.value)); calculatePlanRowSum('${group.id}', '${row.id}')"></td>
            <td><input id="price-${row.id}" type="text" class="currency-input" value="${formatCurrency(row.price || 0)}" data-original-value="${row.price || 0}" oninput="livePlanRowCalc('${group.id}','${wt.id}','${row.id}')" onblur="const val = parseCurrency(this.value); this.setAttribute('data-original-value', val); this.value = formatCurrency(val); updatePlanRow('${group.id}', '${row.id}', 'price', val); calculatePlanRowSum('${group.id}', '${row.id}')" onfocus="this.value = this.getAttribute('data-original-value') || '0'"></td>
            <td><input id="sum-${row.id}" type="text" class="currency-input" value="${formatCurrency(row.sum || 0)}" readonly style="background-color:#f5f5f5;"></td>
            <td><input type="text" value="${row.comments || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'comments', this.value)"></td>
            <td><input type="text" value="${row.supplier || ''}" onchange="updatePlanRow('${group.id}', '${row.id}', 'supplier', this.value)"></td>
            <td class="actions-cell">
                <div class="actions-flex">
                    <button class="icon-btn" title="Вверх" onclick="moveResource('${group.id}','${wt.id}','${row.id}','up')">↑</button>
                    <button class="icon-btn" title="Вниз" onclick="moveResource('${group.id}','${wt.id}','${row.id}','down')">↓</button>
                    <button class="icon-btn" title="Удалить ресурс" onclick="deleteResourceFromWorkType('${group.id}','${wt.id}','${row.id}')">✕</button>
                </div>
            </td>
        </tr>`;
    });

    const wtTotal = calculateWorkTypeTotal(wt);
    const unitPrice = calculateWorkTypeUnitPrice(wt);

    return `
    <div class="worktype-section" style="margin-bottom:16px;">
        <div class="worktype-header" style="display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;">
            <span class="worktype-number">${wtGlobalIndex}</span>
            <input type="text" value="${wt.name}" class="group-title" style="max-width:240px; height:36px;" onchange="updateWorkType('${group.id}','${wt.id}','name', this.value)" placeholder="Вид работ">
            <select onchange="updateWorkType('${group.id}','${wt.id}','unit', this.value)" style="height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; min-width:110px;">
                <option value="шт" ${wt.unit==='шт'?'selected':''}>шт</option>
                <option value="м2" ${wt.unit==='м2'?'selected':''}>м2</option>
                <option value="м3" ${wt.unit==='м3'?'selected':''}>м3</option>
                <option value="кг" ${wt.unit==='кг'?'selected':''}>кг</option>
                <option value="л" ${wt.unit==='л'?'selected':''}>л</option>
                <option value="комплект" ${wt.unit==='комплект'?'selected':''}>комплект</option>
            </select>
            <input type="number" value="${wt.quantity || 0}" step="0.01" onchange="updateWorkType('${group.id}','${wt.id}','quantity', parseFloat(this.value))" placeholder="0" style="width:120px; height:36px; padding:6px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; font-weight:600; text-align:right;">
            <div style="background:#f8fafc; border:1px solid var(--border); padding:8px 12px; border-radius:8px; font-size:12px; line-height:1.4; min-width:180px; height:36px; display:flex; align-items:center;">
                <span style="color:#2b3440; font-weight:600;" id="wt-unitprice-${wt.id}">${formatCurrency(unitPrice)} UZS</span>
            </div>
            <div style="background:#f8fafc; border:1px solid var(--border); padding:8px 12px; border-radius:8px; font-size:12px; line-height:1.4; min-width:180px; height:36px; display:flex; align-items:center;">
                <span style="color:#2b3440; font-weight:600;" id="wt-total-${wt.id}">${formatCurrency(wtTotal)} UZS</span>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;">
                <button class="icon-btn" title="Добавить ресурс" onclick="addResourceToWorkType('${group.id}','${wt.id}')">+</button>
                <button class="icon-btn" title="Вверх" onclick="moveWorkType('${group.id}','${wt.id}','up')">▲</button>
                <button class="icon-btn" title="Вниз" onclick="moveWorkType('${group.id}','${wt.id}','down')">▼</button>
                <button class="icon-btn" title="Удалить вид работ" onclick="deleteWorkType('${group.id}','${wt.id}')">✕</button>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="smeta-table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Фото</th>
                        <th>Название</th>
                        <th>Ресурс</th>
                        <th>Ед.изм</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        window.closeSupplyOrderModal = closeSupplyOrderModal;
                        window.jumpToPlanRow = jumpToPlanRow;
                        <th>Сумма</th>
                        <th>Комментарии</th>
                        <th>Поставщик</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="11" style="text-align:center; padding:12px;">Нет ресурсов</td></tr>'}
                </tbody>
            </table>
        </div>
        <!-- Duplicate action buttons removed -->
    </div>`;
}

// Live update for plan row (quantity/price) without full redraw
function livePlanRowCalc(groupId, workTypeId, rowId){
    const group = currentObject?.data?.plan?.groups.find(g=>g.id===groupId);
    if (!group) return;
    const wt = (group.workTypes||[]).find(w=>w.id===workTypeId);
    if (!wt) return;
    const row = (wt.resources||[]).find(r=>r.id===rowId);
    if (!row) return;
    const qtyEl = document.getElementById('qty-'+rowId);
    const priceEl = document.getElementById('price-'+rowId);
    if (!qtyEl || !priceEl) return;
    const qty = parseFloat(qtyEl.value)||0;
    const price = parseCurrency(priceEl.value);
    row.quantity = qty;
    row.price = price;
    row.sum = qty * price;
    const sumEl = document.getElementById('sum-'+rowId);
    if (sumEl) sumEl.value = formatCurrency(row.sum);
    // Update work type totals
    const wtTotal = calculateWorkTypeTotal(wt);
    const unitPrice = calculateWorkTypeUnitPrice(wt);
    const wtTotalEl = document.getElementById('wt-total-'+wt.id);
    const wtUnitEl = document.getElementById('wt-unitprice-'+wt.id);
    if (wtTotalEl) wtTotalEl.textContent = formatCurrency(wtTotal) + ' UZS';
    if (wtUnitEl) wtUnitEl.textContent = formatCurrency(unitPrice) + ' UZS';
    saveObject();
    // Only update grand totals & charts (could be optimized by debouncing if performance issues)
    updateGrandTotalPlan();
}

// Обновление общего итога плана
function updateGrandTotalPlan() {
    let total = 0;
    if (currentObject.data.plan.groups) {
        currentObject.data.plan.groups.forEach(group => {
            total += calculateGroupTotalAny(group);
        });
    }
    // Добавляем мета-расходы плана
    const meta = currentObject.data.plan.metaExpenses || { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    const resourcesSum = total;
    const miscAmount = (resourcesSum * (Number(meta.miscPercent)||0))/100;
    const extraTotal = (meta.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    const metaSum = Number(meta.land||0) + Number(meta.permit||0) + Number(meta.project||0) + miscAmount + extraTotal;
    total += metaSum;
    document.getElementById('grand-total-plan').textContent = formatCurrency(total);
    // Обновить отображение суммы для каждого этапа (inline рядом с названием)
    try{
        (currentObject.data.plan.groups||[]).forEach(g=>{
            const el = document.getElementById('group-total-inline-'+g.id);
            if (el) el.textContent = formatCurrency(calculateGroupTotalAny(g));
        });
    }catch(_){ }
    updateChart();
    // Hide the grand-total block when there is no meaningful data (total === 0)
    try{
        const grandBlock = document.querySelector('.grand-total');
        if (grandBlock) grandBlock.style.display = (Number(total) > 0) ? 'block' : 'none';
    }catch(_){ }
    // Обновить горизонтальные графики для бюджета
    renderPlanResourceChart();
    renderPlanGroupChart();
}

// Загрузка данных плана
function loadPlanData() {
    renderPlanGroups();
    renderPlanMetaExpenses();
}

// ======== Графики Бюджета: по ресурсам и по группам ========
function computePlanResourceTotals() {
    const totals = { M: 0, TX: 0, T: 0, D: 0, MB: 0, EQ: 0, OBE: 0, KM: 0, DK: 0 };
    const groups = currentObject?.data?.plan?.groups || [];
    groups.forEach(g => {
        const rows = getGroupPlanRows(g);
        rows.forEach(r => {
            const res = (r.resource || 'M').toUpperCase();
            const sum = Number(r.sum || ((r.quantity||0)*(r.price||0)) || 0);
            if (totals.hasOwnProperty(res)) totals[res] += sum; else totals[res] = sum;
        });
    });
    return totals;
}

function renderPlanResourceChart() {
    const host = document.getElementById('plan-resource-chart');
    if (!host) return;
    const totals = computePlanResourceTotals();
    const entries = Object.entries(totals).filter(([,v]) => (v||0) > 0);
    if (entries.length === 0) { host.innerHTML = '<div class="muted">Нет данных</div>'; return; }
    const max = Math.max(...entries.map(([,v]) => v), 1);
    // Sort by value desc
    entries.sort((a,b)=>b[1]-a[1]);
    host.innerHTML = entries.map(([res, val])=>{
        const pct = Math.max(0.5, Math.round((val/max)*100));
        const item = resourceCatalog().find(i=>i.code===res);
        const labelText = item ? item.name : `Ресурс ${res}`;
        return `
        <div class="hbar-row">
            <div class="hbar-label">${renderResourceBadge(res)} <span>${labelText}</span></div>
            <div class="hbar-track"><div class="hbar-fill res-${res}" style="width:${pct}%"></div></div>
            <div class="hbar-value">${formatCurrency(val)} UZS</div>
        </div>`;
    }).join('');
}

function renderPlanGroupChart() {
    const host = document.getElementById('plan-group-chart');
    if (!host) return;
    const groups = currentObject?.data?.plan?.groups || [];
    if (!groups.length) { host.innerHTML = '<div class="muted">Нет данных</div>'; return; }
    const data = groups.map(g=>({ name: g.name || 'Группа', total: calculateGroupTotalAny(g) }));
    const nonzero = data.filter(d=> (d.total||0) > 0);
    if (!nonzero.length) { host.innerHTML = '<div class="muted">Нет данных</div>'; return; }
    const max = Math.max(...nonzero.map(d=>d.total), 1);
    nonzero.sort((a,b)=>b.total-a.total);
    host.innerHTML = nonzero.map(d=>{
        const pct = Math.max(0.5, Math.round((d.total/max)*100));
        const label = d.name.replace(/[<>]/g,'');
        return `
        <div class="hbar-row">
            <div class="hbar-label">${label}</div>
            <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%"></div></div>
            <div class="hbar-value">${formatCurrency(d.total)} UZS</div>
        </div>`;
    }).join('');
}

// ========== ФАКТ ==========
// Дополнительная структура: выплаты подрядчикам
function ensureContractorPayments(){
    if (!currentObject.data.fact.contractorPayments) currentObject.data.fact.contractorPayments = [];
}

function addContractorPayment(){
    ensureContractorPayments();
    const id = 'cp-' + Date.now().toString(36);
    currentObject.data.fact.contractorPayments.push({
        id,
        date:'',
        contractorId:'',
        groupId:'',
        workTypeId:'',
        amount:0,
        fromUserId:'',
        receivedByUserId:'',
        photos:[],
        note:''
    });
    saveObject();
    renderContractorPayments();
}
function updateContractorPayment(id, field, value){
    ensureContractorPayments();
    const row = currentObject.data.fact.contractorPayments.find(r=>r.id===id); if(!row) return;
    if(field==='amount') row.amount = isNaN(value)?0:Number(value); else row[field]=value;
    saveObject();
    renderContractorPayments();
}
function deleteContractorPayment(id){
    if(!confirm('Удалить запись выплаты?')) return;
    ensureContractorPayments();
    currentObject.data.fact.contractorPayments = currentObject.data.fact.contractorPayments.filter(r=>r.id!==id);
    saveObject();
    renderContractorPayments();
}
function handleContractorPaymentPhoto(id, slotIndex, input){
    const file = input.files && input.files[0]; if(!file) return;
    ensureContractorPayments();
    const row = currentObject.data.fact.contractorPayments.find(r=>r.id===id); if(!row) return;
    if(!row.photos) row.photos=[];
    const reader = new FileReader();
    reader.onload = e=>{
        row.photos[slotIndex] = e.target.result;
        try{ input.value=''; }catch(_){ }
        saveObject();
        renderContractorPayments();
    };
    reader.readAsDataURL(file);
}
function deleteContractorPaymentPhoto(id, slotIndex){
    ensureContractorPayments();
    const row = currentObject.data.fact.contractorPayments.find(r=>r.id===id); if(!row||!row.photos) return;
    row.photos.splice(slotIndex,1);
    saveObject();
    renderContractorPayments();
}
function renderContractorPayments(){
    ensureContractorPayments();
    const host = document.getElementById('contractor-payments-container'); if(!host) return;
    const users = (()=>{ try { return JSON.parse(localStorage.getItem('smeta_users'))||[]; } catch(_) { return []; } })().filter(u=> (u.status||'активен')==='активен');
    const contractors = (()=>{ try { return JSON.parse(localStorage.getItem('smeta_contractors'))||[]; } catch(_) { return []; } })();
    const planGroups = currentObject.data.plan.groups || [];
    const groupOptions = '<option value="">Этап...</option>' + planGroups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
    const workTypeOptions = (groupId)=>{
        const g = planGroups.find(x=>x.id===groupId); if(!g||!Array.isArray(g.workTypes)) return '<option value="">Вид работ...</option>';
        return '<option value="">Вид работ...</option>' + g.workTypes.map(w=>`<option value="${w.id}">${w.name||'Без названия'}</option>`).join('');
    };
    const userOptions = '<option value="">—</option>' + users.map(u=>`<option value="${u.id}">${u.fullName||u.name||u.username||u.phone||u.id}</option>`).join('');
    const contractorOptions = '<option value="">Подрядчик...</option>' + contractors.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    let rowsHtml='';
    currentObject.data.fact.contractorPayments.forEach((r,idx)=>{
        const wtOpts = workTypeOptions(r.groupId);
        rowsHtml += `<tr>
            <td class="center">${idx+1}</td>
            <td><input type="date" value="${r.date}" onchange="updateContractorPayment('${r.id}','date', this.value)"></td>
            <td><select onchange="updateContractorPayment('${r.id}','contractorId', this.value)">${contractorOptions.replace(`value=\"${r.contractorId}\"`, `value=\"${r.contractorId}\" selected`)}</select></td>
            <td><select onchange="updateContractorPayment('${r.id}','groupId', this.value)">${groupOptions.replace(`value=\"${r.groupId}\"`, `value=\"${r.groupId}\" selected`)}</select></td>
            <td><select onchange="updateContractorPayment('${r.id}','workTypeId', this.value)">${wtOpts.replace(`value=\"${r.workTypeId}\"`, `value=\"${r.workTypeId}\" selected`)}</select></td>
            <td><input type="text" class="currency-input" value="${formatCurrency(r.amount)}" data-original-value="${r.amount}" onfocus="this.value=this.getAttribute('data-original-value')||'0'" onblur="const val=parseCurrency(this.value); this.setAttribute('data-original-value', val); this.value=formatCurrency(val); updateContractorPayment('${r.id}','amount', val);"></td>
            <td><select onchange="updateContractorPayment('${r.id}','fromUserId', this.value)">${userOptions.replace(`value=\"${r.fromUserId}\"`, `value=\"${r.fromUserId}\" selected`)}</select></td>
            <td><select onchange="updateContractorPayment('${r.id}','receivedByUserId', this.value)">${userOptions.replace(`value=\"${r.receivedByUserId}\"`, `value=\"${r.receivedByUserId}\" selected`)}</select></td>
            <td>
                <div class="receipts-grid">
                    ${[0,1,2,3,4,5].map(i=>{
                        const img = (r.photos||[])[i];
                        const inputId = `cp-photo-${r.id}-${i}`;
                        return img?`<div class='receipt-slot' title='Фото ${i+1}'><img src='${img}' alt='Фото'><div class='slot-actions'><button class='thumb-btn' onclick="deleteContractorPaymentPhoto('${r.id}',${i})">X</button></div></div>`:
                        `<div class='receipt-slot empty' title='Добавить фото' onclick="document.getElementById('${inputId}').click()"><input type='file' id='${inputId}' class='hidden-file-input' accept='image/*' onchange="handleContractorPaymentPhoto('${r.id}',${i}, this)"></div>`;
                    }).join('')}
                </div>
            </td>
            <td><input type="text" value="${r.note||''}" onchange="updateContractorPayment('${r.id}','note', this.value)"></td>
            <td class="center"><button class="icon-btn" title="Удалить" onclick="deleteContractorPayment('${r.id}')">✕</button></td>
        </tr>`;
    });
    const total = currentObject.data.fact.contractorPayments.reduce((s,r)=> s + (r.amount||0),0);
    host.innerHTML = `<div class='table-wrapper'><table class='smeta-table'><thead><tr>
        <th class='center'>№</th><th>Дата</th><th>Подрядчик</th><th>Этап</th><th>Вид работ</th><th>Сумма</th><th>Кто передал</th><th>Кто получил</th><th>Фото</th><th>Заметки</th><th>Действия</th>
    </tr></thead><tbody>${rowsHtml || `<tr><td colspan='11' style='text-align:center; padding:12px;'>Нет выплат</td></tr>`}<tr class='group-total'><td colspan='5' style='text-align:right; font-weight:700;'>Итого выплат:</td><td style='font-weight:700;'>${formatCurrency(total)}</td><td colspan='5'></td></tr></tbody></table></div>`;
}

// Отображение групп факта
function renderFactGroups() {
    const container = document.getElementById('fact-groups-container');
    container.innerHTML = '';
    
    if (!currentObject.data.plan.groups || currentObject.data.plan.groups.length === 0) {
        container.innerHTML = '<p>Нет групп. Добавьте группы во вкладке "Бюджет".</p>';
        updateGrandTotalFact();
        return;
    }
    
    // Синхронизация групп факта с группами плана
    if (!currentObject.data.fact.groups) {
        currentObject.data.fact.groups = [];
    }
    
    currentObject.data.plan.groups.forEach(planGroup => {
        let factGroup = currentObject.data.fact.groups.find(g => g.id === planGroup.id);
        if (!factGroup) {
            factGroup = {
                id: planGroup.id,
                name: planGroup.name,
                rows: []
            };
            currentObject.data.fact.groups.push(factGroup);
        } else {
            factGroup.name = planGroup.name;
        }
        
        // Синхронизация строк
        const planRows = getGroupPlanRows(planGroup);
        planRows.forEach(planRow => {
            let factRow = factGroup.rows.find(r => r.id === planRow.id);
            if (!factRow) {
                factRow = {
                    id: planRow.id,
                    photo: planRow.photo,
                        // receipts - массив фото чеков (base64)
                        receipts: planRow.receipts || [],
                    purchaseDate: '',
                    name: planRow.name,
                    resource: planRow.resource,
                    unit: planRow.unit,
                    quantityFact: 0,
                    priceFact: 0,
                    sumFact: 0,
                    comments: ''
                };
                factGroup.rows.push(factRow);
            } else {
                factRow.name = planRow.name;
                factRow.resource = planRow.resource;
                factRow.unit = planRow.unit;
            }
        });
        
        // Удаление строк, которых нет в плане
        factGroup.rows = factGroup.rows.filter(fr => planRows.some(pr => pr.id === fr.id));
    });
    
    // Удаление групп, которых нет в плане
    currentObject.data.fact.groups = currentObject.data.fact.groups.filter(fg => 
        currentObject.data.plan.groups.some(pg => pg.id === fg.id)
    );
    
    saveObject();
    
    currentObject.data.fact.groups.forEach(group => {
        const groupSection = document.createElement('div');
        groupSection.className = 'group-section';
        
        let rowsHtml = '';
        group.rows.forEach((row, index) => {
            rowsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="photo-cell">
                            ${row.photo ? `<img src="${row.photo}" alt="Фото">` : '<div class="photo-placeholder">Нажмите<br>для выбора</div>'}
                            <input type="file" id="fact-photo-input-${row.id}" class="photo-input" accept="image/*" onchange="handleFactPhotoUpload('${group.id}', '${row.id}', this)">
                        </div>
                    </td>
                    <td>
                        <div class="receipts-cell">
                            <div class="receipts-grid" id="receipts-grid-${row.id}">
                                ${[0,1,2,3,4,5].map(i=>{
                                    const img = (row.receipts||[])[i];
                                    const slotId = `fact-receipt-slot-input-${row.id}-${i}`;
                                    return img ? `
                                        <div class="receipt-slot" title="Чек ${i+1}" onclick="openReceiptModal('${group.id}', '${row.id}', ${i})">
                                            <img src="${img}" alt="Чек ${i+1}">
                                            <div class="slot-actions">
                                                <button class="thumb-btn" onclick="event.stopPropagation(); deleteReceipt('${group.id}','${row.id}', ${i})">Удалить</button>
                                            </div>
                                        </div>
                                    ` : `
                                        <div class="receipt-slot empty" title="Добавить чек" onclick="document.getElementById('${slotId}').click()">
                                            <input type="file" id="${slotId}" class="hidden-file-input" accept="image/*" onchange="handleFactReceiptSlotUpload('${group.id}','${row.id}', ${i}, this)">
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </td>
                    <td><input type="date" value="${row.purchaseDate || ''}" onchange="updateFactRow('${group.id}', '${row.id}', 'purchaseDate', this.value)"></td>
                    <td><input type="text" value="${row.name || ''}" readonly></td>
                    <td class="resource-cell">${renderResourceBadge(row.resource)}</td>
                    <td>
                        <select onchange="updateFactRow('${group.id}', '${row.id}', 'unit', this.value)" disabled>
                            <option value="шт" ${row.unit === 'шт' ? 'selected' : ''}>шт</option>
                            <option value="кг" ${row.unit === 'кг' ? 'selected' : ''}>кг</option>
                                <option value="м" ${row.unit === 'м' ? 'selected' : ''}>м</option>
                                <option value="м2" ${row.unit === 'м2' ? 'selected' : ''}>м2</option>
                                <option value="м3" ${row.unit === 'м3' ? 'selected' : ''}>м3</option>
                            <option value="пачка" ${row.unit === 'пачка' ? 'selected' : ''}>пачка</option>
                            <option value="мешок" ${row.unit === 'мешок' ? 'selected' : ''}>мешок</option>
                            <option value="комплект" ${row.unit === 'комплект' ? 'selected' : ''}>комплект</option>
                            <option value="л" ${row.unit === 'л' ? 'selected' : ''}>л</option>
                            <option value="ведро" ${row.unit === 'ведро' ? 'selected' : ''}>ведро</option>
                            <option value="рейс" ${row.unit === 'рейс' ? 'selected' : ''}>рейс</option>
                        </select>
                    </td>
                    <td><input type="number" value="${row.quantityFact || 0}" step="0.01" onchange="updateFactRow('${group.id}', '${row.id}', 'quantityFact', parseFloat(this.value)); calculateFactRowSum('${group.id}', '${row.id}')"></td>
                    <td><input type="text" class="currency-input" value="${formatCurrency(row.priceFact || 0)}" data-original-value="${row.priceFact || 0}" onblur="const val = parseCurrency(this.value); this.setAttribute('data-original-value', val); this.value = formatCurrency(val); updateFactRow('${group.id}', '${row.id}', 'priceFact', val); calculateFactRowSum('${group.id}', '${row.id}')" onfocus="this.value = this.getAttribute('data-original-value') || '0'"></td>
                    ${renderFactSumCell(group.id, row.id)}
                    <td><input type="text" value="${row.comments || ''}" onchange="updateFactRow('${group.id}', '${row.id}', 'comments', this.value)"></td>
                </tr>
            `;
        });
        
        const groupTotal = calculateFactGroupTotal(group.rows);
        
        groupSection.innerHTML = `
            <div class="group-header">
                <div class="group-title">${group.name}</div>
            </div>
            <div class="table-wrapper">
                <table class="smeta-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Фото</th>
                            <th>Чеки</th>
                            <th>Дата покупки</th>
                            <th>Название</th>
                            <th>Ресурс</th>
                            <th>Ед.изм</th>
                            <th>Кол-во расход</th>
                            <th>Цена расход</th>
                            <th>Сумма расход</th>
                            <th>Комментарии</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="group-total">
                            <td colspan="9" style="text-align: right; font-weight: bold;">Итого:</td>
                            <td style="font-weight: bold;">${formatCurrency(groupTotal)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        container.appendChild(groupSection);
    });
    
    updateGrandTotalFact();
    renderFactMetaExpenses();
}

// ========== РЕСУРСЫ: badge + dropdown ========== 
function resourceCatalog(){
    return [
        { code:'M',   letter:'М', name:'Материал' },
        { code:'TX',  letter:'Т', name:'Техника' },
        { code:'T',   letter:'Ч', name:'Трудоресурсы' },
        { code:'D',   letter:'Д', name:'Доставка' },
        // Новые категории
        { code:'MB',  letter:'М', name:'Мебель' },
        { code:'EQ',  letter:'О', name:'Оборудование' },
        { code:'OBE', letter:'Е', name:'Еда' },
        { code:'KM',  letter:'К', name:'Коммуналка' },
        { code:'DK',  letter:'Д', name:'Документация' }
    ];
}

// Иконки для ресурсов (inline SVG). Возвращает строку SVG или пустую строку.
function resourceIconSVG(code){
    switch((code||'').toUpperCase()){
        case 'M': // Материал — коробка
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11V3"/></svg>';
        case 'TX': // Техника — экскаватор (упрощенный)
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M3 16h13l3-5h2l-3 5"/><path d="M7 16V9h5l3 4"/><path d="M12 9V6h3"/></svg>';
        case 'T': // Труд — человек
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><circle cx="12" cy="7" r="3"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/></svg>';
        case 'D': // Доставка — машина
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M3 16V6h11v10H3z"/><path d="M14 10h4l3 3v3h-7V10z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
        case 'MB': // Мебель — стул
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M7 10V5a2 2 0 0 1 2-2h6v7"/><path d="M7 14h10"/><path d="M7 14v5"/><path d="M17 14v5"/></svg>';
        case 'EQ': // Оборудование — шестерёнка
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a7.8 7.8 0 0 0 .1-2l2-1.2-1.5-2.6-2.3.6a7.7 7.7 0 0 0-1.6-1l.2-2.4h-3l.2 2.4a7.7 7.7 0 0 0-1.6 1l-2.3-.6L2.5 9.8 4.5 11l2 1.2a7.8 7.8 0 0 0 .1 2L4.5 15l1.5 2.6 2.3-.6c.5.4 1 .7 1.6 1l-.2 2.4h3l-.2-2.4c.6-.3 1.1-.6 1.6-1l2.3.6L21.5 15l-2.1 0z"/></svg>';
        case 'OBE': // Еда — вилка/ложка
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M7 2v8"/><path d="M10 2v8"/><path d="M7 10c0 2 3 2 3 0"/><path d="M9 10v12"/><path d="M17 2c-2 2-2 5 0 7v13"/></svg>';
        case 'KM': // Коммуналка — капля
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M12 2s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10z"/></svg>';
        case 'DK': // Документ — лист
            return '<svg viewBox="0 0 24 24" aria-hidden="true" class="res-icon"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>';
        default:
            return '';
    }
}

function renderResourceBadge(code){
    const catalog = resourceCatalog();
    const item = catalog.find(i=>i.code===code) || catalog[0];
    const svg = resourceIconSVG(item.code);
    const inner = svg || item.letter;
    return `<span class="res-badge res-${item.code}" title="${item.name}">${inner}</span>`;
}
function renderResourceSelectorHTML(groupId,rowId, code){
    const items = resourceCatalog();
    const menuId = `resource-menu-${rowId}`;
    return `
    <div class="resource-select">
        <button type="button" class="resource-trigger" data-menu-id="${menuId}" onclick="toggleResourceMenu('${menuId}')">
            ${renderResourceBadge(code)}
        </button>
        <div class="resource-menu" id="${menuId}">
            ${items.map(i=>`<div class="resource-item" onclick="selectResource('${groupId}','${rowId}','${i.code}')">${renderResourceBadge(i.code)}<span class="label">${i.name}</span></div>`).join('')}
        </div>
    </div>`;
}
function toggleResourceMenu(id){
    // close other open resource menus (unmount them)
    document.querySelectorAll('.resource-menu.open').forEach(m=>{ if(m.id!==id) unmountResourceMenu(m); });
    const el = document.getElementById(id);
    if (!el) return;
    // if already mounted in portal -> unmount
    if (el.dataset && el.dataset.portalMounted === '1'){
        unmountResourceMenu(el);
        return;
    }
    mountResourceMenu(el, id);
}

function mountResourceMenu(el, id){
    try{
        // create placeholder to restore later
        if (!el._placeholder){
            const ph = document.createElement('div'); ph.className = 'resource-menu-placeholder'; el.parentNode.insertBefore(ph, el);
            el._placeholder = ph;
        }
        // find trigger button to position against
        const trigger = document.querySelector(`[data-menu-id="${id}"]`);
        const rect = trigger ? trigger.getBoundingClientRect() : { left:0, right:0, bottom:0, width:0 };
        // move to body
        document.body.appendChild(el);
        // set absolute positioning near trigger
        el.style.position = 'absolute';
        el.style.left = (rect.left + window.scrollX) + 'px';
        el.style.top = (rect.bottom + window.scrollY + 6) + 'px';
        el.style.minWidth = (rect.width || 220) + 'px';
        el.style.zIndex = 100000;
        el.classList.add('open');
        el.dataset.portalMounted = '1';
        // handle reposition on scroll/resize while mounted
        const reposition = () => {
            const r = trigger ? trigger.getBoundingClientRect() : null;
            if (!r) return;
            el.style.left = (r.left + window.scrollX) + 'px';
            el.style.top = (r.bottom + window.scrollY + 6) + 'px';
        };
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        el._repositionHandler = reposition;
    }catch(e){ console.warn('mountResourceMenu failed', e); }
}

function unmountResourceMenu(el){
    try{
        el.classList.remove('open');
        el.dataset.portalMounted = '0';
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.minWidth = '';
        el.style.zIndex = '';
        // remove listeners
        if (el._repositionHandler){ window.removeEventListener('scroll', el._repositionHandler, true); window.removeEventListener('resize', el._repositionHandler); el._repositionHandler = null; }
        // restore to original placeholder if present
        if (el._placeholder && el._placeholder.parentNode){
            el._placeholder.parentNode.insertBefore(el, el._placeholder);
            el._placeholder.parentNode.removeChild(el._placeholder);
            el._placeholder = null;
        }
    }catch(e){ console.warn('unmountResourceMenu failed', e); }
}
// Переход к строке бюджета из снабжения
function jumpToPlanRow(rowId){
    const btn = document.querySelector('.tabs .tab[data-tab="plan"]');
    if (btn){ switchTab('plan', btn); }
    setTimeout(()=>{
        const el = document.getElementById('plan-row-'+rowId);
        if (el){
            el.scrollIntoView({behavior:'smooth', block:'center'});
            el.classList.add('flash-highlight');
            setTimeout(()=> el.classList.remove('flash-highlight'), 4800);
        }
    }, 60);
}
function selectResource(groupId,rowId, code){
    updatePlanRow(groupId, rowId, 'resource', code);
}
// Close menus on outside click (handle portal-mounted menus as well)
document.addEventListener('click', function(e){
    const withinResource = e.target.closest('.resource-select') || e.target.closest('.resource-menu');
    if (!withinResource){ document.querySelectorAll('.resource-menu.open').forEach(m=>{ try{ if(m.dataset.portalMounted==='1') unmountResourceMenu(m); else m.classList.remove('open'); }catch(_){ m.classList.remove('open'); }}); }
});
// Close contractor menu on outside click (also allow clicks inside contractor-menu)
document.addEventListener('click', function(e){
    const within = e.target.closest('.contractor-select') || e.target.closest('.contractor-menu');
    if (!within){ document.querySelectorAll('.contractor-menu.open').forEach(m=>m.classList.remove('open')); }
});

// Обновление данных строки факта
function updateFactRow(groupId, rowId, field, value) {
    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (group) {
        const row = group.rows.find(r => r.id === rowId);
        if (row) {
            row[field] = value;
            saveObject();
        }
    }
}

// Расчет суммы строки факта
function calculateFactRowSum(groupId, rowId) {
    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (group) {
        const row = group.rows.find(r => r.id === rowId);
        if (row) {
            row.sumFact = (row.quantityFact || 0) * (row.priceFact || 0);
            saveObject();
            renderFactGroups();
        }
    }
}

// Обработка загрузки фото факта
function handleFactPhotoUpload(groupId, rowId, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            updateFactRow(groupId, rowId, 'photo', e.target.result);
            try { input.value = ''; } catch (err) {}
            renderFactGroups();
        };
        reader.readAsDataURL(file);
    }
}

// Обработка загрузки фото чеков (может быть несколько файлов)
function handleFactReceiptsUpload(groupId, rowId, input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (!group) return;
    const row = group.rows.find(r => r.id === rowId);
    if (!row) return;

    if (!row.receipts) row.receipts = [];

    let remaining = files.length;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            row.receipts.push(e.target.result);
            remaining -= 1;
            if (remaining === 0) {
                // clear input to allow selecting same files again
                try { input.value = ''; } catch (err) {}
                saveObject();
                renderFactGroups();
            }
        };
        reader.readAsDataURL(file);
    });
}

// Upload into a specific slot
function handleFactReceiptSlotUpload(groupId, rowId, index, input){
    const file = input.files && input.files[0];
    if (!file) return;
    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (!group) return;
    const row = group.rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.receipts) row.receipts = [];
    const reader = new FileReader();
    reader.onload = function(e){
        row.receipts[index] = e.target.result;
        try { input.value=''; } catch(_){}
        saveObject();
        renderFactGroups();
    };
    reader.readAsDataURL(file);
}

// Удаление конкретного чека по индексу
function deleteReceipt(groupId, rowId, index) {
    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (!group) return;
    const row = group.rows.find(r => r.id === rowId);
    if (!row || !row.receipts) return;

    if (confirm('Удалить этот чек?')) {
        row.receipts.splice(index, 1);
        saveObject();
        renderFactGroups();
    }
}

// Просмотр чека в модалке
function openReceiptModal(groupId, rowId, index) {
    const group = currentObject.data.fact.groups.find(g => g.id === groupId);
    if (!group) return;
    const row = group.rows.find(r => r.id === rowId);
    if (!row || !row.receipts || !row.receipts[index]) return;

    const img = document.getElementById('receipt-modal-img');
    img.src = row.receipts[index];
    document.getElementById('receipt-modal').style.display = 'block';
    currentReceiptCtx = { groupId, rowId, index };
}

function closeReceiptModal() {
    const img = document.getElementById('receipt-modal-img');
    img.src = '';
    document.getElementById('receipt-modal').style.display = 'none';
    currentReceiptCtx = null;
}

function deleteReceiptFromModal(){
    if (!currentReceiptCtx) return;
    const { groupId, rowId, index } = currentReceiptCtx;
    deleteReceipt(groupId, rowId, index);
    closeReceiptModal();
}

// Render fact sum cell with saving/overrun line
function renderFactSumCell(groupId, rowId){
    // План теперь хранит строки внутри workTypes. Для обратной совместимости сначала
    // пытаемся найти через legacy group.rows, затем через workTypes.
    const factGroup = (currentObject?.data?.fact?.groups||[]).find(g=>g.id===groupId);
    const factRow = factGroup && (factGroup.rows||[]).find(r=>r.id===rowId);
    const planGroup = (currentObject?.data?.plan?.groups||[]).find(g=>g.id===groupId);
    let planRow = null;
    if (planGroup){
        if (Array.isArray(planGroup.rows)){ // legacy
            planRow = planGroup.rows.find(r=>r.id===rowId) || null;
        }
        if (!planRow){ // new hierarchy
            for (const wt of (planGroup.workTypes||[])){
                const found = (wt.resources||[]).find(r=>r.id===rowId);
                if (found){ planRow = found; break; }
            }
        }
    }
    const sumFact = Number(factRow?.sumFact || 0);
    const sumPlan = Number(planRow?.sum || 0);
    const diff = sumPlan - sumFact; // >0 saving, <0 overrun
    const within = sumPlan > 0 && sumFact <= sumPlan;
    let extra = '';
    if (diff > 0) {
        extra = `<div class="sum-extra sum-saving" style="color:#0b6e4f; font-size:12px; margin-top:4px;">+ ${formatCurrency(diff)}</div>`;
    } else if (diff < 0) {
        extra = `<div class="sum-extra sum-overrun" style="color:#b42318; font-size:12px; margin-top:4px;">- ${formatCurrency(Math.abs(diff))}</div>`;
    }
    return `<td>
        <div class="sum-fact-cell">
            <input type="text" class="currency-input" value="${formatCurrency(sumFact)}" readonly style="background-color:#f5f5f5;">
            ${extra}
        </div>
    </td>`;
}

// ===== Sidebar with objects for quick navigation =====
function toggleObjectSidebar(){
    // Sidebar is permanently visible in the layout now.
    // Keep function as a harmless no-op to avoid leftover event references.
    return;
}
function renderObjectSidebarList(){
    const listEl = document.getElementById('object-sidebar-list');
    if (!listEl) return;
    const listRaw = JSON.parse(localStorage.getItem('smeta_objects')) || [];
    // Не показывать блоки в списке объектов
    const list = listRaw.filter(o=> !(o && typeof o.id==='string' && o.id.startsWith('B-')));
    const currentId = (window.currentObject && window.currentObject.id) || (()=>{ try{ const c = JSON.parse(localStorage.getItem('current_object')||'null'); return c && c.id; }catch(_){return null;} })();
    // Add a 'Главная' entry at the top to return to index.html
    const homeEntry = `<div class="sidepanel-item sidepanel-home" onclick="window.location.href='index.html'">
            <div>
                <div class="sidepanel-title">Главная</div>
                <div class="sidepanel-meta">Перейти к списку</div>
            </div>
            <div style="font-size:12px; color:#6b7785;">🏠</div>
        </div>`;

    if (!list.length){
        listEl.innerHTML = homeEntry + '<div class="sidepanel-empty" style="padding:16px; color:#6b7785; font-size:14px;">Список объектов пуст</div>';
        return;
    }

    listEl.innerHTML = homeEntry + list.map((o, idx)=>{
        const activeCls = (o.id === currentId) ? ' active' : '';
        return `
        <div class="sidepanel-item${activeCls}" onclick="openObjectFromSidebar('${o.id}')">
            <div>
                <div class="sidepanel-title">${o.name || 'Без названия'}</div>
                <div class="sidepanel-meta">${o.clientName || ''} ${o.clientPhone ? ' • ' + o.clientPhone : ''}</div>
            </div>
            <div style="font-size:12px; color:#6b7785;">${idx+1}</div>
        </div>`;
    }).join('');
}
function openObjectFromSidebar(objectId){
    const objects = JSON.parse(localStorage.getItem('smeta_objects')) || [];
    const obj = objects.find(x=>x.id===objectId);
    if (!obj) return;
    localStorage.setItem('current_object', JSON.stringify(obj));
    window.location.href = 'object.html';
}

// Расчет итога группы факта
function calculateFactGroupTotal(rows) {
    return rows.reduce((sum, row) => sum + (row.sumFact || 0), 0);
}

// Обновление общего итога факта
function updateGrandTotalFact() {
    let total = 0;
    if (currentObject.data.fact.groups) {
        currentObject.data.fact.groups.forEach(group => {
            total += calculateFactGroupTotal(group.rows);
        });
    }
    const metaF = currentObject.data.fact.metaExpenses || { land:0, permit:0, project:0, misc:0, extra:[] };
    const metaFTotal = Number(metaF.land||0)+Number(metaF.permit||0)+Number(metaF.project||0)+Number(metaF.misc||0)+(metaF.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    total += metaFTotal;
    document.getElementById('grand-total-fact').textContent = formatCurrency(total);
    updateChart();
}

// Загрузка данных факта
function loadFactData() {
    renderFactGroups();
    renderFactMetaExpenses();
}

// ===== Дополнительные статьи бюджета (План) =====
function renderPlanMetaExpenses(){
    const box = document.getElementById('plan-meta-accordion') || document.getElementById('plan-meta-expenses');
    if (!box) return;
    const meta = currentObject?.data?.plan?.metaExpenses || { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    const host = document.getElementById('plan-meta-content');
    if (!host) return;
    const miscAmount = (()=>{ let resSum=0; (currentObject?.data?.plan?.groups||[]).forEach(g=>{ resSum += calculateGroupTotalAny(g); }); return resSum * (Number(meta.miscPercent)||0) / 100; })();
    const row = (key, label, inputHTML, noteHTML='')=> `
        <div class="meta-row" style="display:flex; align-items:center; gap:12px; padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:12px; margin-bottom:8px;">
            <div class="meta-ico" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#f3f6fb; color:#2b3440;">${metaIconSVG(key)}</div>
            <div style="flex:1; font-weight:600; color:#2b3440;">${label}</div>
            ${noteHTML}
            <div style="min-width:220px;">${inputHTML}</div>
        </div>`;
    const inputCurrency = (id, val, onblur)=> `<input type="text" id="${id}" class="currency-input" value="${formatCurrency(val||0)}" data-original-value="${val||0}" onblur="${onblur}" onfocus="__currencyFocus(this)" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; font-weight:600; text-align:right;">`;
    const percentInput = `<div style="display:flex; gap:8px; align-items:center;">
            <input type="number" id="plan-meta-miscPercent" min="0" max="100" step="0.01" value="${Number(meta.miscPercent||0)}" onchange="__onPlanMetaPercent(this)" style="width:110px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; font-weight:600;">
            <span style="color:#6b7785; font-size:12px;">= <span id="plan-meta-misc-amount">${formatCurrency(miscAmount)}</span> UZS</span>
        </div>`;
    const rows = [
        row('land', 'Покупка земельного участка', inputCurrency('plan-meta-land', meta.land, `__onPlanMetaCurrency('land', this)`)),
        row('permit', 'Разрешение на строительство', inputCurrency('plan-meta-permit', meta.permit, `__onPlanMetaCurrency('permit', this)`)),
        row('project', 'Разработка проекта', inputCurrency('plan-meta-project', meta.project, `__onPlanMetaCurrency('project', this)`)),
        row('misc', 'Прочие расходы (% от ресурсов)', percentInput)
    ];
    const extrasHtml = (meta.extra||[]).map(it=>
        `<div class="meta-row" style="display:flex; align-items:center; gap:12px; padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:12px; margin-bottom:8px;">
            <div class="meta-ico" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#f3f6fb; color:#2b3440;">${metaIconSVG('extra')}</div>
            <div style="flex:1;">
                <input type="text" value="${(it.name||'').replace(/"/g,'&quot;')}" placeholder="Название расхода" onchange="updatePlanMetaExtra('${it.id}','name', this.value)" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fff;">
            </div>
            <div style="min-width:220px; display:flex; align-items:center; gap:6px;">
                ${inputCurrency(`plan-extra-${it.id}`, it.amount, `__onPlanMetaExtraCurrency('${it.id}', this)` )}
                <button class="icon-btn" title="Удалить статью" onclick="deletePlanMetaExtra('${it.id}')">
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>`
    ).join('');
    host.innerHTML = rows.join('') + extrasHtml;
}

function updatePlanMiscAmountPreview(){
    const meta = currentObject?.data?.plan?.metaExpenses || { miscPercent:0 };
    // ресурсы сумма
    let resSum = 0; (currentObject?.data?.plan?.groups||[]).forEach(g=>{ resSum += calculateGroupTotalAny(g); });
    const amount = resSum * (Number(meta.miscPercent)||0) / 100;
    const el = document.getElementById('plan-meta-misc-amount'); if (el) el.textContent = formatCurrency(amount);
}

function __currencyFocus(input){ input.value = input.getAttribute('data-original-value') || '0'; }
function __onPlanMetaCurrency(field, input){ const val = parseCurrency(input.value); input.setAttribute('data-original-value', val); input.value = formatCurrency(val); setPlanMetaField(field, val); }
function __onPlanMetaPercent(input){ const val = Number(input.value)||0; setPlanMetaField('miscPercent', val); updatePlanMiscAmountPreview(); updateGrandTotalPlan(); }
function __onPlanMetaExtraCurrency(id, input){ const val = parseCurrency(input.value); input.setAttribute('data-original-value', val); input.value = formatCurrency(val); updatePlanMetaExtra(id, 'amount', val); }

function setPlanMetaField(field, value){
    if (!currentObject.data.plan.metaExpenses) currentObject.data.plan.metaExpenses = { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    currentObject.data.plan.metaExpenses[field] = value;
    saveObject();
    updateGrandTotalPlan();
}
function addPlanMetaExtra(){
    if (!currentObject.data.plan.metaExpenses) currentObject.data.plan.metaExpenses = { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    const id = 'pex-' + Date.now().toString(36);
    currentObject.data.plan.metaExpenses.extra.push({ id, name:'', amount:0 });
    saveObject();
    renderPlanMetaExpenses();
    updateGrandTotalPlan();
}
function updatePlanMetaExtra(id, field, value){
    const meta = currentObject?.data?.plan?.metaExpenses; if (!meta) return;
    const item = (meta.extra||[]).find(x=>x.id===id); if (!item) return;
    item[field] = field==='amount' ? (Number(value)||0) : value;
    saveObject();
    updateGrandTotalPlan();
}

// ===== Дополнительные статьи расхода (Факт) =====
function renderFactMetaExpenses(){
    const box = document.getElementById('fact-meta-content');
    if (!box) return;
    // Синхронизируем список кастомных статей между планом и фактом по id/name
    const planExtra = currentObject?.data?.plan?.metaExpenses?.extra || [];
    if (!currentObject.data.fact.metaExpenses) currentObject.data.fact.metaExpenses = { land:0, permit:0, project:0, misc:0, extra: [] };
    const factExtra = currentObject.data.fact.metaExpenses.extra || [];
    // ensure all plan extras exist in fact extras
    planExtra.forEach(pe=>{ if (!factExtra.find(fe=>fe.id===pe.id)) factExtra.push({ id: pe.id, name: pe.name, amount: 0 }); });
    // remove fact extras no longer in plan
    currentObject.data.fact.metaExpenses.extra = factExtra.filter(fe=> planExtra.some(pe=> pe.id===fe.id));
    saveObject();

    const m = currentObject.data.fact.metaExpenses;
    const inputCurrency = (id, val, onblur)=> `<input type=\"text\" id=\"${id}\" class=\"currency-input\" value=\"${formatCurrency(val||0)}\" data-original-value=\"${val||0}\" onblur=\"${onblur}\" onfocus=\"__currencyFocus(this)\" style=\"width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fff; font-weight:600; text-align:right;\">`;
    const row = (key, label, inputHTML)=> `
        <div class=\"meta-row\" style=\"display:flex; align-items:center; gap:12px; padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:12px; margin-bottom:8px;\">
            <div class=\"meta-ico\" style=\"width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#f3f6fb; color:#2b3440;\">${metaIconSVG(key)}</div>
            <div style=\"flex:1; font-weight:600; color:#2b3440;\">${label}</div>
            <div style=\"min-width:220px;\">${inputHTML}</div>
        </div>`;
    const rows = [
        row('land', 'Покупка земельного участка', inputCurrency('fact-meta-land', m.land, `__onFactMetaCurrency('land', this)`)),
        row('permit', 'Разрешение на строительство', inputCurrency('fact-meta-permit', m.permit, `__onFactMetaCurrency('permit', this)`)),
        row('project', 'Разработка проекта', inputCurrency('fact-meta-project', m.project, `__onFactMetaCurrency('project', this)`)),
        row('misc', 'Прочие расходы (факт)', inputCurrency('fact-meta-misc', m.misc, `__onFactMetaCurrency('misc', this)`))
    ];
    const extrasHtml = (m.extra||[]).map(it=>
        `<div class=\"meta-row\" style=\"display:flex; align-items:center; gap:12px; padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:12px; margin-bottom:8px;\">
            <div class=\"meta-ico\" style=\"width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#f3f6fb; color:#2b3440;\">${metaIconSVG('extra')}</div>
            <div style=\"flex:1;\">
                <input type=\"text\" value=\"${(it.name||'').replace(/\"/g,'&quot;')}\" placeholder=\"Название расхода\" readonly style=\"width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:8px; background:#fff;\">
            </div>
            <div style=\"min-width:220px;\">${inputCurrency(`fact-extra-${it.id}`, it.amount, `__onFactMetaExtraCurrency('${it.id}', this)` )}</div>
        </div>`
    ).join('');
    box.innerHTML = rows.join('') + extrasHtml;
    // Inject supplier chart below analysis main metrics if available
    try{
        const analysisHost = document.getElementById('analysis-data');
        if (analysisHost && typeof supplierChartHtml === 'string' && supplierChartHtml){
            analysisHost.insertAdjacentHTML('beforeend', supplierChartHtml);
        }
    }catch(_){ }
}

// SVG иконки для мета статей
function metaIconSVG(key){
    switch(key){
        case 'land': return '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 12l9-9 9 9v9H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 21v-6h6v6" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        case 'permit': return '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 7h6" stroke="currentColor" stroke-width="2"/><path d="M7 11h6" stroke="currentColor" stroke-width="2"/><path d="M17 8l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        case 'project': return '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 3h13l5 5v13H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 3v5h5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 13h8" stroke="currentColor" stroke-width="2"/><path d="M8 17h5" stroke="currentColor" stroke-width="2"/></svg>';
        case 'misc': return '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        case 'extra': return '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 11h10" stroke="currentColor" stroke-width="2"/><path d="M7 15h6" stroke="currentColor" stroke-width="2"/><path d="M9 3h6v4H9z" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        default: return '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
    }
}

function deletePlanMetaExtra(id){
    const meta = currentObject?.data?.plan?.metaExpenses; if (!meta) return;
    if (!confirm('Удалить эту статью расходов?')) return;
    meta.extra = (meta.extra||[]).filter(x=>x.id!==id);
    // Синхронно удалим и из факта
    if (!currentObject.data.fact.metaExpenses) currentObject.data.fact.metaExpenses = { land:0, permit:0, project:0, misc:0, extra:[] };
    currentObject.data.fact.metaExpenses.extra = (currentObject.data.fact.metaExpenses.extra||[]).filter(x=>x.id!==id);
    saveObject();
    renderPlanMetaExpenses();
    renderFactMetaExpenses();
    updateGrandTotalPlan();
    updateGrandTotalFact();
}

function __onFactMetaCurrency(field, input){ const val = parseCurrency(input.value); input.setAttribute('data-original-value', val); input.value = formatCurrency(val); setFactMetaField(field, val); }
function __onFactMetaExtraCurrency(id, input){ const val = parseCurrency(input.value); input.setAttribute('data-original-value', val); input.value = formatCurrency(val); updateFactMetaExtra(id, 'amount', val); }

function setFactMetaField(field, value){
    if (!currentObject.data.fact.metaExpenses) currentObject.data.fact.metaExpenses = { land:0, permit:0, project:0, misc:0, extra:[] };
    currentObject.data.fact.metaExpenses[field] = value;
    saveObject();
    updateGrandTotalFact();
}
function updateFactMetaExtra(id, field, value){
    const meta = currentObject?.data?.fact?.metaExpenses; if (!meta) return;
    const item = (meta.extra||[]).find(x=>x.id===id); if (!item) return;
    item[field] = field==='amount' ? (Number(value)||0) : value;
    saveObject();
    updateGrandTotalFact();
}

// ========== ПРИХОД (INCOME) ==========

function loadIncomeData() {
    if (!currentObject.data.income) {
        currentObject.data.income = { rows: [] };
    }
    if (typeof window.__incomeTypeFilter === 'undefined') {
        window.__incomeTypeFilter = 'all'; // all | приход | возврат | долг
    }
    renderIncome();
}

function renderIncome() {
    const container = document.getElementById('income-container');
    container.innerHTML = '';

    // Отрисовка фильтров типов (чипы)
    renderIncomeTypeChips();

    if (!currentObject.data.income || !currentObject.data.income.rows || currentObject.data.income.rows.length === 0) {
        container.innerHTML = '<p>Нет записей прихода. Нажмите "Добавить приход".</p>';
        updateIncomeTotal();
        return;
    }

    // Список активных пользователей для выпадающих
    const users = (()=>{ try { return JSON.parse(localStorage.getItem('smeta_users'))||[]; } catch(_) { return []; } })().filter(u=> (u.status||'активен')==='активен');
    const roleOf = u => (u.role||'').trim().toLowerCase();
    // Поддерживаем несколько вариантов ролей и даём фолбэк на всех пользователей
    let customers = users.filter(u=> ['заказчик','клиент','client','customer'].includes(roleOf(u)));
    if (customers.length === 0) customers = users.slice();
    let financiers = users.filter(u=> ['финансист','бухгалтер','accountant','finance'].includes(roleOf(u)));
    if (financiers.length === 0) financiers = users.slice();
    const optList = arr=> '<option value="">—</option>' + arr.map(u=> `<option value="${u.id}">${u.fullName||u.name||u.username||u.phone||u.id}</option>`).join('');
    let rowsHtml = '';
    // Применяем фильтр по типу если выбран не "all"
    const activeFilter = window.__incomeTypeFilter || 'all';
    const filteredRows = currentObject.data.income.rows.filter(r => activeFilter === 'all' ? true : (r.type || 'приход') === activeFilter);

    filteredRows.forEach((row, idx) => {
        const fromDisplay = (()=>{ const u = users.find(x=>x.id===row.fromUserId); return u ? (u.fullName||u.name||u.username||'') : (row.from||''); })();
        const recvDisplay = (()=>{ const u = users.find(x=>x.id===row.receivedByUserId); return u ? (u.fullName||u.name||u.username||'') : (row.receivedBy||''); })();
        rowsHtml += `
            <tr>
                <td class="center">${idx + 1}</td>
                <td><input type="date" value="${row.date || ''}" onchange="updateIncomeRow('${row.id}', 'date', this.value)"></td>
                <td>
                    <div class="photo-cell" style="justify-content:center; cursor:pointer;" onclick="openIncomePhotoModal('${row.id}')" title="Фото прихода">
                        ${row.photo ? `<img src="${row.photo}" alt="Фото"/>` : '<span style="font-size:11px; color:#6b7785;">Нет</span>'}
                    </div>
                </td>
                <td>
                    <div class="type-select-custom inline-select">
                        <select onchange="updateIncomeRow('${row.id}','fromUserId', this.value)">${optList(customers).replace(`value="${row.fromUserId||''}"`, `value="${row.fromUserId||''}" selected`)}</select>
                        <span class="chevron">▾</span>
                    </div>
                </td>
                <td><input type="text" class="currency-input" value="${formatCurrency(row.amount || 0)}" data-original-value="${row.amount || 0}" onblur="const val = parseCurrency(this.value); this.setAttribute('data-original-value', val); this.value = formatCurrency(val); updateIncomeRow('${row.id}', 'amount', val);" onfocus="this.value = this.getAttribute('data-original-value') || '0'"></td>
                <td>
                    <div class="type-select-custom inline-select">
                        <select onchange="updateIncomeRow('${row.id}','receivedByUserId', this.value)">${optList(financiers).replace(`value="${row.receivedByUserId||''}"`, `value="${row.receivedByUserId||''}" selected`)}</select>
                        <span class="chevron">▾</span>
                    </div>
                </td>
                <td class="center">
                    <select onchange="updateIncomeRow('${row.id}', 'type', this.value)">
                        <option value="приход" ${!row.type||row.type==='приход'?'selected':''}>приход</option>
                        <option value="возврат" ${row.type==='возврат'?'selected':''}>возврат</option>
                        <option value="долг" ${row.type==='долг'?'selected':''}>долг</option>
                    </select>
                </td>
                <td class="center">
                    <button class="icon-btn" title="Удалить" onclick="deleteIncomeRow('${row.id}')">
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </td>
            </tr>
        `;
    });

    const filteredTotal = filteredRows.reduce((s,r)=> s + (r.amount || 0), 0);
    container.innerHTML = `
        <div class="table-wrapper">
            <table class="smeta-table">
                <thead>
                    <tr>
                        <th class="center">№</th>
                        <th>Дата прихода</th>
                        <th class="center">Фото</th>
                        <th>Кем передан (Заказчик)</th>
                        <th>Сумма прихода</th>
                        <th>Кто получил (Финансист)</th>
                        <th class="center">Тип</th>
                        <th class="center">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="group-total">
                        <td colspan="4" style="text-align: right; font-weight: bold;">Итог суммы прихода (${activeFilter==='all'?'все типы':activeFilter}):</td>
                        <td style="font-weight: bold;" id="income-total-cell" data-filtered="${activeFilter}">${formatCurrency(filteredTotal)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Обновляем глобальный итог (для других частей анализа) отдельно
    updateIncomeTotal();
}

function addIncomeRow() {
    if (!currentObject.data.income) currentObject.data.income = { rows: [] };
    // Используем выбранного заказчика из пользователей если есть
    const users = (()=>{ try { return JSON.parse(localStorage.getItem('smeta_users'))||[]; } catch(_) { return []; } })();
    const clientUserId = currentObject.clientUserId;
    const clientUser = clientUserId ? users.find(u=>u.id===clientUserId && (u.status||'активен')==='активен') : null;
    const fallbackClient = clientUser ? (clientUser.fullName||clientUser.name||'') : '';
    const rowId = Date.now().toString();
    const row = {
        id: rowId,
        date: '',
        fromUserId: clientUserId || '', // кто передал (заказчик)
        from: fallbackClient, // отображаемое имя (будет затираться при выборе из выпадающего)
        amount: 0,
        receivedByUserId: '', // финансист принявший средства
        receivedBy: '', // отображаемое имя финансиста (для совместимости)
        photo: '',
        type: 'приход'
    };
    currentObject.data.income.rows.push(row);
    saveObject();
    renderIncome();
}

function updateIncomeRow(rowId, field, value) {
    if (!currentObject.data.income) return;
    const row = currentObject.data.income.rows.find(r => r.id === rowId);
    if (!row) return;
    if (field === 'amount') {
        row.amount = isNaN(value) ? 0 : parseFloat(value);
    } else {
        row[field] = value;
    }
    saveObject();
    updateIncomeTotal();
}

function triggerIncomePhoto(rowId){
    const input = document.getElementById('income-file-' + rowId);
    if (input) input.click();
}

function handleIncomePhotoChange(rowId, inputEl){
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
        const dataUrl = e.target.result;
        if (!currentObject.data.income) return;
        const row = currentObject.data.income.rows.find(r => r.id === rowId);
        if (!row) return;
        row.photo = dataUrl;
        saveObject();
        renderIncome();
    };
    reader.readAsDataURL(file);
}

function deleteIncomeRow(rowId) {
    if (!currentObject.data.income) return;
    if (!confirm('Удалить эту запись прихода?')) return;
    currentObject.data.income.rows = currentObject.data.income.rows.filter(r => r.id !== rowId);
    saveObject();
    renderIncome();
}

function calculateIncomeTotal() {
    if (!currentObject.data.income || !currentObject.data.income.rows) return 0;
    return currentObject.data.income.rows.reduce((s, r) => s + (r.amount || 0), 0);
}

function updateIncomeTotal() {
    const activeFilter = window.__incomeTypeFilter || 'all';
    const globalTotal = calculateIncomeTotal();
    let displayTotal = globalTotal;
    if (activeFilter !== 'all' && currentObject.data.income && Array.isArray(currentObject.data.income.rows)) {
        displayTotal = currentObject.data.income.rows.filter(r=> (r.type||'приход')===activeFilter).reduce((s,r)=> s + (r.amount||0), 0);
    }
    const el = document.getElementById('income-total'); // может отсутствовать, если итого только в таблице
    const cell = document.getElementById('income-total-cell');
    if (el) el.textContent = formatCurrency(displayTotal);
    if (cell) cell.textContent = formatCurrency(displayTotal);
}

// ====== Фильтры типов прихода (чипы) ======
function renderIncomeTypeChips(){
    const wrap = document.getElementById('income-type-filters');
    if (!wrap) return;
    const active = window.__incomeTypeFilter || 'all';
    const items = [
        {key:'all', label:'Все'},
        {key:'приход', label:'Приход'},
        {key:'возврат', label:'Возврат'},
        {key:'долг', label:'Долг'}
    ];
    wrap.innerHTML = items.map(it=> `<div class="income-type-chip ${active===it.key?'active':''}" data-type="${it.key}">${it.label}</div>`).join('');
    wrap.querySelectorAll('.income-type-chip').forEach(chip=>{
        chip.addEventListener('click', ()=>{
            const t = chip.getAttribute('data-type');
            window.__incomeTypeFilter = t;
            renderIncome();
        });
    });
}

// ====== Фото прихода (модалка) ======
function openIncomePhotoModal(rowId){
    const modal = document.getElementById('income-photo-modal');
    const body = document.getElementById('income-photo-body');
    const delBtn = document.getElementById('income-photo-delete-btn');
    if (!modal || !body) return;
    if (!currentObject.data.income) return;
    const row = currentObject.data.income.rows.find(r=> r.id === rowId);
    if (!row) return;
    window.__incomePhotoRowId = rowId;
    if (row.photo){
        body.innerHTML = `<img src="${row.photo}" alt="Фото прихода" style="max-width:100%; max-height:60vh; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.06);" />`;
        if (delBtn){ delBtn.style.display='inline-block'; delBtn.onclick = ()=> deleteIncomePhoto(rowId); }
    } else {
        body.innerHTML = `
            <div style="text-align:center; color:#6b7785; font-size:13px;">Фото не добавлено</div>
            <input type="file" accept="image/*" id="income-photo-upload" style="display:none;" />
            <button class="btn btn-primary" id="income-photo-upload-btn">Загрузить фото</button>
        `;
        if (delBtn) delBtn.style.display='none';
        const uploadBtn = document.getElementById('income-photo-upload-btn');
        const uploadInput = document.getElementById('income-photo-upload');
        if (uploadBtn && uploadInput){
            uploadBtn.addEventListener('click', ()=> uploadInput.click());
            uploadInput.addEventListener('change', ()=> handleIncomePhotoUploadFromModal(rowId, uploadInput));
        }
    }
    modal.style.display = 'block';
}

function closeIncomePhotoModal(){
    const modal = document.getElementById('income-photo-modal');
    const body = document.getElementById('income-photo-body');
    const delBtn = document.getElementById('income-photo-delete-btn');
    if (modal) modal.style.display='none';
    if (body) body.innerHTML='';
    if (delBtn) delBtn.style.display='none';
    window.__incomePhotoRowId = null;
}

function handleIncomePhotoUploadFromModal(rowId, inputEl){
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const dataUrl = e.target.result;
        if (!currentObject.data.income) return;
        const row = currentObject.data.income.rows.find(r=> r.id === rowId);
        if (!row) return;
        row.photo = dataUrl;
        saveObject();
        closeIncomePhotoModal();
        renderIncome();
        // Сразу открыть модалку снова для просмотра добавленного фото
        openIncomePhotoModal(rowId);
    };
    reader.readAsDataURL(file);
}

function deleteIncomePhoto(rowId){
    if (!currentObject.data.income) return;
    const row = currentObject.data.income.rows.find(r=> r.id === rowId);
    if (!row) return;
    if (!confirm('Удалить фото из этой записи?')) return;
    row.photo = '';
    saveObject();
    closeIncomePhotoModal();
    renderIncome();
}

// ========== АНАЛИЗ ==========

function loadAnalysisData() {
    const container = document.getElementById('analysis-data');
    let planTotal = 0;
    let factTotal = 0;
    let incomeTotal = 0;
    
    if (currentObject.data.plan.groups) {
        currentObject.data.plan.groups.forEach(group => {
            planTotal += calculateGroupTotalAny(group);
        });
    }
    // добавляем мета-расходы плана (земля, разрешение, проект, прочие %, доп.)
    const metaPlan = currentObject?.data?.plan?.metaExpenses || { land:0, permit:0, project:0, miscPercent:0, extra:[] };
    const miscPlanAmount = ((Number(metaPlan.miscPercent)||0) * planTotal) / 100;
    const extraPlanTotal = (metaPlan.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    planTotal += Number(metaPlan.land||0) + Number(metaPlan.permit||0) + Number(metaPlan.project||0) + miscPlanAmount + extraPlanTotal;
    
    if (currentObject.data.fact.groups) {
        currentObject.data.fact.groups.forEach(group => {
            if (Array.isArray(group.workTypes) && group.workTypes.length){
                group.workTypes.forEach(wt=>{
                    (wt.resources||[]).forEach(r=>{ factTotal += Number(r.sumFact || 0) || 0; });
                });
            } else {
                factTotal += calculateFactGroupTotal(group.rows||[]);
            }
        });
    }
    // добавляем мета-расходы факта (земля, разрешение, проект, прочие факт, доп.)
    const metaFact = currentObject?.data?.fact?.metaExpenses || { land:0, permit:0, project:0, misc:0, extra:[] };
    factTotal += Number(metaFact.land||0) + Number(metaFact.permit||0) + Number(metaFact.project||0) + Number(metaFact.misc||0) + (metaFact.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);

    // Приход (income) — если есть структура income, используем её
    if (currentObject.data.income && currentObject.data.income.rows) {
        incomeTotal = calculateIncomeTotal();
    }

    // ====== Финансы по поставщикам (подрядчикам) ======
    // Считаем бюджетную сумму по подрядчику: сумма плановых ресурсов всех видов работ с назначенным contractorId.
    const contractorBudgetMap = {};
    (currentObject?.data?.plan?.groups||[]).forEach(g=>{
        (g.workTypes||[]).forEach(wt=>{
            if (wt.contractorId){
                const wtSum = calculateWorkTypeTotal(wt);
                contractorBudgetMap[wt.contractorId] = (contractorBudgetMap[wt.contractorId]||0) + wtSum;
            }
        });
    });
    // Считаем фактические выплаты подрядчикам из contractorPayments
    const contractorPaidMap = {};
    (currentObject?.data?.fact?.contractorPayments||[]).forEach(p=>{
        if (p.contractorId){
            contractorPaidMap[p.contractorId] = (contractorPaidMap[p.contractorId]||0) + (Number(p.amount)||0);
        }
    });
    const contractorsAll = (()=>{ try { return JSON.parse(localStorage.getItem('smeta_contractors'))||[]; } catch(_) { return []; } })();
    const contractorRows = Object.keys(contractorBudgetMap).map(cid=>{
        return { id: cid, name: (contractorsAll.find(c=>c.id===cid)?.name)||'Без названия', budget: contractorBudgetMap[cid], paid: contractorPaidMap[cid]||0 };
    }).filter(r=> r.budget>0).sort((a,b)=> b.budget - a.budget);

    const supplierChartHtml = contractorRows.length ? `<div class='analysis-block'><div class='block-header'><div class='block-title'>Финансы по поставщикам</div><div style='font-size:12px; color:#6b7785;'>Бюджет vs Выплаты vs Остаток</div></div>
        <div class='cluster-chart'>${contractorRows.map(r=>{
            const budget = r.budget;
            const paid = r.paid;
            const remain = Math.max(budget - paid, 0);
            const max = contractorRows[0].budget || 1;
            const scale = v=> (v/max)*100;
            return `<div class='cluster-row' style='margin-bottom:10px;'>
                <div style='display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:4px;'>
                    <strong>${r.name}</strong>
                    <span style='color:#6b7785;'>${formatCurrency(budget)} / ${formatCurrency(paid)} / ${formatCurrency(remain)}</span>
                </div>
                <div class='bars' style='display:flex; gap:4px; align-items:flex-end;'>
                    <div class='bar' title='Бюджет' style='background:#6ea8fe; height:24px; width:${scale(budget)}%; min-width:4px; position:relative; border-radius:4px;'><span class='bar-label' style='position:absolute; top:-18px; left:4px; font-size:11px; color:#243b53;'>${formatCurrency(budget)}</span></div>
                    <div class='bar' title='Выплачено' style='background:#ffb3b3; height:24px; width:${scale(paid)}%; min-width:4px; position:relative; border-radius:4px;'><span class='bar-label' style='position:absolute; top:-18px; left:4px; font-size:11px; color:#7b0b0b;'>${formatCurrency(paid)}</span></div>
                    <div class='bar' title='Остаток' style='background:#d9e2ec; height:24px; width:${scale(remain)}%; min-width:4px; position:relative; border-radius:4px;'><span class='bar-label' style='position:absolute; top:-18px; left:4px; font-size:11px; color:#35495e;'>${formatCurrency(remain)}</span></div>
                </div>
            </div>`;
        }).join('')}
        <div class='chart-legend' style='display:flex; gap:12px; margin-top:8px; font-size:12px;'>
            <div style='display:flex; align-items:center; gap:4px;'><span style='width:14px; height:14px; background:#6ea8fe; border-radius:3px;'></span>Бюджет</div>
            <div style='display:flex; align-items:center; gap:4px;'><span style='width:14px; height:14px; background:#ffb3b3; border-radius:3px;'></span>Выплачено</div>
            <div style='display:flex; align-items:center; gap:4px;'><span style='width:14px; height:14px; background:#d9e2ec; border-radius:3px;'></span>Остаток</div>
        </div>
    </div>` : '';

    // --- Resource breakdown (по категориям ресурсов) ---
    // Расширенный порядок: TX, M, D, T, MB, EQ, OBE, KM, DK
    const resourceCodes = {
        TX: 'Техника',
        M: 'Материалы',
        D: 'Доставка',
        T: 'Трудозатраты',
        MB: 'Мебель',
        EQ: 'Оборудование',
        OBE: 'Еда',
        KM: 'Коммуналка',
        DK: 'Документация'
    };
    const planByResource = { TX:0, M:0, D:0, T:0, MB:0, EQ:0, OBE:0, KM:0, DK:0 };
    const factByResource = { TX:0, M:0, D:0, T:0, MB:0, EQ:0, OBE:0, KM:0, DK:0 };

    if (currentObject.data.plan && currentObject.data.plan.groups) {
        currentObject.data.plan.groups.forEach(group => {
            const rows = getGroupPlanRows(group);
            rows.forEach(row => {
                const code = row.resource || 'M';
                const sum = Number(row.sum || 0) || 0;
                if (planByResource.hasOwnProperty(code)) planByResource[code] += sum;
            });
        });
    }
    // мета расходы по ресурсам не распределяем (они вне категорий)

    if (currentObject.data.fact && currentObject.data.fact.groups) {
        currentObject.data.fact.groups.forEach(group => {
            if (Array.isArray(group.workTypes) && group.workTypes.length){
                group.workTypes.forEach(wt=>{
                    (wt.resources||[]).forEach(row => {
                        const code = row.resource || 'M';
                        const sum = Number(row.sumFact || 0) || 0;
                        if (factByResource.hasOwnProperty(code)) factByResource[code] += sum;
                    });
                });
            } else {
                (group.rows||[]).forEach(row => {
                    const code = row.resource || 'M';
                    const sum = Number(row.sumFact || 0) || 0;
                    if (factByResource.hasOwnProperty(code)) factByResource[code] += sum;
                });
            }
        });
    }
    
    // ================= Новая логика аналитических карточек =================
    const overrunAmount = factTotal > planTotal ? (factTotal - planTotal) : 0;
    const savingAmount = planTotal > factTotal ? (planTotal - factTotal) : 0;
    const balance = (incomeTotal || 0) - (factTotal || 0); // Остаток (может быть <0)
    const deficitAmount = balance < 0 ? Math.abs(balance) : 0;
    const positiveBalance = balance > 0 ? balance : 0;

    const areaVal = parseFloat(currentObject?.area);
    const pricePerM2Plan = (areaVal && areaVal > 0) ? (planTotal / areaVal) : null;
    const pricePerM2Fact = (areaVal && areaVal > 0) ? (factTotal / areaVal) : null;
    const costPlan = planTotal; // Себестоимость (план)
    const costFact = factTotal; // Себестоимость (факт)

    // SVG иконки (stroke=currentColor для адаптации цвета)
    const ICONS = {
        budget: '<svg class="card-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="8" cy="13" r="2"/></svg>',
        income: '<svg class="card-icon" viewBox="0 0 24 24"><path d="M12 3v14"/><path d="M6 11l6 6 6-6"/><rect x="3" y="19" width="18" height="2" rx="1"/></svg>',
        expense: '<svg class="card-icon" viewBox="0 0 24 24"><path d="M12 21V7"/><path d="M18 13l-6-6-6 6"/><rect x="3" y="3" width="18" height="2" rx="1"/></svg>',
        overrun: '<svg class="card-icon" viewBox="0 0 24 24"><path d="M12 2l10 18H2L12 2z"/><path d="M12 9v5"/><circle cx="12" cy="16" r="1"/></svg>',
        saving: '<svg class="card-icon" viewBox="0 0 24 24"><path d="M5 12c0-5 7-9 7-9s7 4 7 9a7 7 0 0 1-14 0z"/><path d="M12 9v6"/><path d="M9 12h6"/></svg>',
        balance: '<svg class="card-icon" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><path d="M8 11v6"/><path d="M16 13v-6"/></svg>',
        deficit: '<svg class="card-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>',
        sqm: '<svg class="card-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>',
        cost: '<svg class="card-icon" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>'
    };

    function helpHTML(text){
        const safe = String(text||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        // Unified help icon (no bold, no title attribute) positioned top-right via CSS
        return `<span class="help"><span class="help-icon">?</span><span class="help-tip">${safe}</span></span>`;
    }
    function cardHTML({ title, value, cls, icon, help, click }) {
        const clickAttr = click ? ` data-fin="${click}"` : '';
        const clickCls = click ? ' finance-click' : '';
        return `<div class="analysis-card ${cls}${clickCls}"${clickAttr}>${help?helpHTML(help):''}<div class="card-title">${icon}<span>${title}</span></div><div class="card-value">${formatCurrency(value)} UZS</div></div>`;
    }
    function cardHTMLText({ title, text, cls, icon, help, click }) {
        const clickAttr = click ? ` data-fin="${click}"` : '';
        const clickCls = click ? ' finance-click' : '';
        return `<div class="analysis-card ${cls}${clickCls}"${clickAttr}>${help?helpHTML(help):''}<div class="card-title">${icon}<span>${title}</span></div><div class="card-value">${text}</div></div>`;
    }
    const pricePlanText = (pricePerM2Plan!=null) ? `${formatCurrency(pricePerM2Plan)} UZS` : '—';
    const priceFactText = (pricePerM2Fact!=null) ? `${formatCurrency(pricePerM2Fact)} UZS` : '—';

    container.innerHTML = `
        <div class="analysis-block">
            <div class="block-header"><div class="block-title">Финансы</div></div>
            <div class="analysis-cards">
            ${cardHTML({ title:'Приход', value:incomeTotal, cls:'income-card', icon:ICONS.income, help:'Сумма всех записей прихода.', click:'income' })}
            ${cardHTML({ title:'Расход', value:factTotal, cls:'expense-card', icon:ICONS.expense, help:'Сумма всех фактических расходов.', click:'expense' })}
            ${cardHTML({ title:'Перерасход', value:overrunAmount, cls:'overrun-card', icon:ICONS.overrun, help:'Если расход > план: Расход − План; иначе 0.', click:'overrun' })}
            ${cardHTML({ title:'Экономия', value:savingAmount, cls:'saving-card', icon:ICONS.saving, help:'Если план > расход: План − Расход; иначе 0.', click:'saving' })}
            ${cardHTML({ title:'Остаток', value:positiveBalance, cls: positiveBalance>0 ? 'balance-card card-positive' : 'balance-card', icon:ICONS.balance, help:'Если приход > расход: Приход − Расход; иначе 0.' })}
            ${cardHTML({ title:'Недостача', value:deficitAmount, cls:'deficit-card card-negative', icon:ICONS.deficit, help:'Если расход > приход: Расход − Приход; иначе 0.' })}
            </div>
            <div class="analysis-cards-secondary">
            ${cardHTMLText({ title:'Цена за 1 м² (План)', text: pricePlanText, cls:'plan-metric-card', icon:ICONS.sqm, help:'Если площадь > 0: План / Площадь; иначе —.' })}
            ${cardHTMLText({ title:'Цена за 1 м² (Факт)', text: priceFactText, cls:'fact-metric-card', icon:ICONS.sqm, help:'Если площадь > 0: Расход / Площадь; иначе —.' })}
            ${cardHTML({ title:'Себестоимость (План)', value: costPlan, cls:'plan-metric-card', icon:ICONS.cost, help:'Итоговая сумма плана.' })}
            ${cardHTML({ title:'Себестоимость (Факт)', value: costFact, cls:'fact-metric-card', icon:ICONS.cost, help:'Итоговая сумма фактических расходов.' })}
            </div>
        </div>
    `;

    // Enable click-to-toggle for tooltips (mobile friendly)
    document.addEventListener('click', (e)=>{
        const icon = e.target.closest('.help-icon');
        if (icon){
            e.stopPropagation();
            const wrap = icon.closest('.help');
            document.querySelectorAll('.help.show').forEach(h=>{ if (h!==wrap) h.classList.remove('show'); });
            wrap.classList.toggle('show');
        } else {
            document.querySelectorAll('.help.show').forEach(h=>h.classList.remove('show'));
        }
    }, { once: true });
    
    // Bind clicks for finance modal
    bindFinanceCardClicks(container);

    // Render resource breakdown as columns below the cards
    renderResourceColumns(container, resourceCodes, planByResource, factByResource);

    // Render customer income analysis (pie + horizontal)
    renderCustomerIncome(container);

    updateChart();
}

function renderResourceColumns(container, resourceCodes, planByResource, factByResource) {
    const codes = Object.keys(resourceCodes);
    const maxVal = Math.max(1, ...codes.map(c => Math.max(planByResource[c]||0, factByResource[c]||0)));
    let html = '<div class="analysis-block"><div class="block-header"><div class="block-title">Ресурсы</div></div><div class="resource-analysis">';
    codes.forEach(code => {
        const name = resourceCodes[code];
        const planVal = planByResource[code] || 0;
        const factVal = factByResource[code] || 0;
        const MAX_BAR_H = 120; // px, visual area height
        const planH = Math.round((planVal / maxVal) * MAX_BAR_H);
        const factH = Math.round((factVal / maxVal) * MAX_BAR_H);
        const diff = planVal - factVal; // >0 saved, <0 overrun
        const diffHtml = diff === 0 ? '' : (diff > 0
            ? `<div style="color:#0b6e4f; font-size:12px; margin-top:6px;">+ ${formatCurrency(diff)}</div>`
            : `<div style="color:#b42318; font-size:12px; margin-top:6px;">- ${formatCurrency(Math.abs(diff))}</div>`);

        html += `
            <div class="resource-row">
                <div class="resource-title" style="display:flex; align-items:center; gap:6px;">${renderResourceBadge(code)} <span>${name}</span></div>
                <div class="col-bars" style="display:flex; gap:16px; align-items:flex-end; justify-content:center; height:${MAX_BAR_H}px; overflow:hidden;">
                    <div class="bar bar-plan" style="width:28px; height:${planH}px; background:#7fb5ff; border:1px solid var(--border); border-radius:6px; box-shadow: var(--shadow);"></div>
                    <div class="bar bar-fact" style="width:28px; height:${factH}px; background:#ff8b8b; border:1px solid var(--border); border-radius:6px; box-shadow: var(--shadow);"></div>
                </div>
                <div class="col-labels" style="display:flex; gap:16px; justify-content:center; margin-top:6px;">
                    <div class="lab" style="text-align:center;">
                        <div style="font-size:12px; color:#2b3440;">План</div>
                        <div style="font-size:12px; color:#6b7785;">${formatCurrency(planVal)}</div>
                    </div>
                    <div class="lab" style="text-align:center;">
                        <div style="font-size:12px; color:#2b3440;">Факт</div>
                        <div style="font-size:12px; color:#6b7785;">${formatCurrency(factVal)}</div>
                    </div>
                </div>
                ${diffHtml}
            </div>
        `;
    });
    html += '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
}

function renderCustomerIncome(container){
    const o = window.currentObject || {};
    const rows = (o?.data?.income?.rows||[]).filter(r=> (r.type||'приход')==='приход');
    if (!rows.length){
        container.insertAdjacentHTML('beforeend', `<div class="analysis-block"><div class="block-header"><div class="block-title">Поступления по заказчикам</div></div><div class="fin-empty">Нет данных приходов</div></div>`);
        return;
    }
    const map = new Map();
    rows.forEach(r=>{
        const key = (r.from||'—').trim()||'—';
        map.set(key, (map.get(key)||0) + (Number(r.amount)||0));
    });
    const data = Array.from(map.entries()).map(([name,val])=>({name, val})).sort((a,b)=>b.val-a.val);
    const total = data.reduce((s,d)=>s+d.val,0) || 1;
    const pieSVG = buildPieSVG(data.map(d=>({ label:d.name, value:d.val/total })), 140, 56);
    const bars = data.map(d=>{
        const pct = Math.round((d.val/total)*100);
        return `<div class="fin-row"><div>${pct}%</div><div>${d.name}</div><div style="text-align:right;">${(d.val).toLocaleString('ru-RU')} UZS</div></div>`;
    }).join('');
    const html = `
        <div class="analysis-block">
            <div class="block-header"><div class="block-title">Поступления по заказчикам</div></div>
            <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
                <div>${pieSVG}<div style="font-size:12px; color:#6b7785; text-align:center; margin-top:6px;">Доля по приходу</div></div>
                <div style="flex:1; min-width:260px;">
                    <div class="fin-row head"><div>%</div><div>Заказчик</div><div style="text-align:right;">Сумма</div></div>
                    ${bars}
                </div>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function buildPieSVG(parts, size=160, innerRadius=0){
    // parts: [{label, value in 0..1}], sum ~1
    const r = size/2; const cx=r, cy=r;
    const ir = innerRadius; // donut if >0
    let a0 = -Math.PI/2; // start at top
    const colors = ['#6ea8fe','#7bd88f','#ffd97a','#ff8b8b','#a78bfa','#2fb5c9','#ffb347','#6c5ce7','#f6ad55'];
    const arcs = parts.map((p,i)=>{
        const a1 = a0 + 2*Math.PI*(p.value||0);
        const large = (a1-a0) > Math.PI ? 1 : 0;
        const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
        const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
        if (ir>0){
            const xi0 = cx + ir*Math.cos(a0), yi0 = cy + ir*Math.sin(a0);
            const xi1 = cx + ir*Math.cos(a1), yi1 = cy + ir*Math.sin(a1);
            const d = `M ${xi0} ${yi0} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${ir} ${ir} 0 ${large} 0 ${xi0} ${yi0} Z`;
            a0 = a1; return `<path d="${d}" fill="${colors[i%colors.length]}" />`;
        } else {
            const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
            a0 = a1; return `<path d="${d}" fill="${colors[i%colors.length]}" />`;
        }
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;">${arcs}</svg>`;
}

// ========== ГРАФИК ==========

// ===== Финансовая модалка =====
function bindFinanceCardClicks(root){
    root.querySelectorAll('.analysis-card.finance-click').forEach(card=>{
        card.addEventListener('click', ()=>{
            const key = card.getAttribute('data-fin') || 'income';
            openFinanceModal(key);
        });
    });
}

function openFinanceModal(active){
    const modal = document.getElementById('finance-modal');
    if (!modal) return;
    setFinanceActiveTab(active||'income');
    // init default period to current month
    const now = new Date();
    const ym = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const from = document.getElementById('fin-from');
    const to = document.getElementById('fin-to');
    if (from && !from.value) from.value = ym(new Date(now.getFullYear(), now.getMonth(), 1));
    if (to && !to.value) to.value = ym(now);
    renderFinanceLists();
    modal.style.display = 'block';
}

function closeFinanceModal(){ const m = document.getElementById('finance-modal'); if (m) m.style.display='none'; }

function setFinanceActiveTab(key){
    document.querySelectorAll('.fin-tab').forEach(b=>{
        const on = b.getAttribute('data-tab')===key; b.classList.toggle('active', on);
    });
    document.querySelectorAll('.fin-panel').forEach(p=>{
        const on = p.getAttribute('data-panel')===key; p.style.display = on ? 'block':'none';
    });
    const title = document.getElementById('finance-modal-title');
    if (title){
        const map = { income:'Приходы', expense:'Расходы', overrun:'Перерасход', saving:'Экономия' };
        title.textContent = 'Детализация: ' + (map[key]||'');
    }
}

function parseYYYYMM(s){ if(!s) return null; const [y,m]=s.split('-').map(n=>parseInt(n,10)); if(!y||!m) return null; return {y,m}; }
function inMonthRange(dateStr, fromYM, toYM){
    if (!fromYM && !toYM) return true;
    const d = new Date(dateStr); if (isNaN(d)) return false;
    const ym = d.getFullYear()*100 + (d.getMonth()+1);
    const min = fromYM ? (fromYM.y*100 + fromYM.m) : -Infinity;
    const max = toYM ? (toYM.y*100 + toYM.m) : Infinity;
    return ym>=min && ym<=max;
}

function renderFinanceLists(){
    const fromYM = parseYYYYMM(document.getElementById('fin-from')?.value);
    const toYM = parseYYYYMM(document.getElementById('fin-to')?.value);
    const rangeNote = document.getElementById('fin-range-note');
    if (rangeNote) rangeNote.textContent = fromYM||toYM ? `Фильтр: ${document.getElementById('fin-from').value||'—'} → ${document.getElementById('fin-to').value||'—'}` : '';

    const o = window.currentObject || {};
    // Приходы
    const incRows = (o?.data?.income?.rows||[]).filter(r=>inMonthRange(r.date, fromYM, toYM));
    fillList('fin-income-list', incRows.map(r=>({ date:r.date, title:r.note||'Запись прихода', amt:r.amount||0 })), {pos:true});

    // Расходы (по всем группам)
    const expItems = [];
    (o?.data?.fact?.groups||[]).forEach(g=>{
        if (Array.isArray(g.workTypes) && g.workTypes.length){
            g.workTypes.forEach(wt=>{
                (wt.resources||[]).forEach(r=>{ if (r.sumFact){ expItems.push({ date:r.date||g.date||'', title:r.name||wt.name||g.name||'Расход', amt:r.sumFact||0, res:r.resource||'' }); } });
            });
        } else {
            (g.rows||[]).forEach(r=>{ if (r.sumFact){ expItems.push({ date:r.date||g.date||'', title:r.name||g.name||'Расход', amt:r.sumFact||0, res:r.resource||'' }); } });
        }
    });
    const expRows = expItems.filter(r=>inMonthRange(r.date, fromYM, toYM));
    fillList('fin-expense-list', expRows, {neg:true, showRes:true});

    // Перерасход и Экономия по ресурсам (сводно за период): считаем суммарно План vs Факт
    const agg = {}; // res => {plan:0,fact:0}
    (o?.data?.plan?.groups||[]).forEach(g=>{
        const rows = (Array.isArray(g.workTypes) && g.workTypes.length)
            ? g.workTypes.flatMap(wt=> (wt.resources||[]))
            : (g.rows||[]);
        rows.forEach(r=>{ const res=r.resource||'M'; const sum=Number(r.sum||((r.quantity||0)*(r.price||0)))||0; agg[res]=agg[res]||{plan:0,fact:0}; agg[res].plan+=sum; });
    });
    (o?.data?.fact?.groups||[]).forEach(g=>{
        const rows = (Array.isArray(g.workTypes) && g.workTypes.length)
            ? g.workTypes.flatMap(wt=> (wt.resources||[]))
            : (g.rows||[]);
        rows.forEach(r=>{ const res=r.resource||'M'; const sum=Number(r.sumFact||0)||0; agg[res]=agg[res]||{plan:0,fact:0}; agg[res].fact+=sum; });
    });
    const overruns = [], savings=[];
    Object.keys(agg).forEach(res=>{
        const p=agg[res].plan||0, f=agg[res].fact||0;
        if (f>p) overruns.push({res, diff:f-p});
        else if (p>f) savings.push({res, diff:p-f});
    });
    overruns.sort((a,b)=>b.diff-a.diff); savings.sort((a,b)=>b.diff-a.diff);
    fillList('fin-overrun-list', overruns.map(x=>({title:'Перерасход', amt:x.diff, res:x.res})), {neg:true, showRes:true});
    fillList('fin-saving-list', savings.map(x=>({title:'Экономия', amt:x.diff, res:x.res})), {pos:true, showRes:true});
}

function fillList(id, items, opts={}){
    const host = document.getElementById(id);
    if (!host) return;
    if (!items || !items.length){ host.innerHTML = '<div class="fin-empty">Нет данных за выбранный период</div>'; return; }
    const header = `<div class="fin-row head"><div>Дата</div><div>Описание</div><div style="text-align:right;">Сумма</div></div>`;
    const rows = items.map(it=>{
        const date = it.date ? new Date(it.date) : null;
        const d = date && !isNaN(date) ? `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}` : '—';
        const res = it.res ? `<span class="badge-resource">${it.res}</span>` : '';
        const cls = opts.pos ? 'amt-pos' : (opts.neg ? 'amt-neg' : '');
        const amt = (it.amt||0).toLocaleString('ru-RU');
        return `<div class="fin-row"><div>${d}</div><div>${res}${it.title||''}</div><div style="text-align:right;" class="${cls}">${amt} UZS</div></div>`;
    }).join('');
    host.innerHTML = header + rows;
}

function updateChart() {
    // Проверяем, что элементы графика существуют
    const planBar = document.getElementById('plan-bar');
    const incomeBar = document.getElementById('income-bar');
    const factBar = document.getElementById('fact-bar');
    const balanceBar = document.getElementById('balance-bar');
    const balanceLabel = document.getElementById('balance-label');
    const incomeLabel = document.getElementById('income-label');
    const excessOverlay = document.getElementById('excess-overlay');
    if (!planBar || !factBar || !incomeBar || !balanceBar) return;
    
    let planTotal = 0;
    let factTotal = 0;
    
    // Вычисляем план (группы + мета-статьи)
    if (currentObject.data.plan && currentObject.data.plan.groups) {
        currentObject.data.plan.groups.forEach(group => {
            planTotal += calculateGroupTotalAny(group); // учёт новой иерархии workTypes
        });
    }
    // Добавляем мета-статьи бюджета
    const metaPlan = currentObject?.data?.plan?.metaExpenses;
    if (metaPlan){
        const baseResources = planTotal; // сумма только групп
        const miscAmount = baseResources * (Number(metaPlan.miscPercent)||0) / 100;
        const extraTotal = (metaPlan.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
        planTotal += Number(metaPlan.land||0) + Number(metaPlan.permit||0) + Number(metaPlan.project||0) + miscAmount + extraTotal;
    }
    
    // Вычисляем факт (группы + мета-статьи)
    if (currentObject.data.fact && currentObject.data.fact.groups) {
        currentObject.data.fact.groups.forEach(group => {
            if (Array.isArray(group.workTypes) && group.workTypes.length){
                group.workTypes.forEach(wt=>{ (wt.resources||[]).forEach(r=>{ factTotal += Number(r.sumFact||0)||0; }); });
            } else {
                factTotal += calculateFactGroupTotal(group.rows||[]);
            }
        });
    }
    const metaFact = currentObject?.data?.fact?.metaExpenses;
    if (metaFact){
        factTotal += Number(metaFact.land||0)+Number(metaFact.permit||0)+Number(metaFact.project||0)+Number(metaFact.misc||0)+(metaFact.extra||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
    }

    // Вычисляем приход (если есть)
    let incomeTotal = 0;
    if (currentObject.data.income && currentObject.data.income.rows) {
        incomeTotal = calculateIncomeTotal();
    }
    
    // Определяем максимальное значение для шкалы (учитываем приход)
    const maxValue = Math.max(planTotal, factTotal, incomeTotal, 100000); // Минимум 100000 для видимости
    const roundedMax = Math.ceil(maxValue / 50000) * 50000; // Округляем до 50000
    
    // Обновляем полосу плана (Бюджет)
    const planLabel = document.getElementById('plan-label');
    const planPercentage = roundedMax > 0 ? (planTotal / roundedMax) * 100 : 0;
    planBar.style.width = `${Math.max(planPercentage, 0)}%`;
    if (planLabel) { planLabel.textContent = 'Бюджет - ' + formatNumber(planTotal) + ' UZS'; }
    
    // Обновляем полосу прихода
    const incomePercentage = roundedMax > 0 ? (incomeTotal / roundedMax) * 100 : 0;
    incomeBar.style.width = `${Math.max(incomePercentage, 0)}%`;
    if (incomeLabel) { incomeLabel.textContent = 'Приход - ' + formatNumber(incomeTotal) + ' UZS'; }

    // Обновляем полосу факта
    const factLabel = document.getElementById('fact-label');
    const factColorLabel = document.querySelector('.fact-color');
    const factPercentage = roundedMax > 0 ? (factTotal / roundedMax) * 100 : 0;
    factBar.style.width = `${Math.max(factPercentage, 0)}%`;
    if (factLabel) { factLabel.textContent = 'Расход - ' + formatNumber(factTotal) + ' UZS'; }
    
    // Меняем цвет факта, если превышает план
    if (factTotal > planTotal && planTotal > 0) {
        factBar.classList.add('over-budget');
        if (factColorLabel) {
            factColorLabel.classList.add('over-budget');
        }
    } else {
        factBar.classList.remove('over-budget');
        if (factColorLabel) {
            factColorLabel.classList.remove('over-budget');
        }
    }
    
    // Обновляем шкалу
    updateScale(roundedMax);

    // Обновляем полосу остатка (Приход - Расход) — единоразово
    if (balanceBar && balanceLabel) {
        const balance = incomeTotal - factTotal;
        const balanceAbs = Math.abs(balance);
        const balancePercentage = roundedMax > 0 ? (balanceAbs / roundedMax) * 100 : 0;
        balanceBar.style.width = `${Math.max(Math.min(balancePercentage, 100), 0)}%`;
        const labelName = balance < 0 ? 'Недостача' : 'Остаток';
        balanceLabel.textContent = `${labelName} - ${formatNumber(balanceAbs)} UZS`;
        balanceBar.classList.toggle('balance-negative', balance < 0);
    }

    // Показываем штриховку излишка, если расход > бюджет
    if (excessOverlay) {
        if (factTotal > planTotal && planTotal > 0) {
            const leftPct = roundedMax > 0 ? (planTotal / roundedMax) * 100 : 0;
            const widthPct = roundedMax > 0 ? ((factTotal - planTotal) / roundedMax) * 100 : 0;
            excessOverlay.style.display = 'block';
            excessOverlay.style.left = `${Math.max(0, leftPct)}%`;
            excessOverlay.style.width = `${Math.max(0, widthPct)}%`;
        } else {
            excessOverlay.style.display = 'none';
        }
    }
}

function updateScale(maxValue) {
    const scaleMarkers = document.getElementById('scale-markers');
    scaleMarkers.innerHTML = '';
    
    // Создаем 5 меток на шкале
    const markersCount = 5;
    for (let i = 0; i <= markersCount; i++) {
        const value = (maxValue / markersCount) * i;
        const percentage = (i / markersCount) * 100;
        
        const marker = document.createElement('div');
        marker.className = 'scale-marker';
        marker.style.left = `${percentage}%`;
        marker.textContent = formatNumber(value);
        scaleMarkers.appendChild(marker);
    }
}

function formatNumber(num) {
    // Форматируем число с пробелами для разделения тысяч
    return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Форматирование валюты с разделителями тысяч
function formatCurrency(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    // Форматируем число с пробелами для разделения тысяч, сохраняя 2 знака после запятой
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
}

// Безопасное экранирование HTML (используется при выводе пользовательских значений)
function escapeHtml(str){
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}
if (typeof window !== 'undefined' && !window.escapeHtml){ window.escapeHtml = escapeHtml; }

// Парсинг валюты (удаление пробелов и преобразование в число)
function parseCurrency(str) {
    if (!str) return 0;
    // Удаляем все пробелы и преобразуем в число
    const cleaned = str.toString().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// ========== КАРТА ==========

function initMap() {
    // Инициализация карты будет выполнена при открытии модального окна
}

function openMapModal(groupId, rowId) {
    currentLocationRow = { groupId, rowId };
    const modal = document.getElementById('map-modal');
    modal.style.display = 'block';
    
    // Получение текущей локации строки
    const group = currentObject.data.plan.groups.find(g => g.id === groupId);
    let currentLocation = null;
    if (group) {
        const row = group.rows.find(r => r.id === rowId);
        if (row && row.location) {
            currentLocation = row.location;
        }
    }
    
    // Инициализация карты
    if (typeof ymaps !== 'undefined') {
        ymaps.ready(function() {
            const center = currentLocation ? [currentLocation.lat, currentLocation.lng] : [41.3111, 69.2797]; // Ташкент по умолчанию
            
            if (!yandexMap) {
                yandexMap = new ymaps.Map('yandex-map', {
                    center: center,
                    zoom: 12
                });
                
                yandexPlacemark = new ymaps.Placemark(center, {}, {
                    draggable: true
                });
                
                yandexMap.geoObjects.add(yandexPlacemark);
                
                yandexMap.events.add('click', function(e) {
                    const coords = e.get('coords');
                    yandexPlacemark.geometry.setCoordinates(coords);
                    updateLocationFromCoords(coords);
                });
                
                yandexPlacemark.events.add('dragend', function() {
                    const coords = yandexPlacemark.geometry.getCoordinates();
                    updateLocationFromCoords(coords);
                });
            } else {
                yandexMap.setCenter(center, 12);
                yandexPlacemark.geometry.setCoordinates(center);
                if (currentLocation) {
                    updateLocationFromCoords(center);
                }
            }
        });
    } else {
        document.getElementById('yandex-map').innerHTML = '<p>Карта недоступна. Убедитесь, что подключен API Яндекс.Карт.</p>';
    }
}

function updateLocationFromCoords(coords) {
    if (typeof ymaps !== 'undefined' && yandexMap) {
        ymaps.geocode(coords).then(function(res) {
            const firstGeoObject = res.geoObjects.get(0);
            const address = firstGeoObject ? firstGeoObject.getAddressLine() : 'Адрес не найден';
            
            currentLocationData = {
                lat: coords[0],
                lng: coords[1],
                address: address
            };
        });
    } else {
        currentLocationData = {
            lat: coords[0],
            lng: coords[1],
            address: 'Координаты: ' + coords[0].toFixed(6) + ', ' + coords[1].toFixed(6)
        };
    }
}

function saveLocation() {
    if (currentLocationRow && currentLocationData) {
        const group = currentObject.data.plan.groups.find(g => g.id === currentLocationRow.groupId);
        if (group) {
            let targetRow = null;
            if (typeof findResourceRow === 'function') {
                const fr = findResourceRow(group, currentLocationRow.rowId);
                targetRow = fr && fr.row ? fr.row : null;
            }
            if (!targetRow && Array.isArray(group.rows)) {
                targetRow = group.rows.find(r => r.id === currentLocationRow.rowId);
            }
            if (targetRow) { targetRow.location = currentLocationData; saveObject(); renderPlanGroups(); }
        }
    }
    closeMapModal();
}

function closeMapModal() {
    document.getElementById('map-modal').style.display = 'none';
    currentLocationRow = null;
    currentLocationData = null;
}

// Сохранение объекта
function saveObject() {
    const MAX_LEN = 4_500_000; // ~4.5MB для безопасности
    // Если редактируем блок — обновляем родителя и не добавляем блок в общий список
    try {
        if (window.__editingBlock && window.__parentObjectId) {
            // Load objects list and update the corresponding parent's block
            let objectsForParent = [];
            try{ objectsForParent = JSON.parse(localStorage.getItem('smeta_objects')) || []; }catch(_){ objectsForParent = []; }
            // Удалим возможную ошибочную запись блока из списка объектов (по текущему ID)
            if (currentObject && currentObject.id){
                objectsForParent = objectsForParent.filter(o=> o && o.id !== currentObject.id);
            }
            const parentIdx = objectsForParent.findIndex(o=> o.id === window.__parentObjectId);
            // Build parent object to save
            let parentObj = null;
            if (parentIdx !== -1) parentObj = objectsForParent[parentIdx];
            else parentObj = window.__parentObject || null;
            if (parentObj){
                // find the block inside parentObj.blocks and update by id
                parentObj.blocks = parentObj.blocks || [];
                const bid = currentObject.id;
                const bidx = parentObj.blocks.findIndex(b=> b.id === bid);
                const updatedBlock = parentObj.blocks[bidx] || { id: bid, name: currentObject.name || ('Блок ' + bid), data: currentObject.data };
                // update name and data
                updatedBlock.name = (currentObject.name && currentObject.name.includes('/') ) ? currentObject.name.split('/').slice(-1)[0].trim() : updatedBlock.name;
                updatedBlock.data = currentObject.data;
                if (bidx !== -1) parentObj.blocks[bidx] = updatedBlock; else parentObj.blocks.push(updatedBlock);
                // persist parentObj into objectsForParent
                if (parentIdx !== -1) objectsForParent[parentIdx] = parentObj; else objectsForParent.push(parentObj);
                // write smeta_objects
                try{ localStorage.setItem('smeta_objects', JSON.stringify(objectsForParent)); }catch(_){ }
                // Also save parent as current_object for convenience
                try{ localStorage.setItem('current_object', JSON.stringify(parentObj)); }catch(_){ }
                return; // done
            }
        }
        // Default поведение: сохраняем текущий объект в smeta_objects и current_object
        // Обновление объекта в общем списке с защитой от переполнения хранилища
        let objects = [];
        try { objects = JSON.parse(localStorage.getItem('smeta_objects')) || []; } catch(_){ objects = []; }
        const index = objects.findIndex(obj => obj.id === currentObject.id);
        if (index !== -1) { objects[index] = currentObject; } else { objects.push(currentObject); }
        // Сохраняем smeta_objects
        try {
            let payload = JSON.stringify(objects);
            if (payload.length > MAX_LEN) {
                // Обрезаем старые заказы/доки
                const objRef = objects.find(o=>o.id===currentObject.id);
                if (objRef && objRef.data && objRef.data.supply){
                    const ord = objRef.data.supply.orders||[];
                    while (ord.length && JSON.stringify(objects).length > MAX_LEN){ ord.shift(); }
                    const cds = objRef.data.supply.compDocs||[];
                    while (cds.length && JSON.stringify(objects).length > MAX_LEN){ cds.shift(); }
                }
                payload = JSON.stringify(objects);
            }
            localStorage.setItem('smeta_objects', payload);
        } catch(e){ console.warn('Не удалось сохранить smeta_objects', e); }
        let cur = JSON.stringify(currentObject);
        if (cur.length > MAX_LEN) {
            const clone = JSON.parse(cur);
            // Удаляем тяжёлые поля (фото чеков/товаров) и ограничиваем историю
            try{
                (clone.data?.supply?.orders||[]).forEach(o=>{ o.photosReceipt = []; o.itemsPhotos = {}; });
                if (Array.isArray(clone.data?.supply?.orders) && clone.data.supply.orders.length>10){ clone.data.supply.orders = clone.data.supply.orders.slice(-10); }
                if (Array.isArray(clone.data?.supply?.compDocs) && clone.data.supply.compDocs.length>10){ clone.data.supply.compDocs = clone.data.supply.compDocs.slice(-10); }
            }catch(_){ }
            cur = JSON.stringify(clone);
        }
        localStorage.setItem('current_object', cur);
    } catch(e){ console.warn('Не удалось сохранить current_object', e); }
    // If running inside Electron, also persist to Documents/SMETA_APP
    try {
        if (window.smetaAPI && window.smetaAPI.saveProject) {
            // non-blocking
            window.smetaAPI.saveProject(currentObject).then(result => {
                if (!result || !result.ok) console.warn('Failed to save project to disk', result && result.error);
            }).catch(err => console.warn('saveProject error', err));
        }
    } catch (e) {
        // ignore if window.smetaAPI not available
    }

    // If Google Drive sync enabled
    if (window.DriveAPI && window.DriveAPI.isAuthorized && window.DriveAPI.isAuthorized()) {
        window.DriveAPI.saveProject(currentObject).catch(e => console.warn('Drive save failed', e));
    }
}

// Trigger Google Drive auth and initial load
async function enableDriveSync() {
    if (!window.DriveAPI) { alert('Drive API не загружен'); return; }
    // TODO: replace placeholder client id through user input or config
    if (window.DriveAPI.setClientId) {
        // Put your real client ID here or make it editable
        window.DriveAPI.setClientId('YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com');
    }
    try {
        await window.DriveAPI.signIn();
        const remote = await window.DriveAPI.loadProject();
        if (remote) {
            currentObject = remote;
            window.currentObject = currentObject;
            // re-render after merge
            document.getElementById('object-title').textContent = currentObject.name || 'Объект';
            loadPlanData();
            loadFactData();
            loadIncomeData();
            loadAnalysisData();
            updateChart();
        } else {
            // No remote yet — push current local state
            await window.DriveAPI.saveProject(currentObject);
        }
        alert('Google Drive синхронизация активна');
    } catch (e) {
        console.warn(e);
        alert('Не удалось включить Google Drive: ' + e.message);
    }
}

