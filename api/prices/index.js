const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;

const myAcl = require('../../my-acl');

const dbX = require('../../db');
prepareId = (group, patch) => {
  let id;
  switch(group) {
    case 'age':
      id = patch.path.split('/')[1] * 1;
      break;
    // case 'brand':
    //   id = new ObjectID(patch.path.split('/')[1]);
    //   break;
    default:
      id = patch.path.split('/')[1];
  }
  return id;
}
const upsertPrices = (data, req, res) => {
  const group = data.group;
  const patches = data.patches;
  if (!group || !patches) {return res.status(400).json({
    ok: false,
    message: 'Insufficient data provided.'
  })}
  console.log(data);
    // patches: [ { op: 'replace', path: '/p002/number', value: 1 } ]
      
      co(function*() {
        const db = yield dbX.dbPromise;
        const opTime = (new Date()).toISOString();
        const userId = req.user._id
        const dbOps = patches.map(p => ({
          updateOne: {
            filter: {group, id: prepareId(group, p)},
            update: {
              $set: {
                number: p.value,
                modifiedAt: opTime,
                modifiedBy: userId
              },
              $setOnInsert: {
                createdAt: opTime,
                createdBy: userId
              }
            },
            upsert: true
          }
        }));
        const insertResult = yield db.collection('pricePatches').insert({
          group, patches, createdAt: opTime, createBy: userId
        });
        const updateResult = yield db.collection('prices').bulkWrite(dbOps, {ordered: true, w: 1});
        const updateVersionResult = yield db.collection('versions').updateOne({
          collection: 'prices'
        }, {
          '$set': {version: `${(new Date()).toISOString().substring(0, 10)}:${Math.random()}`}
        }, {
          upsert: true
        });

        
        res.json({ok: true, counts: {
          // insertedCount: updateResult.insertedCount,
          // matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          // deletedCount: updateResult.deletedCount,
          upsertedCount: updateResult.upsertedCount
        }, updateResult});
      }).catch(error => {
        return res.status(500).json({
          error: error.stack,
        });
      });

}

router.post('/', function(req, res) {
  if (!req.body) {return res.status(400).json({
    message: 'No price details provided.'
  })}
  switch (req.query.op) {
    case 'upsert':
      upsertPrices(req.body, req, res);
      // console.log(req.body);
      // res.json({ok: true});
      break;
    default:
      let newPrices; // each new price will have fileds as "type, id, number"
      if (req.body instanceof Array) {
        newPrices = req.body;
      } else {
        newPrices = [req.body]
      }
    
      newPrices.forEach(p => {
        p.createdAt = (new Date()).toISOString();
        p.createdBy = req.user._id;
      });
    
      co(function*() {
        const db = yield dbX.dbPromise;
        const insertResult = yield db.collection('prices').insertMany(newPrices);
        res.json(insertResult);
      }).catch(error => {
        const errStr = JSON.stringify(error.stack);
        // if duplicate price configuration ...
        if (errStr.indexOf('E11000')) return res.status(400).json({
          message: `Duplicate price configuration. ${errStr}`
        });
        return res.status(500).json(error.stack);
      })
  }

});



router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const group = req.query['group'];
    let result;
    if (group) {
      result = yield db.collection('prices').find({group}, {
        group: 0,
        createdAt: 0,
        createdBy: 0,
        modifiedAt: 0,
        modifiedBy: 0
      }).toArray();
    } else {
      result = yield db.collection('prices').find({}, {
        createdAt: 0,
        createdBy: 0,
        modifiedAt: 0,
        modifiedBy: 0
      }).toArray();
    }
    res.json(result);
  }).catch(error => {
    return res.status(500).json({
      error: error.stack,
    });
  })
})

module.exports = router;