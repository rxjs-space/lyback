// const monk = require('monk')
// const url = 'mongodb://timliu:2858880@ds161960.mlab.com:61960/longyundb';
// const db = monk(url);
// const usersColl = db.get('users');

// module.exports = {
//   db, usersColl
// }


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
    // MongoClient.connect(dbUrl, function(err, database) {
    //   if(err) throw err;
    //   db = database;
    //   // Start the application after the database connection is ready
    //   app.listen(3000);
    //   console.log("Listening on port 3000");
    // });
  },
  get db() {
    return db;
  }
}