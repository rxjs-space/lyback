const jwt = require("jwt-simple"); 
const config = require('../config');

exports.rtcNS = (io) => {

  const rtcNS = io.of('/rtc');
  rtcNS.on('connection', (socket) => {
    console.log(`someone ${socket.client.id} connected to /rtc at ${new Date()}`);
  })
}


exports.collectionVersionsNS = (io) => {
  const collectionVersionsNS = io.of('/collectionVersions');
  collectionVersionsNS.use((socket, next) => {
    let token = socket.handshake.query.token;
    let isReconnect = socket.handshake.query.isReconnect;
    console.log('isReconnect:', isReconnect);

    let decoded = null;
    try {
      decoded = jwt.decode(token, config.jwtSecret);
    } catch(error) {
      switch (error) {
        case 'Signature verification failed':
          return next(new Error('authentication error: the jwt has been falsified'));
        case 'Token expired':
          return next(new Error('authentication error: the jwt has been expired'));
      }
    }

    console.log('decoded:', decoded);
    return next();

  })

  // 

  collectionVersionsNS.on('connection', (socket) => {
    // const roomId = socket.client.id;
    console.log(`${new Date()}: ${socket.client.id} connected to socket /collectionVersions`);
  })
}

