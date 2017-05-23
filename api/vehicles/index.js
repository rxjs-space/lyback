const router = require('express').Router();

router.get('/', (req, res) => {
  res.send('at vehicles');
})
module.exports = router;