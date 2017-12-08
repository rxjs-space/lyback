const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;

const dbX = require('../../db');
const postRoot = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'No data provided.'
    });
  }
  
  let newPWs; // each PW will have fileds as "name, unit, active, idForPlan"
  if (req.body instanceof Array) {
    newPWs = req.body;
  } else {
    newPWs = [req.body]
  }

  // const newPW = req.body;
  // const toInsertMany = req.query && req.query.many;
  // if (toInsertMany && !(req.body instanceof Array)) {
  //   return res.status(400).json({
  //     message: 'Bad data while inserting many.'
  //   })
  // }
  co(function*() {
    const db = yield dbX.dbPromise;
    const insertResult = yield db.collection('pws').insertMany(newPWs);
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