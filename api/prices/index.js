const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const updatePrices = (data, req, res) => {
  const group = data.group;
  const patches = data.patches;
  if (!group || !patches) {return res.status(400).json({
    ok: false,
    message: 'Insufficient data provided.'
  })}
  console.log(data);
  switch (group) {
    case 'pw':
    case 'vt':
      // patches: [ { op: 'replace', path: '/p002/number', value: 1 } ]
      
      co(function*() {
        const db = yield dbX.dbPromise;
        const opTime = (new Date()).toISOString();
        const operator = req.user._id
        const dbOps = patches.map(p => ({
          updateOne: {
            filter: {group, id: p.path.split('/')[1]},
            update: {
              $set: {
                number: p.value,
                modifiedAt: opTime,
                modifiedBy: operator
              },
              $setOnInsert: {
                createdAt: opTime,
                createdBy: operator
              }
            },
            upsert: true
          }
        }));
        const insertResult = yield db.collection('pricePatches').insert({
          group, patches, createdAt: opTime, createBy: operator
        });
        const updateResult = yield db.collection('prices').bulkWrite(dbOps, {ordered: true, w: 1});
        res.json({ok: true, upsertCount: updateResult.nUpserted});
      }).catch(error => {
        return res.status(500).json({
          error: error.stack,
        });
      });
      break;
    default:
      res.json({ok: true, op: 'nothing'})
  }
}

router.post('/', function(req, res) {
  if (!req.body) {return res.status(400).json({
    message: 'No price details provided.'
  })}
  switch (req.query.op) {
    case 'update':
      updatePrices(req.body, req, res);
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
    switch (group) {
      case 'pw':
      case 'vt':
        result = yield db.collection('prices').find({group}, {
          _id: 0,
          group: 0,
          createdAt: 0,
          createdBy: 0
        }).toArray();
        break;
    }
    res.json(result);
  }).catch(error => {
    return res.status(500).json({
      error: error.stack,
    });
  })
})

module.exports = router;