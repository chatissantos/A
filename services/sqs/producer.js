const Producer = require('sqs-producer')
const { awsConfig } = require('../../../config/aws')
// const { logger } = require('../../../config')
const sqsConfig = Object.assign({}, awsConfig.sqs)
const {
  generateMessageId,
  generateMessageKey,
  createTransactionHistory
} = require('../transact')

class GenericProducer {
  constructor (config) {
    this.producer = Producer.create(config)
  }
  async queueSize () {
    const producerPromise = new Promise((resolve, reject) => {
      this.producer.queueSize((err, size) => {
        if (err) reject(err)
        resolve(size)
      })
    })
    return producerPromise
  }
  async send (messages) {
    const producerPromise = new Promise((resolve, reject) => {
      this.producer.send(messages, (err) => {
        if (err) reject(err)
        resolve(true)
      })
    })
    return producerPromise
  }
}

class FractureProducer extends GenericProducer {
  constructor (config) {
    super({
      queueUrl: sqsConfig.outbound_queue_url,
      region: awsConfig.connection.region,
      accessKeyId: awsConfig.connection.accessKeyId,
      secretAccessKey: awsConfig.connection.secretAccessKey
    })
  }

  /*
   * Takes as arguments:
   * eventAction (create|update|delete)
   * eventType (order|customer)
   * apiObject (standard Javascript Object)
   * ***********
   * This function is designed to put messages on the OUTBOUND queue
   * (see the constructor) in order to send messages FROM prod TO ecom
   * about modified orders and customers
   */
  async sendMessage (eventAction, eventType, apiObject) {
    const serialObject = JSON.stringify(apiObject)
    // build standard transaction options
    const transactionOptions = {
      eventAction,
      eventType,
      apiObject,
      timestamp: new Date(),
      source: 'prod',
      destination: 'ecom'
    }
    // generate a message ID and Key that we will use both on SQS and for S3 storage
    const messageId = generateMessageId(transactionOptions)
    transactionOptions.messageId = messageId
    const messageKey = generateMessageKey(transactionOptions)
    const message = {
      id: messageId,
      body: serialObject,
      messageAttributes: {
        action: {
          DataType: 'String',
          StringValue: eventAction
        },
        type: {
          DataType: 'String',
          StringValue: eventType
        },
        message_key: {
          DataType: 'String',
          StringValue: messageKey
        }
      }
    }
    // this.send is a base class method that
    // goes to a promisified version of the the Producer function's
    // send method
    const messageSent = await this.send([message])
    let historyResults = { success: false }
    if (messageSent) {
      const transactionResults = await createTransactionHistory(transactionOptions)
      Object.assign(historyResults, transactionResults)
      historyResults.success = true
    } else {
      const errorOptions = Object.assign({}, transactionOptions)
      errorOptions.errror = { status: 'error', message: 'Unable to send message' }
      const errorResult = await createTransactionHistory(errorOptions)
      return errorResult
    }
    return historyResults
  }
}

module.exports = {
  GenericProducer,
  FractureProducer
}
