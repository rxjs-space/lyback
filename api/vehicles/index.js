const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const MongoError = require('mongodb').MongoError;

const strContains = require('../../utils').strContains;
const getMondayOfTheWeek = require('../../utils').getMondayOfTheWeek;
const dbX = require('../../db');
const getLastSundays = require('../../utils/last-sundays');
const getLastMondays = require('../../utils/last-mondays');
const getDaysAgoDate = require('../../utils').getDaysAgoDate;

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

const basedOnEntranceMonday = (entranceMonday, dbQuery, lastMondays) => {
  switch (true) {
    case entranceMonday === lastMondays['1']:
      dbQuery['entranceDate'] = {$gt: lastMondays['1']}
      break;
    default:
      const nextMonday = new Date(Date.parse(new Date(entranceMonday)) + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
      dbQuery['entranceDate'] = {$gte: entranceMonday, $lt: nextMonday};
  }
  return dbQuery;
}

const preparePatches = (originalPatches) => {
  const patches = JSON.parse(JSON.stringify(originalPatches));
  const registrationDatePatch = patches.find(patch => patch.path.indexOf('registrationDate') > -1);
  console.log(registrationDatePatch);
  if (registrationDatePatch) {
    registrationDatePatch.value = new Date(registrationDatePatch.value);
  }
  console.log(registrationDatePatch);
  return patches;
}

const prepareNewVehicle = (originalNewVehicle) => {
  const newVehicle = JSON.parse(JSON.stringify(originalNewVehicle));
  if (newVehicle.vehicle.registrationDate) {
    newVehicle.vehicle.registrationDate = new Date(newVehicle.vehicle.registrationDate);
  }
  return newVehicle;
}

// const getVtbmymIdPromise = (db, patches, newVehicle) => {
//   return new Promise((resolve, reject) => {
//     co(function*() {
//       const vtbmymPatch = patches.patches.find(p => p.path.indexOf('vtbmym') > -1);
//       // if (vtbmymPatch.value === 'new') {
//         let vehicleType, brand, model, registrationDate, year, month;
//         if (newVehicle) {
//           vehicleType = newVehicle.vehicle.vehicleType;
//           brand = newVehicle.vehicle.brand;
//           model = newVehicle.vehicle.model;
//           registrationDate = newVehicle.vehicle.registrationDate;
//           if (registrationDate instanceof Date) {
//             year = registrationDate.toISOString().substring(0, 4);
//             month = registrationDate.toISOString().substring(4, 2);
//           } else {
//             year = registrationDate.substring(0, 4);
//             month = registrationDate.substring(4, 2);
//           }
//         } else {
//           const vin = patches.vin;
//           const findVehicleResult = yield db.collection('vehicles').find({vin}).toArray();
//           const oldVehicle = findVehicleResult[0];
//           vehicleType = oldVehicle.vehicle.vehicleType;
//           const brandPatch = patches.patches.find(p => p.path.indexOf('brand') > -1);
//           brand = brandPatch ? brandPatch.value : oldVehicle.vehicle.brand;
//           // console.log('brand old', oldVehicle.vehicle.brand);
//           // console.log(brandPatch);
//           const modelPatch = patches.patches.find(p => p.path.indexOf('model')) > -1;
//           model = modelPatch ? modelPatch.value : oldVehicle.vehicle.model;
//           const registrationDatePatch = patches.patches.find(p => p.path.indexOf('registrationDate') > -1);
//           registrationDate = registrationDatePatch ? registrationDatePatch.value : oldVehicle.vehicle.registrationDate;
//           if (registrationDate instanceof Date) {
//             year = registrationDate.toISOString().substring(0, 4);
//             month = registrationDate.toISOString().substring(4, 2);
//           } else {
//             year = registrationDate.substring(0, 4);
//             month = registrationDate.substring(4, 2);
//           }
//           // console.log(vehicleType, brand, model, year, month);
//         }

//         let vtbmymId;
//         const vtbmymFindResult = yield db.collection('vtbmym').find({
//           vehicleType, brand, model, year, month
//         }).toArray();

//         if (vtbmymFindResult.length) {
//           vtbmymId = vtbmymFindResult[0]['_id'];
//         } else {
//           const vtbmymInsertResult = yield db.collection('vtbmym').insert({
//             vehicleType, brand, model, year, month
//           });
//           vtbmymId = vtbmymInsertResult['insertedIds'][0];
//         }

//         resolve(vtbmymId);
//       // } else {
//       //   resolve(null);
//       // }

//     }).catch(error => reject(error));

//   })
// }


const createPreDismantlingOrderPromise = (db, vehicle) => {
  const batteryTypeId = 'p000';
  const batteryCountMissing = vehicle.feesAndDeductions.filter(fd => fd.part === batteryTypeId).length;
  const batteryCountPlan = vehicle.vehicle.batterySlotCount - batteryCountMissing;
  const batteryConditionBeforeDismantling = batteryCountPlan === 0 ? 'cbd05' : 'cbd01';
  const noteByPlanner = batteryCountMissing ? `应有蓄电池${vehicle.vehicle.batterySlotCount}块，遗失${batteryCountMissing}块` : '';
  const newPreDismantlingOrder = {
    orderDate: (new Date()).toISOString().substring(0, 10),
    orderType: 'dot3',
    correspondingSalesOrderId: '',
    startedAt: '',
    completedAt: '',
    vin: vehicle.vin,
    vehicleType: vehicle.vehicle.vehicleType,
    planners: [vehicle.createdBy],
    productionOperators: [],
    partsAndWastesPP: [
      {
        id: batteryTypeId,
        countPlan: batteryCountPlan,
        conditionBeforeDismantling: batteryConditionBeforeDismantling,
        noteByPlanner: noteByPlanner,
        countProduction: '',
        noteByProductionOperator: '',
        productionDate: '',
        inventoryInputDate: '',
        productIds: []
      }
    ],
    confirmDismantlingCompleted: false,
    progressPercentage: 0,
    inventoryInputDone: true,
    // vtbmym: vehicle.vtbmym,
    createdAt: vehicle.createdAt,
    createdBy: vehicle.createdBy
  };
  return db.collection('dismantlingOrders').insert(newPreDismantlingOrder);
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
    const newVehicle = prepareNewVehicle(req.body.vehicle);
    const patches = {patches: preparePatches(req.body.patches)};
    newVehicle.createdAt = (new Date()).toISOString();
    newVehicle.createdBy = req.user._id;
    patches.createdAt = newVehicle.createdAt;
    patches.createdBy = newVehicle.createdBy;
    patches.vin = newVehicle.vin;

    // const vtbmymPatch = patches.patches.find(p => p.path.indexOf('vtbmym') > -1);
    // console.log('vtbmymPatch', vtbmymPatch);
    // if (vtbmymPatch && vtbmymPatch.value === 'new') {
    //   const vtbmymId = yield getVtbmymIdPromise(db, patches, newVehicle);
    //   newVehicle.vtbmym = vtbmymId;
    //   vtbmymPatch.value = vtbmymId;
    // }

    const patchResult = yield db.collection('vehiclePatches').insert(patches);
    console.log('patches inserted');
    const saveResult = yield db.collection('vehicles').insert(newVehicle);
    console.log('vehicle inserted', saveResult['insertedIds'][0]);

    // update models set in brand
    if (newVehicle.vehicle.brand && newVehicle.vehicle.model) {
      const addModelToSetInBrandResult = yield db.collection('brands').updateOne({
        _id: new ObjectID(newVehicle.vehicle.brand)
      }, {$addToSet: {models: newVehicle.vehicle.model}});
    }

    // create preDismantlingOrder
    // yield createPreDismantlingOrderPromise(db, newVehicle); // will use different dismantlingOrder system
    res.json(saveResult);
  }).catch(err => {
    if (err.stack && err.stack.indexOf('E11000') > -1) {
      return res.status(400).json(err.stack)
    }
    console.log(err.stack
    /*
    { Error: read ECONNRESET
    at exports._errnoException (util.js:1022:11)
    at TCP.onread (net.js:569:26) name: 'MongoError', message: 'read ECONNRESET' }
    Error: read ECONNRESET
    at exports._errnoException (util.js:1022:11)
    at TCP.onread (net.js:569:26)
    
    */

    /* 

    Error: read ECONNRESET
        at exports._errnoException (util.js:1022:11)
        at TCP.onread (net.js:569:26)

    */

    
    );
    return res.status(500).json(err.stack);
  })

})

