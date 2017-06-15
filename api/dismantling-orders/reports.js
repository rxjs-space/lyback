const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/lastSundays');

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
  const reduceFunctionWaiting =
  `
    function(curr, result) {
      if (curr.entranceDate > '${lastSundays['1']}') {result.thisWeek++; }
      if (curr.entranceDate <= '${lastSundays['1']}' && curr.entranceDate > '${lastSundays['2']}') {result.lastWeek++; }
      if (curr.entranceDate <= '${lastSundays['2']}') {result.evenEarlier++; }
      result.total++;
    }
  `;


  co(function*() {
    const db = yield dbX.dbPromise;
    // const resultWaiting = yield db.collection('vehicles').group(
    //   ['vehicle.vehicleType', 'status.firstSurvey.done', 'status.secondSurvey.done'], 
    //   {'dismantling': false, 'status.dismantled.done': false, 'auctioning': false, 'status.sold.done': false}, 
    //   {'thisWeek': 0, 'lastWeek': 0, 'evenEarlier': 0, 'total': 0},
    //   reduceFunctionWaiting
    // )

    let resultWaiting = yield db.collection('vehicles').aggregate([
      {'$match': {'dismantling': false, 'status.dismantled.done': false, 'auctioning': false, 'status.sold.done': false}},
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

    // console.log(resultWaiting);
    resultWaiting = resultWaiting.map(r => {
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

    let resultDismantling = yield db.collection('dismantlingOrders').aggregate([
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

    resultDismantling = resultDismantling.map(r => {
      return {
        vehicleType: r._id.vehicleType,
        started: r._id.started,
        thisWeek: r.thisWeek,
        lastWeek: r.lastWeek,
        evenEarlier: r.evenEarlier,
        total: r.total
      }
    })

    res.json({
      waiting: resultWaiting,
      dismantling: resultDismantling
    });
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}