const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')
const configData = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'settings.yaml')))
const environment = process.env.NODE_ENV || 'localmachine'

const getConfigsFromENV = () => {
  const cfgData = Object.assign({}, configData[environment])
  Object.assign(cfgData.db.connection, {
    host: (process.env.PG_HOST || cfgData.db.connection.host),
    user: (process.env.PG_USER || cfgData.db.connection.user),
    password: (process.env.PG_PASSWORD || cfgData.db.connection.password),
    database: (process.env.PG_DATABASE || cfgData.db.connection.database),
    port: (process.env.PG_PORT || cfgData.db.connection.port)
  })
  Object.assign(cfgData.mongo.connection, {
    host: (process.env.MONGO_HOST || cfgData.mongo.connection.host),
    user: (process.env.MONGO_USER || cfgData.mongo.connection.user),
    password: (process.env.MONGO_PASSWORD || cfgData.mongo.connection.password),
    database: (process.env.MONGO_DATABASE || cfgData.mongo.connection.database),
    port: (process.env.MONGO_PORT || cfgData.mongo.connection.port)
  })
  Object.assign(cfgData.aws.connection, {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || cfgData.aws.connection.accessKeyId),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || cfgData.aws.connection.secretAccessKey)
  })
  if (environment === 'test') {
    const localstackHost = (process.env.LOCALSTACK_HOST || 'localhost')
    const replaceValue = 'TEST_HOST'
    cfgData.aws.sqs.endpoint = cfgData.aws.sqs.endpoint.replace(replaceValue, localstackHost)
    cfgData.aws.sqs.inbound_queue_url = cfgData.aws.sqs.inbound_queue_url.replace(replaceValue, localstackHost)
    cfgData.aws.sqs.outbound_queue_url = cfgData.aws.sqs.outbound_queue_url.replace(replaceValue, localstackHost)
    cfgData.aws.s3.endpoint = cfgData.aws.s3.endpoint.replace(replaceValue, localstackHost)
    cfgData.aws.cloudwatch.logs.endpoint = cfgData.aws.cloudwatch.logs.endpoint.replace(replaceValue, localstackHost)
    cfgData.aws.sns.endpoint = cfgData.aws.sns.endpoint.replace(replaceValue, localstackHost)
  }
  return cfgData
}

const settings = getConfigsFromENV()
const appRoot = path.join(__dirname, '..')

module.exports = {
  settings,
  appRoot
}
