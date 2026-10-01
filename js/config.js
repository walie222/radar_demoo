// ============================================
// 冒头大作战 - 指向联控版 配置
// ============================================

const PUBNUB = {
    subscribeKey: 'sub-c-486e9d60-f711-11ed-a5aa-123a5a76baa4',
    publishKey: 'pub-c-30ea27f9-14c2-48a0-98b5-b07eeb506b04'
};

const GAME = {
    shootWindow: 1,       // 冒头持续秒数
    rounds: 5,            // 总回合数
    hitScore: 10,         // 射击者命中得分
    missPenalty: -5,      // 射击者打空扣分
    popMin: 2000,         // 冒头间隔最小(ms)
    popMax: 5000          // 冒头间隔最大(ms)
};
