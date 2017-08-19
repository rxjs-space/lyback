```js

      case req.query.title === 'surveyIdle2':
        let resultSurveyReadyNonCommercialVehiclesAndMotorcycles = yield db.collection('vehicles').aggregate([
          {'$match': {'$or': [
            {
              'vehicle.vehicleType': {'$in': vehicleTypeIdsForMotocycle},
              'status.secondSurvey.done': false,
              'status2.isSurveyReady': true,
              'isSurveyNecessary': true
            },
            {
              'vehicle.vehicleType': {'$nin': vehicleTypeIdsForMotocycle},              
              'vehicle.useCharacter': {'$eq': 'uc006'},
              'status.secondSurvey.done': false,
              'status2.isSurveyReady': true,
              'isSurveyNecessary': true
            }
          ]}},
          {'$group': {
            '_id': {
              'vehicle.vehicleType': '$vehicle.vehicleType',
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

        resultSurveyReadyNonCommercialVehiclesAndMotorcycles = resultSurveyReadyNonCommercialVehiclesAndMotorcycles.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          'status.secondSurvey.done': r._id['status.secondSurvey.done'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));

        let resultSurveyReadyCommercialVehiclesNonMotorcycle = yield db.collection('vehicles').aggregate([
          {'$match': {
            'vehicle.vehicleType': {'$nin': vehicleTypeIdsForMotocycle},
            'vehicle.useCharacter': {'$ne': 'uc006'},
            'status.secondSurvey.done': false,
            'status2.isSurveyReady': true,
            'isSurveyNecessary': true
          }},
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
        resultSurveyReadyCommercialVehiclesNonMotorcycle = resultSurveyReadyCommercialVehiclesNonMotorcycle.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          'status.firstSurvey.done': r._id['status.firstSurvey.done'],
          'status.secondSurvey.done': r._id['status.secondSurvey.done'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));

        let resultIsSurveyNotReadyVehicles = yield db.collection('vehicles').aggregate([
          {'$match': {
            'status2.isSurveyReady': false,
            'isSurveyNecessary': true
          }},
          {'$group': {
            '_id': {
              'vehicle.vehicleType': '$vehicle.vehicleType',
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
        resultIsSurveyNotReadyVehicles = resultIsSurveyNotReadyVehicles.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          evenEarlier: r.evenEarlier,
          total: r.total,
        }));
        let resultIsSurveyNotNecessaryVehicles = yield db.collection('vehicles').aggregate([
          {'$match': {
            'isSurveyNecessary': false
          }},
          {'$group': {
            '_id': {
              'vehicle.vehicleType': '$vehicle.vehicleType',
            },
            'thisWeek': {'$sum': {'$cond': [
              {'$gte': ['$entranceDate', lastMondays['1']]}, 1, 0
            ]}},
            'lastWeek': {'$sum': {'$cond': [
              {'$lt': ['$entranceDate', lastMondays['1']]}, {'$cond': [
                {'$gte': ['$entranceDate', lastMondays['2']]}, 1, 0
              ]}, 0
            ]}},
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        resultIsSurveyNotNecessaryVehicles = resultIsSurveyNotNecessaryVehicles.map(r => ({
          'vehicle.vehicleType': r._id['vehicle.vehicleType'],
          thisWeek: r.thisWeek,
          lastWeek: r.lastWeek,
          total: r.total,          
        }))

        result = {
          resultSurveyReadyNonCommercialVehiclesAndMotorcycles,
          resultSurveyReadyCommercialVehiclesNonMotorcycle,
          resultIsSurveyNotReadyVehicles,
          resultIsSurveyNotNecessaryVehicles
        }
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
      



```