class FireDataError {

  constructor({ $modelName = '', error = '', functionName = '', message = '', data = null, original = undefined } = {}) {
    /**
     * Build Error Object
     */
    this.e = `${$modelName.toLowerCase()}/${error.toLowerCase().replace(/\s|\//g, '-')}`;
    this.message = `[ FireDataModeler ] ${$modelName} -> ${functionName.split(' ').join('() -> ')}() : ${message}`;
    this.data = data;

    this.stack = [];

    // console.log(original);

    /**
     * If Original is a FireDataError Instance,
     * then concat the stack arrays
     */
    if (original instanceof FireDataError) {
      original.stack.forEach($error => this.stack.push($error));
    }

    else if (original !== undefined) {
      this.stack.push(original);
    }

    this.stack.push(this);

  }

  get name() {
    return this.e;
  }

  get original() {
    return this.stack[0].name || this.stack[0];
  }

  get main() {
    return this.stack[0];
  }

}

module.exports = FireDataError;
