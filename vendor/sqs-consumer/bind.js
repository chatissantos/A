/* 
 * this has been almost entirely lifted from 
 * https://github.com/bbc/sqs-consumer
 * which is an excellent library. But I wanted / needed
 * more control over some of the lower level events that
 * the library hides behind the .start() abstraction
 */

const isMethod = (propertyName, value) => {
  return propertyName !== 'constructor' && typeof value === 'function'
}

const autoBind = (obj) => {
  const propertyNames = Object.getOwnPropertyNames(obj.constructor.prototype)
  propertyNames.forEach((propertyName) => {
    const value = obj[propertyName]
    if (isMethod(propertyName, value)) {
      obj[propertyName] = value.bind(obj)
    }
  })
}

module.exports = { autoBind }
