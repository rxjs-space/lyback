const MongoClient = require('mongodb').MongoClient;
const co = require('co');
// const dbUrl = `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`;
let dbUrl;
if (process.env.ENVIRONMENT === 'production') {
  dbUrl = `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`;
} else {
  dbUrl = 'mongodb://127.0.0.1:27017/longyundb';
}
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