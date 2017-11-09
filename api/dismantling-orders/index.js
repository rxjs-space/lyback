const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');

const strContains = require('../../utils').strContains;
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
  keys.forEach(k => {
    searchQuery[k] = JSON.parse(searchQuery[k]);
  })
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



  co(function*() {
    const db = yield dbX.dbPromise;
    const ttQueryResult = yield db.collection('tt').find({name: 'types'}).toArray();
    const vehicleTypeIdsForMotocycle = ttQueryResult[0]['vehicleTypeIdsForMotocycle'];


    switch(dbQuery['vehicleType']) {
      case 'non-motorcycle':
        dbQuery['vehicleType'] = {$nin: vehicleTypeIdsForMotocycle}
        break;
      case 'motorcycle':
        dbQuery['vehicleType'] = {$in: vehicleTypeIdsForMotocycle}
        break;
    }

  // if (dbQuery['vehicleType'] === 'z') {
  //   dbQuery['vehicleType'] = {$ne: '3'}
  // }  

  console.log(dbQuery);

    const docs = yield db.collection('dismantlingOrders').find(dbQuery, {'partsAndWastesPP': 0})
    .sort([['_id', -1]])
    .toArray();
    res.json(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
})

router.post('/', (req, res) => {
  if (!req.body || !req.body.dismantlingOrder || !req.body.patches) {
    return res.status(400).json({
      message: "insufficient/incorrect parameters."
    })
  }

  const createdAt = new Date();
  const createdBy = req.user._id;

  const newDismantlingOrder = req.body.dismantlingOrder;
  newDismantlingOrder.vehicleId = new ObjectID(newDismantlingOrder.vehicleId);
  newDismantlingOrder.vtbmym = new ObjectID(newDismantlingOrder.vtbmym);
  newDismantlingOrder.planners = newDismantlingOrder.planners.map(p => new ObjectID(p));
  newDismantlingOrder.productionOperators = newDismantlingOrder.productionOperators.map(p => new ObjectID(p));
  newDismantlingOrder.qualityInspectors = newDismantlingOrder.qualityInspectors.map(p => new ObjectID(p));
  newDismantlingOrder.createdAt = createdAt;
  newDismantlingOrder.createdBy = createdBy;

  let writeStatus = {
    dismantlingOrder_insertItem: null,
    dismantlingOrder_insertPatches: null,
    vehicle_insertPatches: null,
    vehicle_applyPatches: null, // mark dismantled if dismantlingOrder is completed
    inventoryInput_insertEntries: null,
    dismantlingOrder_updatePWs: null
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    writeStatus.dismantlingOrder_insertItem = yield db.collection('dismantlingOrders').insert(newDismantlingOrder);
    let dismantlingOrderId = writeStatus.dismantlingOrder_insertItem.insertedIds[0];
    if (typeof dismantlingOrderId === 'string') {
      dismantlingOrderId = new ObjectID(dismantlingOrderId);
    }
    const patchesToInsert = {
      patches: req.body.patches,
      dismantlingOrderId,
      createdAt,
      createdBy
    };

    writeStatus.dismantlingOrder_insertPatches = yield db.collection('dismantlingOrderPatches').insert(patchesToInsert);

    const updatedDismantlingOrder = yield db.collection('dismantlingOrders').findOne({
      _id: dismantlingOrderId
    });
    const vehicleResults = yield updateVehicle(db, updatedDismantlingOrder, req, createdAt, createdBy);
    const inventoryInputResults = yield insertInventoryAndUpdateDismantlingOrder(db, updatedDismantlingOrder, req, createdAt, createdBy);
    writeStatus = Object.assign(writeStatus, vehicleResults, inventoryInputResults);
    console.log('writeStatus:', writeStatus);
    res.json(writeStatus);
  }).catch((err) => {
    res.status(500).json(err.stack);
  })

})

// router.post('/to-delete', (req, res) => {
//   if (!req.body) {
//     return res.status(400).json({
//       message: 'no data provided.'
//     })
//   }
//   if (!req.body.dismantlingOrder || !req.body.patches) {
//     return res.status(400).json({
//       message: "insufficient/incorrect parameters."
//     })
//   }

//   const newDismantlingOrder = req.body.dismantlingOrder;
//   if(!newDismantlingOrder.vin || !newDismantlingOrder.orderDate) {
//     return res.status(400).json({
//       message: 'non-standard dismantlingOrder content'
//     })
//   }

