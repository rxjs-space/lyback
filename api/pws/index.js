const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;

const dbX = require('../../db');
const postRoot = (req, res) => {
  console.log(req.query);
  if (!req.body) {
    return res.status(400).json({
      message: 'No data provided.'
    });
  }
  const newPW = req.body;
  const toInsertMany = req.query && req.query.many;
  if (toInsertMany && !(req.body instanceof Array)) {
    return res.status(400).json({
      message: 'Bad data while inserting many.'
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    let insertResult;
    if (toInsertMany) {
      insertResult = yield db.collection('pws').insertMany(newPW);
    } else {
      insertResult = yield db.collection('pws').insert(newPW);
    }
    const updateVersionResult = yield db.collection('versions').updateOne({
        collection: 'pws'
      }, {
        '$set': {version: `${(new Date()).toISOString().substring(0, 10)}:${Math.random()}`}
      }, {
        upsert: true
      });


    return res.json(insertResult);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

};

const getRoot = (req, res) => {

  co(function*() {
    const db = yield dbX.dbPromise;
    const getResult = yield db.collection('pws').find(req.query).toArray();
    return res.json(getResult);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })



}

router.post('/', postRoot);
router.get('/', getRoot)
module.exports = router;