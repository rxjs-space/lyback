const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/last-sundays');
const getTenDaysAgo = require('../../utils/ten-days-ago');

const startDay = (new Date());
const onedayMS = 1000 * 60 * 60 * 24;
const nineDaysAgo = (new Date(Date.parse(startDay) - onedayMS * 9));
const nineDaysAgoDate = nineDaysAgo.toISOString().slice(0, 10);
// console.log(nineDaysAgoDate);

module.exports = (req, res) => {
  // const today = (new Date());
  // const onedayMS = 1000 * 60 * 60 * 24;
  // const todayDay = today.getDay();
  // const lastSundays = {};
  // if (todayDay > 0) {
  //   lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * todayDay)).toISOString().slice(0, 10);
  // } else {
  //   lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * 7)).toISOString().slice(0, 10);
  // };
  // lastSundays['2'] = (new Date(Date.parse(lastSundays['1']) - onedayMS * 7)).toISOString().slice(0, 10);
  const lastSundays = getLastSundays();


  co(function*() {
    const db = yield dbX.dbPromise;


    let resultIdle = yield db.collection('vehicles').aggregate([
      {'$match': {'status2.dismantling': false, 'status.dismantled.done': false, 'status2.auctioning': false, 'status.sold.done': false}},
      {'$group': {
        '_id': {
          'vehicle.vehicleType': '$vehicle.vehicleType',
          'status.firstSurvey.done': '$status.firstSurvey.done',
          'status.secondSurvey.done': '$status.secondSurvey.done'
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

    // console.log(resultIdle);
    resultIdle = resultIdle.map(r => {
      return {
        'vehicle.vehicleType': r._id['vehicle.vehicleType'],
        'status.firstSurvey.done': r._id['status.firstSurvey.done'],
        'status.secondSurvey.done': r._id['status.secondSurvey.done'],
        thisWeek: r.thisWeek,
        lastWeek: r.lastWeek,
        evenEarlier: r.evenEarlier,
        total: r.total,
      }
    })

    let resultProgressing = yield db.collection('dismantlingOrders').aggregate([
      {'$match': { 'completedAt': '' }},
      {'$group': 
        {
          '_id': {
            'vehicleType': '$vehicleType',
            'started': {
              '$gt': [ { '$ifNull': [ '$startedAt', ''] }, ''  ]
            }
          },
          'thisWeek': {'$sum': {'$cond': [
            {'$gt': ['$orderDate', lastSundays['1']]}, 1, 0
          ]}},
          'lastWeek': {'$sum': {'$cond': [
            {'$gt': ['$orderDate', lastSundays['2']]}, {'$cond': [
              {'$lte': ['$orderDate', lastSundays['1']]}, 1, 0
            ]}, 0
          ]}},
          'evenEarlier': {'$sum': {'$cond': [
            {'$lte': ['$orderDate', lastSundays['2']]}, 1, 0
          ]}},
          'total': { '$sum': 1 }
        }
      }
    ]).toArray();

    resultProgressing = resultProgressing.map(r => {
      return {
        vehicleType: r._id.vehicleType,
        started: r._id.started,
        thisWeek: r.thisWeek,
        lastWeek: r.lastWeek,
        evenEarlier: r.evenEarlier,
        total: r.total
      }
    })

    let resultCompletedLastTenDays = yield db.collection('dismantlingOrders').aggregate([
      {'$project': {
        'vehicleType': 1,
        'isAdHoc': 1,
        'completedAt': {
          '$substr': ['$completedAt', 0, 10]
        }
      }},
      {'$match': {
        'completedAt': {'$gt': `${nineDaysAgoDate}`}
      }},
      {'$group': {
        '_id': {
          'vehicleType': '$vehicleType',
          'isAdHoc': '$isAdHoc',
          'completedDate': '$completedAt'
        },
        'total': {'$sum': 1}
      }}
    ]).toArray();

    resultCompletedLastTenDays = resultCompletedLastTenDays.map(r => ({
      vehicleType: r._id.vehicleType,
      isAdHoc: r._id.isAdHoc,
      completedDate: r._id.completedDate,
      total: r.total
    }));
    // console.log(resultCompletedLastTenDays);

    res.json({
      idle: resultIdle,
      progressing: resultProgressing,
      completed: resultCompletedLastTenDays
    });
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}