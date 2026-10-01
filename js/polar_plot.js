// ============================================
// 极坐标图渲染器 (Canvas)
// ============================================

class PolarPlot {
    constructor(canvasId, size = 360) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = size;
        this.canvas.height = size;
        this.size = size;
        this.cx = size / 2;
        this.cy = size / 2;
        this.maxRadius = size / 2 - 40;
        this.devices = [null, null, null]; // addr 1/2/3
        this.mode = 'coordinate'; // 'coordinate' | 'pointing'
        this.highlightIdx = -1;
    }

    updateDevice(addr, dis, azi) {
        if (addr >= 1 && addr <= 3) {
            this.devices[addr - 1] = { dis: Number(dis), azi: Number(azi) };
        }
    }

    render() {
        const { ctx, canvas, cx, cy, maxRadius, devices, mode, highlightIdx } = this;
        if (!ctx) return;

        // 背景
        ctx.fillStyle = '#f5f6fa';
        ctx.fillRect(0, 0, this.size, this.size);

        // 同心圆
        for (let r = 50; r <= 150; r += 50) {
            const radius = (r / 150) * maxRadius;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#dfe6e9';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#b2bec3';
            ctx.font = '10px sans-serif';
            ctx.fillText(r + 'm', cx + radius + 3, cy - 3);
        }

        // 方位线
        for (let a = 0; a < 360; a += 30) {
            const rad = (a - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rad) * maxRadius, cy + Math.sin(rad) * maxRadius);
            ctx.strokeStyle = a % 90 === 0 ? '#b2bec3' : '#ecf0f1';
            ctx.lineWidth = a % 90 === 0 ? 1.5 : 0.5;
            ctx.stroke();

            // 角度标签
            const lx = cx + Math.cos(rad) * (maxRadius + 18);
            const ly = cy + Math.sin(rad) * (maxRadius + 18);
            ctx.fillStyle = '#636e72';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(a + '°', lx, ly + 4);
        }

        // 设备点
        const colors = ['#e74c3c', '#3498db', '#2ecc71'];
        const labels = ['1号位', '2号位', '3号位'];
        devices.forEach((dev, i) => {
            if (!dev) return;
            const radius = (dev.dis / 150) * maxRadius;
            const rad = (dev.azi - 90) * Math.PI / 180;
            const x = cx + Math.cos(rad) * radius;
            const y = cy + Math.sin(rad) * radius;

            // 指向模式高亮
            if (mode === 'pointing' && i === highlightIdx) {
                ctx.beginPath();
                ctx.arc(x, y, 18, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
                ctx.fill();
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // 点
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = colors[i];
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 标签
            ctx.fillStyle = '#2d3436';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x, y - 14);
        });

        // 中心标记
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2d3436';
        ctx.fill();
    }

    switchToPointing(highlightIdx) {
        this.mode = 'pointing';
        this.highlightIdx = highlightIdx;
        this.render();
    }

    switchToCoordinate() {
        this.mode = 'coordinate';
        this.highlightIdx = -1;
        this.render();
    }
}
