/**
 * @typedef DataType
 * 
 * @property {String} _original The Original input data
 * @property {Boolean} required If Data is Required
 * @property {Boolean} reference If Data is a Reference to another Model
 * @property {Boolean} bind If Data is Binded to another Model
 * @property {Boolean} isPrimitive If Data is a primitive type (string, number, boolean)
 * @property {Boolean} isArray If Data is an Array Type
 * @property {Boolean} isObject If Data is Object Type
 * @property {Boolean} isModel If Data is a FireData Model
 * @property {String} variable Data type variable lower case
 * @property {String[]} params Data params
 * 
 */

/**
 * @function parseDataType
 * 
 * @param {String} $data Data to Parse
 * 
 * @description
 * Get the Correct dataType object based on $data String
 * 
 * @return {DataType}
 * 
 */
function parseDataType($data, $modelName, $path) {

  /**
   * Check Data Type must be a String
   */
  if (typeof $data !== 'string' || !$data.length) {
    throw new Error('[ FireDataModeler ] - parseDataType : $data must be a valid String');
  }

  /**
   * Create RegExp and parse Data
   */
  const [variableDescription, ...filters] = $data.split('|');
  const params = variableDescription.split(':');
  params.shift();

  try {
    const [data] = variableDescription  //eslint-disable-line
      .match(/^(!|\?)?(>|=)?(\^|&)?([[A-Za-z\]]+)?((?:\()(.*?)?(?:\)))?(?:(?::)(.*?))?$/);
  }
  catch (e) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid field description for '${$path}' in Model '${$modelName}'. Field type can contain only Letters : '${$data}'`);
  }

  /**
   * Check parenthesis count
   */
  if (($data.match(/\(/g) || []).length !== ($data.match(/\)/g) || []).length) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid Parenthesis count for '${$path}' in Model '${$modelName}' : '${$data}'`);
  }

  if (($data.match(/\[/g) || []).length !== ($data.match(/\]/g) || []).length) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid Square Brackets count for '${$path}' in Model '${$modelName}' : '${$data}'`);
  }

  if (($data.match(/\{/g) || []).length !== ($data.match(/\}/g) || []).length) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid Curly Brackets count for '${$path}' in Model '${$modelName}' : '${$data}'`);
  }

  const [
    _input,
    _isRequired,
    _bindMode,
    _autoCastedOrEvaluated,
    _variable,
    _isFunction,
    _functionParams
  ] = variableDescription
    .match(/^(!|\?)?(>|=)?(\^|&)?([[A-Za-z\]]+)?((?:\()(.*?)?(?:\)))?(?:(?::)(.*?))?$/);

  const _isModel = !/^(string|number|boolean|object|array)$/i.test(_variable) && !_isFunction;
  const _isModelArray = _isModel && /^\[.+\]$/.test(_variable);
  const _isPrimitive = !!/^(string|number|boolean)$/i.test(_variable);
  const _isArray = !!/^array$/i.test(_variable);
  const _isObject = !!/^object$/i.test(_variable);

  /**
   * Check is not function and primitive variable
   */
  if (_isFunction && (_isPrimitive || _isArray || _isObject)) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid variable definition for Field '${$path}' in Model '${$modelName}'. A function could not be named as a default JavaScript Variable Type : ${_input}`);
  }

  /**
   * Check the _variable field if is no
   * a directly evaluated expression
   */
  if (_autoCastedOrEvaluated !== '&' && _variable === undefined) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid variable name for Field '${$path}' in Model '${$modelName}' : '${_input}'`);
  }

  /**
   * If is a function direct evaluated
   * check function expression
   */
  if (_autoCastedOrEvaluated === '&' && !_isFunction) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Invalid Function Expression for Field '${$path}' in Model '${$modelName}' : '${_input}'`);
  }

  /**
   * Check if has some params that will be skipped
   */
  if (params.length && _isModel && !_bindMode) {
    global.console.warn(`[ FireDataModeler ] - WARN - Strange params definition for Field '${$path}' in Model '${$modelName}'. Params are accepted only for Function (DEPRECATED) or Model with a Binding Model : '${_input}'`);
  }

  const $dataType = {
    _original       : $data,
    isPrimitive     : _isPrimitive,
    isArray         : _isArray,
    isObject        : _isObject,
    isModel         : _isModel,
    isModelArray    : _isModelArray,
    isFunction      : !!_isFunction,
    functionExpr    : _isFunction,
    functionParams  : _functionParams,
    directEval      : _autoCastedOrEvaluated === '&',
    required        : _isRequired === '!',
    reference       : _bindMode === '>' && !!(_isFunction || _isModel),
    bind            : _bindMode === '=' && !!(_isFunction || _isModel),
    variable        : _variable && _variable.replace(/^\[|\]$/g, ''),
    autoCast        : _autoCastedOrEvaluated === '^',
    params          : ((_isFunction && _autoCastedOrEvaluated === '&') || (_isModel && _bindMode)) ? params  : [],
    filters,
  };

  /**
   * If is a Javascript Variable type
   * then transform the name into lower case
   */
  if (_isPrimitive || _isArray || _isObject) {
    $dataType.variable = $dataType.variable.toLowerCase();
  }

  /**
   * If data type is Model, and has a bind Type
   * check at least 1 params exists
   */
  if (_isModel && ($dataType.reference || $dataType.bind) && !params.length) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Data '${$data}' is a ${$dataType.reference ? 'reference' : 'bind'} field. A exchange field must exists!`);
  }

  /**
   * Check the deprecated function recognition
   */
  if (_isFunction && params.length) {
    /**
     * Convert the Function Expression
     */
    $dataType.functionExpr = $dataType.functionExpr
      .replace(/(?:\()(.*)(?:\))/, `($1,${params[0]})`)
      .replace(/\(,/, '(');

    global.console.warn(`\n\r\x1b[2m[ %s ]\x1b[0m \x1b[33m%s\x1b[0m Using old notation \x1b[4m'Function():params'\x1b[0m has been deprecated. Converted from \x1b[31m'${_variable}():${params[0]}'\x1b[0m to \x1b[32m'${_variable}(${params[0]})'\x1b[0m. Take a look at \x1b[1m'${_input}'\x1b[0m in Model \x1b[1m'${$modelName}'\x1b[0m at Path \x1b[1m'${$path}'\x1b[0m`, 'FireDataModeler', 'DEPRECATED');

    $dataType.params = [];
  }

  /**
   * If is a direct evaluated function
   * and has no bind/reference, change to reference
   */
  if ($dataType.directEval && !$dataType.reference && !$dataType.bind) {
    $dataType.reference = true;
  }

  /**
   * Check the variable name consistency
   * in javascript environment (it cant start with a number)
   */

  return $dataType;
}

module.exports = parseDataType;
