const passport = require("passport");  
const passportJWT = require("passport-jwt");
const dbX = require('../db');
const users = [
  {
    "id": "1",
    "username": "baoshijie",
    "password": "abcd",
    "entityId": "12345"
  }
];
const cfg = {  
  jwtSecret: "MyS3cr3tK3Y",
  jwtSession: {
    session: false
  }
}; 
const ExtractJwt = passportJWT.ExtractJwt;  
const Strategy = passportJWT.Strategy;  
const params = {  
  secretOrKey: cfg.jwtSecret,
  jwtFromRequest: ExtractJwt.fromAuthHeader()
};

module.exports = function() {  
  const strategy = new Strategy(params, function(payload, done) {
    dbX.usersColl.findOne({id: payload.id}, '-password').then(user => {
      if (user) {
        done(null, user);
      } else {
        done(null, false);
        // or you could create a new account 
      }
    }).catch(err => {
      return done(err, false);
    }).then(() => db.close());
      // const user = users[payload.id] || null;
  });
  passport.use(strategy);
  return {
    initialize: function() {
      return passport.initialize();
    },
    authenticate: function() {
      return passport.authenticate("jwt", cfg.jwtSession);
    }
  };
};