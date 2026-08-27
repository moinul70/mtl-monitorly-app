const http = require('http');
const router = require('./router');


const server = http.createServer((req, res) => {
    router(req, res);
});

const LISTEN_PORT = process.env.PORT || 3000;
const LISTEN_IP = process.env.HOST || 'localhost';  // default localhost
server.listen(LISTEN_PORT, LISTEN_IP, () => {
  console.log(`Server running on port ${LISTEN_IP}:${LISTEN_PORT}`);
});