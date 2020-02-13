/* 
 * this has been almost entirely lifted from 
 * https://github.com/bbc/sqs-consumer
 * which is an excellent library. But I wanted / needed
 * more control over some of the lower level events that
 * the library hides behind the .start() abstraction
 */
 
const SQS = require('aws-sdk/clients/sqs')
const { EventEmitter } = require('events')
const { autoBind } = require('./bind')
const { SQSError, TimeoutError } = require('./errors')
const { logger } = require('../../config')

const requiredOptions = [
  'queueUrl',
  'handleMessage'
]

const createTimeout = (duration) => {
  let timeout
  const pending = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new TimeoutError())
    }, duration)
  })
  return [timeout, pending]
}

const assertOptions = (options) => {
  requiredOptions.forEach((option) => {
    if (!options[option]) {
      throw new Error(`Missing SQS consumer option ['${option}'].`)
    }
  })

  if (options.batchSize > 10 || options.batchSize < 1) {
    throw new Error('SQS batchSize option must be between 1 and 10.')
  }
}

const isConnectionError = (err) => {
  if (err instanceof SQSError) {
    return (err.statusCode === 403 || err.code === 'CredentialsError' || err.code === 'UnknownEndpoint')
  }
  return false
}

const toSQSError = (err, message) => {
  const sqsError = new SQSError(message)
  sqsError.code = err.code
  sqsError.statusCode = err.statusCode
  sqsError.region = err.region
  sqsError.retryable = err.retryable
  sqsError.hostname = err.hostname
  sqsError.time = err.time

  return sqsError
}

const hasMessages = (response) => {
  return response.Messages && response.Messages.length > 0
}

class Consumer extends EventEmitter {
  constructor(options) {
    super()
    assertOptions(options)

    this.queueUrl = options.queueUrl
    this.handleMessage = options.handleMessage
    this.handleMessageTimeout = options.handleMessageTimeout
    this.attributeNames = options.attributeNames || []
    this.messageAttributeNames = options.messageAttributeNames || []
    this.stopped = true
    this.batchSize = options.batchSize || 1
    this.visibilityTimeout = options.visibilityTimeout
    this.terminateVisibilityTimeout = options.terminateVisibilityTimeout || false
    this.waitTimeSeconds = options.waitTimeSeconds || 20
    this.authenticationErrorTimeout = options.authenticationErrorTimeout || 10000

    this.sqs = options.sqs || new SQS({
      region: options.region || process.env.AWS_REGION || 'us-east-1'
    });

    autoBind(this);
  }

  isRunning() {
      return !this.stopped
  }

  start () {
    if (this.stopped) {
      logger.debug('Starting SQS Consumer')
      this.stopped = false
      this.poll()
    }
  }

  stop () {
    logger.debug('Stopping SQS consumer')
    this.stopped = true
  }

  async handleSqsResponse (response) {
    logger.debug('Received SQS response')
    logger.debug(response)

    if (response) {
      if (hasMessages(response)) {
        await Promise.all(response.Messages.map(this.processMessage))
        this.emit('response_processed')
      } else {
        this.emit('empty')
      }
    }
  }

  async processMessage (message) {
    this.emit('message_received', message)

    try {
      await this.executeHandler(message)
      await this.deleteMessage(message)
      this.emit('message_processed', message)
    } catch (err) {
      this.emitError(err, message)

      if (this.terminateVisibilityTimeout) {
        try {
          await this.terminateVisabilityTimeout(message)
        } catch (err) {
          this.emit('error', err, message)
        }
      }
    }
  }

  async receiveMessage (params) {
    try {
      return await this.sqs
        .receiveMessage(params)
        .promise()
    } catch (err) {
      throw toSQSError(err, `SQS receive message failed: ${err.message}`)
    }
  }

  async deleteMessage (message) {
    logger.debug('Deleting message %s', message.MessageId)

    const deleteParams = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle
    };

    try {
      await this.sqs
        .deleteMessage(deleteParams)
        .promise();
    } catch (err) {
      throw toSQSError(err, `SQS delete message failed: ${err.message}`);
    }
  }

  async executeHandler (message) {
    let timeout
    let pending
    try {
      if (this.handleMessageTimeout) {
        [timeout, pending] = createTimeout(this.handleMessageTimeout)
        await Promise.race([
          this.handleMessage(message),
          pending
        ])
      } else {
        await this.handleMessage(message)
      }
    } catch (err) {
      if (err instanceof TimeoutError) {
        err.message = `Message handler timed out after ${this.handleMessageTimeout}ms: Operation timed out.`
      } else {
        err.message = `Unexpected message handler failure: ${err.message}`
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async terminateVisabilityTimeout (message) {
    return this.sqs
      .changeMessageVisibility({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
        VisibilityTimeout: 0
      })
      .promise()
  }

  emitError(err, message) {
    if (err.name === SQSError.name) {
      this.emit('error', err, message)
    } else if (err instanceof TimeoutError) {
      this.emit('timeout_error', err, message)
    } else {
      this.emit('processing_error', err, message)
    }
  }

  buildReceiveParams () {
    const receiveParams = {
      QueueUrl: this.queueUrl,
      AttributeNames: this.attributeNames,
      MessageAttributeNames: this.messageAttributeNames,
      MaxNumberOfMessages: this.batchSize,
      WaitTimeSeconds: this.waitTimeSeconds,
      VisibilityTimeout: this.visibilityTimeout
    }
    return receiveParams
  }

  poll() {
    if (this.stopped) {
      this.emit('stopped')
      return
    }

    logger.debug('Polling for SQS messages')

    let pollingTimeout = 0
    this.receiveMessage(this.buildReceiveParams())
      .then(this.handleSqsResponse)
      .catch((err) => {
        this.emit('error', err)
        if (isConnectionError(err)) {
          logger.debug('There was an authentication error to AWS SQS Service. Pausing before retrying.')
          pollingTimeout = this.authenticationErrorTimeout
        }
        return
      }).then(() => {
        setTimeout(this.poll, pollingTimeout)
      }).catch((err) => {
        this.emit('error', err)
      })
  }
}

module.exports = { Consumer }
