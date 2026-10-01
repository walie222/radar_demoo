// ============================================
// 冒头大作战 - 指向联控版 核心逻辑
// ============================================

let G = {}; // 全局状态

const AVATARS = ['🐹', '🐰', '🐻', '🐼'];
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

// ---- 工具函数 ----
function uid() { return Math.random().toString(36).substr(2, 9); }
function genRoomId() { return Math.random().toString(36).substr(2, 6).toUpperCase(); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function now() { return Date.now(); }

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function showError(msg) {
    const ov = document.getElementById('error-overlay');
    if (ov) {
        const p = ov.querySelector('p');
        if (p) p.textContent = msg;
        ov.style.display = 'flex';
    }
}

// ---- 移动端检测 ----
function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

// ---- PubNub ----
let pubnub = null;
let channel = '';

function initPubNub(roomId) {
    channel = 'whackpt_' + roomId;
    pubnub = new PubNub({ subscribeKey: PUBNUB.subscribeKey, publishKey: PUBNUB.publishKey });
    pubnub.subscribe({ channels: [channel] });
    pubnub.addListener({ message: onMessage });
}

function send(type, data) {
    pubnub.publish({
        channel,
        message: { type, uid: G.uid, room: G.roomId, ...data },
        callback: () => {}
    });
}

// ---- 消息处理 ----
function onMessage(p) {
    const m = p.message;
    if (m.uid === G.uid) return; // 忽略自己的消息
    switch (m.type) {
        case 'join': onJoin(m); break;
        case 'pickphase': onPickPhase(m); break;
        case 'pick': onPick(m); break;
        case 'startgame': onStartGame(m); break;
        case 'pop': onPop(m); break;
        case 'shoot': onShoot(m); break;
        case 'roundend': onRoundEnd(m); break;
        case 'gameover': onGameOver(m); break;
    }
}

// ---- 玩家管理 ----
const players = {}; // uid -> {name, role, score}

function addPlayer(uid, name) {
    if (players[uid]) return;
    players[uid] = { uid, name, role: null, score: 0 };
    renderPlayers();
}

function removePlayer(uid) {
    delete players[uid];
    renderPlayers();
}

function getMolerNames() {
    return Object.values(players).filter(p => p.role && p.role.startsWith('moler')).map(p => p.name);
}

function renderPlayers() {
    const grid = document.getElementById('players-grid');
    if (!grid) return;
    const list = Object.values(players);
    grid.innerHTML = list.length < 4
        ? Array.from({length: 4}, (_, i) => {
            const p = list[i];
            return `<div class="player-card ${p ? 'filled' : ''}">
                <div class="avatar">${p ? AVATARS[i] : '?'}</div>
                <div class="name">${p ? p.name : '等待加入...'}</div>
                ${p && p.role ? `<span class="role-tag ${p.role.startsWith('moler') ? 'moler' : 'shooter'}">${p.role}</span>` : ''}
            </div>`;
        }).join('')
        : list.slice(0, 4).map((p, i) => `
            <div class="player-card filled">
                <div class="avatar">${AVATARS[i]}</div>
                <div class="name">${p.name}</div>
                ${p.role ? `<span class="role-tag ${p.role.startsWith('moler') ? 'moler' : 'shooter'}">${p.role}</span>` : ''}
            </div>`).join('');
}

// ---- 阶段1: 登录/创建房间 ----
function handleLogin() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { alert('请输入你的昵称！'); return; }
    const rid = document.getElementById('room-input').value.trim().toUpperCase();
    if (rid) { joinRoom(name, rid); } else { createRoom(name); }
}

function createRoom(name) {
    G.uid = uid();
    G.name = name;
    G.roomId = genRoomId();
    G.isHost = true;
    addPlayer(G.uid, G.name);
    initPubNub(G.roomId);
    send('join', { name: G.name });
    showScreen('waiting-screen');
    document.getElementById('host-name').textContent = G.name;
    document.getElementById('display-room-id').textContent = G.roomId;
    renderPlayers();
}

function joinRoom(name, roomId) {
    G.uid = uid();
    G.name = name;
    G.roomId = roomId;
    G.isHost = false;
    addPlayer(G.uid, G.name);
    initPubNub(roomId);
    send('join', { name: G.name });
    showScreen('waiting-screen');
    document.getElementById('host-name').textContent = '(房主未知)';
    document.getElementById('display-room-id').textContent = roomId;
    renderPlayers();
}

