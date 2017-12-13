const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;
const MongoError = require('mongodb').MongoError;
const toMongodb = require('jsonpatch-to-mongodb');

const collectionName = 'pws';
const patchesCollectionName = 'pwsPatches';

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

const patchRootMany = (req, res) => {
  // patch many
  // patches /is/ an object like {[id0]: [patch0, ...]}
  const patches = req.body;
  const targetIds = Object.keys(patches);
  const thatTime = new Date();
  const thatUser = req.user._id;
  co(function*() {
    const db = yield dbX.dbPromise;
    yield coForEach(targetIds, function*(targetId) {
      const extraPatches = [
        {op: 'replace', path: '/modifiedAt', value: thatTime}, 
        {op: 'replace', path: '/modifiedBy', value: thatUser}
      ]
      const patchesForX = {
        patches: patches[targetId].concat(extraPatches),
        patchedAt: thatTime,
        patchedBy: thatUser
      }
      const insertPatchesResult = yield db.collection(patchesCollectionName).insert(patchesForX);
      const patchesToApply = toMongodb(patchesForX.patches);
      const updateResult = yield db.collection(collectionName).updateOne(
        {_id: new ObjectID(targetId)},
        patchesToApply
      );
    });
    const updateVersionResult = yield db.collection('versions').updateOne({
      collection: collectionName
    }, {
      '$set': {version: `${(new Date()).toISOString()}${Math.random()}`}
    }, {
      upsert: true
    });

    return res.json({ok: true});
  }).catch(error => {
    // console.log(error);
    if (error instanceof MongoError) {
      // front end will check if error contains error code like 'E11000' using error.indexOf
      return res.status(500).json(error.toString());
    } else {
      return res.status(500).json(error.stack);
    }
  })  


}

const patchRoot = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'No data provided.'
    });
  }
  if (req.query._id) {
    // patch one
    // patches /is/ an array
    // a patch shall be like {op, path, value}
    res.json({message: 'todo'})
  } else {
    return patchRootMany(req, res);
  }
}

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
router.patch('/', patchRoot);
module.exports = router;