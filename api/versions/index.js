const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const dbX = require('../../db');

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const docs = yield db.collection('versions').find({}).toArray();
    res.send(docs);
  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
});

router.post('/compare', (req, res) => {
  if (!req.body || !req.body.versionHash) {return res.status(400).json({
    message: 'No data provided.'
  })}
  const versionHash = req.body.versionHash;
  const collections = Object.keys(versionHash);
  const compareResult = {};
  co(function*() {
    const db = yield dbX.dbPromise;
    const serverVersions = yield db.collection('versions').find({}).toArray();

    yield coForEach(collections, function*(collection) {
      const serverVersion = serverVersions.find(sv => sv.collection === collection)['version'];
      const clientVersion = versionHash[collection];
      if (serverVersion === clientVersion) {
        compareResult[collection] = {
          same: true
        }
      } else {
        const newData = yield db.collection(collection).find({}).toArray();
        compareResult[collection] = {
          same: false,
          newData,
          newVersion: serverVersion
        }
      }
    })

    res.json(compareResult)

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })



  // compare version and return hash like
  // {collectionName: {same: boolean, newData: any, newVersion: string}}


})

module.exports = router;
