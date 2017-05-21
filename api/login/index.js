const router = require('express').Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const dbX = require('../../db');


const logJsonStr = require('../../utils/log-json-string');

router.post('/', function(req, res) {
  if (req.body.username && req.body.password) {
    const username0 = req.body.username;
    const password0 = req.body.password;
    dbX.usersColl.findOne({username: username0}).then(userFound => {
      logJsonStr(userFound);
      if(userFound) {
        bcrypt.compare(password0, userFound.password).then(function(result) {
          if(result) {
            console.log('wheres my token');
          } else {
            res.sendStatus(401);
          }
        });
      } else {
        res.sendStatus(401);
      }
    }).catch(err => {
      res.sendStatus(500);
    }).then(() => dbX.db.close());

    // const user = users.find(function(u) {
    //   return u.username === username && u.password === password;
    // });
    // if (user) {
    //   const payload = {
    //     id: user.id
    //   };
    //   const token = jwt.encode(payload, cfg.jwtSecret);
    //     res.json({
    //       token: token
    //     });
    //   } else {
    //     res.sendStatus(401);
    //   }
    } else {
      res.sendStatus(401);
    }
});

module.exports = router;