const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');

const strContains = require('../../utils').strContains;
const getLastSundays = require('../../utils/last-sundays');
const getLastMondayDates = require('../../utils').getLastMondayDates;
const dbX = require('../../db');

// console.log(getLastMondayDates(3));

const rootPost = (req, res) => {
  res.json({ok: true, at: 'rootPost'});
}
const reportsGet = (req, res) => {
  co(function*() {
    let result;
    const db = yield dbX.dbPromise;
    let resultNotReady = yield db.collection('vehicles').aggregate([
      {$match: {
        'status2.isDismantlingReady': false
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
        'status.dismantlingPrepare.done': false
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

module.exports = router;