const MongoClient = require('mongodb').MongoClient;
const co = require('co');
const dbUrl = 'mongodb://timliu:2858880@ds161960.mlab.com:61960/longyundb';
let db;

module.exports = {
  get dbPromise() {
    return MongoClient.connect(dbUrl);
  },
  connect: () => {
    return co(function*() {
      db = yield MongoClient.connect(dbUrl);
    }).catch(err => {
      throw err;
    });
  },
  get db() {
    return db;
  }
}