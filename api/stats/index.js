const router = require('express').Router();
const co = require('co');

const dbX = require('../../db');

router.get('/', function(req, res) {
  res.send('ok');
  // co(function*() {
  //   const db = yield dbX.dbPromise;
  //   const statsResult = yield db.collection('vehicles').aggregate(
  //     [ { $collStats: { storageStats: { } } } ]
  //   ).toArray();
  //   res.json(statsResult);
  // })
});

module.exports = router;