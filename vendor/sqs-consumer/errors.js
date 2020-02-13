/* 
 * this has been almost entirely lifted from 
 * https://github.com/bbc/sqs-consumer
 * which is an excellent library. But I wanted / needed
 * more control over some of the lower level events that
 * the library hides behind the .start() abstraction
 */

class SQSError extends Error {
  constructor(message) {
    super(message)
    this.setBaseAttributes()
    this.name = this.constructor.name
  }

  setBaseAttributes() {
    const baseAttributes = [
      'code', 'statusCode', 'region',
      'hostname', 'time', 'retryable'
    ]
    baseAttributes.map(attr => {
      this[attr] = null
    })
  }
}

class TimeoutError extends Error {
  constructor(message) {
    if (!message) {
      message = 'Operation timed out.'
    }
    super(message)
    this.message = message
    this.name = 'TimeoutError'
  }
}

module.exports = {
  SQSError,
  TimeoutError
}
