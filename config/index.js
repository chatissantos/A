const { settings, appRoot } = require('./settings')
const { AWS, awsConfig } = require('./aws')
const { logger, requestLogger, responseLogger } = require('./logger')
const db = require('./db')
const mongo = require('./mongo')
const redis = require('./redis')
const secrets = require('./secrets')
const { SWAGGER_SPEC } = require('./swagger')

module.exports = {
  settings, appRoot, AWS, awsConfig, logger, requestLogger, responseLogger, db, redis, secrets, SWAGGER_SPEC, mongo
}
