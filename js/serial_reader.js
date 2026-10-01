/* ============================================
   Web Serial API 串口读取器
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

    function parseLine(self, line) {
        if (!line || !self.onData) return;
        // Format: addr:XX dis:NNN azi:NNN
        var m = line.match(/addr:(\d+)\s+dis:(\d+(?:\.\d+)?)\s+azi:(\d+(?:\.\d+)?)/);
        if (m) {
            self.onData(parseInt(m[1]), parseFloat(m[2]), parseFloat(m[3]));
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
