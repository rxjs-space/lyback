const jwt = require("jwt-simple");
const co = require('co');
const config = require('../config');
const dbX = require('../db');
const coForEach = require('co-foreach');



module.exports = (io) => {
  const collectionVersionsNS = io.of('/collectionVersions');
  collectionVersionsNS.use((socket, next) => {
    let token = socket.handshake.query.token;
    // let isReconnect = socket.handshake.query.isReconnect;
    // console.log('isReconnect:', isReconnect);

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
    socket.on('clientCollectionVersions', (data) => {
      const versionsClient = data['versions'];
      co(function*() {
        const db = yield dbX.dbPromise;
        const versionsLatest = yield db.collection('versions').find({}).toArray();
        const clientCollectionUpdates = {};
        // console.log('versionsClient', versionsClient);
        versionsClient.reduce((acc, curr) => {
          switch (true) {
            case curr['collection'] === 'gd': // prices is called gd at client
              const pricesVersionLatest = versionsLatest.find(v => v['collection'] === 'prices');
              if (curr['version'] !== pricesVersionLatest['version']) {
                acc['gd'] = {version: pricesVersionLatest['version']};
              }
              break;
            default:
              const versionLatest = versionsLatest.find(v => {
                return v['collection'] === curr['collection'];
              });
              if (curr['version'] !== versionLatest['version']) {
                acc[curr['collection']] = {version: versionLatest['version']};
              }
          }
          return acc;
        }, clientCollectionUpdates);
        const hasUpdates = Object.keys(clientCollectionUpdates).length;
        if (hasUpdates) {
          const collectionsToUpdate = Object.keys(clientCollectionUpdates);

          // types, titles, staffs
          
          yield coForEach(Object.keys(clientCollectionUpdates), function*(k) {
            console.log('adding to clientCollectionUpdates:', k);
            switch (k) {
              case 'gd':
              clientCollectionUpdates[k]['data'] = JSON.stringify(yield db.collection('prices').find({}, {
                createdAt: 0, createdBy: 0, modifiedAt: 0, modifiedBy: 0
              }).toArray());
              break;
            default:
              // need two stringifies, otherwise, error at heroku without details
              clientCollectionUpdates[k]['data'] = [{a: 1}];
              // clientCollectionUpdates[k]['data'] = JSON.stringify(JSON.stringify(yield db.collection(k).find({}).toArray()));
            }
          });
          
          socket.emit('collectionUpdate', clientCollectionUpdates);
        } else {
          socket.send({message: 'all collections up-to-date'});          
        }
      }).catch(error => {
        console.log(error.stack);
        socket.emit('error', {
          error: error.stack
        })
      })
    })
    // after connection, client sends collectionVersions, then server compares

    // each time a collection is updated, update its version in the 'versions' collection

  })
}