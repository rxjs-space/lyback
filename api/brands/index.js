const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const ObjectID = require('mongodb').ObjectID;
const toMongodb = require('jsonpatch-to-mongodb');

const myAcl = require('../../my-acl');

const dbX = require('../../db');

const postModelsList = (req, res) => {
  if (!req.body || !req.body.brand) {
    return res.status(500).json({
      message: 'No brand details provided.'
    })
  }

  const brand = req.body.brand;
  // get all the vehicles of this brand, and get the models
  co(function*() {
    const db = yield dbX.dbPromise;
    // let result = yield db.collection('vehicles').aggregate([
    //   {$match: {
    //     'vehicle.brand': brand
    //   }},
    //   {$group: {
    //     _id: {
    //       'model': '$vehicle.model',
    //     },
    //     // count: {$sum: 1}
    //   }}
    // ]).toArray();
    // result = result.map(r => r._id.model);
    const thatBrand = yield db.collection('brands').findOne({
      _id: new ObjectID(brand)
    });
    res.json(thatBrand.models.sort());
  }).catch(error => {
    return res.status(500).json(error.stack);
  })

}

router.post('/models/list', postModelsList);

router.post('/', function(req, res) {
  if (!req.body) {return res.status(500).json({
    message: 'No brand details provided.'
  })}
  let newBrands;
  if (req.body instanceof Array) {
    newBrands = req.body;
  } else {
    newBrands = [req.body]
  }
  newBrands.forEach(b => {
    b.models = ['.']; // insert a model named '.'
    if (!b.name) {
      const bStr = JSON.stringify(b);
      return res.status(500).json({
        message: `${bStr} has no valid name property.`
      })
    }
  })

  const createdAt = (new Date()).toISOString();
  const createdBy = req.user._id;
  newBrands.forEach(b => {
    b.createdAt = createdAt;
    b.createdBy = createdBy;
  })

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertResult = yield db.collection('brands').insertMany(newBrands);
    const updateVersionResult = yield db.collection('versions').updateOne({
      collection: 'brands'
    }, {
      '$set': {version: `${(new Date()).toISOString().substring(0, 10)}:${Math.random()}`}
    }, {
      upsert: true
    });

    res.json(insertResult);
  }).catch(error => {
    const errStr = JSON.stringify(error.stack);
    // if duplicate brand ...
    if (errStr.indexOf('E11000')) return res.status(400).json({
      message: `Duplicate brand. ${errStr}`
    });
    return res.status(500).json(error.stack);
  })
});

router.get('/', (req, res) => {
  const query = JSON.parse(JSON.stringify(req.query));
  const showAll = query.showAll;
  delete query.showAll;
  if (query._id) {
    query._id = new ObjectID(query._id);
  }
  let projection;
  if (Object.keys(query).length || showAll) {
    projection = {};
  } else {
    projection = {name: 1};
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    const brands = yield db.collection('brands').find(query, projection).toArray();
    res.json(brands);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

})

router.get('/one', (req, res) => {

  if (!req.query.id && !req.query.name) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  // res.json({ok: true});
  co(function*() {
    const db = yield dbX.dbPromise;
    let brand;
    switch (true) {
      case !!req.query.id:
        brand = yield db.collection('brands').findOne({_id: new ObjectID(req.query.id)});

        break;
      case !!req.query.name:
        brand = yield db.collection('brands').findOne({name: req.query.name});
        break;
    }
    res.send(brand);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
  


})

const patchRoot = (req, res) => {
  const brandId = req.query.brandId ? req.query.brandId : null;
  const patches = req.body;
  console.log(patches);
  if (!brandId || !patches) {
    return res.status(400).json({
      message: 'Insufficient data provided.'
    });
  }
  const thatTime = new Date();
  const thatUser = req.user._id;
  const patchesX = {
    patches,
    patchedAt: thatTime,
    patchedBy: thatUser,
    target: brandId
  };
  const patchesToApply = toMongodb(patches);

  co(function*() {
    const db = yield dbX.dbPromise;
    const patchResult = yield db.collection('brands').update({
      _id: new ObjectID(brandId)
    }, patchesToApply);
    const savePatchesXResult = yield db.collection('brandPatches').insert(patchesX);
    res.json(patchResult);
  }).catch(error => {
    return res.status(500).json(error.stack);
  })
};

router.patch('/', patchRoot);

module.exports = router;
