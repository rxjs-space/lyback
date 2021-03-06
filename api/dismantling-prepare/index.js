const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');
const strContains = require('../../utils').strContains;
const getLastSundays = require('../../utils/last-sundays');
const getLastMondayDates = require('../../utils').getLastMondayDates;
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const dbX = require('../../db');


const rootGet = (req, res) => {
  // accept queryParams
  co(function*() {
    const db = yield dbX.dbPromise;
    let queryResult;
    switch (true) {
      case req.query.recentOnly && JSON.parse(req.query.recentOnly):
        const sevenDaysAgoBeijingZeroHours = new Date(`${getDaysAgoDate(new Date(), 8)}T16:00:00.000Z`);
        // console.log(sevenDaysAgoBeijingZeroHours);
        // get all batches which is created after sevenDaysAgoBeijingZero
        queryResult = yield db.collection('dismantlingPrepareBatches').aggregate([
          {$match: {
            'createdAt': {'$gte': sevenDaysAgoBeijingZeroHours}
          }},
          {$sort: {'createdAt': -1}}
          // {$unwind: '$vehicleIds'},
          // {$lookup: {
          //   from: 'vehicles',
          //   localField: 'vehicleIds',
          //   foreignField: '_id',
          //   as: 'vehicleDetails'
          // }},
          // {$unwind: '$vehicleDetails'},
          // {$project: {
          //   _id: 1, vehicleId: '$vehicleIds', createdAt: 1, createdBy: 1,
          //   batchId: '$vehicleDetails.batchId', vin: '$vehicleDetails.vin',
          //   plateNo: '$vehicleDetails.vehicle.plateNo', vehicleType: '$vehicleDetails.vehicle.vehicleType'
          // }}
        ])
        .toArray();
        res.json(queryResult);
        break;
      case !!req.query._id:
        queryResult = yield db.collection('dismantlingPrepareBatches').findOne({
          _id: new ObjectID(JSON.parse(req.query._id))
        });
        res.json(queryResult);
        break;
      default:
        console.log(req.query);
        res.json({
          ok: true
        })
    }
  }).catch(err => {
    console.log('error at [dismanltingPrepare/post]:', err.stack);
    return res.status(500).json(err.stack);
  });

};

const rootPost = (req, res) => {
  // create a new batch, get the batch._id
  // write the batch._id to each vehicle and update status.dismantlingPrepare
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }

  if (!req.body.vehicleIds) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  const thatUser = req.user._id;
  const thatTime = new Date();

  co(function*() {
    const db = yield dbX.dbPromise;
    const vehicles = req.body.vehicleIds.map(id => ({
      vehicleId: new ObjectID(id)
    }));
    const newBatch = {
      vehicles,
      completed: true, // no more ops needed, all d-prepare batch completes on creation
      createdAt: thatTime,
      createdBy: thatUser
    };

    const saveResult = yield db.collection('dismantlingPrepareBatches').insert(newBatch);
    console.log('new dismantlingPrepare batch inserted');
    const batchId = saveResult.insertedIds[0];
    const batch = yield db.collection('dismantlingPrepareBatches').findOne({_id: batchId});
    yield coForEach(req.body.vehicleIds, function*(vehicleId) {
      const vPatches = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: thatTime},
          {op: 'replace', path: '/modifiedBy', value: thatUser},
          {op: 'add', path: '/status2/dismantlingPrepareBatchIds', value: batchId},
          {op: 'replace', path: '/status/dismantlingPrepare/done', value: true},
          {op: 'replace', path: '/status/dismantlingPrepare/date', value: thatTime}
        ],
        createdAt: thatTime,
        createdBy: thatUser,
        trigger: 'dismantlingPrepareBatches',
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

    res.json(batch);
  }).catch(err => {
    console.log('error at [POST dismanlting-prepare]:', err.stack);
    return res.status(500).json(err.stack);
  });
}
const reportsGet = (req, res) => {
  co(function*() {
    let result;
    const db = yield dbX.dbPromise;
    let resultNotReady = yield db.collection('vehicles').aggregate([
      {$match: {
        'status2.isDismantlingReady': false,
        'metadata.isDeleted': false
      }},
      {$group: {
        _id: {
          entranceDate: '$entranceDate',
          vehicleType: '$vehicle.vehicleType'
        },
        total: {$sum: 1}
      }}
    ]).toArray();
    resultNotReady = resultNotReady.map(r => ({
      entranceDate: r._id.entranceDate,
      vehicleType: r._id.vehicleType,
      total: r.total
    }));

    let resultReadyNotPrepared = yield db.collection('vehicles').aggregate([
      {$match: {
        'status2.isDismantlingReady': true,
        'status.dismantlingPrepare.done': false,
        'metadata.isDeleted': false
      }},
      {$group: {
        _id: {
          entranceDate: '$entranceDate',
          vehicleType: '$vehicle.vehicleType'
        },
        total: {$sum: 1}
      }}
    ]).toArray();
    resultReadyNotPrepared = resultReadyNotPrepared.map(r => ({
      entranceDate: r._id.entranceDate,
      vehicleType: r._id.vehicleType,
      total: r.total
    }));

    result = {resultNotReady, resultReadyNotPrepared};
    res.json(result);
  })
  
}

router.post('/', rootPost);
router.get('/reports', reportsGet);
router.get('/', rootGet); // with queryParma recentOnly, return a list of vehicles with batchCreatedAt

module.exports = router;
