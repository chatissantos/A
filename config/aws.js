const { settings } = require('./settings')
const awsConfig = Object.assign({}, settings.aws)
const AWS = require('aws-sdk')

AWS.config.update(awsConfig.connection)

module.exports = {
  AWS,
  awsConfig
}
