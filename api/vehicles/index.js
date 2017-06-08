const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');

const dbX = require('../../db');

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
    patches.createdAt = (new Date()).toISOString();
    patches.createdBy = req.user._id;
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
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('vehicles').find({}, {
      'id': 1,
      'vin': 1,
      'entranceDate': 1,
      'status': 1,
      'vehicle.plateNo': 1
    })
    .sort([['_id', -1]])
    .toArray();
    res.send(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
  // return res.json(req.user);


})

router.get('/one', (req, res) => {
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
      message: `no doc whose id is ${req.query.vin}`
    })}
    const vehicle = docs[0];
    const userC = yield db.collection('users').find({_id: vehicle.createdBy}).toArray();
    const userM = yield db.collection('users').find({_id: vehicle.modifiedBy}).toArray();
    vehicle.createdBy = userC[0];
    vehicle.modifiedBy = userM[0];
    res.send(vehicle);
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
    req.body.patches.push(
      {op: 'replace', path: '/modifiedAt', value: (new Date()).toISOString()},
      {op: 'replace', path: '/modifiedBy', value: req.user._id}
    )
    const patches = {patches: req.body.patches};
    patches.createdAt = (new Date()).toISOString();
    patches.createdBy = req.user._id;
    patches.vin = vin;
    const patchesToApply = toMongodb(req.body.patches);
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