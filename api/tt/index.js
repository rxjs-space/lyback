const router = require('express').Router();
const co = require('co');

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
    res.send(docs[0].details);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
});

router.patch('/one', (req, res) => {
  if (!req.body.name || !req.body.patches) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }

  res.json(req.body);
})

module.exports = router;
