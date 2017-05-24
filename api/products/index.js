const router = require('express').Router();

router.get('/', (req, res) => {
  return res.json(req.user);
  // return res.send('at', req.originalUrl);
})
module.exports = router;