//   let writeStatus = {
//     dismatlingOrderPatches1: false,
//     dismantlingOrder: false,
//     dismatlingOrderPatches2: false,
//     vehiclePatches: false,
//     vehicle: false
//   }
//   // and other validations
//   co(function*() {
//     const db = yield dbX.dbPromise;
//     // try find the last dismantling order with the same vin
//     // get dismantlingOrder by vin, if no, continue
//     // if found, check if normal, halt;
//     const docs = yield db.collection('dismantlingOrders')
//       .find({vin: newDismantlingOrder.vin, orderType: 'dot1'})
//       .sort([['_id', -1]])
//       .limit(1)
//       .toArray();
//     if (docs.length) {
//       // const lastDismantlingOrderWithSameVIN = docs[0];
//       return res.status(400).json({
//         message: `已存在 VIN 为 ${newDismantlingOrder.vin} 的正常拆解计划。`
//       })

//     }

//     // console.log(JSON.stringify(req.body));
//     const patches = {patches: req.body.patches};
//     const patchedAt = (new Date()).toISOString();
//     const userId = req.user._id;

//     Object.assign(newDismantlingOrder, {
//       createdAt: patchedAt,
//       createdBy: userId
//     });

//     Object.assign(patches, {
//       createdAt: patchedAt,
//       createdBy: userId,
//       dismantlingOrderId: 'tba'
//     });

//     /*
//       save procedure
//       1) save dismantlingOrderPatches and get the dop._id of inserted doc
//       2) save dismantlingOrder and get the do._id of inserted doc
//       3) update dismantlingOrderPatches(dop._id) with the do._id
//       4) update vehiclePatches(vin) with dop._id
//       5) update vehicle(vin), mark dismantling as true
    
//     */

//     const patchesSaveResult = yield db.collection('dismantlingOrderPatches').insert(patches);
//     const patchesId = patchesSaveResult.insertedIds[0];
//     writeStatus.dismatlingOrderPatches1 = true;

//     const saveResult = yield db.collection('dismantlingOrders').insert(newDismantlingOrder);
//     const dismantlingOrderId = saveResult.insertedIds[0];
//     writeStatus.dismantlingOrder = true;

//     const patchesUpdateResult = yield db.collection('dismantlingOrderPatches').updateOne(
//       {_id: patchesId}, {$set: {dismantlingOrderId}}
//     );
//     writeStatus.dismatlingOrderPatches2 = true;

//     const vPatchedAt = (new Date()).toISOString();
//     const vPatches = {
//       patches: [
//         {op: 'replace', path: '/modifiedAt', value: vPatchedAt},
//         {op: 'replace', path: '/modifiedBy', value: userId},
//         {op: 'replace', path: '/status2/dismantlingOrderId', value: dismantlingOrderId},
//         // {op: 'replace', path: '/status2/dismantling', value: true},
//         // {op: 'replace', path: '/status/dismantled/ref', value: dismantlingOrderId},
//       ],
//       createdAt: vPatchedAt,
//       createdBy: userId,
//       trigger: 'dismantlingOrderPatches',
//       triggerRef: patchesId,
//       vin: newDismantlingOrder.vin
//     };
//     const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
//     writeStatus.vehiclePatches = true;

//     const vPatchesToApply = toMongodb(vPatches.patches);
//     const vUpdateResult = yield db.collection('vehicles').updateOne(
//       {vin: newDismantlingOrder.vin},
//       vPatchesToApply
//     );
//     writeStatus.vehicle = true;

//     console.log(writeStatus);
//     res.json(saveResult);
//     // res.json({
//     //   ok: true
//     // })
//   }).catch(error => {
//     return res.status(500).json({
//       error: error.stack,
//       writeStatus
//     });
//   })

// })

