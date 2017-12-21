const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');
const strContains = require('../../utils').strContains;
const getLastMondayDates = require('../../utils').getLastMondayDates;
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const dbX = require('../../db');
const simpleEquals = require('../../utils').simpleEquals;

const dataCollectionName = 'paymentToOwnerBatches';
const patchesCollectionName = 'paymentToOwnerBatchPatches';

const reportsGet = (req, res) => {
  const title = req.query.title;
  const facility = req.query.facility === 'f000' ? 'f001' : req.query.facility;
  if (!title || !facility) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    switch (true) {
      case title === 'countByTypes':
        const daysAgo = getDaysAgoDate(new Date(), 14);
        // 0 residual value, not paid
        let resultZeroRD = yield db.collection('vehicles').aggregate([
          {$match: {
            facility: facility,
            entranceDate: {'$gte': `${daysAgo}`}
          }},
          {$project: {
            // rvBeforeFD: '$vehicle.residualValueBeforeFD',
            // fdValues: {
            //   $map: {
            //     input: '$feesAndDeductions',
            //     as: 'fd',
            //     in: '$$fd.amount'
            // }},
            facility: 1,
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
          {$group: {
            '_id': {facility: '$facility'},
            'total': {'$sum': 1}
          }}
        ]).toArray();
        resultZeroRD = resultZeroRD.map(r => r.total)[0];

        let resultNotPaid = yield db.collection('vehicles').aggregate([
          {$match: {
            facility: facility,
            'status.paymentToOwner.done': false,
            'status2.paymentToOwnerBatchIds': {$size: 0}
          }},
          {$project: {
            facility: 1,
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
          {$group: {
            '_id': {facility: '$facility'},
            'total': {'$sum': 1}
          }}

        ]).toArray();
        resultNotPaid = resultNotPaid.map(r => r.total)[0];
        const result = {
          resultZeroRD,
          resultNotPaid
        };
        return res.json(result);
      default:
        return res.json({ok: true});
    }
    
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

};

const rootPost = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }

  if (!req.body.vehicles) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  const thatUser = req.user._id;
  const thatTime = new Date();
  console.log(thatUser, thatTime);

  co(function*() {
    const db = yield dbX.dbPromise;
    const vehicles = req.body.vehicles.map(v => {
      v.vehicleId = new ObjectID(v.vehicleId);
      return v;
    })
    const newBatch = {
      vehicles: vehicles,
      createdAt: thatTime,
      createdBy: thatUser,
      completed: false
    };

    const saveResult = yield db.collection(dataCollectionName).insert(newBatch);
    console.log('new payment-to-owner batch inserted');
    const batchId = saveResult.insertedIds[0];
    const batch = yield db.collection(dataCollectionName).findOne({_id: batchId});
    const patches = {
      batchId,
      patches: [
        {op: 'replace', path: '/vehicles', value: vehicles},
      ],
      patchedAt: thatTime,
      patchedBy: thatUser
    };
    const patchesSaveResult = yield db.collection(patchesCollectionName).insert(patches);

    /* update vehiclePatches and vehicle */
    yield coForEach(vehicles, function*(vehicle) {
      const vehicleId = vehicle.vehicleId;
      const vPatches = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: thatTime},
          {op: 'replace', path: '/modifiedBy', value: thatUser},
          {op: 'add', path: '/status2/paymentToOwnerBatchIds', value: batchId}
        ],
        createdAt: thatTime,
        createdBy: thatUser,
        trigger: dataCollectionName,
        triggerRef: batchId,
        vehicleId
      };
      const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
      const vPatchesToApply = toMongodb(vPatches.patches);
      console.log(vPatchesToApply);
      const vSaveResult = yield db.collection('vehicles').updateOne(
        {_id: new ObjectID(vehicleId)},
        vPatchesToApply
      );
    });

    res.json(batch); // return the full batch data, not the saveResult
  }).catch(err => {
    console.log('error at [POST payments-to-owner]:', err.stack);
    return res.status(500).json(err.stack);
  });
};

