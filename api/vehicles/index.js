const router = require('express').Router();


router.get('/', (req, res) => {
  return res.json(req.user);
})
module.exports = router;