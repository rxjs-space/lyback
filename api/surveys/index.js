const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');
const strContains = require('../../utils').strContains;
const getLastMondayDates = require('../../utils').getLastMondayDates;
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const dbX = require('../../db');

const reportsGet = (req, res) => {
  const title = req.query.title;
  const facility = req.query.facility;
  if (!title || !facility) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    switch (true) {
      case title === 'countByTypes':
        // not ready, recent 0 surveys, 1st survey ready, 2nd survey ready
        let resultNotReady = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'status2.isSurveyReady': false,
            'surveyRounds': {'$ne': 'zero'}
          }},
          {'$group': {
            '_id': {
              'facility': '$facility'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        
        let resultReadyOne = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'status2.isSurveyReady': true,
            'surveyRounds': {'$eq': 'one'},
            'status.firstSurvey.done': false
          }},
          {'$group': {
            '_id': {
              'facility': '$facility',
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        
        let resultReadyTwo = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'status2.isSurveyReady': true,
            'surveyRounds': {'$eq': 'two'},
            'status.secondSurvey.done': false
          }},
          {'$group': {
            '_id': {
              'facility': '$facility',
              'firstSurveyDone': '$status.firstSurvey.done'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        console.log(resultReadyTwo);

        const twoWeeksAgoDate = getDaysAgoDate(new Date(), 14);
        let resultZeroSurvey = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'entranceDate': {'$gte': `${twoWeeksAgoDate}T16:00:00.000Z`},
            'surveyRounds': {'$eq': 'zero'}
          }},
          {'$group': {
            '_id': {
              'facility': '$facility'
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        
        const result = {
          resultNotReady: resultNotReady[0] ? resultNotReady[0].total : 0,
          resultReadyOne: resultReadyOne[0] ? resultReadyOne[0].total : 0,
          resultReadyTwoFirstSurveyDone: resultReadyTwo.find(r => r._id.firstSurveyDone) ? resultReadyTwo.find(r => r._id.firstSurveyDone)['total'] : 0,
          resultReadyTwoFirstSurveyNotDone: resultReadyTwo.find(r => !r._id.firstSurveyDone) ? resultReadyTwo.find(r => !r._id.firstSurveyDone)['total'] : 0,
          resultZeroSurvey: resultZeroSurvey[0] ? resultZeroSurvey[0].total : 0
        };
        return res.json(result);
      default:
        return res.json({ok: true});
    }
    
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

};

const rootPost = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }

  if (!req.body.vehicles) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    const vehicles = req.body.vehicles.map(v => {
      v.vehicleId = new ObjectID(v.vehicleId);
      return v;
    })
    const newBatch = {
      vehicles: vehicles,
      createdAt: (new Date()).toISOString(),
      createdBy: req.user._id,
      completed: false
    };

    const saveResult = yield db.collection('surveyBatches').insert(newBatch);
    console.log('new survey batch inserted');
    const batchId = saveResult.insertedIds[0];
    const patches = {
      batchId,
      patches: [
        {op: 'replace', path: '/vehicles', value: vehicles},
      ],
      patchedAt: newBatch.createdAt,
      patchedBy: newBatch.createdBy
    };
    const patchesSaveResult = yield db.collection('surveyBatchPatches').insert(patches);
    /* no need to update vehicles when creating new survey batch */

    // yield coForEach(vehicles, function*(vehicle) {
    //   const vPatches = {
    //     patches: [
    //       {op: 'replace', path: '/modifiedAt', value: newBatch.createdAt},
    //       {op: 'replace', path: '/modifiedBy', value: newBatch.createdBy},
    //       {op: 'add', path: '/status2/surveyBatchIds', value: batchId},
    //       {op: 'replace', path: `/status/${vehicle.surveyOrdinal}Survey/done`, value: true},
    //       {op: 'replace', path: `/status/${vehicle.surveyOrdinal}Survey/date`, value: newBatch.createdAt}
    //     ],
    //     createdAt: newBatch.createdAt,
    //     createdBy: newBatch.createdBy,
    //     trigger: 'surveyBatches',
    //     triggerRef: batchId,
    //     vehicleId
    //   };

    //   const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
    //   const vPatchesToApply = toMongodb(vPatches.patches);
    //   console.log(vPatchesToApply);
    //   const vSaveResult = yield db.collection('vehicles').updateOne(
    //     {_id: new ObjectID(vehicleId)},
    //     vPatchesToApply
    //   );
    // });

    res.json(saveResult);
  }).catch(err => {
    console.log('error at [POST surveys]:', err.stack);
    return res.status(500).json(err.stack);
  });
};

const rootGet = (req, res) => {
  const title = req.query.title;
  if (!title) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    switch (title) {
      case 'ongoingBatch':
        const ongoingBatches = yield db.collection('surveyBatches').find({$or: [
          {completed: false, canceled: false},
          {completed: false, canceled: {$exists: false}},
        ]}).toArray();
        const vehicles = [];
        if (ongoingBatches.length) {
          yield coForEach(ongoingBatches, function*(batch) {
            const vehicleIds = batch.vehicles.map(v => v.vehicleId);
            const vehiclesOfTheBatch = yield db.collection('vehicles').find({
              _id: {$in: vehicleIds}
            }, {
              'vin': 1,
              'batchId': 1,
              'entranceDate': 1,
              // 'surveyRounds': 1,
              'vehicle.plateNo': 1,
              'vehicle.vehicleType': 1,
            }).toArray();
            vehicles.push({batchId: batch._id, vehicles: vehiclesOfTheBatch})
          });
        }
        
        return res.json({
          ongoingBatches: ongoingBatches,
          vehicles
        });
    }


  }).catch(err => {
    console.log('error at [dismanltingPrepare/post]:', err.stack);
    return res.status(500).json(err.stack);
  });



}
router.get('/', rootGet);
router.post('/', rootPost);
router.get('/reports', reportsGet);

module.exports = router;
