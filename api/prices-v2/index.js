const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;
const MongoError = require('mongodb').MongoError;
const toMongodb = require('jsonpatch-to-mongodb');

const collectionName = 'pricesV2';
const patchesCollectionName = 'pricesV2Patches';
const dbX = require('../../db');

const patchRoot = (req, res) => {
  // upsert in pricesV2, and save the patches
  // if new key in pricesV2, don't save the patch, since we have numberCreatedAs
  const patches = req.body; // [{op, path, value, target}];
  
  if (!patches || !patches.length) {
    return res.status(400).json({
      message: 'No data provided.'
    });
  }
  const thatTime = new Date();
  const thatUser = req.user._id;
  co(function*() {
    const db = yield dbX.dbPromise;
    yield coForEach(patches, function*(patch) {
      const patchesForX = {
        patches: [{op: 'replace', path: '/number', value: patch.value}],
        patchedAt: thatTime,
        patchedBy: thatUser
      }
      const existingDoc = yield db.collection(collectionName).findOne(patch.target);
      if (!existingDoc) { // if this is a new one, add more info and do not save patches
        patchesForX.patches.push(
          {op: 'replace', path: '/createdAt', value: thatTime}, 
          {op: 'replace', path: '/createdBy', value: thatUser},
          {op: 'replace', path: '/numberCreatedAs', value: patch.value}
        )
      } else { // if this is to update an existing one, save the patches
        patchesForX.target = existingDoc._id;
        const insertPatchesResult = yield db.collection(patchesCollectionName).insert(patchesForX);
      }
      const patchesToApply = toMongodb(patchesForX.patches);
      const upsertResult = yield db.collection(collectionName).updateOne(
        patch.target,
        patchesToApply,
        {upsert: true}
      );
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


const postRoot = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'No data provided.'
    });
  }
  let newPrices; // each new price will have fileds as "brandId, model, partId, number"
  if (req.body instanceof Array) {
    newPrices = req.body;
  } else {
    newPrices = [req.body]
  }
  const createdAt = new Date();
  const createdBy = req.user._id;
  newPrices.forEach(p => {
    p.numberCreatedAs = p.number;
    p.createdAt = createdAt;
    p.createdBy = createdBy;
  });

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertResult = yield db.collection(collectionName).insertMany(newPrices);

    return res.json(insertResult);
  }).catch(error => {
    // console.log(error);
    if (error instanceof MongoError) {
      // front end will check if error contains error code like 'E11000' using error.indexOf
      return res.status(500).json(error.toString());
    } else {
      return res.status(500).json(error.stack);
    }
  })

};

const postSearch = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'No search params provided.'
    });
  }
  const projection = req.query.fat ? {} : {
    numberCreatedAs: 0, _id: 0, createdAt: 0, createdBy: 0
  };
  const searchParams = req.body;
  co(function*() {
    const db = yield dbX.dbPromise;
    const searchResult = yield db.collection(collectionName).find(searchParams, projection).toArray();
    return res.json(searchResult);
  }).catch(error => {
    // console.log(error);
    if (error instanceof MongoError) {
      // front end will check if error contains error code like 'E11000' using error.indexOf
      return res.status(500).json(error.toString());
    } else {
      return res.status(500).json(error.stack);
    }
  })

};


router.post('/', postRoot);
router.post('/search', postSearch);
router.patch('/', patchRoot);
module.exports = router;