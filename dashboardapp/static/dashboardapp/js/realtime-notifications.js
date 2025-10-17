// Modal-based notification system with Firestore persistence
const notificationModalEl = document.getElementById('realtimeNotificationsModal');
const notificationListEl = document.getElementById('notificationList');
const notificationCountEl = document.getElementById('notificationCount');
const notifBadgeEl = document.getElementById('notifBadge');
const notifDropdownMenu = document.getElementById('notifDropdownMenu');
const notifDropdownEmpty = document.getElementById('notifDropdownEmpty');
let notificationStore = []; // {id, message, createdAt, type, read}
// persist last seen timestamp (ms since epoch) so other tabs won't replay old notifications
const LAST_SEEN_KEY = 'ui_notifications_lastSeen';
let lastSeenNotifications = parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10);
// If this is the very first load (no lastSeen saved), default to now so we don't replay historic docs
if (!lastSeenNotifications || isNaN(lastSeenNotifications) || lastSeenNotifications < 1000) {
    lastSeenNotifications = Date.now();
    try { localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); } catch (e) { }
}
// generic guards map for collections removed in favor of per-listener guards inside watcher
// keep a lightweight persistent recent-notified cache per-collection to avoid re-notifying the same doc
const notifiedCache = {}; // in-memory; persisted to localStorage as 'notified_<collection>'

// cross-tab communication
const TAB_ID = Math.random().toString(36).slice(2);
const BC_CHANNEL = 'dashboard_notifications_v1';
let bc = null;
if ('BroadcastChannel' in window) {
    try{ bc = new BroadcastChannel(BC_CHANNEL); bc.onmessage = (ev)=>{ try{ handleBroadcast(ev.data); }catch(e){} } }catch(e){}
}
// storage fallback
window.addEventListener('storage', function(e){ if(e.key === BC_CHANNEL && e.newValue){ try{ handleBroadcast(JSON.parse(e.newValue)); }catch(err){} } });

function broadcastNotification(payload){
    payload = payload || {};
    payload.sender = TAB_ID;
    payload.ts = Date.now();
    try{
        if(bc) bc.postMessage(payload);
        else localStorage.setItem(BC_CHANNEL, JSON.stringify(payload));
    }catch(e){ console.warn('broadcast failed', e); }
}

function handleBroadcast(payload){
    if(!payload) return;
    if(payload.sender && payload.sender === TAB_ID) return; // ignore self
    // update lastSeen so old docs won't replay
    lastSeenNotifications = Date.now();
    try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
    // show immediate UI feedback (toast/modal) depending on visibility
    const message = payload.message || 'New data has been received.';
    // show a subtle toast always
    showInlineToast('Notification', message, 'info');
    // show modal only if visible and not spammy
    if(window.showSuccessModal && document.visibilityState === 'visible'){
        try{ window.showSuccessModal(message); }catch(e){}
    }
}

