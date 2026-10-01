/* ============================================
   极坐标图渲染器 (Canvas)
   ============================================ */

var PolarPlot = (function() {
    function create(canvasId, size) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        var ctx = canvas.getContext('2d');
        size = size || 360;
        canvas.width = size;
        canvas.height = size;

        var self = {
            canvas: canvas,
            ctx: ctx,
            size: size,
            cx: size / 2,
            cy: size / 2,
            maxR: size / 2 - 40,
            devices: [null, null, null], // index 0=addr1, 1=addr2, 2=addr3
            mode: 'coordinate', // 'coordinate' | 'pointing'
            highlightIdx: -1,
        };

        self.updateDevice = function(addr, dis, azi) {
            if (addr >= 1 && addr <= 3) {
                self.devices[addr - 1] = { dis: Number(dis), azi: Number(azi) };
            }
        };

        self.getClosestToZero = function() {
            var best = -1, bestDiff = Infinity;
            for (var i = 0; i < 3; i++) {
                if (!self.devices[i]) continue;
                var diff = Math.abs(self.devices[i].azi);
                diff = Math.min(diff, 360 - diff);
                if (diff < bestDiff && diff <= 15) {
                    bestDiff = diff;
                    best = i;
                }
            }
            return best; // returns 0/1/2 or -1
        };

        self.render = function() {
            var c = ctx, s = size, cx = self.cx, cy = self.cy, mr = self.maxR;
            // Background
            c.fillStyle = '#f5f6fa';
            c.fillRect(0, 0, s, s);

            // Concentric circles
            for (var r = 50; r <= 150; r += 50) {
                var radius = (r / 150) * mr;
                c.beginPath();
                c.arc(cx, cy, radius, 0, Math.PI * 2);
                c.strokeStyle = '#dfe6e9';
                c.lineWidth = 1;
                c.stroke();
                c.fillStyle = '#b2bec3';
                c.font = '10px sans-serif';
                c.fillText(r + 'm', cx + radius + 3, cy - 3);
            }

            // Azimuth lines
            for (var a = 0; a < 360; a += 30) {
                var rad = (a - 90) * Math.PI / 180;
                c.beginPath();
                c.moveTo(cx, cy);
                c.lineTo(cx + Math.cos(rad) * mr, cy + Math.sin(rad) * mr);
                c.strokeStyle = a % 90 === 0 ? '#b2bec3' : '#ecf0f1';
                c.lineWidth = a % 90 === 0 ? 1.5 : 0.5;
                c.stroke();

                var lx = cx + Math.cos(rad) * (mr + 18);
                var ly = cy + Math.sin(rad) * (mr + 18);
                c.fillStyle = '#636e72';
                c.font = '11px sans-serif';
                c.textAlign = 'center';
                c.fillText(a + '°', lx, ly + 4);
            }

            // Device dots
            var colors = ['#e74c3c', '#3498db', '#2ecc71'];
            var labels = ['1号位', '2号位', '3号位'];
            for (var i = 0; i < 3; i++) {
                var dev = self.devices[i];
                if (!dev) continue;
                var dr = (dev.dis / 150) * mr;
                var drad = (dev.azi - 90) * Math.PI / 180;
                var dx = cx + Math.cos(drad) * dr;
                var dy = cy + Math.sin(drad) * dr;

                // Highlight in pointing mode
                if (self.mode === 'pointing' && i === self.highlightIdx) {
                    c.beginPath();
                    c.arc(dx, dy, 18, 0, Math.PI * 2);
                    c.fillStyle = 'rgba(255,215,0,0.25)';
                    c.fill();
                    c.strokeStyle = '#ffd700';
                    c.lineWidth = 3;
                    c.stroke();
                }

                c.beginPath();
                c.arc(dx, dy, 8, 0, Math.PI * 2);
                c.fillStyle = colors[i];
                c.fill();
                c.strokeStyle = '#fff';
                c.lineWidth = 2;
                c.stroke();

                c.fillStyle = '#2d3436';
                c.font = 'bold 11px sans-serif';
                c.textAlign = 'center';
                c.fillText(labels[i], dx, dy - 14);
            }

            // Center dot
            c.beginPath();
            c.arc(cx, cy, 4, 0, Math.PI * 2);
            c.fillStyle = '#2d3436';
            c.fill();
        };

        self.switchToPointing = function(idx) {
            self.mode = 'pointing';
            self.highlightIdx = idx;
            self.render();
        };

        self.switchToCoordinate = function() {
            self.mode = 'coordinate';
            self.highlightIdx = -1;
            self.render();
        };

        self.copyTo = function(targetCanvasId) {
            var tc = document.getElementById(targetCanvasId);
            if (!tc) return;
            var tctx = tc.getContext('2d');
            tc.width = size;
            tc.height = size;
            tctx.drawImage(canvas, 0, 0);
        };

        // Initial render
        self.render();
        return self;
    }

    return { create: create };
})();
