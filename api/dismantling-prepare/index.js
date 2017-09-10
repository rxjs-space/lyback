const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');

const strContains = require('../../utils').strContains;
const getLastSundays = require('../../utils/last-sundays');
const dbX = require('../../db');


const rootPost = (req, res) => {
  res.json({ok: true, at: 'rootPost'});
}
const reportsGet = (req, res) => {



  co(function*() {
    let result;
    const lastSundays = getLastSundays();  
    const db = yield dbX.dbPromise;

    const resultReady = yield db.collection('vehicles').aggregate([
      {'$match': {
        '$or': [
          {
            'status2.dismantlingOrderId': {'$exists': false},
            'status.dismantled.done': false,
          },
          {
            'status2.dismantlingOrderId': '',
            'status.dismantled.done': false,
          },

        ]
      }},
      {'$group': {
        '_id': {
          'vehicleType': '$vehicle.vehicleType',
          'isDismantlingReady':'$status2.isDismantlingReady',
        },
        'thisWeek': {'$sum': {'$cond': [
          {'$gt': ['$entranceDate', lastSundays['1']]}, 1, 0
        ]}},
        'lastWeek': {'$sum': {'$cond': [
          {'$lte': ['$entranceDate', lastSundays['1']]}, {'$cond': [
            {'$gt': ['$entranceDate', lastSundays['2']]}, 1, 0
          ]}, 0
        ]}},
        'evenEarlier': {'$sum': {'$cond': [
          {'$lte': ['$entranceDate', lastSundays['2']]}, 1, 0
        ]}},
        'total': { '$sum': 1 }
      }}
    ]).toArray();

    result = resultReady.map(r => {
      return {
        'vehicle.vehicleType': r._id['vehicleType'],
        'status2.isDismantlingReady': r._id['isDismantlingReady'],
        thisWeek: r.thisWeek,
        lastWeek: r.lastWeek,
        evenEarlier: r.evenEarlier,
        total: r.total,
      }
    })

    res.json(result);
  })
  
}

router.post('/', rootPost);
router.get('/reports', reportsGet);

module.exports = router;