router.get('/one', (req, res) => {
  if (!req.query._id) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  const _id = new ObjectID(req.query._id);
  co(function*() {
    const db = yield dbX.dbPromise;
    const dismantlingOrder = yield db.collection('dismantlingOrders').findOne({_id});
    if (!dismantlingOrder) {return res.status(400).json({
      message: `no dismantling order whose id is ${_id}`
    })}
    // const userC = yield db.collection('users').find({_id: dismantlingOrder.createdBy}, {password: 0}).toArray();
    // const userM = yield db.collection('users').find({_id: dismantlingOrder.modifiedBy}, {password: 0}).toArray();
    // dismantlingOrder.createdBy = userC[0];
    // dismantlingOrder.modifiedBy = userM[0];
    return res.send(dismantlingOrder);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
})

const updateVehicle = (db, updatedDismantlingOrder, req, patchedAt, patchedBy) => {
  return co(function*() {
    // if new dismantlingOrder, update the dismantlingOrderId
    // if completed dismantlingOrder, update status.dismantled
    const isNew = !req.body._id;
    const completedAtPatch = req.body.patches.find(patch => patch.path.indexOf('completedAt') > -1);
    const isCompleted = !!completedAtPatch;

    if (!isNew && !isCompleted) {
      return {
        vehicle_insertPatches: 'noop',
        vehicle_applyPatches: 'noop',
      };
    } else {
      const patches = req.body.patches;
      const vehiclePatchesToInsert = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: patchedAt},
          {op: 'replace', path: '/modifiedBy', value: req.user._id},
        ],
        vehicleId: updatedDismantlingOrder.vehicleId,
        createdAt: patchedAt,
        createdBy: patchedBy,
        trigger: 'dismantlingOrders',
        triggerRef: updatedDismantlingOrder._id
      }
      switch (true) {
        case isNew && !isCompleted:
          vehiclePatchesToInsert.patches.push(
            {op: 'replace', path: '/status2/dismantling', value: true},
            {op: 'replace', path: '/status2/dismantlingOrderId', value: updatedDismantlingOrder._id}
          );
          break;
        case isNew && isCompleted:
          vehiclePatchesToInsert.patches.push(
            {op: 'replace', path: '/status2/dismantling', value: false},
            {op: 'replace', path: '/status2/dismantlingOrderId', value: updatedDismantlingOrder._id},
            {op: 'replace', path: '/status/dismantled/done', value: true},
            {op: 'replace', path: '/status/dismantled/date', value: patchedAt}
          );
          break;
        case !isNew && isCompleted:
          vehiclePatchesToInsert.patches.push(
            {op: 'replace', path: '/status2/dismantling', value: false},
            {op: 'replace', path: '/status/dismantled/done', value: true},
            {op: 'replace', path: '/status/dismantled/date', value: patchedAt}
          );
          break;
      }

      const vehicle_insertPatches = yield db.collection('vehiclePatches').insert(vehiclePatchesToInsert);
      const vehicle_applyPatches = yield db.collection('vehicles').updateOne(
        {_id: updatedDismantlingOrder.vehicleId},
        toMongodb(vehiclePatchesToInsert.patches)
      );
      return {
        vehicle_insertPatches: 'done',
        vehicle_applyPatches: 'done'
      };
    }

  })

}

