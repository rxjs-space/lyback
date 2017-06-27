const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/last-sundays');
const getLastMondays = require('../../utils/last-mondays');
const getTenDaysAgo = require('../../utils/ten-days-ago');

// const today = (new Date());
// const onedayMS = 1000 * 60 * 60 * 24;
// const tenDaysAgo = (new Date(Date.parse(today) - onedayMS * 10));
// const tenDaysAgoDate = tenDaysAgo.toISOString().slice(0, 10);


module.exports = (req, res) => {

  co(function*() {
    const db = yield dbX.dbPromise;
    const lastSundays = getLastSundays();
    const lastMondays = getLastMondays();
    let result;

    switch (true) {
      case req.query.title === 'entrance':
        result = {lastTenDays: [], lastFiveWeeks: []}
        const resultLatest10Days = yield db.collection('vehicles').aggregate([
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
        result['lastTenDays'] = resultLatest10Days.map(r => ({
          'vehicle.vehicleType': r['_id']['vehicle.vehicleType'],
          'entranceDate': r['_id']['entranceDate'],
          'total': r['total'],
        }))
        const resultLastFiveWeeks = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$gt': lastSundays[5]}
          }},
          {'$group': {
            '_id': {
              'vehicle.vehicleType': '$vehicle.vehicleType',
            },
            [lastMondays['1']]: {'$sum': {'$cond': [
              {'$gt': ['$entranceDate', lastSundays['1']]}, 1, 0
            ]}},
            [lastMondays['2']]: {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['1']]}, {'$cond': [
                {'$gt': ['$entranceDate', lastSundays['2']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['3']]: {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['2']]}, {'$cond': [
                {'$gt': ['$entranceDate', lastSundays['3']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['4']]: {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['3']]}, {'$cond': [
                {'$gt': ['$entranceDate', lastSundays['4']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['5']]: {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['4']]}, {'$cond': [
                {'$gt': ['$entranceDate', lastSundays['5']]}, 1, 0
              ]}, 0
            ]}},
            'total': { '$sum': 1 }
          }}
        ]).toArray();

        result['lastFiveWeeks'] = resultLastFiveWeeks.map(r => ({
          [r['_id']['vehicle.vehicleType']]: [
            {entranceDate: lastMondays['5'], total: r[[lastMondays['5']]]},
            {entranceDate: lastMondays['4'], total: r[[lastMondays['4']]]},
            {entranceDate: lastMondays['3'], total: r[[lastMondays['3']]]},
            {entranceDate: lastMondays['2'], total: r[[lastMondays['2']]]},
            {entranceDate: lastMondays['1'], total: r[[lastMondays['1']]]},
            // {entranceDate: 'total', total: r[['total']]},
          ]
        }))        
        break;
      case req.query.title === 'surveyIdle':
        // res.send('survey');
        let resultSurveyIdle = yield db.collection('vehicles').aggregate([
          {'$match': {'status.secondSurvey.done': false}},
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
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        result = resultSurveyIdle.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          'status.firstSurvey.done': r._id['status.firstSurvey.done'],
          'status.secondSurvey.done': r._id['status.secondSurvey.done'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }))
        break;
      case req.query.title === 'surveyCompleted':
        let resultVehicleType3 = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': '3',
            'status.firstSurvey.done': true,
            'status.firstSurvey.date': {'$gt': lastSundays['5']}
          }},
          {'$group': {
            '_id': null,
            'week0': {'$sum': {'$cond': [
              {'$gt': ['$status.firstSurvey.date', lastSundays['1']]}, 1, 0
            ]}},
            'week-1': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['1']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['2']]}, 1, 0
              ]}, 0
            ]}},
            'week-2': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['2']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['3']]}, 1, 0
              ]}, 0
            ]}},
            'week-3': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['3']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['4']]}, 1, 0
              ]}, 0
            ]}},
            'week-4': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['4']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['5']]}, 1, 0
              ]}, 0
            ]}},
            'total': { '$sum': 1 }
          }}
        ]).toArray();

        let resultVehicleTypezOnlyFirstDone = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': {'$ne': '3'},
            'status.firstSurvey.done': true,
            'status.secondSurvey.done': false,
            'status.firstSurvey.date': {'$gt': lastSundays['5']}
          }},
          {'$group': {
            '_id': null,
            'week0': {'$sum': {'$cond': [
              {'$gt': ['$status.firstSurvey.date', lastSundays['1']]}, 1, 0
            ]}},
            'week-1': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['1']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['2']]}, 1, 0
              ]}, 0
            ]}},
            'week-2': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['2']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['3']]}, 1, 0
              ]}, 0
            ]}},
            'week-3': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['3']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['4']]}, 1, 0
              ]}, 0
            ]}},
            'week-4': {'$sum': {'$cond': [
              {'$lte': ['$status.firstSurvey.date', lastSundays['4']]}, {'$cond': [
                {'$gt': ['$status.firstSurvey.date', lastSundays['5']]}, 1, 0
              ]}, 0
            ]}},
            'total': { '$sum': 1 }      
          }}

        ]).toArray();

        let resultVehicleTypezSecondDone = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': {'$ne': '3'},
            'status.secondSurvey.done': true,
            'status.secondSurvey.date': {'$gt': lastSundays['5']}
          }},
          {'$group': {
            '_id': null,
            'week0': {'$sum': {'$cond': [
              {'$gt': ['$status.secondSurvey.date', lastSundays['1']]}, 1, 0
            ]}},
            'week-1': {'$sum': {'$cond': [
              {'$lte': ['$status.secondSurvey.date', lastSundays['1']]}, {'$cond': [
                {'$gt': ['$status.secondSurvey.date', lastSundays['2']]}, 1, 0
              ]}, 0
            ]}},
            'week-2': {'$sum': {'$cond': [
              {'$lte': ['$status.secondSurvey.date', lastSundays['2']]}, {'$cond': [
                {'$gt': ['$status.secondSurvey.date', lastSundays['3']]}, 1, 0
              ]}, 0
            ]}},
            'week-3': {'$sum': {'$cond': [
              {'$lte': ['$status.secondSurvey.date', lastSundays['3']]}, {'$cond': [
                {'$gt': ['$status.secondSurvey.date', lastSundays['4']]}, 1, 0
              ]}, 0
            ]}},
            'week-4': {'$sum': {'$cond': [
              {'$lte': ['$status.secondSurvey.date', lastSundays['4']]}, {'$cond': [
                {'$gt': ['$status.secondSurvey.date', lastSundays['5']]}, 1, 0
              ]}, 0
            ]}},
            'total': { '$sum': 1 }      
          }}
        ]).toArray();

        const mapper = (result) => {
          return {
            'week0': result['week0'],
            'week-1': result['week-1'],
            'week-2': result['week-2'],
            'week-3': result['week-3'],
            'week-4': result['week-4'],
            'total': result['total'],
          }
        }

        result = {
          resultVehicleType3: resultVehicleType3.map(mapper)[0], 
          resultVehicleTypezOnlyFirstDone: resultVehicleTypezOnlyFirstDone.map(mapper)[0],
          resultVehicleTypezSecondDone: resultVehicleTypezSecondDone.map(mapper)[0]
        };
        break;
      default:
        result = {ok: true};
    }

    res.json(result);

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

