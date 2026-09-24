/**
 * INTELLIGENT LOG FORENSIC - SEVERITY BAR CHART
 * Custom Chart.js bar chart styled exclusively to cybersec dark token palette
 */

class SeverityBarChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.chart = null;
    this.init();
  }

  init() {
    const ctx = this.canvas.getContext('2d');

    // Cybersec gradient bar fills
    const criticalGrad = ctx.createLinearGradient(0, 0, 0, 240);
    criticalGrad.addColorStop(0, '#EF4444');
    criticalGrad.addColorStop(1, 'rgba(239, 68, 68, 0.2)');

    const highGrad = ctx.createLinearGradient(0, 0, 0, 240);
    highGrad.addColorStop(0, '#F97316');
    highGrad.addColorStop(1, 'rgba(249, 115, 22, 0.2)');

    const mediumGrad = ctx.createLinearGradient(0, 0, 0, 240);
    mediumGrad.addColorStop(0, '#EAB308');
    mediumGrad.addColorStop(1, 'rgba(234, 179, 8, 0.2)');

    const safeGrad = ctx.createLinearGradient(0, 0, 0, 240);
    safeGrad.addColorStop(0, '#22C55E');
    safeGrad.addColorStop(1, 'rgba(34, 197, 94, 0.2)');

    const data = {
      labels: ['Critical (L4)', 'High (L3)', 'Medium (L2)', 'Safe / Low (L1)'],
      datasets: [{
        label: 'Threat Count',
        data: [12, 19, 28, 65],
        backgroundColor: [criticalGrad, highGrad, mediumGrad, safeGrad],
        borderColor: ['#EF4444', '#F97316', '#EAB308', '#22C55E'],
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.6
      }]
    };

    const config = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#FFFFFF',
            borderColor: '#CBD5E1',
            borderWidth: 1,
            titleColor: '#0F172A',
            bodyColor: '#475569',
            titleFont: { family: 'Space Grotesk', weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#64748B',
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: '#F1F5F9' },
            ticks: {
              color: '#64748B',
              font: { family: 'JetBrains Mono', size: 11 },
              precision: 0
            },
            beginAtZero: true
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);

    // Subscribe to live telemetry updates
    if (window.eventBus) {
      window.eventBus.on('stats:updated', (stats) => {
        this.updateData(stats.severityCounts);
      });
    }
  }

  updateData(severityCounts) {
    if (!this.chart || !severityCounts) return;
    this.chart.data.datasets[0].data = [
      severityCounts.critical || 0,
      severityCounts.high || 0,
      severityCounts.medium || 0,
      severityCounts.safe || 0
    ];
    this.chart.update('none'); // Update smoothly without lag
  }
}

window.SeverityBarChart = SeverityBarChart;
