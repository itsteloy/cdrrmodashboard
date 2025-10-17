// static/dashboardapp/js/realtime-emergency.js
document.addEventListener('DOMContentLoaded', function() {
    // Only run if we're on the emergency records tab
    if (document.getElementById('mainTable') && document.querySelector('thead').textContent.includes('Patient Name')) {
        initializeRealTimeUpdates();
    }
});

let existingRecordIds = new Set();

function initializeRealTimeUpdates() {
    const db = firebase.firestore();
    const emergencyRef = db.collection('emergency_form');

    // Collect existing record IDs from server-rendered table
    document.querySelectorAll('#mainTable tbody tr[data-doc-id]').forEach(row => {
        existingRecordIds.add(row.getAttribute('data-doc-id'));
    });

    // Set up real-time listener
    emergencyRef.orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            if (change.type === 'added') {
                // Only add if not already present
                if (!existingRecordIds.has(docId)) {
                    addNewRecordToTable(change.doc.data(), docId);
                    existingRecordIds.add(docId);
                    showNewRecordNotification(change.doc.data().patient_name);
                }
            } else if (change.type === 'modified') {
                updateRecordInTable(change.doc.data(), docId);
            } else if (change.type === 'removed') {
                removeRecordFromTable(docId);
                existingRecordIds.delete(docId);
            }
        });

        // Update record count
        updateRecordCount(snapshot.size);
    }, (error) => {
        console.error("Error in real-time listener: ", error);
        showErrorToast("Error connecting to real-time updates");
    });
}

function addNewRecordToTable(record, docId) {
    const tbody = document.querySelector('#mainTable tbody');
    // Prevent duplicate rows
    if (tbody.querySelector(`tr[data-doc-id="${docId}"]`)) return;

    // Create new row
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-doc-id', docId);

    // Format the row content (similar to your Django template)
    newRow.innerHTML = `
        <td>${record.patient_name || ''}</td>
        <td>${record.age || ''}</td>
        <td>${record.chief_complaint || ''}</td>
        <td>${record.pickup_point || ''}</td>
        <td>${record.barangay || ''}</td>
        <td>${record.date_of_incident || ''}</td>
        <td>${record.date_of_birth || ''}</td>
        <td>
            <!-- View Details Button -->
            <button class="btn btn-primary btn-sm view-details-btn" type="button" data-bs-toggle="modal"
                data-bs-target="#detailsModal-${docId}">
                <i class="bi bi-eye"></i> View Details
            </button>

            <!-- Edit Button -->
            <button type="button" class="btn btn-warning btn-sm edit-btn" data-bs-toggle="modal"
                data-bs-target="#editModal" 
                data-id="${docId}"
                data-age="${record.age || ''}"
                data-allergy_status="${record.allergy_status || ''}"
                data-appearance_observation="${record.appearance_observation || ''}"
                data-asthma_status="${record.asthma_status || ''}"
                data-barangay="${record.barangay || ''}"
                data-bloodloss_observation="${record.bloodloss_observation || ''}"
                data-capillary_refill_time="${record.capillary_refill_time || ''}"
                data-chief_complaint="${record.chief_complaint || ''}"
                data-consent_to_care="${record.consent_to_care || ''}"
                data-contact_number="${record.contact_number || ''}"
                data-date_of_birth="${record.date_of_birth || ''}"
                data-date_of_incident="${record.date_of_incident || ''}"
                data-destination="${record.destination || ''}"
                data-device_id="${record.device_id || ''}"
                data-diabetes_status="${record.diabetes_status || ''}"
                data-diastolic_bp="${record.diastolic_bp || ''}"
                data-equipment_used="${Array.isArray(record.equipment_used) ? record.equipment_used.join(',') : record.equipment_used || ''}"
                data-eye_score="${record.eye_score || ''}"
                data-gcs_total="${record.gcs_total || ''}"
                data-hypertension_status="${record.hypertension_status || ''}"
                data-incident_number="${record.incident_number || ''}"
                data-left_pupil_reaction="${record.left_pupil_reaction || ''}"
                data-left_pupil_size="${record.left_pupil_size || ''}"
                data-medications="${record.medications || ''}"
                data-motor_score="${record.motor_score || ''}"
                data-nature_of_call="${record.nature_of_call || ''}"
                data-noted_by="${record.noted_by || ''}"
                data-other_medical_history="${record.other_medical_history || ''}"
                data-patient_name="${record.patient_name || ''}"
                data-pickup_point="${record.pickup_point || ''}"
                data-pulse_ox="${record.pulse_ox || ''}"
                data-pulse_rate="${record.pulse_rate || ''}"
                data-purok="${record.purok || ''}"
                data-remarks="${record.remarks || ''}"
                data-respiratory_rate="${record.respiratory_rate || ''}"
                data-responding_unit="${record.responding_unit || ''}"
                data-right_pupil_reaction="${record.right_pupil_reaction || ''}"
                data-right_pupil_size="${record.right_pupil_size || ''}"
                data-seizures_status="${record.seizures_status || ''}"
                data-sex="${record.sex || ''}"
                data-systolic_bp="${record.systolic_bp || ''}"
                data-team_leader="${record.team_leader || ''}"
                data-team_member="${record.team_member || ''}"
                data-team_operator="${record.team_operator || ''}"
                data-temperature="${record.temperature || ''}"
                data-treatments_given="${Array.isArray(record.treatments_given) ? record.treatments_given.join(',') : record.treatments_given || ''}"
                data-verbal_score="${record.verbal_score || ''}"
                data-waiver="${record.waiver || ''}">
                <i class="bi bi-pencil"></i> Edit
            </button>

            <!-- Delete Button -->
            <form action="/delete_emergency_record/${docId}/" method="POST" style="display:inline;">
                <input type="hidden" name="csrfmiddlewaretoken" value="${getCSRFToken()}">
                <button type="submit" class="btn btn-danger btn-sm"
                    onclick="return confirm('Are you sure you want to delete this record?');">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </form>
        </td>
    `;
    
    // Add the new row at the top of the table
    if (tbody.firstChild) {
        tbody.insertBefore(newRow, tbody.firstChild);
    } else {
        tbody.appendChild(newRow);
    }
    
}

function updateRecordInTable(record, docId) {
    // Find the row with matching data-doc-id
    const row = document.querySelector(`tr[data-doc-id="${docId}"]`);
    
    if (row) {
        // Update each cell with new data
        row.cells[0].textContent = record.patient_name || '';
        row.cells[1].textContent = record.age || '';
        row.cells[2].textContent = record.chief_complaint || '';
        row.cells[3].textContent = record.pickup_point || '';
        row.cells[4].textContent = record.barangay || '';
        row.cells[5].textContent = record.date_of_incident || '';
        row.cells[6].textContent = record.date_of_birth || '';
        
        // Show update notification
        showUpdateNotification(record.patient_name);
    }
}

function updateRecordCount(count) {
    // You can display the count somewhere in your UI
    const countElement = document.getElementById('recordCount');
    if (countElement) {
        countElement.textContent = `Total Records: ${count}`;
    }
}

function getCSRFToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : '';
}

function showNewRecordNotification(patientName) {
    showToast(`New emergency record added for ${patientName}`, 'success');
}

function showUpdateNotification(patientName) {
    showToast(`Record updated for ${patientName}`, 'info');
}

function showDeleteNotification() {
    showToast('Record deleted', 'warning');
}

function showErrorToast(message) {
    showToast(message, 'danger');
}

function showToast(message, type = 'info') {
    // Create toast element
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
    
    // Add to toast container
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    // Show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}