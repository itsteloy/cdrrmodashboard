document.addEventListener("DOMContentLoaded", function () {
    
    const editButtons = document.querySelectorAll(".edit-btn");
    const editForm = document.getElementById("editForm");
    let otherValue = '';

    // Update dropdown button
    function updateDropdownButton(dropdownId, checkboxesName) {
        const button = document.getElementById(dropdownId);
        const checkboxes = document.querySelectorAll(`input[name="${checkboxesName}"]:checked`);
        
        if (checkboxesName === 'treatments_given') {
            otherValue = document.getElementById("other_treatment").value.trim();
        
        } else if (checkboxesName === 'equipment_used') {
            otherValue = document.getElementById("other_equipment").value.trim();
        
        }

        const totalSelected = checkboxes.length + (otherValue ? 1 : 0)

        if (totalSelected === 0){
            button.textContent = `Select ${checkboxesName.replace('_', ' ')}`;
        } else {
            button.textContent = `${totalSelected} selected`;
        
        }
    }

    //Other treatment and equipment handling
    editForm.addEventListener("submit", function (e) {

        const otherTreatment = document.getElementById("other_treatment").value.trim();
        if (otherTreatment){

            document.querySelectorAll(`input[name="treatments_given"] [type = "hidden]`).forEach(el => {
                el.remove();
            });

            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'treatments_given';
            hiddenInput.value = otherTreatment;
            this.appendChild(hiddenInput);
        }

        const otherEquipment = document.getElementById("other_equipment").value.trim();
        if (otherEquipment) {

            document.querySelectorAll(`input[name="equipment_used"] [type = "hidden]`).forEach(el => {
                el.remove();
            });

            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'equipment_used';
            hiddenInput.value = otherEquipment;
            this.appendChild(hiddenInput);
        }
    })

    // Initialize dropdowns
    document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });

    // Handle checkbox changes to update dropdown button text
    document.querySelectorAll('input[name="treatments_given"], input[name="equipment_used"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            let dropdownId;
            if (this.name === 'treatments_given') {
                dropdownId = 'treatmentsDropdown';
            } else if (this.name === 'equipment_used') {
                dropdownId = 'equipmentDropdown';
            }
            updateDropdownButton(dropdownId, this.name);
        });
    });

    editButtons.forEach(button => {
        button.addEventListener("click", function () {

            console.log("Noted By:", this.dataset.noted_by); 
            // Set document ID
            document.getElementById("edit_document_id").value = this.dataset.id;
            
            // Fill text, number, date, and select fields
            const fields = [
                "patient_name", "age", "chief_complaint", "date_of_incident",
                "pickup_point", "date_of_birth", "contact_number", "barangay",
                "other_medical_history", "systolic_bp", "diastolic_bp", "pulse_rate",
                "respiratory_rate", "left_pupil_size", "right_pupil_size", "eye_score",
                "verbal_score", "motor_score", "appearance_observation",
                "bloodloss_observation", "capillary_refill_time", "temperature",
                "remarks", "destination", "reason_for_referral", "receiving_institution",
                "transferring_institution", "endorsed_by", "endorsed_to", "responding_unit",
                "team_leader", "team_member", "team_operator", "incident_number",
                "device_id", "purok", "pulse_ox", "medications", "treatments_given",
                "equipment_used", "consent_to_care", "waiver", "nature_of_call", "other_treatment",
                "other_equipment", "noted_by"
            ];

            // Handle text fields
            fields.forEach(field => {
                const input = document.getElementById(field);
                if (input) {
                    input.value = this.dataset[field] || "";
                }
            });

            // Handle array fields (treatments_given and equipment_used)
            const arrayFields = [
                { name: "treatments_given", dropdownId: "treatmentsDropdown" },
                { name: "equipment_used", dropdownId: "equipmentDropdown" }
            ];
            arrayFields.forEach(field => {
                try {
                    const values = JSON.parse(this.dataset[field.name].replace(/'/g, '"'));
                    if (Array.isArray(values)) {
                        document.querySelectorAll(`input[name="${field.name}"]`).forEach(checkbox => {
                            checkbox.checked = false;
                        });
                        
                        // Check the ones that match
                        values.forEach(value => {
                            const checkbox = document.querySelector(`input[name="${field.name}"][value="${value}"]`);
                            if (checkbox) {
                                checkbox.checked = true;
                            } else {
                                if (field.name === "treatments_given"){
                                    document.getElementById("other_treatment").value = value;
                                } else if (field.name === "equipment_used"){
                                    document.getElementById("other_equipment").value = value;
                                }
                            }
                        });
                        
                        // Update dropdown button text
                        updateDropdownButton(field.dropdownId, field.name);
                    }
                } catch (e) {
                    console.error(`Error parsing ${field.name}:`, e);
                }
            });

            // Set Radio Buttons
            const radioFields = [
                "sex", "nature_of_call", "allergy_status", "asthma_status",
                "diabetes_status", "hypertension_status", "seizures_status",
                "left_pupil_reaction", "right_pupil_reaction"
            ];
            radioFields.forEach(field => {
                const value = this.dataset[field];
                if (value) {
                    const radio = document.querySelector(`input[name="${field}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                }
            });

            // Set Checkboxes (comma-separated values)
            const checkboxFields = ["consent_to_care", "waiver"];
            checkboxFields.forEach(field => {
                const value = this.dataset[field];
                if (value) {
                    const selectedValues = value.split(",").map(v => v.trim());
                    document.querySelectorAll(`input[name="${field}"]`).forEach(checkbox => {
                        checkbox.checked = selectedValues.includes(checkbox.value);
                    });
                } else {
                    document.querySelectorAll(`input[name="${field}"]`).forEach(checkbox => {
                        checkbox.checked = false;
                    });
                }
            });

            // Set dropdown values
            const selectFields = ["barangay", "appearance_observation", "bloodloss_observation", "capillary_refill_time"];
            selectFields.forEach(field => {
                const select = document.getElementById(field);
                if (select) {
                    select.value = this.dataset[field] || "";
                }
            });

            // Auto-calculate GCS Total
            const eye = document.getElementById("eye_score");
            const verbal = document.getElementById("verbal_score");
            const motor = document.getElementById("motor_score");
            const gcsTotal = document.getElementById("gcs_total");

            function updateGCSTotal() {
                const e = parseInt(eye.value) || 0;
                const v = parseInt(verbal.value) || 0;
                const m = parseInt(motor.value) || 0;
                gcsTotal.value = e + v + m;
            }

            [eye, verbal, motor].forEach(input => {
                input.addEventListener("input", updateGCSTotal);
            });

            // Initial GCS calculation
            updateGCSTotal();

            // Set form action
            editForm.action = `/edit_emergency_record/edit/${this.dataset.id}/`;
        });
    });

    // Initialize dropdown buttons text
    document.getElementById('other_treatment').addEventListener('input', function(){
        updateDropdownButton('treatmentsDropdown', 'treatments_given');
    
    })
    document.getElementById('other_equipment').addEventListener('input', function(){
        updateDropdownButton('equipmentDropdown', 'equipment_used');
    })

});