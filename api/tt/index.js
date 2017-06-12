const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');

const dbX = require('../../db');

router.post('/', function(req, res) {
  // for upsert a section in the tt (for example, create 'types', replace 'types')
  co(function*() {
    const db = yield dbX.dbPromise;
    const upsertOp = yield db.collection('tt').updateOne(
      {name: req.body.name}, 
      {$set: req.body},
      {upsert: true}
    );
    res.json(upsertOp);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
});

router.get('/one', (req, res) => {
  if (!req.query.name) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('tt').find({name: req.query.name}).toArray();
    if (!docs.length) {return res.status(400).json({
      message: `no doc whose name is ${req.query.name}`
    })}
    res.send(docs[0]);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
});

router.patch('/one', (req, res) => {
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  if (!req.body) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }

  co(function*() {
    const db = yield dbX.dbPromise;
    req.body.patches.push(
      {op: 'replace', path: '/modifiedAt', value: (new Date()).toISOString()},
      {op: 'replace', path: '/modifiedBy', value: req.user._id}
    )
    const patches = {patches: req.body.patches};
    patches.createdAt = (new Date()).toISOString();
    patches.createdBy = req.user._id;
    patches.name = name;
    const patchesToApply = toMongodb(req.body.patches);
    console.log(req.body.patches);
    console.log(patchesToApply);
    const patchResult = yield db.collection('ttPatches').insert(patches);
    const updateResult = yield db.collection('tt').updateOne(
      {name},
      patchesToApply
    );
    res.json(updateResult);
    // console.log(patchesToApply);
    // res.json({
    //   message: 'ok'
    // })
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

  // res.json(req.query);
})

module.exports = router;
