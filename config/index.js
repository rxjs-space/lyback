module.exports = {  
  jwtSecret: "MyS3cr3tK3Y",
  jwtSession: {
    session: false
  },
  email: {
    username: process.env.EMAILUSER || 'lynx04213@zoho.com',
    password: process.env.EMAILPASS || 'a1234567'
  }
};