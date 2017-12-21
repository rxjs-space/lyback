const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;
const MongoError = require('mongodb').MongoError;
const dbX = require('../../db');

module.exports = (req, res) => {
  if (!req.query._id) {
    res.status(400).json({
      message: 'Insufficient parameter'
    })
  }
  const vehicleId = new ObjectID(req.query._id);
  
  co(function*() {
    const db = yield dbX.dbPromise;
    const paymentToOwnerBatches = yield db.collection('paymentToOwnerBatches').aggregate([
      {$unwind: '$vehicles'},
      {$match: {'vehicles.vehicleId': vehicleId}},
      {$project: {
        rvAfterFD: '$vehicles.rvAfterFD',
        success: '$vehicles.success',
        createdAt: 1,
        completedAt: 1
      }}
    ]).toArray();
    
    const dismantlingPrepareBatches = yield db.collection('dismantlingPrepareBatches').aggregate([
      {$unwind: '$vehicles'},
      {$match: {'vehicles.vehicleId': vehicleId}},
      {$project: {
        createdAt: 1
      }}
    ]).toArray();

    const surveyBatches = yield db.collection('surveyBatches').aggregate([
      {$unwind: '$vehicles'},
      {$match: {'vehicles.vehicleId': vehicleId}},
      {$project: {
        success: '$vehicles.success',
        surveyOrdinal: '$vehicles.surveyOrdinal',        
        createdAt: 1,
        completedAt: 1        
      }}
    ]).toArray();

    return res.json({
      // vehicleId,
      paymentToOwnerBatches,
      dismantlingPrepareBatches,
      surveyBatches
    });
    // return res.json({ok: true});
  }).catch(error => {
    // console.log(error);
    if (error instanceof MongoError) {
      // front end will check if error contains error code like 'E11000' using error.indexOf
      return res.status(500).json(error.toString());
    } else {
      return res.status(500).json(error.stack);
    }
  })  


}