const insertInventoryAndUpdateDismantlingOrder = (db, updatedDismantlingOrder, req, patchedAt, patchedBy) => {
  return co(function*() {
    const patchesForAddingPWs = req.body.patches.filter(patch => {
      // return patch.op === 'add' && patch.path === '/partsAndWastesPP'
      return patch.path.indexOf('/partsAndWastesPP') > -1;
    });
    if (!patchesForAddingPWs.length) {
      return {
        inventoryInput_insertEntries: 'noop',
        dismantlingOrder_updatePWs: 'noop'
      };
    } else {
      // generate new products, insert into inventory, get the product ids, save back to dismantling order
      const dismantlingOrderPatchesToInsert = {
        patches: [],
        dismantlingOrderId: updatedDismantlingOrder._id,
        createdAt: patchedAt,
        createdBy: patchedBy,
        trigger: 'inventoryInputFeedback',
      };
      
      const pws = patchesForAddingPWs.reduce((acc, curr) => {
        // const typeId = Object.keys(curr.value)[0];
        const typeId = curr.path.split('/')[2];
        
        if (typeId.indexOf('p') > -1) {
          // unwind 'part' items with productionCount more than 1
          for (let i = 0; i < curr.value.productionCount; i++) {
            const newIventoryItem = {
              vehicleId: updatedDismantlingOrder.vehicleId,
              vtbmym: updatedDismantlingOrder.vtbmym,
              typeId,
              inputDate: patchedAt,
              isInStock: true,
              isReadyForSale: true,
              outputTo: '',
              outputDate: '',
              outputRef: '',
              createdAt: patchedAt,
              createdBy: patchedBy,
              source: 'dismantling'
            };
            acc = [...acc, newIventoryItem];
          }
        } else {
          // record count for 'waste' item
          const newIventoryItem = {
            vehicleId: updatedDismantlingOrder.vehicleId,
            vtbmym: updatedDismantlingOrder.vtbmym,
            typeId,
            inputDate: patchedAt,
            isInStock: true,
            isReadyForSale: true,
            quantity: curr.value.productionCount,
            outputTo: '',
            outputDate: '',
            outputRef: '',
            createdAt: patchedAt,
            createdBy: patchedBy,
            source: 'dismantling'
          };
          acc = [...acc, newIventoryItem];
        }
        return acc;
      }, []);

      const inventoryInsertResult = yield db.collection('inventory').insertMany(pws);
      const pwIds = inventoryInsertResult.insertedIds;
      yield coForEach(pwIds, function*(id) {
        const updatePWResult = yield db.collection('inventory').updateOne({_id: id}, {
          $set: {'idString': JSON.parse(JSON.stringify(id))}
        }, {upsert: true})
      });


      dismantlingOrderPatchesToInsert.patches = patchesForAddingPWs.reduce((acc, curr) => {
        const typeId = curr.path.split('/')[2];
        const thatPatch = {
          op: 'replace',
          path: `/partsAndWastesPP/${typeId}/inventoryInputDone`,
          value: true
        }
        return [...acc, thatPatch];
      }, []);

      const insertDismantlingOrderPatchesResult =  yield db.collection('dismantlingOrderPatches').insert(dismantlingOrderPatchesToInsert);

      const updateDismantlingOrderResult = yield db.collection('dismantlingOrders').update({
        _id: updatedDismantlingOrder._id
      }, toMongodb(dismantlingOrderPatchesToInsert.patches));
      console.log(dismantlingOrderPatchesToInsert.patches);
      return {
        inventoryInput_insertEntries: 'done',
        dismantlingOrder_updatePWs: 'done'
      }
    }

  })
}



router.patch('/one', (req, res) => {
  if (!req.body || !req.body._id || !req.body.patches) {
    return res.status(400).json({
      message: 'Insufficient data provided.'
    })
  }

  const patchedAt = new Date();
  const patchedBy = new ObjectID(req.user._id);

  const dismantlingOrderId = new ObjectID(req.body._id);
  const patchesToInsert = {
    patches: [
      ...req.body.patches,
      {op: 'replace', path: '/modifiedAt', value: patchedAt},
      {op: 'replace', path: '/modifiedBy', value: patchedBy}
    ],
    dismantlingOrderId,
    createdAt: patchedAt,
    createdBy: patchedBy
  };

  let writeStatus = {
    dismantlingOrder_insertPatches: null,
    dismantlingOrder_applyPatches: null,
    vehicle_insertPatches: null,
    vehicle_applyPatches: null, // mark dismantled if dismantlingOrder is completed
    inventoryInput_insertEntries: null,
    dismantlingOrder_updatePWs: null
  }

  co(function*() {
    const db = yield dbX.dbPromise;

    writeStatus.dismantlingOrder_insertPatches = yield db.collection('dismantlingOrderPatches').insert(patchesToInsert);
    writeStatus.dismantlingOrder_applyPatches = yield db.collection('dismantlingOrders').updateOne(
      {_id: dismantlingOrderId}, toMongodb(patchesToInsert.patches)
    );

    const updatedDismantlingOrder = yield db.collection('dismantlingOrders').findOne({
      _id: dismantlingOrderId
    });
    const vehicleResults = yield updateVehicle(db, updatedDismantlingOrder, req, patchedAt, patchedBy);
    const inventoryInputResults = yield insertInventoryAndUpdateDismantlingOrder(db, updatedDismantlingOrder, req, patchedAt, patchedBy);
    writeStatus = Object.assign(writeStatus, vehicleResults, inventoryInputResults);
    console.log('writeStatus:', writeStatus);
    res.json(writeStatus);
  }).catch((err) => {
    res.status(500).json(err.stack);
  })

})


// router.patch('/one-to-delete', (req, res) => {
//   if (!req.body || !req.body.dismantlingOrderId || !req.body.patches || !req.body.vin) {
//     return res.status(400).json({
//       message: 'Insufficient data provided.'
//     })
//   }

