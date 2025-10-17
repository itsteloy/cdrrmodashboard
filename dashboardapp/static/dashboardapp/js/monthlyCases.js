document.addEventListener("DOMContentLoaded", function () {
    // Monthly Cases Chart
    const canvas = document.getElementById('monthlyCasesChart');
    if (canvas) {
        try {
            const ctx = canvas.getContext('2d');
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                           'August', 'September', 'October', 'November', 'December'];

            const emergencyData = JSON.parse(canvas.dataset.emergency);
            const reportData = JSON.parse(canvas.dataset.reports);

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Emergency Records',
                            data: emergencyData,
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Resident Reports',
                            data: reportData,
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        },
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
                            text: 'Monthly Overview Cases',
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
                                text: 'Months'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating monthly cases chart:', error);
        }
    }

    // Toggle button functionality
    const toggleBtn = document.getElementById('toggleAveragesBtn');
    const monthlyAveragesSection = document.getElementById('monthlyAveragesSection');
    
    if (toggleBtn && monthlyAveragesSection) {
        toggleBtn.addEventListener('click', function () {
            if (monthlyAveragesSection.style.display === 'none') {
                monthlyAveragesSection.style.display = 'flex';
                toggleBtn.textContent = 'Hide Monthly Averages';
            } else {
                monthlyAveragesSection.style.display = 'none';
                toggleBtn.textContent = 'Show Monthly Averages';
            }
        });
    }
});