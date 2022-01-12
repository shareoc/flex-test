const { getSdk, getTrustedSdk, handleError, serialize } = require('../api-util/sdk');

module.exports = (req, res) => {
    console.log("hey")
    res
      .status(200)
      .set('Content-Type', 'application/transit+json')
      .send({error: "none"})
      .end();
  
    // integrationSdk
    };