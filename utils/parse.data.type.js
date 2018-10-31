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
function parseDataType($data) {

  /**
   * Check Data Type must be a String
   */
  if (typeof $data !== 'string' || !$data.length) {
    throw new Error('[ FireDataModeler ] - parseDataType : $data must be a valid String');
  }

  /**
   * Create RegExp and parse Data
   */
  const $regExp = $data.indexOf(':') !== -1 ? /^(!|\?)?(>|=)?(\^)?(.+(?=:))(?:(?::)(.+))?/ : /^(!|\?)?(>|=)?(\^)?(.+)$/;

  /**
   * If no match throw an Error
   */
  const $match = $data.match($regExp);

  if (!$match) {
    throw new Error('[ FireDataModeler ] - parseDataType : Invalid $data String');
  }

  /**
   * Split Matched value
   */
  const [input, required, bind, autoCast, variable, params] = $match;
  
  const isFunction = /\(\)$/.test(variable);
  const isModel = !/^(string|number|boolean|object|array)$/i.test(variable) && !isFunction;
  let variableName = variable.replace(/\(\)$/, '');
  let getThisFirst;

  let isModelArray = false;

  if (isModel && /^\[.+\]$/.test(variableName)) {
    isModelArray = true;
    variableName = variableName.replace(/^\[|\]$/g, '');
  }

  if (/^this\|\|/.test(variableName)) {
    getThisFirst = true;
    variableName = variableName.replace(/^this\|\|/, '');
  }

  /**
   * Check Variable consistence
   */
  if (!/^[A-Za-z0-9]+$/.test(variableName)) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Variable name could contain only String character and Numbers. Found '${variableName}'`);
  }

  const $dataType = {
    _original: input,
    required: required === '!',
    reference: bind === '>' && (isFunction || isModel),
    bind: bind === '=' && (isFunction || isModel),
    autoCast: !!autoCast,
    isPrimitive: !!/^(string|number|boolean)$/i.test(variable) && !isFunction,
    isArray: !!/^array$/i.test(variable) && !isFunction,
    isObject: !!/^object$/i.test(variable) && !isFunction,
    isModel,
    isFunction,
    isModelArray,
    getThisFirst: !!getThisFirst,
    variable: variableName,
    params: typeof params === 'string' && (isFunction || isModel) ? params.replace(/,\s/g, ',').split(',') : []
  };

  /**
   * Transform Variable to LowerCase only if
   * is a Primitive type
   */
  if ($dataType.isPrimitive || $dataType.isArray || $dataType.isObject) {
    $dataType.variable = $dataType.variable.toLowerCase();
  }

  /**
   * If is a bind|reference type, check at least one params exists
   */
  if (($dataType.reference || $dataType.bind) && !isFunction && !$dataType.params.length) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Data '${$data}' is a ${$dataType.reference ? 'reference' : 'bind'} field. A exchange field must exists!`);
  }

  if ($dataType.params.length && (!$dataType.reference && !$dataType.bind && !isFunction)) {
    throw new Error(`[ FireDataModeler ] - parseDataType : Data ${$data} has params but is not a referenced or a binded value.`);
  }

  /**
   * Return Data
   */
  return $dataType;

}

module.exports = parseDataType;