function onJoin(m) {
    addPlayer(m.uid, m.name);
    if (m.uid !== G.uid && !G.isHost) {
        document.getElementById('host-name').textContent = m.name;
    }
}

// ---- 阶段2: 角色选择 ----
const picks = {}; // uid -> role

function enterRoleSelect() {
    const list = Object.values(players);
    if (list.length < 2) { alert('至少需要2名玩家！'); return; }
    G.playerList = list;
    showScreen('role-select-screen');
    renderRolePicker();
    renderRolePlayers();
}

function renderRolePicker() {
    const picker = document.getElementById('role-picker');
    if (!picker) return;

    const roles = ['shooter', 'moler1', 'moler2', 'moler3'];
    const icons = { shooter: '🎯', moler1: '🐹', moler2: '🐰', moler3: '🐻' };
    const labels = { shooter: '射击者', moler1: '冒头者 1号位', moler2: '冒头者 2号位', moler3: '冒头者 3号位' };

    const mobile = isMobileDevice();
    const availableRoles = mobile ? roles.filter(r => r.startsWith('moler')) : roles;

    picker.innerHTML = availableRoles.map(r => {
        const takenBy = Object.entries(picks).find(([_, role]) => role === r);
        const isTaken = !!takenBy;
        const isMyPick = picks[G.uid] === r;
        const locked = mobile && r === 'shooter';

        let cls = 'role-btn';
        if (locked) cls += ' locked-role';
        else if (isMyPick) cls += ' my-pick';
        else if (isTaken) cls += ' taken';

        const takenName = Object.values(players).find(p => p.uid && picks[p.uid] === r)?.name || '他人';
        return `<button class="${cls}" onclick="pickRole('${r}')" ${isTaken || locked ? 'disabled' : ''}>
            <span class="role-btn-icon">${icons[r]}</span>
            <span class="role-btn-label">${labels[r]}</span>
            ${isMyPick ? '<span class="role-btn-status">✓ 已选</span>' : ''}
            ${isTaken && !isMyPick ? `<span class="role-btn-status" style="color:#00ff64">已被选 (${takenName})</span>` : ''}
        </button>`;
    }).join('');
}

function pickRole(role) {
    if (picks[G.uid]) return;
    const taken = Object.values(picks).includes(role);
    if (taken) return;
    picks[G.uid] = role;
    players[G.uid].role = role;
    send('pick', { role });
    renderRolePicker();
    renderRolePlayers();
}

function onPick(m) {
    picks[m.uid] = m.role;
    if (players[m.uid]) players[m.uid].role = m.role;
    renderRolePicker();
    renderRolePlayers();
}

function renderRolePlayers() {
    const container = document.getElementById('role-players-list');
    if (!container) return;
    const chips = Object.entries(picks).map(([uid, role]) => {
        const p = Object.values(players).find(pl => pl.uid === uid);
        const name = p ? p.name : '?';
        const label = role === 'shooter' ? '射击者' : role.replace('moler', '冒头者');
        return `<div class="role-player-chip"><span class="chip-role">${label}</span> ${name}</div>`;
    });
    container.innerHTML = chips.join('');
}

function startGameFromHost() {
    const playerCount = Object.keys(players).length;
    const pickedCount = Object.keys(picks).length;

    // 机器人填充
    const roles = ['shooter', 'moler1', 'moler2', 'moler3'];
    const humanPicks = new Set(Object.values(picks));
    const botIdx = [];
    for (let i = 0; i < 4; i++) {
        const pIdx = playerCount + i;
        if (pIdx < 4) botIdx.push(i);
    }

    let botNum = 0;
    roles.forEach(r => {
        if (!humanPicks.has(r)) {
            if (botNum < botIdx.length) {
                const bName = `机器人${botNum + 1}`;
                const bUid = 'bot_' + botNum;
                players[bUid] = { uid: bUid, name: bName, role: r, score: 0 };
                picks[bUid] = r;
                botNum++;
            }
        }
    });

    renderRolePicker();
    renderRolePlayers();

    // 发送开始信号
    const molerNames = getMolerNames();
    send('startgame', { molerNames, playerCount: Object.keys(players).length });
    showScreen('serial-connect-screen');
    setupSerialUI();
}

