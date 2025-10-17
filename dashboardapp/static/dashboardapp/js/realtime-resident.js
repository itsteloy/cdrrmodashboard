// residentReportsRealtime.js
// Combines real-time Firestore updates and resident report status/action UI

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('mainTable') && document.querySelector('thead').textContent.includes('Full Name')) {
        initializeRealTimeUpdates();
    }
});

let existingReportIds = new Set();

// Utility to get CSRF token
function getCSRFToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) return metaTag.getAttribute('content');
    // Fallback to cookie
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === ('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

// Create status badge HTML
function createStatusBadge(status) {
    status = status || 'Pending';
    const badgeClasses = {
        'Pending': 'badge bg-danger text-white',
        'In Progress': 'badge bg-warning text-dark',
        'Resolved': 'badge bg-success text-light'
    };
    const badgeClass = badgeClasses[status] || 'badge bg-secondary';
    return `<span class="${badgeClass}">${status}</span>`;
}

// Create action button HTML
function createActionButton(docId, status) {
    status = status || 'Pending';
    if (status === 'Resolved') return '';
    const buttonConfigs = {
        'Pending': {
            text: 'Validate',
            class: 'btn-primary',
            icon: 'bi-check-circle',
            nextStatus: 'In Progress'
        },
        'In Progress': {
            text: 'Done',
            class: 'btn-success',
            icon: 'bi-check2-all',
            nextStatus: 'Resolved'
        }
    };
    const config = buttonConfigs[status];
    if (!config) return '';
    return `
        <button class="btn btn-sm status-btn ${config.class}" 
                data-doc-id="${docId}"
                data-current-status="${status}"
                data-next-status="${config.nextStatus}">
            <i class="bi ${config.icon}"></i> ${config.text}
        </button>
    `;
}

function initializeRealTimeUpdates() {
    const db = firebase.firestore();
    const residentReportsRef = db.collection('resident_reports');

    // Collect existing record IDs from server-rendered table
    document.querySelectorAll('#mainTable tbody tr[id^="row-"]').forEach(row => {
        existingReportIds.add(row.id.replace('row-', ''));
    });

    // Initialize status/action UI for server-rendered rows
    initializeStatusUI();

    residentReportsRef.orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added') {
                if (!existingReportIds.has(docId)) {
                    addNewReportToTable(data, docId);
                    existingReportIds.add(docId);
                    showNewReportNotification(data.fullname);
                }
            } else if (change.type === 'modified') {
                updateReportInTable(data, docId);
            } else if (change.type === 'removed') {
                removeReportFromTable(docId);
                existingReportIds.delete(docId);
            }
        });
        updateReportCount(snapshot.size);
    }, (error) => {
        console.error("Error in real-time listener: ", error);
        showErrorToast("Error connecting to real-time updates");
    });
}

function addNewReportToTable(report, docId) {
    const tbody = document.querySelector('#mainTable tbody');
    if (tbody.querySelector(`#row-${docId}`)) return;

    const imageCell = report.imageUrl ? 
        `<img src="${report.imageUrl}" alt="Incident Image" style="max-width: 300px;" class="img-thumbnail">` : 
        '<span class="text-muted">No image</span>';

    const newRow = document.createElement('tr');
    newRow.id = `row-${docId}`;
    newRow.innerHTML = `
        <td class="w-20">${report.fullname || ''}</td>
        <td>${report.description || ''}</td>
        <td class="w-25">${report.location || ''}</td>
        <td class="text-center">${imageCell}</td>
        <td>${formatTimestamp(report.timestamp)}</td>
        <td id="status-${docId}" data-status="${report.status || 'Pending'}" class="text-center"></td>
        <td id="action-${docId}" class="text-center"></td>
    `;

    if (tbody.firstChild) {
        tbody.insertBefore(newRow, tbody.firstChild);
    } else {
        tbody.appendChild(newRow);
    }

    // Initialize badge and button for the new row
    initializeRowStatusUI(docId, report.status || 'Pending');
}

function updateReportInTable(report, docId) {
    const row = document.getElementById(`row-${docId}`);
    if (row) {
        row.cells[0].textContent = report.fullname || '';
        row.cells[1].textContent = report.description || '';
        row.cells[2].textContent = report.location || '';
        
        // Update image cell (index 3)
        const imageCell = report.imageUrl ? 
            `<img src="${report.imageUrl}" alt="Incident Image" style="max-width: 300px;" class="img-thumbnail">` : 
            '<span class="text-muted">No image</span>';
        row.cells[3].innerHTML = imageCell;
        
        row.cells[4].textContent = formatTimestamp(report.timestamp);
        initializeRowStatusUI(docId, report.status || 'Pending');
    }
}

function removeReportFromTable(docId) {
    const row = document.getElementById(`row-${docId}`);
    if (row) row.remove();
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
    }
    if (typeof timestamp === 'string') {
        try {
            return new Date(timestamp).toLocaleString();
        } catch (e) {
            return timestamp;
        }
    }
    return timestamp;
}

function updateReportCount(count) {
    const countElement = document.getElementById('reportCount');
    if (countElement) {
        countElement.textContent = `Total Reports: ${count}`;
    }
}

function showNewReportNotification(fullname) {
    showToast(`New resident report from ${fullname}`, 'info');
}

function showErrorToast(message) {
    showToast(message, 'danger');
}

function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

// Initialize all status UI elements for server-rendered rows
function initializeStatusUI() {
    const rows = document.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const docId = row.id.replace('row-', '');
        const statusCell = document.getElementById(`status-${docId}`);
        const actionCell = document.getElementById(`action-${docId}`);
        const initialStatus = statusCell.getAttribute('data-status') || 'Pending';
        statusCell.innerHTML = createStatusBadge(initialStatus);
        actionCell.innerHTML = createActionButton(docId, initialStatus);
        const button = actionCell.querySelector('.status-btn');
        if (button) {
            button.addEventListener('click', function() {
                updateStatus(this);
            });
        }
    });
}

// Initialize a single row's status UI (for real-time added/updated rows)
function initializeRowStatusUI(docId, status = null) {
    const statusCell = document.getElementById(`status-${docId}`);
    const actionCell = document.getElementById(`action-${docId}`);
    const currentStatus = status || (statusCell ? statusCell.getAttribute('data-status') : 'Pending');
    if (statusCell) statusCell.innerHTML = createStatusBadge(currentStatus);
    if (actionCell) {
        actionCell.innerHTML = createActionButton(docId, currentStatus);
        const button = actionCell.querySelector('.status-btn');
        if (button) {
            button.addEventListener('click', function() {
                updateStatus(this);
            });
        }
    }
}

// Update status via AJAX
function updateStatus(buttonElement) {
    const docId = buttonElement.getAttribute('data-doc-id');
    const nextStatus = buttonElement.getAttribute('data-next-status');
    if (!nextStatus) return;
    fetch(`/resident_reports/${docId}/update-status/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCSRFToken(),
        },
        body: `status=${nextStatus}`
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            alert('Error updating status: ' + (data.error || 'Unknown error'));
        }
        // UI will update automatically via real-time listener
    })
    .catch(error => {
        alert('An error occurred while updating the status.');
    });
}

// For real-time updates: update badge and button for a row
function updateRowStatus(docId, newStatus) {
    initializeRowStatusUI(docId, newStatus);
}
