

exports.rtcNS = (io) => {

  const rtcNS = io.of('/rtc');
  rtcNS.on('connection', (socket) => {
    console.log(`someone ${socket.client.id} connected to /rtc at ${new Date()}`);
  })
}

exports.collectionVersionsNS = require('./collection-versions');

