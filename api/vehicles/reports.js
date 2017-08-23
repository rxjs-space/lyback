const co = require('co');
const dbX = require('../../db');
// const getLastSundays = require('../../utils/last-sundays');
const getLastMondays = require('../../utils/last-mondays');
const getTenDaysAgo = require('../../utils/ten-days-ago');
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
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
              'vehicleType': '$vehicle.vehicleType',
              'mofcomEntryDone': '$status.mofcomEntry.done',
              'mofcomCertReadyDone': '$status.mofcomCertReady.done'
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
          'vehicle.vehicleType': r._id['vehicleType'],
          'status.mofcomEntry.done': r._id['mofcomEntryDone'],
          'status.mofcomCertReady.done': r._id['mofcomCertReadyDone'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total
        }))
        break;
      case req.query.title === 'entrance':
        result = {lastTenDays: [], lastFiveWeeks: []}
        const tenDaysAgoDate = getDaysAgoDate(new Date(), 10);
        const resultOnTheWayAndPaperWorkNotSubmitted = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceStatus': {'$ne': 'est01'}
          }},
          {'$group': {
            '_id': {'entranceStatus': '$entranceStatus'},
            'total': {'$sum': 1}
          }}
        ]).toArray();
        console.log(resultOnTheWayAndPaperWorkNotSubmitted);
        result['onTheWayAndPaperWorkNotSubmitted'] = resultOnTheWayAndPaperWorkNotSubmitted.map(r => ({
          entranceStatus: r['_id']['entranceStatus'],
          total: r['total']
        }));
        const resultLatest10Days = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$gt': tenDaysAgoDate}
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'entranceDate': '$entranceDate'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        result['lastTenDays'] = resultLatest10Days.map(r => ({
          'vehicle.vehicleType': r['_id']['vehicleType'],
          'entranceDate': r['_id']['entranceDate'],
          'total': r['total'],
        }))
        const resultLastFiveWeeks = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$gte': lastMondays['5']}
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
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
          [r['_id']['vehicleType']]: [
            {entranceDate: lastMondays['5'], total: r[[lastMondays['5']]]},
            {entranceDate: lastMondays['4'], total: r[[lastMondays['4']]]},
            {entranceDate: lastMondays['3'], total: r[[lastMondays['3']]]},
            {entranceDate: lastMondays['2'], total: r[[lastMondays['2']]]},
            {entranceDate: lastMondays['1'], total: r[[lastMondays['1']]]},
            // {entranceDate: 'total', total: r[['total']]},
          ]
        }))        
        break;
      case req.query.title === 'surveyIdle3':
        let resultIsSurveyNotReady, resultZeroSurvey, resultSurveyReadyOneSurvey, resultSurveyReadyTwoSurveys;
        resultIsSurveyNotReady = yield db.collection('vehicles').aggregate([
          {'$match': {
            'status2.isSurveyReady': false,
            'surveyRounds': {'$ne': 'zero'}
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
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
        resultIsSurveyNotReady = resultIsSurveyNotReady.map(r => ({
          'vehicle.vehicleType': r._id['vehicleType'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));

        resultZeroSurvey = yield db.collection('vehicles').aggregate([
          {'$match': {
            'surveyRounds': 'zero'
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
            },
            'thisWeek': {'$sum': {'$cond': [
              {'$gte': ['$entranceDate', lastMondays['1']]}, 1, 0
            ]}},
            'lastWeek': {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            // 'evenEarlier': {'$sum': {'$cond': [
            //   {'$lt': ['$entranceDate', lastMondays['2']]}, 1, 0
            // ]}},
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        resultZeroSurvey = resultZeroSurvey.map(r => ({
          'vehicle.vehicleType': r._id['vehicleType'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          // evenEarlier: r.evenEarlier,
          total: r.total,
        }));

        resultSurveyReadyOneSurvey = yield db.collection('vehicles').aggregate([
          {'$match': {
            'status.firstSurvey.done': false,
            'status2.isSurveyReady': true,
            'surveyRounds': 'one',
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'firstSurveyDone': '$status.firstSurvey.done'
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
        resultSurveyReadyOneSurvey = resultSurveyReadyOneSurvey.map(r => ({
          'vehicle.vehicleType': r._id['vehicleType'],
          'status.firstSurvey.done': r._id['firstSurveyDone'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));
        resultSurveyReadyTwoSurveys = yield db.collection('vehicles').aggregate([
          {'$match': {
            'status.secondSurvey.done': false,
            'status2.isSurveyReady': true,
            'surveyRounds': 'two',
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'firstSurveyDone': '$status.firstSurvey.done',
              'secondSurveyDone': '$status.secondSurvey.done'
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
        resultSurveyReadyTwoSurveys = resultSurveyReadyTwoSurveys.map(r => ({
          'vehicle.vehicleType': r._id['vehicleType'],
          'status.firstSurvey.done': r._id['firstSurveyDone'],
          'status.secondSurvey.done': r._id['secondSurveyDone'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));

        result = {
          resultIsSurveyNotReady,
          resultZeroSurvey,
          resultSurveyReadyOneSurvey, 
          resultSurveyReadyTwoSurveys}
        break;
      case req.query.title === 'dailyClearYesterday':
        const yesterdayDate = getDaysAgoDate(new Date(), 1);
        let resultEntranceYesterday = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$eq': yesterdayDate},
            'entranceStatus': 'est01'
          }},
          {'$project': {
            'vehicle.vehicleType': 1,
            'source': 1,
            'vehicle.batterySlotCount': 1,
            'batteryMissingCount': {
              '$size': {
                '$filter': {
                    input: '$feesAndDeductions',
                    as: 'fd',
                    cond: {$eq: [ '$$fd.part', 'p000' ]}
                  }
              }
            }
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'source': '$source'
            },
            'total': {
              '$sum': 1
            },
            'batterySlotCount': {
              '$sum': '$vehicle.batterySlotCount'
            },
            'batteryMissingCount': {
              '$sum': '$batteryMissingCount'
            }
          }}
        ]).toArray();
        resultEntranceYesterday = resultEntranceYesterday.reduce((acc, curr) => {
          const vt = curr['_id']['vehicleType'];
          const source = curr['_id']['source'];
          const subTotal = curr['total'];
          const subBatterySlotCount = curr['batterySlotCount'];
          const subBatteryMissingCount = curr['batteryMissingCount'];

          const item = acc.find(i => i['vehicleType'] === vt);

          const totalItem = acc.find(i => i['vehicleType'] === 'total');
          totalItem[source] += subTotal;
          totalItem['total'] += subTotal;
          totalItem['batterySlotCount'] += subBatterySlotCount;
          totalItem['batteryMissingCount'] += subBatteryMissingCount;

          if (item) {
            item[source] = subTotal;
            item['total'] += subTotal;
            item['batterySlotCout'] += subBatterySlotCount;
            item['batteryMissingCount'] += subBatteryMissingCount;
          } else {
            acc.push({
              'vehicleType': vt,
              [source]: subTotal,
              'total': subTotal,
              'batterySlotCount': subBatterySlotCount,
              'batteryMissingCount': subBatteryMissingCount
            })
          }
          return acc;
        }, [{
          entranceDate: yesterdayDate,
          vehicleType: 'total',
          vs1: 0,
          vs2: 0,
          total: 0,
          batterySlotCount: 0,
          batteryMissingCount: 0
        }]);

        let resultEntranceYesterdayMofcom = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$eq': yesterdayDate},
            'status.mofcomCertReady.done': false,
            'entranceStatus': 'est01'
          }},
          {'$group': {
            '_id': {
              'mofcomEntryDone': '$status.mofcomEntry.done',
              'mofcomCertReadyDone': '$status.mofcomCertReady.done'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();

        resultEntranceYesterdayMofcom = resultEntranceYesterdayMofcom.reduce((acc, curr) => {
          const dataEntryDone = curr['_id']['mofcomEntryDone'];
          const certDone = curr['_id']['mofcomCertReadyDone'];
          acc.total += curr.total;
          switch (true) {
            case !dataEntryDone:
              acc.noDataEntry = curr.total; break;
            case !certDone:
              acc.onlyDataEntryDone = curr.total; break;
            default:
              acc.certDone = curr.total;
          }
          return acc
        }, {
          noDataEntry: 0,
          onlyDataEntryDone: 0,
          certDone: 0,
          total: 0
        });

        let resultEntranceYesterdayDismantlingReadiness = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$eq': yesterdayDate},
            'entranceStatus': 'est01'
          }},
          {'$group': {
            '_id': {
              'isDismantlingReady': '$status2.isDismantlingReady',
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        resultEntranceYesterdayDismantlingReadiness = resultEntranceYesterdayDismantlingReadiness.reduce((acc, curr) => {
          const isDismantlingReady = curr['_id']['isDismantlingReady'];
          const total = curr['total'];
          acc.total += total;
          if (isDismantlingReady) {
            acc.ready = total;
          } else {
            acc.notReady = total;
          }
          return acc;
        }, {
          ready: 0, notReady: 0, total: 0
        });
        let resultEntranceYesterdayOnTheWayOrPaperWorkNotSubmitted = yield db.collection('vehicles').aggregate([
          {'$match': {
            'entranceDate': {'$eq': yesterdayDate},
            'entranceStatus': {'$ne': 'est01'}
          }},
          {'$group': {
            '_id': {
              'entranceStatus': '$entranceStatus',
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        resultEntranceYesterdayOnTheWayOrPaperWorkNotSubmitted = resultEntranceYesterdayOnTheWayOrPaperWorkNotSubmitted.reduce((acc, curr) => {
          acc[curr['_id']['entranceStatus']] = curr['total'];
          return acc;
        }, {})
        result = {
          resultEntranceYesterday,
          resultEntranceYesterdayMofcom,
          resultEntranceYesterdayDismantlingReadiness,
          resultEntranceYesterdayOnTheWayOrPaperWorkNotSubmitted
        }
        break;
      case req.query.title === 'currentSate':
        let resultCurrentStateByDismantling = yield db.collection('vehicles').aggregate([
          {'$match': {
            'status.dismantled.done': false
          }},
          {'$project': {
            'vehicle.vehicleType': 1,
            'status2.isDismantlingReady': 1,
            'hasDismantlingOrder': {
              '$ne': ['$status2.dismantlingOrderId', '']
            }
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'isDismantlingReady': '$status2.isDismantlingReady',
              'hasDismantlingOrder': '$hasDismantlingOrder'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        result ={
          resultCurrentStateByDismantling
        }
        break;
      default:
        result = {ok: true};
    }

    res.json(result);

  }).catch(err => {
    return res.status(500).json(err.stack);
  })


}
