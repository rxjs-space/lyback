const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');

const dbX = require('../../db');
const getLastSundays = require('../../utils/lastSundays');

const basedOnEntranceWeek = {
  'thisWeek': (dbQuery, lastSundays) => {
    dbQuery['entranceDate'] = {$gt: lastSundays['1']}
    return dbQuery;
  },
  'lastWeek': (dbQuery, lastSundays) => {
    dbQuery['entranceDate'] = {$gt: lastSundays['2'], $lte: lastSundays['1']}
    return dbQuery;
  },
  'evenEarlier': (dbQuery, lastSundays) => {
    dbQuery['entranceDate'] = {$lte: lastSundays['2']}
    return dbQuery;
  },
  'total': (dbQuery, lastSundays) => {return dbQuery; },
}

router.post('/', (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }
  if (!req.body.vehicle || !req.body.patches) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  // and other validations

  co(function*() {
    const db = yield dbX.dbPromise;
    const newVehicle = req.body.vehicle;
    const patches = {patches: req.body.patches};
    newVehicle.createdAt = (new Date()).toISOString();
    newVehicle.createdBy = req.user._id;
    patches.createdAt = newVehicle.createdAt;
    patches.createdBy = newVehicle.createdBy;
    patches.vin = newVehicle.vin;
    const patchResult = yield db.collection('vehiclePatches').insert(patches);
    const saveResult = yield db.collection('vehicles').insert(newVehicle);
    res.json(saveResult);
  }).catch(err => {
    if (err.stack && err.stack.indexOf('E11000') > -1) {
      return res.status(400).json(err.stack)
    }
    return res.status(500).json(err.stack);
  })

})

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
  // turn req.query into dbQuery
  for (let k of Object.keys(searchQuery)) {
    if (k === 'entranceWeek') {
      dbQuery = basedOnEntranceWeek[searchQuery[k]](dbQuery, getLastSundays());
    } else {
      dbQuery[k] = searchQuery[k];
    }
  }

  // deal with vehicleType === 'z', that is not '2' (i.e, not motorbike)
  if (dbQuery['vehicle.vehicleType'] === 'z') {
    dbQuery['vehicle.vehicleType'] = {$ne: '2'}
  }
  // console.log(searchQuery);
  // console.log(dbQuery);
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('vehicles').find(dbQuery, {
      'id': 1,
      'vin': 1,
      'entranceDate': 1,
      'status': 1,
      'vehicle.plateNo': 1,
      'vehicle.vehicleType': 1,
      'vehicle.brand': 1,
      'dismantling': 1
    })
    .sort([['_id', -1]])
    .toArray();
    res.json(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
  // return res.json(req.user);


})

router.get('/one', (req, res) => {
  // example query 
  // /api/vehicles/one?vin=asdfa&returnIDOnly=true
  if (!req.query.vin) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('vehicles').find({vin: req.query.vin}/*, {
      '_id': 0,
      'createdAt': 0,
      'createdBy': 0,
      'modifiedAt': 0,
      'modifiedBy': 0
    }*/).toArray();
    if (!docs.length) {return res.status(400).json({
      message: `no vehicle whose vin is ${req.query.vin}`
    })}
    const vehicle = docs[0];
    if (req.query.returnIDOnly && JSON.parse(req.query.returnIDOnly)) {
      return res.json({
        _id: vehicle._id
      }); 
    } else {
      const userC = yield db.collection('users').find({_id: vehicle.createdBy}, {password: 0}).toArray();
      const userM = yield db.collection('users').find({_id: vehicle.modifiedBy}, {password: 0}).toArray();
      vehicle.createdBy = userC[0];
      vehicle.modifiedBy = userM[0];
      return res.send(vehicle);
    }

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
});


router.patch('/one', (req, res) => {
  const vin = req.query.vin;
  if (!vin) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }


  co(function*() {
    const db = yield dbX.dbPromise;
    const patchedAt = (new Date()).toISOString()
    req.body.patches.push(
      {op: 'replace', path: '/modifiedAt', value: patchedAt},
      {op: 'replace', path: '/modifiedBy', value: req.user._id}
    )
    const patches = {patches: req.body.patches};
    patches.createdAt = patchedAt;
    patches.createdBy = req.user._id;
    patches.vin = vin;
    const patchesToApply = toMongodb(req.body.patches);
    // console.log(req.body.patches);
    // console.log(patchesToApply);
    const patchResult = yield db.collection('vehiclePatches').insert(patches);
    const updateResult = yield db.collection('vehicles').updateOne(
      {vin},
      patchesToApply
    );
    res.json(updateResult);
    // console.log(patchesToApply);
    // res.json({
    //   message: 'ok'
    // })
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

    // const updateResult = yield db.collection('tt').updateOne(
    //   {name: req.body.name}, 
    //   {$set: req.body},
    //   {upsert: true}
    // );
    // res.json(updateResult);


  // res.send({message: 'ok'});
  // co(function*() {
  //   const db = yield dbX.dbPromise;
  //   const docs = yield db.collection('vehicles').find({id: req.query.vin}, {
  //     '_id': 0,
  //     'createdAt': 0,
  //     'createdBy': 0
  //   }).toArray();
  //   if (!docs.length) {return res.status(400).json({
  //     message: `no doc whose id is ${req.query.vin}`
  //   })}
  //   res.send(docs[0]);
  // }).catch((err) => {
  //   return res.status(500).json(err.stack);
  // })
});
module.exports = router;