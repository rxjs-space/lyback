const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/last-sundays');
const getTenDaysAgo = require('../../utils/ten-days-ago');

// const today = (new Date());
// const onedayMS = 1000 * 60 * 60 * 24;
// const tenDaysAgo = (new Date(Date.parse(today) - onedayMS * 10));
// const tenDaysAgoDate = tenDaysAgo.toISOString().slice(0, 10);


module.exports = (req, res) => {


  co(function*() {
    const db = yield dbX.dbPromise;

    let resultLatest10Days = yield db.collection('vehicles').aggregate([
      {'$match': {
        'entranceDate': {'$gt': getTenDaysAgo()}
      }},
      {'$group': {
        '_id': {
          'vehicle.vehicleType': '$vehicle.vehicleType',
          'entranceDate': '$entranceDate'
        },
        'total': {
          '$sum': 1
        }
      }}
    ]).toArray();
    resultLatest10Days = resultLatest10Days.map(r => ({
      'vehicle.vehicleType': r['_id']['vehicle.vehicleType'],
      'entranceDate': r['_id']['entranceDate'],
      'total': r['total'],
    }))
    res.send(resultLatest10Days);
  })


}


    
  //   let resultIdle = yield db.collection('vehicles').aggregate([
  //     {'$match': {'dismantling': false, 'status.dismantled.done': false, 'auctioning': false, 'status.sold.done': false}},
  //     {'$group': {
  //       '_id': {
  //         'vehicle.vehicleType': '$vehicle.vehicleType',
  //         'status.firstSurvey.done': '$status.firstSurvey.done',
  //         'status.secondSurvey.done': '$status.secondSurvey.done'
  //       },
  //       'thisWeek': {'$sum': {'$cond': [
  //         {'$gt': ['$entranceDate', lastSundays['1']]}, 1, 0
  //       ]}},
  //       'lastWeek': {'$sum': {'$cond': [
  //         {'$lte': ['$entranceDate', lastSundays['1']]}, {'$cond': [
  //           {'$gt': ['$entranceDate', lastSundays['2']]}, 1, 0
  //         ]}, 0
  //       ]}},
  //       'evenEarlier': {'$sum': {'$cond': [
  //         {'$lte': ['$entranceDate', lastSundays['2']]}, 1, 0
  //       ]}},
  //       'total': { '$sum': 1 }
  //     }}
  //   ]).toArray();
  // })


  // res.send('ok');

