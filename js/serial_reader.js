/* ============================================
   Web Serial API 串口读取器
   数据格式对齐 point_demo_test.py:
     addr:([0-9a-zA-Z]+).*dis:([-\d]+).*azi:([-\d]+)
   addr 为十六进制(如 01/02/03), dis/azi 可为负数
   ============================================ */

var SerialReader = (function() {
    function create() {
        return {
            port: null,
            reader: null,
            running: false,
            buffer: '',
            onData: null,  // callback(addr, dis, azi)
            onError: null, // callback(msg)
        };
    }

    function requestPort(self) {
        return new Promise(function(resolve, reject) {
            if (!navigator.serial) {
                var err = new Error('浏览器不支持 Web Serial API，请使用 Chrome/Edge');
                if (self.onError) self.onError(err.message);
                reject(err);
                return;
            }
            navigator.serial.requestPort({}).then(function(port) {
                self.port = port;
                return port.open({ baudRate: SERIAL.baudRate });
            }).then(function() {
                resolve(true);
            }).catch(function(e) {
                if (self.onError) self.onError(e.message);
                reject(e);
            });
        });
    }

    function startReading(self) {
        if (!self.port) return;
        self.running = true;
        var transport = self.port.readable.getReader();
        self.reader = transport;
        var decoder = new TextDecoder();

        function readLoop() {
            if (!self.running || !self.port) return;
            transport.read().then(function(result) {
                if (!self.running) return;
                if (result.done) return;
                self.buffer += decoder.decode(result.value, { stream: true });

                var lines = self.buffer.split('\n');
                self.buffer = lines.pop();

                for (var i = 0; i < lines.length; i++) {
                    parseLine(self, lines[i].trim());
                }

                readLoop();
            }).catch(function(e) {
                if (self.onError) self.onError(e.message);
            });
        }
        readLoop();
    }

    /**
     * 解析一行串口数据，正则与 point_demo_test.py 保持一致：
     *   addr:([0-9a-zA-Z]+).*dis:([-\d]+).*azi:([-\d]+)
     * 
     * 示例: "addr:01 dis:500 azi:200"  → addr="01", dis=500, azi=200
     * 示例: "addr:02 dis:-100 azi:-350" → addr="02", dis=-100, azi=-350
     */
    function parseLine(self, line) {
        if (!line || !self.onData) return;
        var m = line.match(/addr:([0-9a-zA-Z]+).*dis:([-\d]+).*azi:([-\d]+)/);
        if (m) {
            var rawAddr = m[1];
            var dis = parseInt(m[2], 10);
            var azi = parseInt(m[3], 10);

            // 将十六进制地址转为十进制序号 (01→1, 02→2, 03→3)
            var addrNum = parseInt(rawAddr, 16);
            if (isNaN(addrNum)) addrNum = parseInt(rawAddr, 10);

            console.log('[SERIAL] Parsed addr=' + addrNum + ' dis=' + dis + ' azi=' + azi);
            self.onData(addrNum, dis, azi);
        } else {
            // 打印无法解析的行便于调试
            console.warn('[SERIAL] Unparsed line:', line);
        }
    }

    function close(self) {
        return new Promise(function(resolve) {
            self.running = false;
            if (self.reader) {
                self.reader.cancel().catch(function(){}).then(function() {
                    self.reader = null;
                    doClose(self);
                });
            } else {
                doClose(self);
            }
        });
    }

    function doClose(self) {
        if (self.port) {
            self.port.close().catch(function(){}).then(function() {
                self.port = null;
            });
        }
    }

    function isConnected(self) {
        return self.port !== null && self.running;
    }

    return {
        create: create,
        requestPort: requestPort,
        startReading: startReading,
        close: close,
        isConnected: isConnected,
    };
})();