//   const patchedAt = (new Date()).toISOString();
//   req.body.patches.push(
//     {op: 'replace', path: '/modifiedAt', value: patchedAt},
//     {op: 'replace', path: '/modifiedBy', value: req.user._id}
//   );
//   const dismantlingOrderId = new ObjectID(req.body.dismantlingOrderId);
//   const patchesToInsert = {patches: req.body.patches, dismantlingOrderId};
//   patchesToInsert.createdAt = patchedAt;
//   patchesToInsert.createdBy = req.user._id;

//   const patchesToApply = toMongodb(patchesToInsert.patches);
//   let isCompleted, completedAt, patchesToInsertForVehicle, patchesToApplyForVehicle;

//   const patchForCompletedAt = patchesToInsert.patches.filter(p => p.path === '/completedAt')[0];
//   if (patchForCompletedAt) {
//     isCompleted = true;
//     completedAt = patchForCompletedAt.value;
//   }

//   const writeStatusPatchDismantlingOrder = {
//     insertPatchesToDismantlingOrderPatches: null,
//     patchDismantlingOrder: null,
//     insertPatchesToVehiclePatches: null,
//     patchVehicle: null,
//     insertInventory: null,
//     insertPatchesToDismantlingOrderPatchesWithProductIds: null,
//     updateProductIdsInDismantlingOrder: null,
//   };

//   co(function*() {
//     const db = yield dbX.dbPromise;
//     // get dismantlingOrderType
//     const currentDismantlingOrder = yield db.collection('dismantlingOrders').find({
//       _id: dismantlingOrderId
//     }, {orderType: 1}).toArray();
//     const dismanltingOrderTypeX = currentDismantlingOrder[0].orderType;
//     // insert patches for dismantling order
//     const insertPatchesToDismantlingOrderPatchesResult = 
//       yield db.collection('dismantlingOrderPatches').insert(patchesToInsert);
//     writeStatusPatchDismantlingOrder.insertPatchesToDismantlingOrderPatches = true;
//     const patchesId = insertPatchesToDismantlingOrderPatchesResult.insertedIds[0];
//     // update dismantling order
//     const updateResult = yield db.collection('dismantlingOrders').updateOne(
//       {_id: dismantlingOrderId},
//       patchesToApply
//     );
//     writeStatusPatchDismantlingOrder.patchDismantlingOrder = true;
//     if (isCompleted && dismanltingOrderTypeX === 'dot1' /* is normal plan */) {


//       patchesToInsertForVehicle = {
//         createdAt: patchesToInsert.createdAt,
//         createdBy: patchesToInsert.createdBy,
//         trigger: 'dismantlingOrderPatches',
//         triggerRef: patchesId,
//         patches: [
//           {op: 'replace', path: '/status/dismantled/done', value: true},
//           {op: 'replace', path: '/status/dismantled/date', value: completedAt.slice(0, 10)},
//           {op: 'replace', path: '/status2/dismantling', value: false},
//           {op: 'replace', path: '/modifiedAt', value: patchesToInsert.createdAt},
//           {op: 'replace', path: '/modifiedBy', value: patchesToInsert.createdBy},
//         ]
//       };
//       patchesToApplyForVehicle = toMongodb(patchesToInsertForVehicle.patches);

      
//       // insert patches for vehicle
//       const insertPatchesToVehiclePatchesResult = 
//         yield db.collection('vehiclePatches').insert(patchesToInsertForVehicle);
//       writeStatusPatchDismantlingOrder.insertPatchesToVehiclePatches = true;

//       // update vehicle
//       const updateVehicleResult = yield db.collection('vehicles').update(
//         {vin: req.body.vin},
//         patchesToApplyForVehicle
//       )
//       writeStatusPatchDismantlingOrder.patchVehicle = true;
//     }

