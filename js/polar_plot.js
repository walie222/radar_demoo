/* ============================================
   极坐标图渲染器 (Canvas)
   对齐 point_demo_test.py 的半圆极坐标显示逻辑：
   - azi 原始值需除以 AZI_TO_DEG(100) 转为角度
   - 只显示 ±90° 范围内的数据点
   - 动态距离刻度（根据最大数据自动扩展）
   - 半圆扇形 + 径向线 + 同心圆弧
   ============================================ */

// ---- 常量 (与 point_demo_test.py 保持一致) ----
var AZI_TO_DEG = 100.0;
var MAX_DISPLAY_AZI = 90;
var DEFAULT_MAX_DIS = 1000;
var SCALE_MARGIN_FACTOR = 1.2;
var SCALE_STEP = 200;
var RADIAL_STEP_DEG = 30;
var POLAR_OFFSET_DEG = 90; // 方位角→屏幕角度偏移 (0°指向正上方)

// 配色
var DEVICE_COLORS_WEB = ['#e67e22', '#2980b9', '#8e44ad'];
var DEVICE_LABELS_WEB = ['设备1', '设备2', '设备3'];
var HIGHLIGHT_COLOR = '#00e676';

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
            cy: size * 0.85,          // 圆心纵坐标占画布 85%（底部）
            maxR: 0,                   // 将在 render 中计算
            devices: [null, null, null], // index 0=addr1, 1=addr2, 2=addr3
            mode: 'coordinate',       // 'coordinate' | 'pointing'
            highlightIdx: -1,
            gameCtx: null,            // 游戏界面的第二个 canvas
        };

        /**
         * 更新设备数据
         * @param {number} addr - 设备序号 1/2/3
         * @param {number} dis  - 距离 (mm, 原始串口值)
         * @param {number} azi  - 角度 (centi-degrees, 原始串口值, 需除以100)
         */
        self.updateDevice = function(addr, dis, azi) {
            if (addr >= 1 && addr <= 3) {
                self.devices[addr - 1] = { dis: Number(dis), azi: Number(azi) };
            }
        };

        /**
         * 计算当前 best_idx (指向判定)
         * 逻辑与 point_demo_test.py get_highlight_index() 一致
         * 返回 0/1/2 或 -1(NO_HIGHLIGHT)
         */
        self.getClosestToZero = function() {
            var validAvgs = {};
            for (var i = 0; i < 3; i++) {
                var dev = self.devices[i];
                if (!dev || dev.dis <= 0) continue;
                var deg = Math.abs(dev.azi / AZI_TO_DEG);
                if (deg > MAX_DISPLAY_AZI) continue;
                validAvgs[i] = dev.azi; // raw centi-degree
            }

            var keys = Object.keys(validAvgs);
            if (keys.length < 1) return -1;

            // 找到角度最接近 0 的设备
            var bestIdx = -1;
            var bestAbs = Infinity;
            for (var k in validAvgs) {
                var absVal = Math.abs(validAvgs[k]);
                if (absVal < bestAbs) {
                    bestAbs = absVal;
                    bestIdx = parseInt(k);
                }
            }

            // 稳定性判定: 角度均值在 ±10° 内
            var bestAziDeg = validAvgs[bestIdx];
            var POINTING_AZI_LIMIT = 1000;   // ±10° (centi-degrees)
            var POINTING_STABLE_RANGE = 1000; // 窗口内极差上限

            if (Math.abs(bestAziDeg) <= POINTING_AZI_LIMIT) {
                return bestIdx;
            }
            return -1;
        };

        self.render = function() {
            _draw(ctx);
            if (self.gameCtx) {
                _draw(self.gameCtx);
            }
        };

        function _draw(c) {
            var s = self.size;
            var cx = self.cx;
            var cy = self.cy;

            // 计算可用半径
            var angleLabelMargin = 40;
            var radius = Math.min(s / 2 - angleLabelMargin, cy - angleLabelMargin);
            if (radius < 50) radius = 50;
            self.maxR = radius;

            // ---- 动态距离刻度 ----
            var maxDis = 0;
            for (var di = 0; di < 3; di++) {
                var d = self.devices[di];
                if (d && d.dis > 0) {
                    var dDeg = Math.abs(d.azi / AZI_TO_DEG);
                    if (dDeg <= MAX_DISPLAY_AZI && d.dis > maxDis) {
                        maxDis = d.dis;
                    }
                }
            }
            if (maxDis <= 0) maxDis = DEFAULT_MAX_DIS;
            var maxScale = maxDis * SCALE_MARGIN_FACTOR;
            maxScale = Math.ceil(maxScale / SCALE_STEP) * SCALE_STEP;

            // ---- 背景 ----
            c.fillStyle = '#f5f6fa';
            c.fillRect(0, 0, s, s);

            // ---- 半圆外框 ----
            c.beginPath();
            c.arc(cx, cy, radius, Math.PI, 0, false); // 上半圆
            c.strokeStyle = '#94a3b8';
            c.lineWidth = 2;
            c.stroke();
            // 底边
            c.beginPath();
            c.moveTo(cx - radius, cy);
            c.lineTo(cx + radius, cy);
            c.stroke();

            // ---- 同心圆弧 (虚线) ----
            for (var r = SCALE_STEP; r <= maxScale; r += SCALE_STEP) {
                var cr = radius * r / maxScale;
                c.beginPath();
                c.arc(cx, cy, cr, Math.PI, 0, false);
                c.strokeStyle = '#cbd5e1';
                c.lineWidth = 1;
                c.setLineDash([4, 4]);
                c.stroke();
                c.setLineDash([]);
                // 刻度标签
                c.fillStyle = '#b2bec3';
                c.font = '10px sans-serif';
                c.textAlign = 'left';
                c.fillText(r + 'mm', cx - cr + 3, cy - 3);
            }

            // ---- 径向线 ----
            for (var a = -MAX_DISPLAY_AZI; a <= MAX_DISPLAY_AZI; a += RADIAL_STEP_DEG) {
                var rad = (POLAR_OFFSET_DEG - a) * Math.PI / 180;
                var ex = cx + radius * Math.cos(rad);
                var ey = cy - radius * Math.sin(rad);

                if (a === -MAX_DISPLAY_AZI || a === MAX_DISPLAY_AZI) {
                    c.strokeStyle = '#94a3b8';
                    c.lineWidth = 1.5;
                    c.setLineDash([]);
                } else if (a === 0) {
                    c.strokeStyle = '#94a3b8';
                    c.lineWidth = 1;
                    c.setLineDash([4, 4]);
                } else {
                    c.strokeStyle = '#e2e8f0';
                    c.lineWidth = 1;
                    c.setLineDash([4, 4]);
                }
                c.beginPath();
                c.moveTo(cx, cy);
                c.lineTo(ex, ey);
                c.stroke();
                c.setLineDash([]);

                // 角度标注
                var labelOffset = 22;
                var lx = cx + (radius + labelOffset) * Math.cos(rad);
                var ly = cy - (radius + labelOffset) * Math.sin(rad);
                c.fillStyle = '#475569';
                c.font = '11px Microsoft YaHei, sans-serif';
                c.textAlign = 'center';
                c.fillText(a + '°', lx, ly + 4);
            }

            // ---- 中心点 ----
            c.beginPath();
            c.arc(cx, cy, 4, 0, Math.PI * 2);
            c.fillStyle = '#64748b';
            c.fill();

            // ---- 数据点 ----
            for (var i = 0; i < 3; i++) {
                var dev = self.devices[i];
                if (!dev || dev.dis <= 0) continue;

                var aziDeg = dev.azi / AZI_TO_DEG;
                if (Math.abs(aziDeg) > MAX_DISPLAY_AZI) continue;

                var pr = radius * Math.min(dev.dis, maxScale) / maxScale;
                var angleRad = (POLAR_OFFSET_DEG - aziDeg) * Math.PI / 180;
                var px = cx + pr * Math.cos(angleRad);
                var py = cy - pr * Math.sin(angleRad);

                // 连接线 (虚线)
                var connColor = DEVICE_COLORS_WEB[i];
                c.beginPath();
                c.moveTo(cx, cy);
                c.lineTo(px, py);
                c.strokeStyle = connColor;
                c.globalAlpha = 0.45;
                c.lineWidth = 1.2;
                c.setLineDash([3, 3]);
                c.stroke();
                c.setLineDash([]);
                c.globalAlpha = 1.0;

                // 高亮外发光
                if (self.mode === 'pointing' && i === self.highlightIdx) {
                    c.beginPath();
                    c.arc(px, py, 18, 0, Math.PI * 2);
                    c.fillStyle = 'rgba(0, 230, 118, 0.3)';
                    c.fill();
                    c.strokeStyle = HIGHLIGHT_COLOR;
                    c.lineWidth = 3;
                    c.stroke();
                }

                // 外发光 (普通)
                c.beginPath();
                c.arc(px, py, 16, 0, Math.PI * 2);
                c.fillStyle = connColor.replace(')', ',0.18)').replace('rgb', 'rgba');
                // Fallback hex → rgba
                var hex = DEVICE_COLORS_WEB[i];
                var rr = parseInt(hex.slice(1,3),16);
                var gg = parseInt(hex.slice(3,5),16);
                var bb = parseInt(hex.slice(5,7),16);
                c.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',0.18)';
                c.fill();

                // 实心圆点
                c.beginPath();
                c.arc(px, py, 7, 0, Math.PI * 2);
                c.fillStyle = connColor;
                c.fill();
                c.strokeStyle = '#ffffff';
                c.lineWidth = 2;
                c.stroke();

                // 标签
                c.fillStyle = '#2d3436';
                c.font = 'bold 11px Microsoft YaHei, sans-serif';
                c.textAlign = 'center';
                c.fillText(DEVICE_LABELS_WEB[i], px, py - 14);
            }
        }

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
            self.gameCanvas = tc;
            self.gameCtx = tc.getContext('2d');
            tc.width = self.size;
            tc.height = self.size;
            self.render();
        };

        // 初始渲染
        self.render();
        return self;
    }

    return { create: create };
})();
