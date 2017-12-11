const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;
const toMongodb = require('jsonpatch-to-mongodb');

const myAcl = require('../../my-acl');
const getMondayOfTheWeek = require('../../utils').getMondayOfTheWeek;

const dbX = require('../../db');
const collectionName = 'salesOrders';
const patchesCollectionName = 'salesOrderPatches';

/* 
  POST /: new sales order
  PATCH /one?_id=abc: update a sales order
  GET /?queryParams: get a list of sales order
  GET /reports?title=xyz: get report

*/

const rootGetDefault = (req, res, queryParams, keys) => {
  const dbQuery = {}; // transform queryParmas into dbQuery, when necessary
  keys.forEach(k => {
    switch (k) {
      case '_id':
        dbQuery[k] = new ObjectID(queryParams[k]);
        break;
      case 'withDetails':
        break;
      default:
        dbQuery[k] = queryParams[k];
    }
  })
  console.log(dbQuery);

  co(function*() {
    const db = yield dbX.dbPromise;
    // const results = yield db.collection(collectionName).find(dbQuery).toArray();
    let result;
    if (queryParams['withDetails']) {
      results = yield db.collection(collectionName).aggregate([
        {$match: dbQuery},
        {$lookup: {
          from: 'customers',
          localField: 'customer._id',
          foreignField: '_id',
          as: 'customer'
        }},
        {$unwind: '$customer'},
        // {$unwind: '$products'},
        // {$lookup: {
        //   from: 'inventory',
        //   localField: 'products._id',
        //   foreignField: '_id',
        //   as: 'productsDetails'
        // }},
        // // {$unwind: '$productsDetails'},
        // {$unwind: {
        //   path: '$productsDetails',
        //   preserveNullAndEmptyArrays: true
        // }},
        // {$lookup: {
        //   from: 'vehicles',
        //   localField: 'productsDetails.vehicleId',
        //   foreignField: '_id',
        //   as: 'vehicleDetails'
        // }},
        // {$unwind: '$vehicleDetails'},
        // {$project: {
        //   _id: 1,
        //   customer: 1,
        //   createdAt: 1,
        //   createdBy: 1,
        //   discountPercent: 1,
        //   paid: 1,
        //   deleted: 1,
        //   products: {
        //     _id: '$products._id',
        //     price: '$products.price',
        //     // priceAge: '$products.priceAge',
        //     // priceBrand: '$products.priceBrand',
        //     // priceType: '$products.priceType',
        //     // priceVT: '$products.priceVT',
        //     typeId: '$productsDetails.typeId',
        //     vehicleId: '$productsDetails.vehicleId',
        //     vehicleType: '$vehicleDetails.vehicle.vehicleType',
        //     brand: '$vehicleDetails.vehicle.brand',
        //     model: '$vehicleDetails.vehicle.model',
        //   },
        //   // productsDetails: 1,
        //   // vehicleDetails: {
        //   //   vehicleId: '$vehicleDetails._id',
        //   //   vehicleType: '$vehicleDetails.vehicle.vehicleType',
        //   //   brand: '$vehicleDetails.vehicle.brand',
        //   // }
        //   // vehicleDetails: {$push: '$vehicleDetails'}
        // }},
        // {$group: {
        //   _id: '$_id',
        //   customer: {$first: '$customer'},
        //   createdAt: {$first: '$createdAt'},
        //   createdBy: {$first: '$createdBy'},
        //   discountPercent: {$first: '$discountPercent'},
        //   paid: {$first: '$paid'},
        //   deleted: {$first: '$deleted'},
        //   products: {$push: '$products'},
        //   // productsDetails: {$push: '$productsDetails'},
        //   // vehicleDetails: {$push: '$vehicleDetails'}
        // }},
      ]).toArray();
    } else {
      results = yield db.collection(collectionName).aggregate([
        {$match: dbQuery},
      ]).toArray();
    }
    // console.log(results);
    return res.json(results);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

const rootGetByDate =  (req, res, date) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const begginingDateTime = new Date(Date.parse(date) - 1000 * 60 * 60 * 8);
    const endingDateTime = new Date(Date.parse(date) + 1000 * 60 * 60 * 16);
    console.log(begginingDateTime);
    console.log(endingDateTime);
    let results = yield db.collection(collectionName).aggregate([
        {$match: {$and: [
          {createdAt: {$gte: begginingDateTime}},
          {createdAt: {$lt: endingDateTime}},
        ]}},
      ]).toArray();
      console.log(results);
    return res.json(results);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}
const rootGetByWeek =  (req, res, week) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const begginingDateTime = getMondayOfTheWeek(week);
    const endingDateTime = new Date(Date.parse(begginingDateTime) + 1000 * 60 * 60 * 24 * 7);
    console.log(begginingDateTime);
    console.log(endingDateTime);
    let results = yield db.collection(collectionName).aggregate([
        {$match: {$and: [
          {createdAt: {$gte: begginingDateTime}},
          {createdAt: {$lt: endingDateTime}},
        ]}},
      ]).toArray();
      console.log(results);
    return res.json(results);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

const rootGet = (req, res) => {
  const queryParams = req.query;
  if (!queryParams) {
    return res.status(400).json({
      message: "insufficient parameters."
    });
  }
  const keys = Object.keys(queryParams);

  // value of each queryParam has been JSON.stringify-ed at the frontend
  keys.forEach(k => {
    queryParams[k] = JSON.parse(queryParams[k]);
  })
  console.log(queryParams);
  switch (true) {
    case queryParams.title === 'all':
      return res.json({
        message: 'want them all?'
      });
    case !!queryParams.date:
      return rootGetByDate(req, res, queryParams.date);
    case !!queryParams.week:
      return rootGetByWeek(req, res, queryParams.week);
    default:
      return rootGetDefault(req, res, queryParams, keys);
  }
}

const rootPost = (req, res) => {
  if (!req.body || !req.body.salesOrder || !req.body.patches) {
    return res.status(400).json({
      message: "insufficient/incorrect parameters."
    })
  }

  const createdAt = new Date();
  const createdBy = req.user._id;
  const newSalesOrder = JSON.parse(JSON.stringify(req.body.salesOrder));
  newSalesOrder.customer._id = new ObjectID(newSalesOrder.customer._id);
  newSalesOrder.products.forEach(product => {
    product._id = product._id ? new ObjectID(product._id) : product._id;
  });
  newSalesOrder.createdAt = createdAt;
  newSalesOrder.createdBy = createdBy;
  const productIds = newSalesOrder.products.map(product => product._id);
  const patches = {
    patches: JSON.parse(JSON.stringify(req.body.patches))
  };
  patches.createdAt = createdAt;
  patches.createdBy = createdBy;

  const writeStatus = {
    insertItem: null,
    insertPatches: null,
    updateInventory: null,
    itemId: null
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertItemResult = yield db.collection('salesOrders').insert(newSalesOrder);
    const salesOrderId = insertItemResult.insertedIds[0];
    writeStatus.insertItem = 'done';
    writeStatus.itemId = salesOrderId;
    patches.salesOrderId = salesOrderId;
    const insertPatchesResult = yield db.collection('salesOrderPatches').insert(patches);
    writeStatus.insertPatches = 'done';
    yield coForEach(productIds, function*(id) {
      if (id) {
        const updateOneInventoryItemResult = yield db.collection('inventory').updateOne({_id: id}, {
          $set: {
            'isInStock': false,
            'outputTo': 'salesOrders',
            'outputDate': createdAt,
            'outputRef': salesOrderId
          }
        })
      }
    });
    writeStatus.updateInventory = 'done';
    console.log(writeStatus);
    res.json(writeStatus);
  }).catch((err) => {
    res.status(500).json(err.stack);
  })

}

const preparePatches = (patches) => {
  patches.forEach(patch => {
    if ((patch.path.indexOf('Notes') > -1) && patch.op === 'add') {
      patch.op = 'replace';
    }
  })
  return patches;
}

const rootPatch = (req, res) => {
  if (!req.body || !req.body._id || !req.body.patches) {
    return res.status(400).json({
      message: 'no data or no _id provided.'
    })
  }
  const modifiedAt = new Date();
  const modifiedBy = req.user._id;
  const itemId = req.body._id;
  const patches = {
    patches: preparePatches(req.body.patches),
    createdAt: modifiedAt,
    createdBy: modifiedBy
  };
  const patchesToApply = toMongodb(patches.patches);
  const writeStatus = {
    updateItem: null,
    insertPatches: null,
  };

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertPatchesResult = yield db.collection('salesOrderPatches').insert(patches);
    writeStatus.insertPatches = true;
    const updateItemResult = yield db.collection('salesOrders').updateOne({
      _id: new ObjectID(itemId)
    }, patchesToApply);
    writeStatus.updateItem = true;
    res.json(writeStatus);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

  // res.json({ok: true});
}


router.get('/', rootGet);
router.get('/reports', require('./reports'));
router.post('/', rootPost);
router.patch('/', rootPatch);
module.exports = router;