// lightweight toast helper (uses Bootstrap toasts)
function showInlineToast(title, message, type){
    try{
        const container = document.querySelector('.toast-container');
        if(!container) return;
        container.classList.remove('d-none');
        const toastEl = document.createElement('div');
        const now = Date.now();
        toastEl.className = `toast align-items-center text-bg-${type || 'info'} border-0`;
        toastEl.setAttribute('role','alert');
        toastEl.setAttribute('aria-live','assertive');
        toastEl.setAttribute('aria-atomic','true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body"><strong>${title}:</strong> ${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        container.appendChild(toastEl);
        const bs = new bootstrap.Toast(toastEl, { delay: 4000 });
        bs.show();
        toastEl.addEventListener('hidden.bs.toast', ()=> toastEl.remove());
    }catch(e){ console.warn('showInlineToast failed', e); }
}
// debounce to avoid multiple modals in quick succession
let lastModalShownAt = 0;
const MODAL_DEBOUNCE_MS = 2000;

function typeIcon(type){
    switch(type){
        case 'emergency': return '<i class="bi bi-exclamation-triangle-fill text-danger"></i>';
        case 'resident': return '<i class="bi bi-person-fill text-warning"></i>';
        case 'referral': return '<i class="bi bi-arrow-left-right text-info"></i>';
        default: return '<i class="bi bi-info-circle-fill text-secondary"></i>';
    }
}

function renderNotifications(){
    if(!notificationListEl) return;
    notificationListEl.innerHTML = '';
    notificationStore.forEach(item => {
        const node = document.createElement('div');
        node.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';
        if(!item.read) node.classList.add('unread-notification');
        node.setAttribute('data-notif-id', item.id);
        node.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-3">${typeIcon(item.type)}</div>
                <div class="ms-2 me-auto">
                    <div class="fw-semibold">${item.message}</div>
                    <div class="small text-muted">${new Date(item.createdAt).toLocaleString()}</div>
                </div>
            </div>
            <div class="ms-3 d-flex align-items-start flex-column">
                <button class="btn btn-sm btn-outline-secondary mb-2 dismiss-btn" aria-label="Dismiss notification">Dismiss</button>
                <button class="btn btn-sm btn-outline-primary mark-read-btn" aria-label="Mark as read">Mark read</button>
            </div>
        `;
        notificationListEl.appendChild(node);
        node.querySelector('.dismiss-btn').addEventListener('click', ()=>dismissNotification(item.id));
        node.querySelector('.mark-read-btn').addEventListener('click', ()=>markAsRead(item.id));
    });
    notificationCountEl.textContent = `${notificationStore.filter(n=>!n.read).length} unread, ${notificationStore.length} total`;
    // update badge and dropdown
    updateBadgeAndDropdown();
}

function updateBadgeAndDropdown(){
    if(!notifBadgeEl || !notifDropdownMenu) return;
    const unreadCount = notificationStore.filter(n=>!n.read).length;
    if(unreadCount > 0){
        notifBadgeEl.classList.remove('d-none');
        notifBadgeEl.textContent = unreadCount;
    } else {
        notifBadgeEl.classList.add('d-none');
        notifBadgeEl.textContent = '0';
    }

    // populate dropdown
    notifDropdownMenu.innerHTML = '';
    if(notificationStore.length === 0){
        notifDropdownMenu.innerHTML = '<li class="small text-muted px-2">No notifications</li>';
        return;
    }
    notificationStore.slice(0,8).forEach(item => {
        const li = document.createElement('li');
        li.className = 'px-2 py-1';
        li.innerHTML = `
            <a href="#" class="d-flex align-items-start text-decoration-none text-reset dropdown-notif-item" data-notif-id="${item.id}">
                <div class="me-2">${typeIcon(item.type)}</div>
                <div class="small">
                    <div class="fw-semibold">${item.message}</div>
                    <div class="text-muted small">${new Date(item.createdAt).toLocaleString()}</div>
                </div>
            </a>
        `;
        notifDropdownMenu.appendChild(li);
    });
    // add view all / open modal link
    const hr = document.createElement('li'); hr.className='dropdown-divider my-1'; notifDropdownMenu.appendChild(hr);
    const viewAll = document.createElement('li'); viewAll.className='px-2'; viewAll.innerHTML = '<a href="#" id="openNotificationsModal" class="text-decoration-none">View all notifications</a>';
    notifDropdownMenu.appendChild(viewAll);
    // wire events
    notifDropdownMenu.querySelectorAll('.dropdown-notif-item').forEach(a=>{
        a.addEventListener('click', function(e){ e.preventDefault(); const id = this.getAttribute('data-notif-id'); openModalAndMarkRead(id); });
    });
    const openAll = document.getElementById('openNotificationsModal'); if(openAll) openAll.addEventListener('click', function(e){ e.preventDefault(); showNotificationsModal(); });
}

function showNotificationsModal(){
    if(!notificationModalEl) return;
    const modal = bootstrap.Modal.getInstance(notificationModalEl) || new bootstrap.Modal(notificationModalEl, {keyboard: true});
    modal.show();
}

async function openModalAndMarkRead(id){
    showNotificationsModal();
    // mark a single item read and ensure it's in view
    await markAsRead(id);
    // highlight the item in modal (optional)
    const el = document.querySelector(`[data-notif-id="${id}"]`);
    if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
}

async function addNotificationToUI(docRef){
    // fetch the document and add to UI store
    const snap = await docRef.get();
    const data = snap.data();
    const createdAtMs = data.createdAt ? data.createdAt.toMillis() : Date.now();
    const item = { id: docRef.id, message: data.message, createdAt: createdAtMs, type: data.type || 'info', read: !!data.read };
    // ensure newest first
    notificationStore = [item, ...notificationStore.filter(n=>n.id !== item.id)];
    renderNotifications();
}

async function createNotificationInFirestore(type, message){
    try{
        // Send to server endpoint which will write using admin SDK
        const csrftoken = (document.querySelector('meta[name="csrf-token"]') || {}).content || getCookie('csrftoken');
        const res = await fetch('/api/notifications/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-CSRFToken': csrftoken
            },
            body: `type=${encodeURIComponent(type)}&message=${encodeURIComponent(message)}`
        });
        const data = await res.json();
        if(!data.success) throw new Error(data.error || 'Server error');
        return data;
    }catch(e){ console.error('Failed to create UI notification', e); }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function dismissNotification(id){
    // remove locally
    const idx = notificationStore.findIndex(n=>n.id===id);
    if(idx !== -1){
        const n = notificationStore[idx];
        notificationStore.splice(idx,1);
        renderNotifications();
    }
    // also delete via server endpoint
    try{
        const csrftoken = (document.querySelector('meta[name="csrf-token"]') || {}).content || getCookie('csrftoken');
        await fetch('/api/notifications/delete/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-CSRFToken': csrftoken }, body: `id=${encodeURIComponent(id)}` });
    }catch(e){ /* ignore */ }
}

async function markAsRead(id){
    const idx = notificationStore.findIndex(n=>n.id===id);
    if(idx !== -1){ notificationStore[idx].read = true; renderNotifications(); }
    try{
        const csrftoken = (document.querySelector('meta[name="csrf-token"]') || {}).content || getCookie('csrftoken');
        await fetch('/api/notifications/mark-read/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-CSRFToken': csrftoken }, body: `ids=${encodeURIComponent(id)}` });
    }catch(e){ console.warn(e); }
}

async function markAllRead(){
    const batch = db.batch();
    const unread = notificationStore.filter(n=>!n.read);
    unread.forEach(n=>{ batch.update(db.collection('ui_notifications').doc(n.id), { read: true }) });
    try{ await batch.commit();
        notificationStore = notificationStore.map(n=>({ ...n, read: true }));
        renderNotifications();
        lastSeenNotifications = Date.now();
        try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
    }catch(e){ console.warn('markAllRead failed', e); }
}

// wire mark all read button
document.addEventListener('DOMContentLoaded', function(){
    const markAllBtn = document.getElementById('markAllReadBtn');
    if(markAllBtn) markAllBtn.addEventListener('click', markAllRead);
});

// Listen to ui_notifications collection and keep UI in sync
let notificationsInitDone = false;
// helper: robust timestamp parsing (Firestore Timestamp, number (seconds or ms), ISO string)
function parseTimestampToMs(data){
    if(!data || typeof data !== 'object') return Date.now();
    const candidates = ['createdAt','timestamp','created_at','created','date','time'];
    for(const k of candidates){
        if(!(k in data)) continue;
        const v = data[k];
        if(v && typeof v.toMillis === 'function'){
            try{ return v.toMillis(); }catch(e){}
        }
        if(typeof v === 'number'){
            // if number looks like seconds (10 digits) convert to ms
            if(v < 1e12) return v * 1000;
            return v;
        }
        if(typeof v === 'string'){
            const parsed = Date.parse(v);
            if(!isNaN(parsed)) return parsed;
            // try truncating fractional seconds with excessive precision
            const trimmed = v.split('.')[0];
            const parsed2 = Date.parse(trimmed);
            if(!isNaN(parsed2)) return parsed2;
        }
    }
    // fallback
    return Date.now();
}

db.collection('ui_notifications').orderBy('createdAt', 'desc').onSnapshot(snapshot=>{
    const changes = snapshot.docChanges();
    changes.forEach(change=>{
        const doc = change.doc;
        if(change.type === 'added' || change.type === 'modified'){
            // Read the doc data to check createdAt
            const data = doc.data();
            const createdMs = parseTimestampToMs(data);
            addNotificationToUI(doc.ref);
            // only auto-open modal for real-time adds after initial snapshot AND when the doc is newer than last seen
            // do not auto-open modal here — only update UI and badge. Auto-opening caused unwanted popups when logging in or opening a new tab.
            if(change.type === 'added' && notificationsInitDone){
                if(createdMs > lastSeenNotifications){
                    // optionally play a subtle sound or show a lightweight toast here
                    // for now, just update the UI (addNotificationToUI already updated the list)
                }
            }
        } else if(change.type === 'removed'){
            // remove locally
            const idx = notificationStore.findIndex(n=>n.id===doc.id);
            if(idx !== -1){ notificationStore.splice(idx,1); renderNotifications(); }
        }
    });
    if(!notificationsInitDone) notificationsInitDone = true;
});

// When the modal is opened, mark displayed notifications as read
if(notificationModalEl){
    notificationModalEl.addEventListener('shown.bs.modal', async function(){
        // mark visible (or all) notifications as read
        const unread = notificationStore.filter(n=>!n.read).map(n=>n.id);
        if(unread.length === 0) return;
        // batch update if available
        try{
            const batch = db.batch();
            unread.forEach(id=> batch.update(db.collection('ui_notifications').doc(id), { read: true }));
            await batch.commit();
            notificationStore = notificationStore.map(n=>({ ...n, read: true }));
            renderNotifications();
            // update last seen timestamp to now so other tabs won't replay these
            lastSeenNotifications = Date.now();
            try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
        }catch(e){
            // fallback: update individually
            for(const id of unread){ try{ await db.collection('ui_notifications').doc(id).update({ read: true }); }catch(err){} }
            notificationStore = notificationStore.map(n=>({ ...n, read: true }));
            renderNotifications();
            lastSeenNotifications = Date.now();
            try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
        }
    });
}

function _loadNotifiedSet(collection){
    const key = `notified_${collection}`;
    try{
        const raw = localStorage.getItem(key);
        if(raw) return new Set(JSON.parse(raw));
    }catch(e){}
    return new Set();
}

function _saveNotifiedSet(collection, set){
    const key = `notified_${collection}`;
    try{ localStorage.setItem(key, JSON.stringify(Array.from(set))); }catch(e){}
}

function shouldNotify(collection, docId) {
    // Do not notify for docs we've already seen in this or other tabs.
    if(!collection || !docId) return false;
    // maintain an in-memory cache for quick checks
    if(!notifiedCache[collection]) notifiedCache[collection] = _loadNotifiedSet(collection);
    const set = notifiedCache[collection];
    if(set.has(docId)) return false;
    // mark now to prevent re-notification
    set.add(docId);
    _saveNotifiedSet(collection, set);
    // also ensure the doc is newer than lastSeenNotifications
    // callers should still check createdMs > lastSeenNotifications, but double-check here
    return true;
}

// Consolidated collection watchers will handle 'emergency_form', 'resident_reports', 'referral' and others below

// Generic collection watcher helper
function watchCollectionForNewDocs(collectionPath, label){
    if(!collectionPath) return;
    console.debug('[watchCollection] registering', collectionPath, label);
    // per-listener init flags so each listener ignores its initial snapshot
    let primaryInitialized = false;
    let fallbackInitialized = false;

    try{
        // primary, efficient listener: latest document by timestamp
        db.collection(collectionPath).orderBy('timestamp','desc').limit(1).onSnapshot(snapshot=>{
            if(!primaryInitialized){ primaryInitialized = true; return; }
            snapshot.docChanges().forEach(change=>{
                if(change.type === 'added'){
                    const doc = change.doc;
                    const data = doc.data();
                    const createdMs = parseTimestampToMs(data);
                    console.debug('[watchCollection][primary] ', collectionPath, 'doc:', doc.id, 'createdMs:', createdMs);
                    if(createdMs > lastSeenNotifications && shouldNotify(collectionPath, doc.id)){
                        (async ()=>{
                            try{
                                const res = await createNotificationInFirestore('info', `New ${label} received!`);
                                // broadcast to other tabs
                                broadcastNotification({ type: 'new-data', collection: collectionPath, message: `New ${label} received!` });
                                // show immediate feedback in visible tab
                                const now = Date.now();
                                if(window.showSuccessModal && document.visibilityState === 'visible' && (now - lastModalShownAt) > MODAL_DEBOUNCE_MS){
                                    window.showSuccessModal(`New ${label} received!`);
                                    lastModalShownAt = now;
                                }
                                lastSeenNotifications = Date.now();
                                try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
                                return res;
                            }catch(e){ console.warn('watchCollection createNotification failed', e); }
                        })();
                    }
                }
            });
        });
    }catch(e){ console.warn('watchCollection failed', collectionPath, e); }

    // Fallback: if the primary orderBy-based listener didn't work (e.g. no timestamp field), attach a full snapshot listener
    try{
        db.collection(collectionPath).onSnapshot(snapshot=>{
            if(!fallbackInitialized){ fallbackInitialized = true; return; }
            snapshot.docChanges().forEach(change=>{
                if(change.type === 'added'){
                    const doc = change.doc;
                    const data = doc.data();
                    const createdMs = parseTimestampToMs(data);
                    console.debug('[watchCollection][fallback] ', collectionPath, 'doc:', doc.id, 'createdMs:', createdMs);
                    if(createdMs > lastSeenNotifications && shouldNotify(collectionPath, doc.id)){
                        (async ()=>{
                            try{
                                const res = await createNotificationInFirestore('info', `New ${label} received!`);
                                broadcastNotification({ type: 'new-data', collection: collectionPath, message: `New ${label} received!` });
                                const now = Date.now();
                                if(window.showSuccessModal && document.visibilityState === 'visible' && (now - lastModalShownAt) > MODAL_DEBOUNCE_MS){
                                    window.showSuccessModal(`New ${label} received!`);
                                    lastModalShownAt = now;
                                }
                                lastSeenNotifications = Date.now();
                                try{ localStorage.setItem(LAST_SEEN_KEY, String(lastSeenNotifications)); }catch(e){}
                                return res;
                            }catch(err){ console.warn('watchCollection (fallback) createNotification failed', err); }
                        })();
                    }
                }
            });
        });
    }catch(err){ /* fallback failed too; log and continue */ console.warn('watchCollection fallback failed', collectionPath, err); }
}

// wire additional collections (adjust names to your actual collection paths)
watchCollectionForNewDocs('reports', 'report');
watchCollectionForNewDocs('user_requests', 'user request');
watchCollectionForNewDocs('logs', 'log');
watchCollectionForNewDocs('responder_updates', 'responder update');
// wire primary collections through generic watcher
watchCollectionForNewDocs('emergency_form', 'emergency record');
watchCollectionForNewDocs('resident_reports', 'resident report');
watchCollectionForNewDocs('referral', 'referral');