const rootPatch = (req, res) => {
  if (!req.body || !req.body._id) {
    return res.status(400).json({
      message: 'no data or no _id provided.'
    })
  }
  const batchId = new ObjectID(req.body._id);
  const thatTime = new Date();
  const thatUser = req.user._id;
  co(function*() {
    const db = yield dbX.dbPromise;
    const patchedAt = thatTime;
    const patchedBy = thatUser;

    const patches0 = req.body.patches;
    const patchCompletedAt = patches0.find(p => p.path.indexOf('completedAt') > -1);
    const completedAt = patchCompletedAt.value;
    const patchesWithoutCompletedAt = patches0.filter(p => p.path.indexOf('completedAt') === -1);
    const patches = {patches: [
      ...patchesWithoutCompletedAt,
      {op: 'replace', path: '/completedAt', value: new Date(completedAt)},
      {op: 'replace', path: '/modifiedAt', value: thatTime},
      {op: 'replace', path: '/modifiedBy', value: thatUser}
    ]};
    patches.createdAt = thatTime;
    patches.createdBy = thatUser;
    patches.batchId = batchId;

    const patchesToApply = toMongodb(patches.patches);
    console.log('patchesToApply', patchesToApply);


    const insertToPatchesResult = yield db.collection(patchesCollectionName).insert(patches);
    const updateResult = yield db.collection(dataCollectionName).updateOne(
      {_id: batchId},
      patchesToApply
    );
    const newBatch = yield db.collection(dataCollectionName).findOne({_id: batchId});
    const vehicles = newBatch.vehicles;
    yield coForEach(vehicles, function*(vehicle) {
      const vehicleId = vehicle.vehicleId;
      let batchResultPatch;
      if (vehicle.success) {
        batchResultPatch = [
          {op: 'replace', path: `/status/paymentToOwner/done`, value: true},
          {op: 'replace', path: `/status/paymentToOwner/date`, value: patchedAt}
        ]
      } else {
        batchResultPatch = [{op: 'remove', path: `/status2/paymentToOwnerBatchIds/0`}];
      }
      const vPatches = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: patchedAt},
          {op: 'replace', path: '/modifiedBy', value: patchedBy},
          ...batchResultPatch
        ],
        createdAt: patchedAt,
        createdBy: patchedBy,
        trigger: dataCollectionName,
        triggerRef: batchId,
        vehicleId
      };
      const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
      const vPatchesToApply = toMongodb(vPatches.patches);
      console.log('vPatchesToApply:', vPatchesToApply);

      let patchesToApplyFollowingUp, toApplyPullPatches = false; // in case $unset op for array elements, need following up $pull ops
      if (Object.keys(vPatchesToApply).indexOf('$unset') > -1) {
        toApplyPullPatches = true;
        patchesToApplyFollowingUp = {'$pull': {}};
        const pullKeys = [];
        Object.keys(vPatchesToApply['$unset']).forEach(k => {
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

      const vSaveResult = yield db.collection('vehicles').updateOne(
        {_id: new ObjectID(vehicleId)},
        vPatchesToApply
      );
      
      console.log('toApplyPullPatches', toApplyPullPatches);
      if (toApplyPullPatches) {
        console.log('pulling null elements...')
        const pullResult = yield db.collection('vehicles').updateOne(
          {_id: new ObjectID(vehicleId)},
          patchesToApplyFollowingUp
        )
      }

    });


    res.json(updateResult);

  }).catch(err => {
    console.log('Error at [payments-to-owner PATCH]:', err);
    return res.status(500).json(err.stack);
  })



}
const rootGet = (req, res) => {
  const title = req.query.title;
  if (!title) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    switch (title) {
      case 'progressingBatches':
        const progressingBatches = yield db.collection(dataCollectionName).find({$or: [
          {completed: false, canceled: false},
          {completed: false, canceled: {$exists: false}},
        ]}).toArray();
        return res.json(progressingBatches);
      case 'recentCompletedBatches': // completedAt within 5 weeks
        const thirtyFiveDaysAgoDate = getDaysAgoDate(new Date(), 35);
        const recentCompletedBatches = yield db.collection(dataCollectionName)
          .find({$or: [
            {
              completed: true,
              completedAt: {'$gte': new Date(`${thirtyFiveDaysAgoDate}T16:00:00.000Z`)}
            },
            {
              completed: true,
              completedAt: {$exists: false},
              modifiedAt: {'$gte': new Date(`${thirtyFiveDaysAgoDate}T16:00:00.000Z`)}
            },
          ]})
          .sort({'createdAt': -1})
          .toArray();
        return res.json(recentCompletedBatches);
    }
  }).catch(err => {
    console.log('error at [paymentToOwnerBatch/get]:', err.stack);
    return res.status(500).json(err.stack);
  });



}


router.get('/', rootGet);
router.post('/', rootPost);
router.patch('/', rootPatch);
router.get('/reports', reportsGet);

module.exports = router;
