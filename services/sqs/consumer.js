const { Consumer } = require('../../vendor/sqs-consumer')
const { AWS, awsConfig } = require('../../config/aws')
const { logger } = require('../../config')
const { sqsMessageHandler } = require('./handler')
const { createTransactionHistory } = require('../transact')

const sqsConfig = Object.assign({}, awsConfig.sqs)

const sendErrorToCloudWatch = (err) => {
  const eventAction = 'sqs-consumer'
  const eventType = 'error'
  const transactionOptions = {
    eventAction,
    eventType,
    apiObject: err,
    timestamp: new Date(),
    source: 'ecom',
    destination: 'prod'
  }
  // this is a promise but it's okay if it just happens whenever it can
  createTransactionHistory(transactionOptions)
}

const fractureConsumer = new Consumer({
  queueUrl: sqsConfig.inbound_queue_url,
  sqs: new AWS.SQS({
    endpoint: sqsConfig.endpoint
  }),
  handleMessage: sqsMessageHandler,
  batchSize: sqsConfig.batch_size,
  waitTimeSeconds: sqsConfig.wait_time_seconds,
  messageAttributeNames: ['action', 'type', 'id', 'message_key']
})

fractureConsumer.on('bad_request', (payload) => {
  // console.log('bad request payload: ', payload)
  createTransactionHistory(payload)
})

fractureConsumer.on('error', (err) => {
  logger.error(err)
  // console.log('consumer error: ', err)
  sendErrorToCloudWatch(err)
})

fractureConsumer.on('processing_error', (err) => {
  logger.error(err)
  // console.log('consumer processing_error: ', err)
  sendErrorToCloudWatch(err)
})

fractureConsumer.on('timeout_error', (err) => {
  logger.error(err)
  // console.log('consumer timeout_error: ', err)
  sendErrorToCloudWatch(err)
})

module.exports = {
  fractureConsumer
}