// ---- 阶段3: 串口连接（仅射击者） ----
let polarPlot = null;
let serialReader = null;
let pointingTarget = -1; // 当前指向的冒头者index

function setupSerialUI() {
    const myRole = players[G.uid]?.role;
    const isShooter = myRole === 'shooter';

    if (!isShooter) {
        // 非射击者直接跳过
        showScreen('game-screen');
        setupGameView();
        return;
    }

    // 初始化极坐标图
    polarPlot = new PolarPlot('polar-canvas');
    serialReader = new SerialReader();

    serialReader.onData = (addr, dis, azi) => {
        if (polarPlot) polarPlot.updateDevice(addr, dis, azi);
        if (polarPlot) polarPlot.render();
        updateLegend(addr, dis, azi);
    };

    serialReader.onError = (msg) => {
        console.error('Serial error:', msg);
    };

    document.getElementById('btn-connect').addEventListener('click', async () => {
        try {
            await serialReader.requestPort();
            document.getElementById('status-dot').className = 'status-dot on';
            document.getElementById('btn-disconnect').disabled = false;
            document.getElementById('btn-start-game').disabled = false;
            document.getElementById('mode-badge').className = 'mode-badge coordinate-mode';
            document.getElementById('mode-badge').textContent = '📍 坐标模式';
            document.getElementById('mode-desc').textContent = '设备定位中...';
            if (polarPlot) polarPlot.switchToCoordinate();

            serialReader.startReading();
        } catch (e) {
            alert('连接失败: ' + e.message);
        }
    });

    document.getElementById('btn-disconnect').addEventListener('click', async () => {
        await serialReader.close();
        document.getElementById('status-dot').className = 'status-dot off';
        document.getElementById('btn-disconnect').disabled = true;
        document.getElementById('btn-start-game').disabled = true;
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
        // 切换到指向模式并启动游戏
        determinePointingTarget();
        showScreen('game-screen');
        setupGameView();
    });
}

function updateLegend(addr, dis, azi) {
    const item = document.getElementById(`legend-${addr}`);
    if (item) {
        const dataEl = item.querySelector('.legend-data');
        if (dataEl) dataEl.textContent = `距离:${dis}m 方位:${azi}°`;
    }
}

function determinePointingTarget() {
    // 找到最接近0°方位角的设备
    if (!polarPlot || !polarPlot.devices) return -1;
    let bestIdx = -1;
    let bestDiff = Infinity;
    polarPlot.devices.forEach((dev, i) => {
        if (!dev) return;
        const diff = Math.min(Math.abs(dev.azi), 360 - Math.abs(dev.azi));
        if (diff < bestDiff && diff <= 10) {
            bestDiff = diff;
            bestIdx = i;
        }
    });
    pointingTarget = bestIdx;
    if (polarPlot) polarPlot.switchToPointing(bestIdx);
    return bestIdx;
}

// ---- 阶段4: 游戏 ----
let currentRound = 0;
let popTimer = null;
let popDeadline = 0;

function setupGameView() {
    const myRole = players[G.uid]?.role;
    const isShooter = myRole === 'shooter';
    const isMoler = myRole && myRole.startsWith('moler');

    document.getElementById('game-role').textContent = isShooter ? '🎯 射击者' : '🐹 冒头者';

    if (isShooter) setupShooterView();
    else setupMolerView();
}

// 射击者视图
function setupShooterView() {
    const arena = document.getElementById('shooter-view');
    if (!arena) return;

    const molers = Object.values(players).filter(p => p.role && p.role.startsWith('moler'));
    arena.innerHTML = `
        <div class="polar-mini-container">
            <canvas id="polar-canvas-game" width="360" height="360"></canvas>
            <div class="pointing-indicator">
                <span class="pointing-label">指向目标:</span>
                <span class="pointing-target" id="pointing-target-display">--</span>
            </div>
        </div>
        <div class="shooter-arena">
            ${molders.map((m, i) => { const slotNum = m.role.replace('moler', ''); return `
                <div class="slot disabled" id="slot-${slotNum}" onclick="doShoot(${slotNum})">
                    <div class="slot-number">${slotNum}</div>
                    <div class="slot-player">${m.name}</div>
                    <div class="slot-status">等待中</div>
                </div>`; }).join('')}
        </div>
        <div class="shooter-result" id="shooter-result"></div>
        <div class="score-board">
            <h3>📊 计分板</h3>
            ${Object.values(players).map(p => `
                <div class="score-item">
                    <span>${p.name} (${p.role})</span>
                    <span class="score-value" id="score-${p.uid}">${p.score}</span>
                </div>
            `).join('')}
        </div>
    `;

    // 复制极坐标数据到游戏画布
    if (polarPlot) {
        const gameCanvas = document.getElementById('polar-canvas-game');
        if (gameCanvas && polarPlot.canvas) {
            const ctx = gameCanvas.getContext('2d');
            ctx.drawImage(polarPlot.canvas, 0, 0);
        }
    }
}

