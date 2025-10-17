// ...existing code...

document.addEventListener('DOMContentLoaded', function () {
    // Fetch and display profile info on page load
    fetch('/get-profile-info/')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.username && data.profile_picture) {
                document.getElementById('accountsLabel').textContent = data.username;
                document.getElementById('accountsIcon').innerHTML = `<img src='data:image/png;base64,${data.profile_picture}' class='rounded-circle me-2' style='width:32px;height:32px;object-fit:cover;'>`;
            }
        });
    // Profile picture preview
    const profileInput = document.getElementById('profile_picture');
    const profilePreview = document.getElementById('profilePreview');
    if (profileInput) {
        profileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (ev) {
                    profilePreview.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Manage Account AJAX submit
    const form = document.getElementById('manageAccountForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            console.debug('[manageAccount] submit event');
            const formData = new FormData(form);
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : getCookie('csrftoken');
            fetch('/update-account/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            })
            .then(async response => {
                const text = await response.text();
                try{
                    return JSON.parse(text);
                }catch(err){
                    console.error('[manageAccount] invalid JSON response', response.status, text);
                    throw new Error('Invalid server response');
                }
            })
            .then(data => {
                const feedback = document.getElementById('accountFeedback');
                if (data.success) {
                    console.debug('[manageAccount] update success', data);
                    // show success modal
                    showSuccessModal(data.message || 'Admin account updated successfully!');
                    // Dynamic tab update
                    if (data.username && data.profile_picture) {
                        document.getElementById('accountsLabel').textContent = data.username;
                        document.getElementById('accountsIcon').innerHTML = `<img src='data:image/png;base64,${data.profile_picture}' class='rounded-circle me-2' style='width:32px;height:32px;object-fit:cover;'>`;
                    }
                    setTimeout(() => {
                        // Force close modal and remove backdrop
                        var modalEl = document.getElementById('manageAccountsModal');
                        var modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                        document.body.classList.remove('modal-open');
                        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                        form.reset();
                        feedback.innerHTML = '';
                    }, 1500);
                } else {
                    console.warn('[manageAccount] update failed', data);
                    feedback.innerHTML = `<div class='alert alert-danger'>${data.error}</div>`;
                }
            })
            .catch((err) => {
                console.error('[manageAccount] submit error', err);
                document.getElementById('accountFeedback').innerHTML = `<div class='alert alert-danger'>Error updating account. See console for details.</div>`;
            });
        });
    }

    // Responder registration handlers
    const responderForm = document.getElementById('responderForm');
    const responderSubmit = document.getElementById('responderSubmit');
    const responderCancel = document.getElementById('responderCancel');
    const adminSaveBtn = document.getElementById('adminSaveBtn');
    if (responderSubmit && responderForm) {
        responderSubmit.addEventListener('click', function (e) {
            e.preventDefault();
            // Gather inputs from the responderForm div
            const fullname = document.getElementById('res_fullname').value.trim();
            const email = document.getElementById('res_email').value.trim();
            const password = document.getElementById('res_password').value;

            const feedback = document.getElementById('responderFeedback');
            feedback.innerHTML = '';

            if (!fullname || !email || !password) {
                feedback.innerHTML = `<div class='alert alert-danger'>All fields are required.</div>`;
                return;
            }

            const formData = new FormData();
            formData.append('fullname', fullname);
            formData.append('email', email);
            formData.append('password', password);

            responderSubmit.disabled = true;

            fetch('/register-responder/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json'
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                const feedback = document.getElementById('responderFeedback');
                if (data.success) {
                    // Immediately hide the manage modal (if open) and clear backdrops
                    var manageModalEl = document.getElementById('manageAccountsModal');
                    var manageModal = bootstrap.Modal.getInstance(manageModalEl);
                    if (manageModal) manageModal.hide();
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    document.body.classList.remove('modal-open');

                    // show success modal
                    showSuccessModal(data.message || 'Responder registered successfully!');
                    // clear inputs and inline feedback
                    document.getElementById('res_fullname').value = '';
                    document.getElementById('res_email').value = '';
                    document.getElementById('res_password').value = '';
                    feedback.innerHTML = '';
                } else {
                    showToast('Error', data.error || 'Registration failed', 'danger');
                    feedback.innerHTML = `<div class='alert alert-danger'>${data.error}</div>`;
                }
                responderSubmit.disabled = false;
            })
            .catch(() => {
                showToast('Error', 'Network error while registering responder.', 'danger');
                document.getElementById('responderFeedback').innerHTML = `<div class='alert alert-danger'>Error registering responder.</div>`;
                responderSubmit.disabled = false;
            });
        });
    }

    if (responderCancel) {
        responderCancel.addEventListener('click', function () {
            // Switch back to admin tab
            var adminTab = new bootstrap.Tab(document.getElementById('admin-tab'));
            adminTab.show();
        });
    }

    // Toggle visibility of Admin Save button depending on active tab
    const adminTabBtn = document.getElementById('admin-tab');
    const responderTabBtn = document.getElementById('responder-tab');
    function updateAdminSaveVisibility() {
        if (!adminSaveBtn) return;
        // If admin tab has 'active' class, show button
        const adminActive = adminTabBtn.classList.contains('active');
        adminSaveBtn.style.display = adminActive ? 'inline-block' : 'none';
    }

    // Ensure adminSaveBtn triggers form submit explicitly (fix for potential browser/JS timing issues)
    if (adminSaveBtn && form) {
        adminSaveBtn.addEventListener('click', function(e){
            // if button is type=submit this will already trigger; ensure form submission anyway
            // Disable constraint validation on inputs that are inside the hidden responder tab to avoid
            // the browser raising "An invalid form control is not focusable" when those inputs are required
            const responderInputs = document.querySelectorAll('#responderForm input');
            const oldConstraint = [];
            responderInputs.forEach((inp, idx) => {
                oldConstraint[idx] = inp.required;
                // temporarily turn off required so form.requestSubmit won't be blocked
                inp.required = false;
            });

            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            }

            // restore original required flags
            responderInputs.forEach((inp, idx) => {
                inp.required = !!oldConstraint[idx];
            });
        });
    }

    // Success modal helper
    function showSuccessModal(message){
        try{
            const textEl = document.getElementById('successMessageText');
            if(textEl) textEl.textContent = message || 'Success';
            const modalEl = document.getElementById('successMessageModal');

            // Ensure any parent modal (manageAccountsModal) is fully hidden before showing success
            const manageModalEl = document.getElementById('manageAccountsModal');
            try{
                const manageBs = bootstrap.Modal.getInstance(manageModalEl);
                if (manageBs) {
                    manageBs.hide();
                }
            }catch(e){ /* ignore if not present */ }

            // Force remove backdrop remnants before showing
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');

            // Ensure the success modal is displayed on top
            modalEl.style.zIndex = 20000;
            const bs = new bootstrap.Modal(modalEl, { keyboard: true, focus: true });
            bs.show();

            // Wire OK button to hide and clean up
            const ok = document.getElementById('successMessageOkBtn');
            if(ok){
                ok.onclick = function(){
                    try{ bs.hide(); }catch(e){}
                    // cleanup backdrop if any
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    document.body.classList.remove('modal-open');
                };
            }
        }catch(e){ console.warn('Failed to show success modal', e); }
    }
    // expose globally so other scripts (realtime notifications) can call this for quick user feedback
    try{ window.showSuccessModal = showSuccessModal; }catch(e){}

    // Initial toggle
    updateAdminSaveVisibility();

    // Listen for tab shown events
    if (adminTabBtn) {
        adminTabBtn.addEventListener('shown.bs.tab', updateAdminSaveVisibility);
    }
    if (responderTabBtn) {
        responderTabBtn.addEventListener('shown.bs.tab', updateAdminSaveVisibility);
    }

    // Toast helper
    function showToast(title, message, type) {
        // type: 'success' | 'danger' | 'info'
        const container = document.querySelector('.toast-container');
        if (!container) return;
        const toastId = 'toast-' + Date.now();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${type} border-0`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.id = toastId;
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${title}:</strong> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        container.appendChild(toastEl);
        const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
        bsToast.show();
        // remove element after hidden
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
});
// ...existing code...
