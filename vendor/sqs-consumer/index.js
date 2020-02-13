/* 
 * this has been almost entirely lifted from 
 * https://github.com/bbc/sqs-consumer
 * which is an excellent library. But I wanted / needed
 * more control over some of the lower level events that
 * the library hides behind the .start() abstraction
 */

const { Consumer, ConsumerOptions } = require('./consumer')

module.exports = { Consumer, ConsumerOptions }
