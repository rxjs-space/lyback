const router = require('express').Router();
const co = require('co');
const dbX = require('../../db');

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('versions').find({}).toArray();
    res.send(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
});

module.exports = router;
