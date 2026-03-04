const http = require('http');
const net = require('net');
const fs = require('fs');
const url = require('url');

console.log("=========================================");
console.log("🛡️ Agent Portal Egress Interceptor v1 🛡️");
console.log("=========================================");

// 1. Read the developer's manifest securely
let declaredEndpoints = [];
try {
    const manifestRaw = fs.readFileSync('manifest.json', 'utf8');
    const manifest = JSON.parse(manifestRaw);
    declaredEndpoints = manifest.declared_endpoints || [];
    console.log(`📋 Loaded ${declaredEndpoints.length} authorized egress endpoints from manifest.json.`);
} catch (e) {
    console.error("❌ Failed to parse manifest.json. Ensure 'declared_endpoints' is an array.");
    process.exit(1);
}

// 2. The Transparent Proxy Server
const server = http.createServer((req, res) => {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Transparent Proxy enforces secure HTTPS. Standard unencrypted HTTP is completely blocked.\n');
});

// 3. The TLS TCP Tunnel (Forward Proxy mechanism)
server.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = url.parse(`//${req.url}`, false, true);

    // Core Check against the Manifest Allowlist
    let isAllowed = false;
    for (const allowedTarget of declaredEndpoints) {
        if (hostname === allowedTarget || hostname.endsWith(`.${allowedTarget}`)) {
            isAllowed = true;
            break;
        }
    }

    if (isAllowed || hostname === 'registry.npmjs.org' || hostname === 'registry.yarnpkg.com') { // NPM overrides
        console.log(`[VERIFIED_EGRESS] 🟢 Mathematical Trust Validated: -> ${hostname}:${port}`);

        const serverSocket = net.connect(port || 443, hostname, () => {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                'Proxy-agent: Agent-Portal-Interceptor\r\n' +
                '\r\n');
            serverSocket.write(head);
            serverSocket.pipe(clientSocket);
            clientSocket.pipe(serverSocket);
        });

        serverSocket.on('error', (err) => {
            console.error(`[SOCKET_ERR] ⚠️ Target Unreachable: ${hostname} ->`, err.message);
            clientSocket.end();
        });

        clientSocket.on('error', (err) => {
            serverSocket.end();
        });

    } else {
        // SECURITY BLOCK!
        console.error(`[ROGUE_EGRESS_DETECTED] 🛑 SECURITY HALT! Attempted to contact unauthorized external host: -> ${hostname}:${port}`);
        clientSocket.write('HTTP/1.1 403 Forbidden\r\n' +
            'Proxy-agent: Agent-Portal-Interceptor\r\n' +
            '\r\n');
        clientSocket.end();
    }
});

server.listen(8080, '127.0.0.1', () => {
    console.log("🔒 Egress Proxy successfully mounted on 127.0.0.1:8080.");
    console.log("-> Awaiting Agent TLS handshakes...");
});
