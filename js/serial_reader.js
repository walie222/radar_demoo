// ============================================
// Web Serial API 串口读取器
// ============================================

class SerialReader {
    constructor() {
        this.port = null;
        this.reader = null;
        this.decoder = new TextDecoder();
        this.onData = null;     // (addr, dis, azi) => void
        this.onError = null;   // (msg) => void
        this.running = false;
        this.buffer = '';
    }

    async requestPort() {
        if (!navigator.serial) {
            throw new Error('浏览器不支持 Web Serial API，请使用 Chrome/Edge');
        }
        try {
            this.port = await navigator.serial.requestPort({});
            await this.port.open({ baudRate: 115200 });
            return true;
        } catch (e) {
            if (this.onError) this.onError(e.message);
            throw e;
        }
    }

    async startReading() {
        if (!this.port) return;
        this.running = true;
        const transport = this.port.readable.getReader();
        this.reader = transport;

        while (this.running && this.port.readable) {
            try {
                const { value, done } = await this.reader.read();
                if (done) break;
                this.buffer += this.decoder.decode(value, { stream: true });

                // 按行解析
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop(); // 保留不完整的最后一行

                for (const line of lines) {
                    this.parseLine(line.trim());
                }
            } catch (e) {
                if (this.onError) this.onError(e.message);
                break;
            }
        }
    }

    parseLine(line) {
        if (!line) return;
        // 格式: addr:XX dis:NNN azi:NNN
        const match = line.match(/addr:(\d+)\s+dis:(\d+(?:\.\d+)?)\s+azi:(\d+(?:\.\d+)?)/);
        if (match && this.onData) {
            const addr = parseInt(match[1]);
            const dis = parseFloat(match[2]);
            const azi = parseFloat(match[3]);
            this.onData(addr, dis, azi);
        }
    }

    async close() {
        this.running = false;
        if (this.reader) {
            try { await this.reader.cancel(); } catch (_) {}
            this.reader = null;
        }
        if (this.port) {
            try { await this.port.close(); } catch (_) {}
            this.port = null;
        }
    }

    isConnected() {
        return this.port !== null && this.running;
    }
}
