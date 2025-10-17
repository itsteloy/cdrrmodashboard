document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const table = document.getElementById('mainTable');
    
    if (!searchInput || !clearSearch || !table) return;
    
    searchInput.addEventListener('input', function() {
        filterTable(this.value.toLowerCase());
    });
    
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        filterTable('');
    });
    
    function filterTable(searchTerm) {
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const fullname = row.cells[0].textContent.toLowerCase();
            const description = row.cells[1].textContent.toLowerCase();
            const location = row.cells[2].textContent.toLowerCase();
            
            if (fullname.includes(searchTerm) || 
                description.includes(searchTerm) || 
                location.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
});