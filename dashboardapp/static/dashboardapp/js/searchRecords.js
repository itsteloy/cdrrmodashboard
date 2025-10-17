document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");
    const tableRows = document.querySelectorAll("#mainTable tbody tr:not(.details.row)");
    
    function searchTable(){
        const searchTerm = searchInput.value.toLowerCase();

        tableRows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            if (rowText.includes(searchTerm)) {
                row.style.display = "";
            } else {
                row.style.display = "none";       
                const detailsRow = row.nextElementSibling;
                if (detailsRow && detailsRow.classList.contains('details-row')) {
                    detailsRow.style.display = "none";
                }
            }
        
        })
    }

    function clearSearchFunction () {
        searchInput.value = "";
        
        tableRows.forEach(row => {
            row.style.display = "";

        })
    }
    searchInput.addEventListener("input", searchTable);
    clearSearch.addEventListener("click", clearSearchFunction);

    
})