function doShoot(slotIdx) {
    if (now() > popDeadline) {
        document.getElementById('shooter-result').innerHTML = '<span class="result-miss">⏰ 冒头已结束！</span>';
        return;
    }
    send('shoot', { slot: slotIdx });
}

// 冒头者视图
function setupMolerView() {
    const view = document.getElementById('moler-view');
    if (!view) return;
    view.innerHTML = `
        <div class="moler-status">
            <div class="state-badge waiting" id="moler-state">等待中...</div>
            <div class="countdown hidden" id="moler-countdown"></div>
        </div>
        <button class="btn-pop" id="btn-pop" onclick="doPop()" disabled>🐹 冒头！</button>
    `;
}

function doPop() {
    send('pop', {});
}

// ---- 游戏事件处理 ----
function onStartGame(m) {
    if (!G.isHost) {
        showScreen('serial-connect-screen');
        setupSerialUI();
    }
}

function onPop(m) {
    // 冒头者按下按钮 → 通知射击者
    const molerIdx = getPlayerMolerIndex(m.uid);
    if (molerIdx < 0) return;

    popDeadline = now() + GAME.shootWindow * 1000;
    send('pop', { slot: molerIdx, deadline: popDeadline });

    // 冒头者自身倒计时
    const btn = document.getElementById('btn-pop');
    if (btn) { btn.disabled = true; }
    const state = document.getElementById('moler-state');
    if (state) { state.className = 'state-badge popping'; state.textContent = '🔥 已冒头！'; }

    startPopCountdown(GAME.shootWindow);
}

function startPopCountdown(seconds) {
    const cd = document.getElementById('moler-countdown');
    if (!cd) return;
    cd.classList.remove('hidden');
    let remaining = seconds;
    cd.textContent = remaining;

    const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            cd.textContent = remaining;
        } else {
            clearInterval(interval);
            cd.classList.add('hidden');
            endPop();
        }
    }, 1000);
}

function endPop() {
    const state = document.getElementById('moler-state');
    if (state) { state.className = 'state-badge safe'; state.textContent = '✅ 安全'; }
    const btn = document.getElementById('btn-pop');
    if (btn) btn.disabled = false;
}

function onShoot(m) {
    // 射击者点击了某个槽位
    const slot = m.slot;
    const hit = (slot === pointingTarget);

    // 更新槽位视觉
    const slotEl = document.getElementById(`slot-${slot}`);
    if (slotEl) {
        slotEl.classList.add(hit ? 'hit-flash' : 'miss-flash');
        setTimeout(() => slotEl.classList.remove('hit-flash', 'miss-flash'), 600);
    }

    const resultEl = document.getElementById('shooter-result');
    if (resultEl) {
        if (hit) {
            resultEl.innerHTML = `<span class="result-hit">🎯 命中！+${GAME.hitScore}分</span>`;
            players[G.uid].score += GAME.hitScore;
        } else {
            resultEl.innerHTML = `<span class="result-miss">❌ 打空！${GAME.missPenalty}分</span>`;
            players[G.uid].score += GAME.missPenalty;
        }
    }

    // 冒头者侧显示结果
    const state = document.getElementById('moler-state');
    if (state && hit) {
        state.className = 'state-badge hit';
        state.textContent = '💥 被击中！';
    }

    updateScores();
}

function updateScores() {
    Object.values(players).forEach(p => {
        const el = document.getElementById(`score-${p.uid}`);
        if (el) el.textContent = p.score;
    });
}

function getPlayerMolerIndex(playerUid) {
    const molers = Object.values(players).filter(p => p.role && p.role.startsWith('moler'));
    return molers.findIndex(m => m.uid === playerUid);
}

function onRoundEnd(m) {}
function onGameOver(m) {}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
    showScreen('login-screen');
});
