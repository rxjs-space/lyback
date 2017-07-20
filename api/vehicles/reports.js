const co = require('co');
const dbX = require('../../db');
// const getLastSundays = require('../../utils/last-sundays');
const getLastMondays = require('../../utils/last-mondays');
const getTenDaysAgo = require('../../utils/ten-days-ago');

// const today = (new Date());
// const onedayMS = 1000 * 60 * 60 * 24;
// const tenDaysAgo = (new Date(Date.parse(today) - onedayMS * 10));
// const tenDaysAgoDate = tenDaysAgo.toISOString().slice(0, 10);


module.exports = (req, res) => {

  co(function*() {
    const db = yield dbX.dbPromise;
    const ttQueryResult = yield db.collection('tt').find({name: 'types'}).toArray();
    const vehicleTypeIdsForMotocycle = ttQueryResult[0]['vehicleTypeIdsForMotocycle'];
    // console.log(vehicleTypeIdsForMotocycle);
    // const lastSundays = getLastSundays();
    const lastMondays = getLastMondays();
    let result;

    switch (true) {
      case req.query.title === 'mofcom':
        let resultMofcomIdle = yield db.collection('vehicles').aggregate([
          {$match: {'status.mofcomCertReady.done': false}},
          {$group: {
            _id: {
              'vehicle.vehicleType': '$vehicle.vehicleType',
              'status.mofcomEntry.done': '$status.mofcomEntry.done',
              'status.mofcomCertReady.done': '$status.mofcomCertReady.done'
            },
            thisWeek: {$sum: {$cond: [
              {$gte: ['$entranceDate', lastMondays['1']]}, 1, 0
            ]}},
            lastWeek: {$sum: {$cond: [
              {$lt: ['$entranceDate', lastMondays['1']]}, {$cond: [
                {$gte: ['$entranceDate', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            evenEarlier: {$sum: {$cond: [
              {$lt: ['$entranceDate', lastMondays['2']]}, 1, 0
            ]}},
            total: {$sum: 1}
          }}
        ]).toArray();
        result = resultMofcomIdle.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          'status.mofcomEntry.done': r._id['status.mofcomEntry.done'],
          'status.mofcomCertReady.done': r._id['status.mofcomCertReady.done'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total
        }))
        break;
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
            'entranceDate': {'$gte': lastMondays['5']}
          }},
          {'$group': {
            '_id': {
              'vehicle.vehicleType': '$vehicle.vehicleType',
            },
            [lastMondays['1']]: {'$sum': {'$cond': [
              {'$gte': ['$entranceDate', lastMondays['1']]}, 1, 0
            ]}},
            [lastMondays['2']]: {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['3']]: {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['2']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['3']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['4']]: {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['3']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['4']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['5']]: {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['4']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['5']]}, 1, 0
              ]}, 0
            ]}},
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
              {'$gte': ['$entranceDate', lastMondays['1']]}, 1, 0
            ]}},
            'lastWeek': {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            'evenEarlier': {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['2']]}, 1, 0
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
            'vehicle.vehicleType': {'$in': vehicleTypeIdsForMotocycle},
            'status.firstSurvey.done': true,
            'status.firstSurvey.date': {'$gte': lastMondays['5']}
          }},
          {'$group': {
            '_id': null,
            [lastMondays['1']]: {'$sum': {'$cond': [
              {'$gte': ['$status.firstSurvey.date', lastMondays['1']]}, 1, 0
            ]}},
            [lastMondays['2']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['3']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['2']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['3']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['4']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['3']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['4']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['5']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['4']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['5']]}, 1, 0
              ]}, 0
            ]}},
          }}
        ]).toArray();

        let resultVehicleTypezFirstDone = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': {'$nin': vehicleTypeIdsForMotocycle},
            'status.firstSurvey.done': true,
            // 'status.secondSurvey.done': false,
            'status.firstSurvey.date': {'$gte': lastMondays['5']}
          }},
          {'$group': {
            '_id': null,
            [lastMondays['1']]: {'$sum': {'$cond': [
              {'$gte': ['$status.firstSurvey.date', lastMondays['1']]}, 1, 0
            ]}},
            [lastMondays['2']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['3']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['2']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['3']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['4']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['3']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['4']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['5']]: {'$sum': {'$cond': [
              {'$lt': ['$status.firstSurvey.date', lastMondays['4']]}, {'$cond': [
                {'$gte': ['$status.firstSurvey.date', lastMondays['5']]}, 1, 0
              ]}, 0
            ]}},
          }}

        ]).toArray();

        let resultVehicleTypezSecondDone = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': {'$nin': vehicleTypeIdsForMotocycle},
            'status.secondSurvey.done': true,
            'status.secondSurvey.date': {'$gte': lastMondays['5']}
          }},
          {'$group': {
            '_id': null,
            [lastMondays['1']]: {'$sum': {'$cond': [
              {'$gte': ['$status.secondSurvey.date', lastMondays['1']]}, 1, 0
            ]}},
            [lastMondays['2']]: {'$sum': {'$cond': [
              {'$lt': ['$status.secondSurvey.date', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$status.secondSurvey.date', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['3']]: {'$sum': {'$cond': [
              {'$lt': ['$status.secondSurvey.date', lastMondays['2']]}, {'$cond': [
                {'$gte': ['$status.secondSurvey.date', lastMondays['3']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['4']]: {'$sum': {'$cond': [
              {'$lt': ['$status.secondSurvey.date', lastMondays['3']]}, {'$cond': [
                {'$gte': ['$status.secondSurvey.date', lastMondays['4']]}, 1, 0
              ]}, 0
            ]}},
            [lastMondays['5']]: {'$sum': {'$cond': [
              {'$lt': ['$status.secondSurvey.date', lastMondays['4']]}, {'$cond': [
                {'$gte': ['$status.secondSurvey.date', lastMondays['5']]}, 1, 0
              ]}, 0
            ]}},
          }}
        ]).toArray();

        const mapper = (result) => {
          return [
            {date: lastMondays['1'], total: result[lastMondays['1']]},
            {date: lastMondays['2'], total: result[lastMondays['2']]},
            {date: lastMondays['3'], total: result[lastMondays['3']]},
            {date: lastMondays['4'], total: result[lastMondays['4']]},
            {date: lastMondays['5'], total: result[lastMondays['5']]},
          ]
        }

        result = {
          resultVehicleType3: resultVehicleType3.map(mapper)[0], 
          resultVehicleTypezFirstDone: resultVehicleTypezFirstDone.map(mapper)[0],
          resultVehicleTypezSecondDone: resultVehicleTypezSecondDone.map(mapper)[0]
        };
        break;
      default:
        result = {ok: true};
    }

    res.json(result);

  }).catch(err => {
    return res.status(500).json(err.stack);
  })


}