const rootGetDefault = (req, res, queryParams, keys) => {
  co(function*() {
    const db = yield dbX.dbPromise;

    // const ttQueryResult = yield db.collection('tt').find({name: 'types'}).toArray();
    // const vehicleTypeIdsForMotocycle = ttQueryResult[0]['vehicleTypeIdsForMotocycle'];
   
    let dbQuery = {};
    // turn req.query into dbQuery
    for (let k of keys) {
      switch (k) {
        case 'status.dismantled.week':
          const weekNumber = queryParams['status.dismantled.week'];
          const thatMonday = getMondayOfTheWeek(weekNumber);
          const nextMonday = new Date(Date.parse(thatMonday) + 1000 * 60 * 60 * 24 * 7);
          dbQuery['status.dismantled.done'] = true;
          dbQuery['status.dismantled.date'] = {
            $gte: thatMonday,
            $lt: nextMonday
          };
          break;
        case 'status.dismantled.date':
          dbQuery['status.dismantled.done'] = true;
          dbQuery['status.dismantled.date'] = {
            $gte: new Date(queryParams['status.dismantled.date']['$gte']),
            $lt: new Date(queryParams['status.dismantled.date']['$lt'])
          };
          break;
        case 'entranceWeek':
          dbQuery = basedOnEntranceWeek[queryParams[k]](dbQuery, getLastSundays());
          break;
        case 'entranceMonday':
          dbQuery = basedOnEntranceMonday(queryParams[k], dbQuery, getLastMondays());
          break;
        case 'byIdList':
          const idList = queryParams[k].map(id => new ObjectID(id));
          dbQuery['_id'] = {$in: idList};
          break;
        default:
          dbQuery[k] = queryParams[k];
      }

    }
    dbQuery['metadata.isDeleted'] = false;
    console.log(dbQuery);
    const docs = yield db.collection('vehicles').find(dbQuery, {
      'vin': 1,
      'batchId': 1,
      'facility': 1,
      'entranceStatus': 1,
      'entranceDate': 1,
      'surveyRounds': 1,
      // 'vtbmym': 1,
      'estimatedSurveyDateFirst': 1,
      'estimatedSurveyDateSecond': 1,
      'status': 1,
      'status2': 1,
      'vehicle.plateNo': 1,
      'vehicle.vehicleType': 1,
      'vehicle.brand': 1,
      'vehicle.model': 1,
      'vehicle.color': 1,
      'vehicle.engineNo': 1,
      'vehicle.curbWeightKG': 1,
      'vehicle.useCharacter': 1,
      'vehicle.conditionOnEntrance': 1,
      'vehicle.residualValueBeforeFD': 1,
      'dismantling': 1,
      'owner.name': 1,
      'owner.address': 1,
      'owner.idNo': 1,
      'agent.name': 1,
      'agent.idNo': 1,
      'owner.tel': 1,
      'feesAndDeductions': 1
    })
    .sort([['entranceDate', -1], ['createdAt', -1]])
    // .sort([['vehicle.vehicleType', -1]])
    .toArray();
    return res.json(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

const rootGetPaymentToOwnerReady = (req, res) => {
  const facility = req.query.facility === 'f000' ? 'f001' : req.query.facility;
  if (!facility) {
    return res.status(400).json({
      message: "insufficient parameters."
    });
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    let resultNotPaidNorProcessing = yield db.collection('vehicles').aggregate([
      {$match: {
        facility: facility,
        'status.paymentToOwner.done': false,
        'status2.paymentToOwnerBatchIds': {$size: 0}
      }},
      {$project: {
        'vin': 1,
        'batchId': 1,
        'facility': 1,
        // 'entranceStatus': 1,
        'entranceDate': 1,
        // 'surveyRounds': 1,
        // 'vtbmym': 1,
        // 'estimatedSurveyDateFirst': 1,
        // 'estimatedSurveyDateSecond': 1,
        'status': 1,
        'status2': 1,
        'vehicle.plateNo': 1,
        'vehicle.vehicleType': 1,
        'vehicle.brand': 1,
        // 'vehicle.model': 1,
        // 'vehicle.color': 1,
        // 'vehicle.engineNo': 1,
        // 'vehicle.useCharacter': 1,
        // 'vehicle.conditionOnEntrance': 1,
        'vehicle.residualValueBeforeFD': 1,
        // 'dismantling': 1,
        // 'owner.name': 1,
        // 'owner.address': 1,
        // 'owner.idNo': 1,
        // 'agent.name': 1,
        // 'agent.idNo': 1,
        // 'owner.tel': 1,
        'feesAndDeductions': 1,
        rvAfterFD: {
          $subtract: [
            {$cond: [
              {$eq: ['$vehicle.residualValueBeforeFD', '']},
              0,
              '$vehicle.residualValueBeforeFD'
            ]},
            {$sum: {
              $map: {
                input: '$feesAndDeductions',
                as: 'fd',
                in: '$$fd.amount'
              }
            }}
          ]
        }
      }},
      {$match: {
        rvAfterFD: {$ne: 0}
      }},
      { $sort : { entranceDate : -1 } }
    ]).toArray();
    return res.json(resultNotPaidNorProcessing);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}
const rootGetPaymentToOwnerZeroRD = (req, res) => {
  const facility = req.query.facility;
  if (!facility) {
    return res.status(400).json({
      message: "insufficient parameters."
    });
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    const daysAgo = getDaysAgoDate(new Date(), 14);
    let resultZeroRD = yield db.collection('vehicles').aggregate([
      {$match: {
        facility: facility,
        entranceDate: {'$gte': `${daysAgo}`}
      }},
      {$project: {
        'vin': 1,
        'batchId': 1,
        'facility': 1,
        // 'entranceStatus': 1,
        'entranceDate': 1,
        // 'surveyRounds': 1,
        // 'vtbmym': 1,
        // 'estimatedSurveyDateFirst': 1,
        // 'estimatedSurveyDateSecond': 1,
        'status': 1,
        'status2': 1,
        'vehicle.plateNo': 1,
        'vehicle.vehicleType': 1,
        'vehicle.brand': 1,
        // 'vehicle.model': 1,
        // 'vehicle.color': 1,
        // 'vehicle.engineNo': 1,
        // 'vehicle.useCharacter': 1,
        // 'vehicle.conditionOnEntrance': 1,
        'vehicle.residualValueBeforeFD': 1,
        // 'dismantling': 1,
        // 'owner.name': 1,
        // 'owner.address': 1,
        // 'owner.idNo': 1,
        // 'agent.name': 1,
        // 'agent.idNo': 1,
        // 'owner.tel': 1,
        'feesAndDeductions': 1,
        rvAfterFD: {
          $subtract: [
            {$cond: [
              {$eq: ['$vehicle.residualValueBeforeFD', '']},
              0,
              '$vehicle.residualValueBeforeFD'
            ]},
            {$sum: {
              $map: {
                input: '$feesAndDeductions',
                as: 'fd',
                in: '$$fd.amount'
              }
            }}
          ]
        }
      }},
      {$match: {
        rvAfterFD: {$eq: 0}
      }},
      { $sort : { entranceDate : -1 } }
    ]).toArray();
    return res.json(resultZeroRD);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

router.get('/', (req, res) => {
  const queryParams = req.query;
  if (!queryParams || !Object.keys(queryParams)) {
    return res.status(400).json({
      message: "insufficient parameters."
    });
  }
  const keys = Object.keys(queryParams);
  
  // value of each queryParam has been JSON.stringify-ed at the frontend
  keys.forEach(k => {
    queryParams[k] = JSON.parse(queryParams[k]);
  })
  console.log(queryParams);
  switch (true) {
    case queryParams.title === 'payment-to-owner-ready':
      return rootGetPaymentToOwnerReady(req, res);
    case queryParams.title === 'payment-to-owner-zero-rd':
      return rootGetPaymentToOwnerZeroRD(req, res);
    default:
      return rootGetDefault(req, res, queryParams, keys);
  }
  // return res.json(req.user);
})

router.get('/one', (req, res) => {
  // example query 
  // /api/vehicles/one?vin=asdfa&returnIDOnly=true
  if (!req.query.vin && !req.query.batchId && !req.query.vehicleId) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    let vehicle;
    switch (true) {
      case !!req.query.vin:
        const docs = yield db.collection('vehicles').find({vin: req.query.vin}).toArray();
        if (!docs.length) {return res.status(400).json({
          message: `no vehicle whose vin is ${req.query.vin}`
        })}
        vehicle = docs[0];
        break;
      case !!req.query.vehicleId:
        vehicle = yield db.collection('vehicles').findOne({_id: new ObjectID(req.query.vehicleId)});
        if (!vehicle) {return res.status(400).json({
          message: `no vehicle whose id is ${req.query.vehicleId}`
        })}
        break;
      case !!req.query.batchId:
        vehicle = yield db.collection('vehicles').findOne({batchId: req.query.batchId});
        if (!vehicle) {return res.status(400).json({
          message: `no vehicle whose batchId is ${req.query.batchId}`
        })}
        break;
    }


    // const vehicle = docs[0];
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

router.patch('/survey', (req, res) => {
  // vehicleList: {vin, vehicleType}[]
  // surveyType can be either 'firstSurvey' or 'secondSurvey'
  // if surveyType is firstSurvey, and vehicleType is 3, mark both firstSurvey and secondSurvey as done
  if (!req.body['vehicleList'] || !req.body['surveyType']) {
    return res.status(400).json({
      message: 'insufficient parameters.'
    })
  }

  const vehicleList = req.body['vehicleList'];
  const surveyType = req.body['surveyType'];

  const userId = req.user._id;
  const patchedAt = (new Date()).toISOString();
  // patch status.firstSurvey.done, status.firstSurvey.date and modifiedAt, modifiedBy
  const patchesForOneVehicle = {
    vin: '',
    patches: [
      {op: 'replace', path: '/modifiedAt', value: patchedAt},
      {op: 'replace', path: '/modifiedBy', value: userId},
      {op: 'replace', path: `/status/${surveyType}/done`, value: true},
      {op: 'replace', path: `/status/${surveyType}/date`, value: patchedAt.slice(0, 10)},
    ],
    patchedAt,
    patchedBy: userId
  };

  const patchesForAllVehicles = vehicleList.map(vehicle => {
    return Object.assign({}, patchesForOneVehicle, {vin: vehicle.vin})
  });

  const patchesToApply = toMongodb(patchesForOneVehicle.patches);
  // res.json(patchesToApply);
  co(function*() {
    const db = yield dbX.dbPromise;
    const patchResult = yield db.collection('vehiclePatches').insertMany(patchesForAllVehicles);
    const updateResult = yield db.collection('vehicles').updateMany({
      vin: {$in: vehicleList}
    }, patchesToApply)
    res.json(updateResult);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
})

router.patch('/one', (req, res) => {
  const vehicleId = req.query.vehicleId;
  const vin = req.query.vin; // shall delete this from query and replace patches.vin with patches.vehicleId
  if (!vehicleId) {
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
    const patches = {patches: preparePatches(req.body.patches)};
    patches.createdAt = patchedAt;
    patches.createdBy = req.user._id;
    patches.vin = vin;
    patches.vehicleId = vehicleId;

    // const vtbmymPatch = patches.patches.find(p => p.path.indexOf('vtbmym') > -1);
    // if (vtbmymPatch && vtbmymPatch.value === 'new') {
    //   const vtbmymId = yield getVtbmymIdPromise(db, patches);
    //   vtbmymPatch.value = vtbmymId;
    // }


    const patchesToApply = toMongodb(patches.patches);
    console.log('patchesToApply', patchesToApply);

    let patchesToApplyFollowingUp, toApplyPullPatches; // in case $unset op for array elements, need following up $pull ops
    if (Object.keys(patchesToApply).indexOf('$unset') > -1) {
      toApplyPullPatches = true;
      patchesToApplyFollowingUp = {'$pull': {}};
      const pullKeys = [];
      Object.keys(patchesToApply['$unset']).forEach(k => {
        const routes = k.split('.');
        const pullKey = routes.slice(0, routes.length - 1).join('.');
        if (pullKeys.indexOf(pullKey) === -1) {
          pullKeys.push(pullKey);
        }
      })
      pullKeys.reduce((acc, curr) => {
        acc['$pull'][curr] = null;
        return acc;
      }, patchesToApplyFollowingUp)
    }
    console.log('patchesToApplyFollowingUp', patchesToApplyFollowingUp);

    // {$pull : {"interests" : null}}
    const patchResult = yield db.collection('vehiclePatches').insert(patches);
    const updateResult = yield db.collection('vehicles').updateOne(
      {_id: new ObjectID(vehicleId)},
      patchesToApply
    );

    if (toApplyPullPatches) {
      console.log('pulling null elements...')
      const pullResult = yield db.collection('vehicles').updateOne(
        {_id: new ObjectID(vehicleId)},
        patchesToApplyFollowingUp
      )
    }

    // update models set in brand
    let patchedModel = false;
    for (const patch of patches.patches) {
      if (patch.path.indexOf('model') > -1) {
        patchedModel = true;
        break;
      }
    }
    if (patchedModel) {
      const thatVehicle = yield db.collection('vehicles').findOne({_id: new ObjectID(vehicleId)}, {'vehicle.brand': 1, 'vehicle.model': 1});
      const addModelToSetInBrandResult = yield db.collection('brands').updateOne({
        _id: new ObjectID(thatVehicle.vehicle.brand)
      }, {$addToSet: {models: thatVehicle.vehicle.model}});
    }


    res.json(updateResult);
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

router.get('/reports', require('./reports'));

// search by vin or plateNo or batchId
router.get('/search', (req, res) => {
  const key = req.query.key;
  if (!key) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  // res.send(req.query.key);
  co(function*() {
    const db = yield dbX.dbPromise;
    const byVehicleCriteria = (key.length === 12 || key.length === 24) ? [
      {_id: new ObjectID(key)},
      {vin: {$regex: key}},
      {'vehicle.plateNo': {$regex: key}},
    ] : [
      {vin: {$regex: key}},
      {'vehicle.plateNo': {$regex: key}},
    ];
    let resultVINPlateNo = yield db.collection('vehicles').find(
      {$or: byVehicleCriteria},
      {vin: 1, 'vehicle.plateNo': 1, _id: 1}
    ).toArray();

    resultVINPlateNo = resultVINPlateNo.map(item => ({
      type: 'vehicle',
      // displayValue: `${item.vin} / ${item.vehicle.plateNo}`,
      _id: item._id,
      vin: item.vin,
      plateNo: item.vehicle.plateNo
    }));

    let resultBatchId = yield db.collection('vehicles').aggregate([
      {$match: {
        batchId: {$regex: key},
      }},
      {$group: {
        _id: {batchId: '$batchId'}
      }}
    ]).toArray();

    resultBatchId = resultBatchId.map(item => ({
      type: 'batch',
      // displayValue: item._id.batchId,
      _id: item._id.batchId
    }));

    const result = [...resultBatchId, ...resultVINPlateNo];

    res.json(result);
    // const docs = yield db.collection('vehicles').find({vin: req.query.vin}/*, {
    //   '_id': 0,
    //   'createdAt': 0,
    //   'createdBy': 0,
    //   'modifiedAt': 0,
    //   'modifiedBy': 0
    // }*/).toArray();
    // if (!docs.length) {return res.status(400).json({
    //   message: `no vehicle whose vin is ${req.query.vin}`
    // })}
    // const vehicle = docs[0];
    // if (req.query.returnIDOnly && JSON.parse(req.query.returnIDOnly)) {
    //   return res.json({
    //     _id: vehicle._id
    //   }); 
    // } else {
    //   const userC = yield db.collection('users').find({_id: vehicle.createdBy}, {password: 0}).toArray();
    //   const userM = yield db.collection('users').find({_id: vehicle.modifiedBy}, {password: 0}).toArray();
    //   vehicle.createdBy = userC[0];
    //   vehicle.modifiedBy = userM[0];
    //   return res.send(vehicle);
    // }

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })



  
})



router.get('/status', require('./status'));

module.exports = router;