const MongoClient = require('mongodb').MongoClient;
const co = require('co');
const dbUrl = 'mongodb://timliu:2858880@ds161960.mlab.com:61960/longyundb';
let db;

module.exports = {
  connect: () => {
    return co(function*() {
      db = yield MongoClient.connect(dbUrl);
      return db;
    }).catch(err => {
      console.log('error at db connect');
      throw err;
    });
  },
  get db() {
    return db;
  },
  get dbPromise() {
    return co(function*() {
      let shouldReconnect;
      db.stats(v => {
        if (v && v.message === 'topology was destroyed') {
          shouldReconnect = true;
        }
      })

      if (shouldReconnect) {
        console.log('reconnecting to db');
        db = yield MongoClient.connect(dbUrl);
        console.log('reconnected to db');
        db.stats(v => console.log(JSON.stringify(v, null, 2)));
      }
      return db;
    }).catch(err => {
      console.log('error at dbPromise');
      throw err;
    });
  }
}

  // db.stats(v => console.log(JSON.stringify(v)));
  // // {"name":"MongoError","message":"topology was destroyed"}