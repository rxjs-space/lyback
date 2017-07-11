const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;

const getLastSundays = require('../../utils/last-sundays');
const dbX = require('../../db');

const basedOnDismantlingOrderWeek = {
  'thisWeek': (dbQuery, lastSundays) => {
    dbQuery['orderDate'] = {$gt: lastSundays['1']}
    return dbQuery;
  },
  'lastWeek': (dbQuery, lastSundays) => {
    dbQuery['orderDate'] = {$gt: lastSundays['2'], $lte: lastSundays['1']}
    return dbQuery;
  },
  'evenEarlier': (dbQuery, lastSundays) => {
    dbQuery['orderDate'] = {$lte: lastSundays['2']}
    return dbQuery;
  },
  'total': (dbQuery, lastSundays) => {return dbQuery; },
}

router.get('/reports', require('./reports'));
router.get('/', (req, res) => {
  const searchQuery = req.query;
  const keys = Object.keys(searchQuery);
  // turn string 'true' into boolean true
  if (keys.length) {
    for (const k of keys) {
      if (searchQuery[k] === 'true') {searchQuery[k] = true; }
      if (searchQuery[k] === 'false') {searchQuery[k] = false; }
    }
  }

  let dbQuery = {};
  for (let k of keys) {
    switch (true) {
      case k === 'dismantlingStarted':
        if (searchQuery['dismantlingStarted']) {
          dbQuery['startedAt'] = {'$gt': ''};
        } else {
          dbQuery['startedAt'] = '';
        }
        break;
      case k === 'dismantlingOrderWeek':
        dbQuery = basedOnDismantlingOrderWeek[searchQuery[k]](dbQuery, getLastSundays());
        break;
      case k === 'completed':
        dbQuery['completedAt'] = searchQuery[k] ? {'$gt': ''} : '';
        break;
      case k === 'completedDate':
        dbQuery['completedAt'] = {'$regex': `${searchQuery[k]}.*`}
        break;
      default:
      dbQuery[k] = searchQuery[k];
    }
  }

  if (dbQuery['vehicleType'] === 'z') {
    dbQuery['vehicleType'] = {$ne: '3'}
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
  if(!newDismantlingOrder.vin || !newDismantlingOrder.orderDate) {
    return res.status(400).json({
      message: 'non-standard dismantlingOrder content'
    })
  }

  const writeStatus = {
    dismatlingOrderPatches1: false,
    dismantlingOrder: false,
    dismatlingOrderPatches2: false,
    vehiclePatches: false,
    vehicle: false
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
    const patchedAt = (new Date()).toISOString();
    const userId = req.user._id;

    Object.assign(newDismantlingOrder, {
      createdAt: patchedAt,
      createdBy: userId
    });

    Object.assign(patches, {
      createdAt: patchedAt,
      createdBy: userId,
      vin: newDismantlingOrder.vin,
      dismantlingOrderId: 'tba'
    });

    /*
      save procedure
      1) save dismantlingOrderPatches and get the _id_dop of inserted doc
      2) save dismantlingOrder and get the _id_do of inserted doc
      3) update dismantlingOrderPatches(_id_dop) with the _id_do
      4) update vehiclePatches(vin) with _id_dop
      5) update vehicle(vin), mark dismantling as true
    
    */

    const patchesSaveResult = yield db.collection('dismantlingOrderPatches').insert(patches);
    const patchesId = patchesSaveResult.insertedIds[0];
    writeStatus.dismatlingOrderPatches1 = true;

    const saveResult = yield db.collection('dismantlingOrders').insert(newDismantlingOrder);
    const dismantlingOrderId = saveResult.insertedIds[0];
    writeStatus.dismantlingOrder = true;

    const patchesUpdateResult = yield db.collection('dismantlingOrderPatches').updateOne(
      {_id: patchesId}, {$set: {dismantlingOrderId}}
    );
    writeStatus.dismatlingOrderPatches2 = true;

    const vPatchedAt = (new Date()).toISOString();
    const vPatches = {
      patches: [
        {op: 'replace', path: '/modifiedAt', value: vPatchedAt},
        {op: 'replace', path: '/modifiedBy', value: userId},
        {op: 'replace', path: '/status2/dismantling', value: true},
      ],
      createdAt: vPatchedAt,
      createdBy: userId,
      trigger: 'dismantlingOrderPatches',
      triggerId: patchesId
    };
    const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
    writeStatus.vehiclePatches = true;

    const vPatchesToApply = toMongodb(vPatches.patches);
    const vUpdateResult = yield db.collection('vehicles').updateOne(
      {vin: newDismantlingOrder.vin},
      vPatchesToApply
    );
    writeStatus.vehicle = true;

    console.log(writeStatus);
    res.json(saveResult);
    // res.json({
    //   ok: true
    // })
  }).catch(error => {
    return res.status(500).json({
      error: error.stack,
      writeStatus
    });
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
      message: `no dismantling order whose id is ${rdismantlingOrderId}`
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
  if (!req.body || !req.body.dismantlingOrderId || !req.body.patches || !req.body.vin) {
    return res.status(400).json({
      message: 'Insufficient data provided.'
    })
  }

  const patchedAt = (new Date()).toISOString();
  req.body.patches.push(
    {op: 'replace', path: '/modifiedAt', value: patchedAt},
    {op: 'replace', path: '/modifiedBy', value: req.user._id}
  );
  const dismantlingOrderId = new ObjectID(req.body.dismantlingOrderId);
  const patchesToInsert = {patches: req.body.patches};
  patchesToInsert.createdAt = patchedAt;
  patchesToInsert.createdBy = req.user._id;
  const patchesToApply = toMongodb(req.body.patches);
  let isCompleted, completedAt, patchesToInsertForVehicle, patchesToApplyForVehicle;
  console.log('patchForCompletedAt', JSON.stringify(patchesToInsert));
  const patchForCompletedAt = patchesToInsert.patches.filter(p => p.path === '/completedAt')[0];
  if (patchForCompletedAt) {
    isCompleted = true;
    completedAt = patchForCompletedAt.value;
  }
  // const isCompleted = JSON.stringify(patchesToInsert.patches).indexOf('completedAt');
  if (isCompleted) { // if the dismantlingOrder is completed, mark the corresponding vehicle
    patchesToInsertForVehicle = {
      createdAt: patchesToInsert.createdAt,
      createdBy: patchesToInsert.createdBy,
      patches: [
        {op: 'replace', path: '/status/dismantled/done', value: true},
        {op: 'replace', path: '/status/dismantled/date', value: completedAt.slice(0, 10)},
        {op: 'replace', path: '/status2/dismantling', value: false}
      ]
    };
    patchesToApplyForVehicle = toMongodb(patchesToInsertForVehicle.patches);
  }


  co(function*() {
    const db = yield dbX.dbPromise;
    // insert patches for dismantling order
    const insertPatchesToDismantlingOrderPatchesResult = 
      yield db.collection('dismantlingOrderPatches').insert(patchesToInsert);
    // update dismantling order
    const updateResult = yield db.collection('dismantlingOrders').updateOne(
      {_id: dismantlingOrderId},
      patchesToApply
    );
    if (isCompleted) {
      // insert patches for vehicle
      const insertPatchesToVehiclePatchesResult = 
        yield db.collection('vehiclePatches').insert(patchesToInsertForVehicle);
      // update vehicle
      const updateVehicleResult = yield db.collection('vehicles').update(
        {vin: req.body.vin},
        patchesToApplyForVehicle
      )
    }
    res.json(updateResult);
  })


  // todo: when the dismantlingOrder if completed, mark the vehicle as dismantling = false and dismantled.done as true with date
  // todo: and then makr the dismantling with markedAt
  res.json({ok: true})
})


module.exports = router;