const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;

const dbX = require('../../db');

router.get('/', (req, res) => {
  const dbQuery = {};
  for (let k of Object.keys(req.query)) {
    dbQuery[k] = req.query[k]
  }
  console.log(dbQuery);
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('dismantlingOrders').find(dbQuery)
    .sort([['_id', -1]])
    .toArray();
    res.json(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
})

router.post('/', (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }
  if (!req.body.dismantlingOrder || !req.body.patches) {
    return res.status(400).json({
      message: "insufficient/incorrect parameters."
    })
  }

  const newDismantlingOrder = req.body.dismantlingOrder;
  if(!newDismantlingOrder.vin || !newDismantlingOrder.startedAt) {
    return res.status(400).json({
      message: 'non-standard dismantlingOrder content'
    })
  }


  // and other validations
  co(function*() {
    const db = yield dbX.dbPromise;
    // try find the last dismantling order with the same vin
    // get dismantlingOrder by vin, if no, continue
    // if found, check if normal, halt; if adHoc, check if active
    const docs = yield db.collection('dismantlingOrders')
      .find({vin: newDismantlingOrder.vin})
      .sort([['_id', -1]])
      .limit(1)
      .toArray();
    if (docs.length) {
      const lastDismantlingOrderWithSameVIN = docs[0];
      if (lastDismantlingOrderWithSameVIN.isAdHoc === '1') {
        if (!lastDismantlingOrderWithSameVIN.completedAt) {
          return res.status(400).json({
            message: `存在 VIN 为${newDismantlingOrder.vin}且尚未完成的临时拆解计划。`
          })
        }
      } else {
        return res.status(400).json({
          message: `已存在 VIN 为 ${newDismantlingOrder.vin} 的正常拆解计划。`
        })
      }
    }

    // console.log(JSON.stringify(req.body));
    const patches = {patches: req.body.patches};
    newDismantlingOrder.createdAt = (new Date()).toISOString();
    newDismantlingOrder.createdBy = req.user._id;
    patches.createdAt = newDismantlingOrder.createdAt;
    patches.createdBy = newDismantlingOrder.createdBy;
    const saveResult = yield db.collection('dismantlingOrders').insert(newDismantlingOrder);
    // console.log(saveResult);
    // after getting the _id of the dismantlingOrder, insert the patches with the _id
    patches.dismantlingOrderId = saveResult.insertedIds[0];
    const patchResult = yield db.collection('dismantlingOrderPatches').insert(patches);
    // todo: mark the vehicle as dismantling
    // todo: mark dismantlingOrder with markedAt
    res.json(saveResult);
    // res.json({
    //   ok: true
    // })
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

})

router.get('/one', (req, res) => {
  if (!req.query.dismantlingOrderId) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  const dismantlingOrderId = new ObjectID(req.query.dismantlingOrderId);
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('dismantlingOrders').find({_id: dismantlingOrderId}).toArray();
    if (!docs.length) {return res.status(400).json({
      message: `no doc whose id is ${req.query.vin}`
    })}
    const dismantlingOrder = docs[0];
    const userC = yield db.collection('users').find({_id: dismantlingOrder.createdBy}, {password: 0}).toArray();
    const userM = yield db.collection('users').find({_id: dismantlingOrder.modifiedBy}, {password: 0}).toArray();
    dismantlingOrder.createdBy = userC[0];
    dismantlingOrder.modifiedBy = userM[0];
    return res.send(dismantlingOrder);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
})

router.patch('/one', (req, res) => {
  // todo: when the dismantlingOrder if completed, mark the vehicle as dismantling = '0'
  // todo: and then makr the dismantling with markedAt
  res.json({ok: true})
})


module.exports = router;