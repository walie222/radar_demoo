/* ============================================
   游戏配置
   ============================================ */

const CONFIG = {
    PUBNUB: {
        publishKey: 'pub-c-8f6fe818-ef2e-4122-9993-e790f721c8ea',
        subscribeKey: 'sub-c-632c8bc5-da75-4b54-af01-a18aae16138a',
    },

    GAME: {
        popUpDuration: 5,
        shootWindow: 1,
        totalGameTime: 300,
        roundCooldown: 2,
        maxPlayers: 4,
    },

    CHANNELS: {
        main: (roomCode) => `room-${roomCode}-main`,
        state: (roomCode) => `room-${roomCode}-state`,
    },
};

// ---- Serial config ----
var SERIAL = {
    baudRate: 115200,
    // Data format from devices: addr:XX dis:NNN azi:NNN
    // addr 01/02/03 maps to moler slot 1/2/3
};
