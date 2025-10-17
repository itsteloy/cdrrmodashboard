// Real-time Firestore listener for referral tab
document.addEventListener('DOMContentLoaded', function() {
	if (document.getElementById('mainTable') && document.querySelector('thead').textContent.includes('Patient Name')) {
		initializeReferralRealTimeUpdates();
	}
});

let existingReferralIds = new Set();

function initializeReferralRealTimeUpdates() {
	const db = firebase.firestore();
	const referralRef = db.collection('referral');

	// Collect existing record IDs from server-rendered table
	document.querySelectorAll('#mainTable tbody tr[data-doc-id]').forEach(row => {
		existingReferralIds.add(row.getAttribute('data-doc-id'));
	});

	referralRef.orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
		snapshot.docChanges().forEach((change) => {
			const docId = change.doc.id;
			const data = change.doc.data();

			if (change.type === 'added') {
				if (!existingReferralIds.has(docId)) {
					addNewReferralToTable(data, docId);
					existingReferralIds.add(docId);
					showNewReferralNotification(data.patient_name);
				}
			} else if (change.type === 'modified') {
				updateReferralInTable(data, docId);
			} else if (change.type === 'removed') {
				removeReferralFromTable(docId);
				existingReferralIds.delete(docId);
			}
		});
		updateReferralCount(snapshot.size);
	}, (error) => {
		console.error("Error in real-time listener: ", error);
		showErrorToast("Error connecting to real-time updates");
	});
}

function addNewReferralToTable(referral, docId) {
	const tbody = document.querySelector('#mainTable tbody');
	if (tbody.querySelector(`tr[data-doc-id='${docId}']`)) return;

	const newRow = document.createElement('tr');
	newRow.setAttribute('data-doc-id', docId);
	newRow.innerHTML = `
		<td>${referral.patient_name || ''}</td>
		<td>${referral.reason_for_referral || ''}</td>
		<td>${referral.receiving_institution || ''}</td>
		<td>${referral.referring_institution || ''}</td>
		<td>${formatTimestamp(referral.timestamp)}</td>
		<td>
			<button class="btn btn-primary btn-sm view-details-btn" type="button" data-bs-toggle="modal"
				data-bs-target="#detailsModal-${docId}">
				<i class="bi bi-eye"></i> View Details
			</button>
			<button type="button" class="btn btn-warning btn-sm edit-btn" data-bs-toggle="modal" data-bs-target="#editModal"
				data-id="${docId}"
				data-patient_name="${referral.patient_name || ''}"
				data-reason_for_referral="${referral.reason_for_referral || ''}"
				data-receiving_institution="${referral.receiving_institution || ''}"
				data-referring_institution="${referral.referring_institution || ''}"
				data-endorsed_by="${referral.endorsed_by || ''}"
				data-endorsed_to="${referral.endorsed_to || ''}"
				data-waiver="${referral.waiver || ''}"
				data-consent_to_care="${referral.consent_to_care || ''}"
				data-remarks="${referral.remarks || ''}">
				<i class="bi bi-pencil"></i> Edit
			</button>
			<form action="/delete_referral_record/${docId}/" method="POST" style="display:inline;">
				<input type="hidden" name="csrfmiddlewaretoken" value="${getCSRFToken()}">
				<button type="submit" class="btn btn-danger btn-sm"
					onclick="return confirm('Are you sure you want to delete this record?');">
					<i class="bi bi-trash"></i> Delete
				</button>
			</form>
		</td>
	`;
	if (tbody.firstChild) {
		tbody.insertBefore(newRow, tbody.firstChild);
	} else {
		tbody.appendChild(newRow);
	}
}

function updateReferralInTable(referral, docId) {
	const row = document.querySelector(`#mainTable tbody tr[data-doc-id='${docId}']`);
	if (row) {
		row.cells[0].textContent = referral.patient_name || '';
		row.cells[1].textContent = referral.reason_for_referral || '';
		row.cells[2].textContent = referral.receiving_institution || '';
		row.cells[3].textContent = referral.referring_institution || '';
		row.cells[4].textContent = formatTimestamp(referral.timestamp);
		// Update action cell attributes for edit/view
		row.cells[5].querySelector('.edit-btn').setAttribute('data-patient_name', referral.patient_name || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-reason_for_referral', referral.reason_for_referral || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-receiving_institution', referral.receiving_institution || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-referring_institution', referral.referring_institution || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-endorsed_by', referral.endorsed_by || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-endorsed_to', referral.endorsed_to || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-waiver', referral.waiver || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-consent_to_care', referral.consent_to_care || '');
		row.cells[5].querySelector('.edit-btn').setAttribute('data-remarks', referral.remarks || '');
	}
}

function removeReferralFromTable(docId) {
	const row = document.querySelector(`#mainTable tbody tr[data-doc-id='${docId}']`);
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

function updateReferralCount(count) {
	const countElement = document.getElementById('reportCount');
	if (countElement) {
		countElement.textContent = `Total Reports: ${count}`;
	}
}

function showNewReferralNotification(patient_name) {
	showToast(`New referral report for ${patient_name}`, 'info');
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
