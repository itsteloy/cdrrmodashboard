document.addEventListener("DOMContentLoaded", function () {
    const editButtons = document.querySelectorAll(".edit-btn");
    const editForm = document.getElementById("editForm");

    editButtons.forEach(button => {
        button.addEventListener("click", function () {
            // Set the document ID
            document.getElementById("edit_document_id").value = this.dataset.id;

            // Handle text fields
            const fields = [
                "patient_name",
                "reason_for_referral",
                "receiving_institution",
                "referring_institution",
                "endorsed_by",
                "endorsed_to",
                "remarks"
            ];

            fields.forEach(field => {
                const input = document.getElementById(field);
                if(input){
                    input.value = this.dataset[field] || "";
                }
            });

            // Handle checkbox fields - waiver and consent_to_care
            const checkboxFields = [
                "consent_to_care",
                "waiver"
            ];

            checkboxFields.forEach(field => {
                const value = this.dataset[field];
                const checkbox = document.getElementById(field);
                
                if (checkbox) {
                    // If the value is 'yes', check the checkbox
                    // If the value is 'no' or empty, uncheck it
                    checkbox.checked = (value === 'yes');
                }
            });

            // Update form action
            editForm.action = `/edit_referral_record/edit/${this.dataset.id}/`;
        });
    });
});