const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const coForEach = require('co-foreach');
const strContains = require('../../utils').strContains;
const getLastMondayDates = require('../../utils').getLastMondayDates;
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const dbX = require('../../db');
const simpleEquals = require('../../utils').simpleEquals;

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
            'surveyRounds': {'$ne': 'zero'},
            'metadata.isDeleted': false
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
            'status.firstSurvey.done': false,
            'metadata.isDeleted': false,
            'status2.surveyBatchIds': {$size: 0}
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
        resultReadyOne = resultReadyOne[0].total;


        
        let resultReadyTwo = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'status2.isSurveyReady': true,
            'surveyRounds': {'$eq': 'two'},
            'status.secondSurvey.done': false,
            'metadata.isDeleted': false
          }},
          {'$group': {
            '_id': {
              'firstSurveyDone': '$status.firstSurvey.done',
              'surveyBatchIdCount': { $size: "$status2.surveyBatchIds" },              
            },
            'total': {
              '$sum': 1
            }
          }}
        ]).toArray();
        resultReadyTwo = resultReadyTwo.reduce((acc, curr) => {
          // keep only the number for vehicles not listed in batches
          switch (true) {
            case !curr._id.firstSurveyDone && simpleEquals(curr._id.surveyBatchIdCount, 0):
              acc.firstSurveyNotDone += curr.total;
              break;
            case curr._id.firstSurveyDone && simpleEquals(curr._id.surveyBatchIdCount, 1):
              acc.firstSurveyDone += curr.total;
              break;
          }
          return acc;
        }, {
          firstSurveyDone: 0,
          firstSurveyNotDone: 0
        });


        const twoWeeksAgoDate = getDaysAgoDate(new Date(), 14);
        let resultZeroSurvey = yield db.collection('vehicles').aggregate([
          {'$match': {
            'facility': {'$eq': facility},
            'entranceDate': {'$gte': `${twoWeeksAgoDate}T16:00:00.000Z`},
            'surveyRounds': {'$eq': 'zero'},
            'metadata.isDeleted': false
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
          resultReadyOne,
          resultReadyTwo,
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
    const batch = yield db.collection('surveyBatches').findOne({_id: batchId});
    const patches = {
      batchId,
      patches: [
        {op: 'replace', path: '/vehicles', value: vehicles},
      ],
      patchedAt: newBatch.createdAt,
      patchedBy: newBatch.createdBy
    };
    const patchesSaveResult = yield db.collection('surveyBatchPatches').insert(patches);

    /* update vehiclePatches and vehicle */
    yield coForEach(vehicles, function*(vehicle) {
      const vehicleId = vehicle.vehicleId;
      const vPatches = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: newBatch.createdAt},
          {op: 'replace', path: '/modifiedBy', value: newBatch.createdBy},
          {op: 'add', path: '/status2/surveyBatchIds', value: batchId}
        ],
        createdAt: newBatch.createdAt,
        createdBy: newBatch.createdBy,
        trigger: 'surveyBatches',
        triggerRef: batchId,
        vehicleId
      };
      const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
      const vPatchesToApply = toMongodb(vPatches.patches);
      console.log(vPatchesToApply);
      const vSaveResult = yield db.collection('vehicles').updateOne(
        {_id: new ObjectID(vehicleId)},
        vPatchesToApply
      );
    });

    res.json(batch);
  }).catch(err => {
    console.log('error at [POST surveys]:', err.stack);
    return res.status(500).json(err.stack);
  });
};

