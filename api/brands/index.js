const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const ObjectID = require('mongodb').ObjectID;
const myAcl = require('../../my-acl');

const dbX = require('../../db');


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
  co(function*() {
    const db = yield dbX.dbPromise;
    const brands = yield db.collection('brands').find().toArray();
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

module.exports = router;
