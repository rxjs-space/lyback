const monk = require('monk')
const url = 'mongodb://timliu:2858880@ds161960.mlab.com:61960/longyundb';
const db = monk(url);
const usersColl = db.get('users');

module.exports = {
  db, usersColl
}