const rootPatch = (req, res) => {
  if (!req.body || !req.body._id) {
    return res.status(400).json({
      message: 'no data or no _id provided.'
    })
  }
  const batchId = new ObjectID(req.body._id);
  co(function*() {
    const db = yield dbX.dbPromise;
    const patchedAt = (new Date()).toISOString();
    const patchedBy = req.user._id;

    const patches = {patches: [
      ...req.body.patches,
      {op: 'replace', path: '/modifiedAt', value: patchedAt},
      {op: 'replace', path: '/modifiedBy', value: patchedBy}
    ]};
    patches.createdAt = patchedAt;
    patches.createdBy = patchedBy;
    patches.batchId = batchId;

    const patchesToApply = toMongodb(patches.patches);
    console.log('patchesToApply', patchesToApply);


    const insertToPatchesResult = yield db.collection('surveyBatchPatches').insert(patches);
    const updateResult = yield db.collection('surveyBatches').updateOne(
      {_id: batchId},
      patchesToApply
    );
    const newBatch = yield db.collection('surveyBatches').findOne({_id: batchId});
    const vehicles = newBatch.vehicles;
    // update vehicles (which surveyDone, delete surveyBatchId if not successful)
    yield coForEach(vehicles, function*(vehicle) {
      const vehicleId = vehicle.vehicleId;
      const surveyOrdinal = vehicle.surveyOrdinal;
      let surveyResultPatches;
      if (vehicle.success) {
        surveyResultPatches = [
          {op: 'replace', path: `/status/${surveyOrdinal}Survey/done`, value: true},
          {op: 'replace', path: `/status/${surveyOrdinal}Survey/date`, value: patchedAt}
        ]
      } else {
        // how to write delete array element patch?
        const idIndex = surveyOrdinal === 'first' ? 0 : 1;
        surveyResultPatches = [{op: 'remove', path: `/status2/surveyBatchIds/${idIndex}`}];
      }
      const vPatches = {
        patches: [
          {op: 'replace', path: '/modifiedAt', value: patchedAt},
          {op: 'replace', path: '/modifiedBy', value: patchedBy},
          ...surveyResultPatches
        ],
        createdAt: patchedAt,
        createdBy: patchedBy,
        trigger: 'surveyBatches',
        triggerRef: batchId,
        vehicleId
      };
      const vPatchesSaveResult = yield db.collection('vehiclePatches').insert(vPatches);
      const vPatchesToApply = toMongodb(vPatches.patches);
      console.log('vPatchesToApply:', vPatchesToApply);

      let patchesToApplyFollowingUp, toApplyPullPatches = false; // in case $unset op for array elements, need following up $pull ops
      if (Object.keys(vPatchesToApply).indexOf('$unset') > -1) {
        toApplyPullPatches = true;
        patchesToApplyFollowingUp = {'$pull': {}};
        const pullKeys = [];
        Object.keys(vPatchesToApply['$unset']).forEach(k => {
          const routes = k.split('.');
          const pullKey = routes.slice(0, routes.length - 1).join('.');
          if (pullKeys.indexOf(pullKey) === -1) {
            pullKeys.push(pullKey);
          }
        })
        pullKeys.reduce((acc, curr) => {
          acc['$pull'][curr] = null;
          return acc;
        }, patchesToApplyFollowingUp)
      }
      console.log('patchesToApplyFollowingUp', patchesToApplyFollowingUp);

      const vSaveResult = yield db.collection('vehicles').updateOne(
        {_id: new ObjectID(vehicleId)},
        vPatchesToApply
      );
      
      console.log('toApplyPullPatches', toApplyPullPatches);
      if (toApplyPullPatches) {
        console.log('pulling null elements...')
        const pullResult = yield db.collection('vehicles').updateOne(
          {_id: new ObjectID(vehicleId)},
          patchesToApplyFollowingUp
        )
      }

    });


    res.json(updateResult);

  }).catch(err => {
    return res.status(500).json(err.stack);
  })



}
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
      case 'progressingBatches':
        const progressingBatches = yield db.collection('surveyBatches').find({$or: [
          {completed: false, canceled: false},
          {completed: false, canceled: {$exists: false}},
        ]}).toArray();
        return res.json(progressingBatches);
      case 'recentCompletedBatches': // completedAt within 5 weeks
        const thirtyFiveDaysAgoDate = getDaysAgoDate(new Date(), 35);
        const recentCompletedBatches = yield db.collection('surveyBatches').find({$or: [
          {
            completed: true,
            completedAt: {'$gte': `${thirtyFiveDaysAgoDate}T16:00:00.000Z`}
          },
          {
            completed: true,
            completedAt: {$exists: false},
            modifiedAt: {'$gte': `${thirtyFiveDaysAgoDate}T16:00:00.000Z`}
          },
        ]}).toArray();
        return res.json(recentCompletedBatches);
    }


  }).catch(err => {
    console.log('error at [dismanltingPrepare/post]:', err.stack);
    return res.status(500).json(err.stack);
  });



}
router.get('/', rootGet);
router.post('/', rootPost);
router.patch('/', rootPatch);
router.get('/reports', reportsGet);

module.exports = router;
