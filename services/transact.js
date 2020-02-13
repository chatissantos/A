const { CloudwatchLogger } = require('./cloudwatch')
const crypto = require('crypto')
const cloudwatchLogger = CloudwatchLogger()
const { logger } = require('../../config')

const validateOptions = (options) => {
  const {
    eventType,
    eventAction,
    source,
    destination,
    timestamp
  } = options
  const attributes = [eventType, eventAction, source, destination, timestamp]
  attributes.map((attr) => {
    if (!attr) {
      throw new Error(`${attr} is a required option for generating messages for SQS`)
    }
  })
}

/*
 * This function should create a unique digest for the options
 * that determine the meaningful specificity of the action being handled
 */
const generateMessageId = (options) => {
  validateOptions(options)
  return crypto.createHash('sha1').update(JSON.stringify(options)).digest('base64')
}

const generateMessageKey = (options) => {
  validateOptions(options)
  const {
    eventType,
    eventAction,
    source,
    destination,
    timestamp
  } = options
  let messageId = options.messageId
  if (!messageId) {
    messageId = generateMessageId(options)
  }
  return `${eventType}-${eventAction}-from-${source}-to-${destination}-${timestamp.toJSON()}-${messageId}`
}

/*
NOTE: this is the style of transaction history log we are putting into CloudWatch
{
  "event_type": "customer",
  "event_action": "create",
  "message_id": "Tk+GObyTCFQfQK7fHfZXLozAV38=",
  "sent_at": "2017-01-18T18:08:44.830Z",
  "source": "prod",
  "destination": "ecom",
  "event_detail": {
    "customer": {
      "id": 99,
      "email": "customer@fake.com",
      "first_name": "John",
      "last_name": "Smith"
    }
  }
}
*/
const createTransactionHistory = async (transactOptions) => {
  const source = transactOptions.source || 'prod'
  const destination = transactOptions.destination || 'ecom'
  const timestamp = transactOptions.timestamp || Date.now()
  const eventType = transactOptions.eventType
  const apiObject = transactOptions.apiObject
  const eventAction = transactOptions.eventAction
  const options = {
    eventType,
    eventAction,
    apiObject,
    source,
    destination,
    timestamp
  }
  let messageId = transactOptions.messageId
  if (!messageId) {
    messageId = generateMessageId(options)
  }
  options.messageId = messageId
  const historyObject = {
    event_type: eventType,
    event_action: eventAction,
    message_id: messageId,
    sent_at: timestamp,
    source,
    destination,
    event_detail: apiObject
  }

  const awsResults = await cloudwatchLogger.log(historyObject)
  const results = {
    messageId,
    awsResults
  }
  logger.info({ aws_results: results, history_object: historyObject })
  return results
}

module.exports = {
  createTransactionHistory,
  generateMessageKey,
  generateMessageId
}