//     // deal with inventoryInput
//     // "/partsAndWastesPP/0/inventoryInputDate"
//     const patchesForInventoryInput = patchesToInsert.patches.filter(p => {
//       return strContains(p.path, 'inventoryInputDate');
//     });
//     // console.log('patchesForInventoryInput', patchesForInventoryInput);
//     if (patchesForInventoryInput.length) {
//       // insert into invetory and its patches
//       // vin, vtbmymId, typeId, inputDate, inputRef(if pw is from non-dismantling), outputDate, outputType, outputRef
//       // createdAt, createdBy, modifiedAt, modifiedBy
//       const dbFindVehicleResult = yield db.collection('vehicles').find({vin: req.body.vin}, {vtbmym: 1}).toArray();
//       const vtbmymId = dbFindVehicleResult[0]['vtbmym'];
//       const dbFindDOResult = yield db.collection('dismantlingOrders').find({_id: dismantlingOrderId}).toArray();
//       const dismantlingOrder = dbFindDOResult[0];
//       const items = []; // unwind to 1 item a line, according to inventoryInputCount
//       patchesForInventoryInput.forEach(patch => {
//         const itemIndexInArray = patch.path.split('/')[2];
//         const pwpp = dismantlingOrder.partsAndWastesPP[itemIndexInArray];
//         for (i = 1; i <= pwpp.inventoryInputCount; i++) {
//           items.push({
//             typeId: pwpp.id,
//             inputDate: patch.value,
//             itemIndexInArray,
//             i
//           })
//         }
//       });

//       yield coForEach(items, function*(item) {
//         const newIventoryItem = {
//           vin: req.body.vin,
//           vtbmymId,
//           typeId: item.typeId,
//           inputDate: item.inputDate,
//           isInStock: true,
//           isReadyForSale: true,
//           outputTo: '',
//           outputDate: '',
//           outputRef: '',
//           createdAt: patchesToInsert.createdAt,
//           createdBy: patchesToInsert.createdBy
//         };
//         const inventoryInsertResult = yield db.collection('inventory').insert(newIventoryItem);
//         const inventoryItemId = inventoryInsertResult.insertedIds[0];
//         item.inventoryItemId = inventoryItemId; // add inventoryItemId property to item, in order to update pwpp.productIds
//         const inventoryInputPatches = {
//           inventoryItemId,
//           patches: [
//             {op: 'replace', path: '/vin', value: req.body.vin},
//             {op: 'replace', path: '/vtbmymId', value: vtbmymId},
//             {op: 'replace', path: '/typeId', value: item.typeId},
//             {op: 'replace', path: '/inputDate', value: item.inputDate},
//           ],
//           createdAt: patchesToInsert.createdAt,
//           createdBy: patchesToInsert.createdBy,
//           trigger: 'dismantlingOrderPatchOne',
//           triggerRef: dismantlingOrderId
//         };
//         const insertPatchesResult = yield db.collection('inventoryPatches').insert(inventoryInputPatches);

//       })

//       writeStatusPatchDismantlingOrder.insertInventory = true;

//       const patchesToInsertWithProductIds = {
//         dismantlingOrderId,
//         patches: [],
//         createdAt: patchesToInsert.createdAt,
//         createdBy: patchesToInsert.createdBy
//       };
//       items.forEach(item => {
//         const patch = {
//           op: 'replace',
//           path: `/partsAndWastesPP.${item.itemIndexInArray}.productIds.${item.i - 1}`,
//           value: item.inventoryItemId
//         }
//         patchesToInsertWithProductIds.patches.push(patch);
//       })

//       // mark inventoryInputDone as true
//       patchesToInsertWithProductIds.patches.push({
//         op: 'replace',
//         path: '/inventoryInputDone',
//         value: true
//       });
//       const insertPatchesWithProductIds = yield db.collection('dismantlingOrderPatches').insert(patchesToInsertWithProductIds);
//       writeStatusPatchDismantlingOrder.insertPatchesToDismantlingOrderPatchesWithProductIds = true;
//       const patchesToApplayWithProductIds = toMongodb(patchesToInsertWithProductIds.patches);
//       // console.log(patchesToApplayWithProductIds);
//       const updateDismantlingOrdersWithProductIdsResult = yield db.collection('dismantlingOrders').updateOne(
//         {_id: dismantlingOrderId},
//         patchesToApplayWithProductIds
//       )
      
//       writeStatusPatchDismantlingOrder.updateProductIdsInDismantlingOrder = true;

//     }
    

//     console.log('writeStatusPatchDismantlingOrder:', writeStatusPatchDismantlingOrder);

//     res.json(updateResult);
//   }).catch((err) => {
//     return res.status(500).json(err.stack);
//   })

//   // res.json({ok: true})
// })


module.exports = router;