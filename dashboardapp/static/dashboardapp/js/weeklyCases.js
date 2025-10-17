document.addEventListener("DOMContentLoaded", function() {
    const monthSelector = document.getElementById('monthSelector');
    const monthNameSpan = document.getElementById('selectedMonthName');

    // ✅ Function to update month name in the title
    function updateMonthName() {
        const selectedMonthText = monthSelector.options[monthSelector.selectedIndex].text;
        monthNameSpan.textContent = selectedMonthText;
    }

    // ✅ Call immediately on page load
    updateMonthName();

    const ctxWeekly = document.getElementById('weeklyCasesChart').getContext('2d');
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];

    const emergencyData = JSON.parse(document.getElementById('weeklyCasesChart').dataset.emergency);
    const reportData = JSON.parse(document.getElementById('weeklyCasesChart').dataset.reports);

    // ✅ Store chart in a variable so we can update later
    window.weeklyCasesChart = new Chart(ctxWeekly, {
        type: 'bar',
        data: {
            labels: weeks,
            datasets: [
                {
                    label: 'Emergency Records',
                    data: emergencyData,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                },
                {
                    label: 'Resident Reports',
                    data: reportData,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { 
                    position: 'top',
                    labels: {
                        font: {
                            size: 14
                        }
                    }
                },
                title: { 
                    display: true, 
                    text: 'Weekly Cases Overview',
                    font: {
                        size: 15
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Cases'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Weeks'
                    }
                }
            }
        }
    });

    // ✅ Dropdown change event
    monthSelector.addEventListener('change', function() {
        updateMonthName(); // Update title month name

        const selectedMonth = this.value;
        fetch(`/get_weekly_cases_ajax?month=${selectedMonth}`)
            .then(response => response.json())
            .then(data => {
                try {
                    weeklyCasesChart.data.datasets[0].data = data.emergency_form;
                    weeklyCasesChart.data.datasets[1].data = data.resident_reports;
                    weeklyCasesChart.update();
                } catch (error) {
                    console.error('Error updating chart:', error);
                }
            })
            .catch(error => {
                console.error('Error fetching weekly cases:', error);
            });
    });
});
