document.addEventListener("DOMContentLoaded", function () {
    
        const referralCanvas = document.getElementById('monthlyReferralChart');
    if (referralCanvas) {
        try {
            console.log('Attempting to create referral chart...');
            
            const referralCtx = referralCanvas.getContext('2d');
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                        'August', 'September', 'October', 'November', 'December'];

            // FIX: Use proper JSON parsing
            const referralDataStr = referralCanvas.getAttribute('data-referral');
            console.log('Raw data attribute:', referralDataStr);
            
            const referralData = JSON.parse(referralDataStr);
            console.log('Parsed referral data:', referralData);

            new Chart(referralCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Referral Cases',
                            data: referralData,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2
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
                            text: 'Monthly Referral Cases',
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
            
            console.log('Referral chart created successfully!');
            
        } catch (error) {
            console.error('Error creating referral chart:', error);
        }
    } else {
        console.error('Referral referralCanvas not found!');
    }
})