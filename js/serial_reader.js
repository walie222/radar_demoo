/* ============================================
   Web Serial API 串口读取器 (修复增强版)
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
                // 确保 SERIAL 对象在全局可访问，设置默认波特率备用
                var baud = (typeof SERIAL !== 'undefined' && SERIAL.baudRate) ? SERIAL.baudRate : 9600;
                return port.open({ baudRate: baud });
            }).then(function() {
                resolve(true);
            }).catch(function(e) {
                if (self.onError) self.onError(e.message);
                reject(e);
            });
        });
    }

    function startReading(self) {
        if (!self.port || self.running) return;
        self.running = true;
        
        // 获取 reader 实例
        var transport = self.port.readable.getReader();
        self.reader = transport;
        var decoder = new TextDecoder();

        function readLoop() {
            if (!self.running) return;

            transport.read().then(function(result) {
                // 如果读取完成或主动关闭，安全释放流锁
                if (result.done) {
                    if (self.reader) {
                        self.reader.releaseLock();
                        self.reader = null;
                    }
                    return;
                }

                if (result.value) {
                    self.buffer += decoder.decode(result.value, { stream: true });
                    var lines = self.buffer.split(/\r?\n/); // 兼容 \r\n 和 \n
                    self.buffer = lines.pop(); // 最后一项是不完整的残帧，留回 buffer

                    for (var i = 0; i < lines.length; i++) {
                        parseLine(self, lines[i].trim());
                    }
                }

                if (self.running) {
                    readLoop();
                }
            }).catch(function(e) {
                // 设备异常拔出或流读取错误处理
                if (self.reader) {
                    try { self.reader.releaseLock(); } catch(err) {}
                    self.reader = null;
                }
                self.running = false;
                if (self.onError) self.onError('串口读取错误: ' + e.message);
            });
        }

        readLoop();
    }

    function parseLine(self, line) {
        if (!line || !self.onData) return;
        // Format: addr:XX dis:NNN azi:NNN
        var m = line.match(/addr:(\d+)\s+dis:(\d+(?:\.\d+)?)\s+azi:(\d+(?:\.\d+)?)/);
        if (m) {
            self.onData(parseInt(m[1], 10), parseFloat(m[2]), parseFloat(m[3]));
        }
    }

    function close(self) {
        return new Promise(function(resolve) {
            self.running = false;

            var cleanup = function() {
                if (self.port) {
                    self.port.close().then(function() {
                        self.port = null;
                        resolve(true);
                    }).catch(function(e) {
                        self.port = null;
                        resolve(false);
                    });
                } else {
                    resolve(true);
                }
            };

            if (self.reader) {
                // 取消读取流并释放锁
                self.reader.cancel().then(function() {
                    if (self.reader) {
                        try { self.reader.releaseLock(); } catch(e) {}
                        self.reader = null;
                    }
                    cleanup();
                }).catch(function() {
                    if (self.reader) {
                        try { self.reader.releaseLock(); } catch(e) {}
                        self.reader = null;
                    }
                    cleanup();
                });
            } else {
                cleanup();
            }
        });
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