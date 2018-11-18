<div align="center">
    <div>
        <img width="256" src="media/logo.png" alt="Awesome Node.js">
    </div>
    <br>
    <br>
  <h1>FireData Modeler</h1>
    <br>
</div>

FireData Modeler is a NodeJS package to help maintain data on [Firebase Database](https://firebase.google.com/).

It will help you to build Model for your data and synchronize it with other Model, avoiding multiple query and update on your backend API.

With FireData Modeler you can choose exactly what do you want to save into your Database and how you can want to save it.
You can apply validators and formatters to your data, that will be executed always and help you to get safe data to send to Firebase.

## Table of Content <!-- omit in toc -->
- [Example](#example)
    - [1. Install](#1-install)
    - [2. Require](#2-require)
    - [3. Create a Model](#3-create-a-model)
    - [4. Add Data](#4-add-data)
- [FireData Type Definition](#firedata-type-definition)
  - [Declaring JavaScript Variable Type](#declaring-javascript-variable-type)
    - [Variable AutoCast](#variable-autocast)
  - [Using Model as FireData Type](#using-model-as-firedata-type)
  - [Using Function as FireData Type](#using-function-as-firedata-type)
  - [Filter Data](#filter-data)
- [Modeler](#modeler)
  - [$model(_name_, _constructor_)](#modelname-constructor)
    - [`model` {Object}](#model-object)
    - [`paths` {Object[]}](#paths-object)
    - [`validators` {Object[]}](#validators-object)
    - [`formatters` {Function[]}](#formatters-function)
    - [`onAdd | onSet | onGet | onUpdate | onDelete` {Function[]}](#onadd--onset--onget--onupdate--ondelete-function)
    - [`afterAdd | afterSet | afterUpdate | afterDelete` {Function[]}](#afteradd--afterset--afterupdate--afterdelete-function)
  - [$extractor(_name_, _constructor_)](#extractorname-constructor)
    - [`model` {String}](#model-string)
    - [`extract` {Object}](#extract-object)
    - [`validators` {Object[]}](#validators-object-1)
    - [`formatters` {Function[]}](#formatters-function-1)
  - [$parser(_name_, _constructor_)](#parsername-constructor)
  - [$function(_name_, _function_, _priority_)](#functionname-function-priority)
  - [$filter(_name_, _function_)](#filtername-function)
- [Talker](#talker)
  - [Loading Talker](#loading-talker)
  - [$path(_placeholder_)](#pathplaceholder)
    - [replace(_replacer_)](#replacereplacer)
    - [get()](#get)
    - [delete()](#delete)
  - [$parse(_modelName_)](#parsemodelname)
  - [$add(_modelName_)](#addmodelname)
  - [$set(_modelName_)](#setmodelname)
  - [$update(_modelName_)](#updatemodelname)
  - [$get(_modelName_)](#getmodelname)
  - [$delete(_modelName_)](#deletemodelname)
  - [$drop(_modelName_)](#dropmodelname)
  - [$destroy()](#destroy)
- [Built With](#built-with)
- [Versioning](#versioning)
- [Authors](#authors)
- [License](#license)

## Example
#### 1. Install
Install the  FireData Modeler into your project
```sh
npm install --save @mooxed/fire-data-modeler
```

#### 2. Require
Require the Dependency and build a new Instance of the [`Modeler`](#modeler) at the top of your file
```js
const FireDataModeler = require('@mooxed/fire-data-modeler');

const Modeler = new FireDataModeler();
```

#### 3. Create a Model
Create the Contact model using the [`Modeler`](#modeler) instance
```js
Modeler
  .$model('Company', {
    model: {
      name: '!String'
    },
    paths: {
      hasID: true,
      read: 'data/company',
      writes: [
        // Tell Model that must update also contact referenced to this Company
        { ref: 'data/contact', queryOn: 'companyID', writeChild: 'company' }
      ]
    }
  })
  .$model('Contact', {
    model: {
      name: '!String',      // use ! to require a field
      surname: '?String',   // the ? tell model the field is not required
      phone: 'String',      // the ? is optional
      email: 'String',
      company: '>Company:companyID'   // it will be used the Company model to add/update data
    },
    paths: {
      hasID: true,
      read: 'data/contact'
    },
    formatters: [
      // Use a formatter to manipulate data while parsing
      ($data) => {
        $data.displayName = [$data.name, $data.surname].join(' ').trim();
        return $data;   // each formatter must return data
      }
    ]
  })
```

#### 4. Add Data
Use the [`Talker`](#talker) to add Data to Firebase Database
```js
/**
* To use the Talker, must load the Firebase Admin Credential
*/
const AdminCredential = require('./your-json-credential.json');

const $talker = Modeler.Talker({ credential: AdminCredential, databaseURL: 'http://your-database.firebaseio.com' });

/**
 * To Add Data you can create an Adder
 */
const CompanyAdder = $talker.$add('Company');
const ContactAdder = $talker.$add('Contact');

CompanyAdder({ name: 'Apple' })
  .then(($id) => ContactAdder({ name: 'John', surname: 'Doe', companyID: $id, foo: 'bar' }))
  .then(($id) => {
    /**
     * $id is the Firebase Data ID
     * 
     * Data on Database now contain
     * {
     *  name: 'John',
     *  surname: 'Doe',
     *  displayName: 'John Doe',
     *  companyID: <idCompanyAdded>,
     *  company: {
     *    name: 'Apple'
     *  }
     * }
     * 
     * Undefined property in Model are automatically stripped
     */
  })
  .catch((e) => {
    // e === Instance of FireDataError, contain error and errors stack (if more then one)
    console.log(e.original);
  })

/**
 * ... After you can update Contact using id
 */
const ContactUpdater = $talker.$update('Contact');

ContactUpdater($id, { name: 'Jane' })
  .then(() => {
    /**
     * Now, data for $id on Database is
     * {
     *  name: 'Jane',
     *  surname: 'Doe',
     *  displayName: 'Jane Doe' <- Automatically updated using formatter function
     *  companyID: <idCompanyAdded>,
     *  company: {
     *    name: 'Apple'
     *  }
     * }
     */
  })
  .catch((e) => {
    // e === Instance of FireDataError, contain error and errors stack (if more then one)
    console.log(e.original);
  })

/**
 * ... After you can update Company too
 */
const CompanyUpdater = $talker.$update('Company');

CompanyUpdater($companyID, { name: 'Google' })
  .then(() => {
    /**
     * Obviously Company data now contain property name === 'Google',
     * but lookin on 'Jane' Contact data, now is
     * {
     *  name: 'Jane',
     *  surname: 'Doe',
     *  displayName: 'Jane Doe'
     *  companyID: <idCompanyAdded>,
     *  company: {
     *    name: 'Google'  <- Automatically updated by 'Company' model and the 'writes' path
     *  }
     * }
     */
  })

/**
 * Trying adding data without the required key
 * generate an error
 */
ContactAdder({ surname: 'Baggins' })
  .then(($id) => {

  })
  .catch((e) => {
    // e.original === 'contact/name-missing'
  })

/**
 * Key evaluate correct type to
 */
ContactAdder({ name: 150 })
  .then(($id) => {

  })
  .catch((e) => {
    // e.original === 'contact/name-error'
  })
```

## FireData Type Definition
The `FireData Type` is the definition of the type of data that must be written into the object before sending it to Firebase.

An example of a simple FireData Type could be
```js
/**
 * In Model Constructor
 */
{
  name: '!String',
  surname: '?String'
}
```
In this case, we are telling our [`Modeler`](#modeler) that in the field `name` there will be a String and that it's required (with the `!`). Instead in the field `surname` __could__ be present a String and the data must be kept only if is a String (using the `?`)

### Declaring JavaScript Variable Type
All type of Variables accepted from Firebase are accepted as `primitive` from the [`Modeler`](#modeler), as `String`, `Number`, `Boolean`, `Object` and `Array`.
```js
Modeler.$model('Person', {
  model: {
    age: '?Number',
    name: '!String',
    address: '?Object',
    hasDog: '!Boolean',
    dogsName: '?Array',
  }
})
```
#### Variable AutoCast
Using the `primitive` variable type get you the ability to try the `autocast` method, to convert the any type of variable into the desired type. To set autocast must prepend to the variable type the `^` symbol.
```js
/**
 * In Model Constructor
 */
  {
    isMale: '!^Boolean'
  }
```
Any type of data inserted into `isMale` field will be auto-converted into a Boolean.

This option will work with all variable type (String, Number, Boolean, Object, Array).

### Using Model as FireData Type
Using the same logic we can tell [`Modeler`](#modeler) to use an existing Model to build a Field, getting data from the Database using the ID specified into the __exchange field__

A more complex example using this logic could be
```js
/**
 * In Model Constructor
 */
{
  company: '!>Company:companyID'
}
```
This will be translated pretty much in 
>Keep the ID stored in `companyID` field (that is required using `!` symbol), use it to get data from Firebase using the Model `Company` and put the result here. Do it only if the field `companyID` is not changed (if we are updating data) and if `company` field is empty (using the `>` symbol)

We can tell [`Modeler`](#modeler) to use also an [`Extractor`](#extractorname-constructor) to keep only certain data. You could read more on Extractor later

Another more complex example is
```js
/**
 * In Model Constructor
 */
{
  users: '?=[UserDetail]:usersID'
}
```
as above, the translation of this is
>Keep the Array of ID stored in `usersID` (wrapping Model in brackets `[ ]`) building Firebase Link like `{ user1: true, user2: true ... }` and for each users ID build user detail using model `UserDetail` and store the data into `users` field using same structure `{ user1: <Data>, user2: <Data> ... }`. Do it every time i'm uploading/downloading data (using the `=` symbol)

The structure representation of FireData Type Definition in this case is
```
  [ ? | ! ] [ > | = ] [ ModelName ] : [ ExchangeField ]
    /|        /|           /|               /|
     |         |            |                |__The Exchange Field
     |         |            |                   into store ID
     |         |            |
     |         |            |__ Model or Extractor to Use
     |         |
     |         |__Bind Type (Referenced or Binded)
     |
     |__ Optional / Required
```
### Using Function as FireData Type
You can also specify a function to run to fill the field. Function must be declared using [`Modeler.$function`](#functionname-function), you could read more on it later.

A function example is
```js
/**
 * Suppose to have declared a function named Now that
 * will return a timestamp when invoked
 */
{
  createdOn: '>Now()',
  editedOn: '=Now()'
}
```
This will be translated in
>If `createdOn` is empty, run the `Now` function and put the result in this field (is referenced `>`). Instead, every time I'm updating data to Firebase, run `Now` function and store the result into `editedOn` (as it is bonded, using `=`)

The function will be invoked with the `this` bound to the parsed model and can have multiple parameters that will be used as function arguments. The last argument appended is always an instance of the [`Talker`](#talker).

Arguments could be specified after function invoke separated from function using `:`

```js
/**
 * In Model Constructor
 */
{
  name: '?String',
  dogs: '?Array',
  hasDogs: '=HasDogs():dogs'
}

/**
 * On Function declaration
 */
Modeler
  .$function('HasDogs', ($dogs = []) => !!$dogs.length);
```

### Filter Data
A filter is a function executed after the field parsing. This is the last option to append to the field declaration, it is composed by the filter name. All filters arguments (separated from name using `:` ) are passed to filter function as __String__
```js
/**
 * In Model Constructor
 */
{
  date: '?Number|startOf:day'
}

/**
 * On Filter declaration
 */
Modeler
  .$filter('startOf', (value, type) => {
    /**
     * value === 'date' field
     * type === 'day' as String
     */

    /**
     * this filter will use moment to return always
     * the timestamp of start of 'day'
     */
    return moment(value).startOf(type).valueOf();

  })
```

The function could also return a Promise, fulfilled with the result to store into the field: in this case, __Modeler__ will wait until function are resolved before uploading data to Database.

## Modeler

To create new Model for your Data you must use the __Modeler__ instance
```js
const FireDataModeler = require('@mooxed/fire-data-modeler');
const Modeler = new FireDataModeler();
```

### $model(_name_, _constructor_)
Use this function to build a complete Model for your data. The Model name must be unique on your project. Using two times the same model name will produce an error, to avoid replace of an existing model.

The _constructor_ object is the real definition of the Model and could have the following properties

| Key           | Type         | Required | Default | Description                                            |
| ------------- | ------------ | -------- | ------- | ------------------------------------------------------ |
| `model`       | `Object`     | `true`   |         | Model Rapresentation                                   |
| `paths`       | `Object`     | `true`   |         | Paths to read/write/update Model                       |
| `validators`  | `Object[]`   | `false`  | `[]`    | Array of Validator functions to execute during parsing |
| `formatters`  | `Function[]` | `false`  | `[]`    | Array of Function to format the Data                   |
| `onAdd`       | `Function[]` | `false`  | `[]`    | Array of Function to execute while adding data         |
| `onSet`       | `Function[]` | `false`  | `[]`    | Array of Function to execute while setting data        |
| `onGet`       | `Function[]` | `false`  | `[]`    | Array of Function to execute while getting data        |
| `onUpdate`    | `Function[]` | `false`  | `[]`    | Array of Function to execute while updating data       |
| `onDelete`    | `Function[]` | `false`  | `[]`    | Array of Function to execute while deleting data       |
| `afterAdd`    | `Function[]` | `false`  | `[]`    | Array of Function to execute after adding data         |
| `afterSet`    | `Function[]` | `false`  | `[]`    | Array of Function to execute after setting data        |
| `afterUpdate` | `Function[]` | `false`  | `[]`    | Array of Function to execute after updating data       |
| `afterDelete` | `Function[]` | `false`  | `[]`    | Array of Function to execute after deleting data       |

#### `model` {Object}
The representation of the Model that will be used through data parsing. The `model` could also have nested key.

Each key of the Model object must be a correct [FireData Type Definition](#firedata-type-definition) (as described above).

```js
{
  name: '!String',
  surname: '?String',
  phone: '?String',
  email: '?String'
  address: {
    street: '?String',
    streetNumber: '?Number',
    city: '?String',
    postCode: '?String',
    district: '?String',
    country: '?String'
  }
}
```

#### `paths` {Object[]}
Paths key is required to let the talker know where add/set/update/delete the data. Path string can contain _placeholder_, like `data/$team/contact`. All the placeholder must be defined using the [`Talker.$path`](#pathplaceholder) function.

It could contain the following properties.

| Key      | Type       | Required | Default | Description                                                       |
| -------- | ---------- | -------- | ------- | ----------------------------------------------------------------- |
| `hasID`  | `Boolean`  | `false`  | `true`  | Tell the [`Talker`](#talker) that data for this model is ID-based |
| `read`   | `String`   | `true`   |         | The main Read/Write path for the Model                            |
| `writes` | `Object[]` | `false`  |         | All the path where write data                                     |

##### `read` {String} <!-- omit in toc -->
The main Model path. It is the path where the model will add data or where it will read and parse data while getting it. It will be auto-added to writes path array
##### `hasID` {Boolean=true} <!-- omit in toc -->
Setting the `hasID` to `true` will tell the [`Talker`](#talker) that the model is an Array of Firebase Node. If you have a list of `Contact` for example it must be set to true. Else, if you are managing some other properties without an ID it must be set to false.
##### `writes` {Object[]} <!-- omit in toc -->
An array of the path where [`Talker`](#talker) will update data. Each path Object could contain
- `ref` {String} Required path reference
- `queryOn` {[String]} The field to use to build the query for data and get only the data to update
- `writeChild` {[String]} The child into put the updated data
- `snapFilter` {[Function]} A function to execute to evaluate if the child could be updated. If the function returns false, the child will be skipped and not updated
- `model` {[String]} The model to use, must be an `Extractor` (you could read more on extractor later)

Example
```js
{
  paths: {
    hasID: true,
    read: 'data/company',
    writes: [
      /**
       * This instruction will tell the model that on Company update must do
       * a query on ref 'data/contact' ordered by child 'companyID' equal to
       * the updating Company ID and write the data on child 'company'
       */
      { ref: 'data/contact', queryOn: 'companyID', writeChild: 'company' }

    ]
  }
}
```

By default, reference path in ID-based structure, the reference ID will be appended to the path so `data/company` on get/update/delete will be transformed automatically in `data/company/$id`. To manually set where the id has to be placed you can define it in the path string. A model referred only to user detail could have the path set to `users/$id/detail`: the model will always be ID-Based but user id will be replaced in the path instead appended at the end.

#### `validators` {Object[]}
Validators key is an Array of object that must contain the following properties

| Key       | Type       | Required | Description                                          |
| --------- | ---------- | -------- | ---------------------------------------------------- |
| `checker` | `Function` | `true`   | Function to Execute, receive parsed data as argument |
| `error`   | `String`   | `true`   | Error to throw back                                  |

##### `checker` {Function} <!-- omit in toc -->
The function to execute to validate data. If function will return `false`, the process stops and the `error` will be thrown through promise rejection. The function will receive parsed data as argument
##### `error` {String} <!-- omit in toc -->
The error to throw if checker function evaluate to `false`. It will be compiled in `modelName/error`

```js
Modeler
  .$model('Contact', {
    model: { ... },
    validators: [
      { error: 'address-missing', $data => $data.address.street || $data.address.city }
    ]
  })

// Later...
$talker.$add('Contact')({ name: 'John', surname: 'Doe' })
  .catch((e) => {
    // e === 'contact/address-missing'
    //         /|
    //          |
    //          |__ Model name is auto prepended
  })
```

#### `formatters` {Function[]}
Formatters are an array of function that will be executed after all Model parsing. Each function will receive as argument the `$data` parsed and must return valid data object transformed.

Example
```js
{
  formatters: [
    ($data) => {
      /**
       * Evaluate Display Name for Contact
       */
      $data.displayName = `${$data.name} ${$data.surname}`.trim()

      /**
       * Return formatted data
       */
      return $data;

    }
  ]
}
```
Formatters function __mustn't__ be `async function` as they are evaluated in sync mode!

#### `onAdd | onSet | onGet | onUpdate | onDelete` {Function[]}
Array of hook function to execute on `Model` event. Each function will receive as parameters the the parsed data (`null` on [\$delete](#deletemodelname)) and `$id` (if exists, else `undefined`). This function won't change data sendend to Firebase.
Each functions are executed at the same time but they could be `Promise` function. [`Talker`](#talker) operation will wait until all function will be executed before update data on Firebase.

The `this` of the Hook function refers to the [`Talker`](#talker) instance.

#### `afterAdd | afterSet | afterUpdate | afterDelete` {Function[]}
Array of hook function to execute on `Model` event. Each function will receive as parameters the the parsed data (a raw copy of deleting data will be passed on [\$delete](#deletemodelname)) and `$id` (if exists, else `undefined`). This function won't change data that will be sended to Firebase.
Each functions are executed at the same time but they could be `Promise` function. [`Talker`](#talker) operation will wait until all function will be executed before update data on Firebase.

The `this` of the Hook function refers to the [`Talker`](#talker) instance.

### $extractor(_name_, _constructor_)
An extractor is a simple model that will extract data from a father model to write only certain data to Database instead of all field.
It could be used to save some basic information of the father model to some linked child.

Example
```js
/**
 * Suppose the Company Model is more complex than the previous example
 * and that we want to save only the company name and email into the Contact node.
 * In this case we could use an extractor
 */

Modeler
  .$model('Company', { /* Complex company structure */ })
  .$extractor('CompanyCompressed', {
    model: 'Company',   // Model to use
    extract: {          // Data to Extract
      name: '!',
      email: '?reference.email'   // we could set the object path to take data
    }
  })

/**
 * When we declare the contact model
 * we can use the extractor instead of the complete model
 * to save only name and email
 */
Modeler
  .$model('Contact', {
    model: {
      /**
       * ... all contact model definition
       */
      company: 'CompanyCompressed:companyID'  // tell the modeler to use CompanyCompressed
    }
  })
```
The extractor _constructor_ could have the following properties

| Key          | Type         | Required | Default | Description                                            |
| ------------ | ------------ | -------- | ------- | ------------------------------------------------------ |
| `model`      | `String`     | `true`   |         | Model Rapresentation                                   |
| `extract`    | `Object`     | `true`   |         | Key to Extract from father model                       |
| `validators` | `Object[]`   | `false`  | `[]`    | Array of Validator functions to execute during parsing |
| `formatters` | `Function[]` | `false`  | `[]`    | Array of Function to format the Data                   |

#### `model` {String}
The name of the model to use and extract data
#### `extract` {Object}
The key to extract from the model. Each key must be a `string`, to set optionality must start with `?` char, to set to required must start with `!`. It could contain the object key path into take the value.

Example
```js
/**
 * This will extract the value from { reference: { email: 'xxx@gmail.com' } }
 */
'?reference.email'
```
#### `validators` {Object[]}
Same as Model validators property described above
#### `formatters` {Function[]}
Same as Model formatters property described above

### $parser(_name_, _constructor_)
A simple object parser that contains only the Model and that will return a parsed object without writing data on Database. The constructor must contain only the `model`{Object} key that will be evaluated like the `model` of the [`$model`](#model-object) Function

### $function(_name_, _function_, _priority_)
Declare a function that could be used into Model Constructor as [`FireData Type`](#firedata-type-definition).
Name of the function must obviously be unique into the Model instance.

The function will be called binding the `this` to the parsed model (after evaluating all other fields). It could return a value or a `Promise` that will be resolved with the value to store into the field. If the `Promise` will be rejected, all the parsing process will fail.

```js
/**
 * Simple declaration of a function
 * that will return the current timestamp
 */
Modeler
  .$function('Now', () => Date.now())
```

You can define Function priority execution. All default Functions are executed with default `priority === 1000`. Lower priority functions will be executed after higher priority functions. It means that you want to execute a function after another function you can set priority to a lower value

```js
Modeler
  .$model('SomeModel', {
    model: {
      now: '>Now()',
      tomorrow: '>Tomorrow():now'
    },
    paths: {
      ...
    }
  })

  .$function('Now', () => Date.now())

  /**
   * Priority 900 will be executed after default priority 1000
   * it means that when Tomorrow function will be called, your are sure
   * that Now result as been written
   */
  .$function('Tomorrow', ($date) => moment($date).add(1, 'd'), 900);

```

### $filter(_name_, _function_)
A function declaration that can be used to transform the field. The function will receive as first argument the current parsed value of the field and as last argument the instance of the [`Talker`](#talker). Any other arguments specified are passed to the function as `String`.

The `this` of the function is the complete parsed object

Filter functions are evaluated in sync mode, then they mustn't be a `Promise`
```js
Modeler
  .$filter('startOf', (value, type) => {
    /**
     * value === 'date' field
     * type === 'day' as String
     */

    /**
     * this filter will use moment to return always
     * the timestamp of start of 'day'
     */
    return moment(value).startOf(type).valueOf();

  })
```

## Talker
__Talker__ is the main object that let you get/write data on Firebase Database.

To use the __Talker__ you have to get it from [`Modeler`](#modeler)

```js
const Talker = Modeler.Talker(...params)
```

### Loading Talker
You have to way to build the talker

1. Loading the talker using your JSON file with Firebase Admin credential
   ```js
   const FirebaseAdminCredential = require('./path/to/firebase-admin-credential.json');

   const Talker = Modeler.Talker({ credential: FirebaseAdminCredential, databaseURL: 'https://your-database.firebaseio.com' })

   /**
    * Talker is Ready
    */
   ```
  
2. Using an already loaded FirebaseAdmin
   ```js
   const Admin = require('firebase-admin');
   const AdminCredential = require('./moox-cloud.json');

   Admin.initializeApp({
     credential: Admin.credential.cert(AdminCredential),
     databaseURL: 'https://your-database.firebaseio.com'
   });

   /**
    * Later on your code
    */
   const Talker = Modeler.Talker({ adminInstance: Admin })
   ```

### $path(_placeholder_)
Path function help to manage Path replacer for Firebase Ref. Imagine you have a model like
```json
{
  "data": {
    "team1": {
      "contact": {
        "contact1": { ... },
        "contact2": { ... },
        "contact3": { ... }
      }
    },
    "team2": {
      "contact": {
        "contact1": { ... },
        "contact2": { ... },
        "contact3": { ... }
      }
    }
  }
}
```
To manage contact for the two team you could use path placeholder to build path for Contact Model
```js
Modeler
  .$model('Contact', {
    model: {
      name: '!String',
      surname: '?String'
    },
    paths: {
      hasID: true,
      read: 'data/$team/contact'    // <-- $team is the placeholder
    }
  })


/**
 * Later on your Code you can set
 * the path placeholder using the loaded Talker
 * 
 * Setting path placeholder are without $ char
 * the $ is automatically prepended to avoid error
 * during setting up path replacers
 */
Talker.$path('team').replace('team2');

/**
 * Now the Talker will work replacing $team
 * placeholder in path with 'team2'
 * So John Doe contact will be added into data/team2/contact node
 */
Talker.$add('Contact')({ name: 'John', surname: 'Doe' })
```

Path function require the _placeholder_ param that is a `String` corresponding to placeholder. It return a set of function to manage the placholder
#### replace(_replacer_)
Set the replacer for the _placeholder_
```js
Talker.$path('team').replace('team2');

/**
 * $team placeholder into path now will be
 * replaced with team2
 */
```

#### get()
Get the replacer for the placeholder
```js
Talker.$path('team').get() === 'team2'
```

#### delete()
Delete a setted placeholder

### $parse(_modelName_)
Return a function that could be used to parse object using a model

The returned function is a `Promise`, resolved once data has been correctly parsed

```js
const ContactParser = Talker.$parse('Contact');

ContactParser({ name: 'Tom', surname: 'Hanks', foo: 'bar' })
  .then(($parsed) => {
    /**
     * $parsed = {
     *  name: 'Tom',
     *  surname: 'Hanks',
     *  displayName: 'Tom Hanks'
     * }
     */
  });
```

### $add(_modelName_)
Return a function that could be used to add data on Firebase Database.

The returned function is a `Promise`, resolved with the `$id` of the new data on Firebase.

This function is restricted to Model that are ID-Based and could not be used with Model without ID.

```js
const ContactAdder = Talker.$add('Contact');

ContactAdder({ name: 'Harrison', surname: 'Ford' })
  .then(($id) => {
    /**
     * $id === ID of new Data
     */
  })
```

### $set(_modelName_)
Return a function that could be used to set data on Firebase Database.

The returned function is a `Promise`, resolved once data has been correctly set.

This function is restricted to Models that are not ID-Based and could not be used with Model with ID.

```js
const SettingsSetter = Talker.$set('Settings');

SettingsSetter({ currency: 'EUR' })
  .then(() => {
    /**
     * Operation Completed
     */
  })
```

### $update(_modelName_)
Return a function that could be used to update data on Firebase Database.

The returned function is a `Promise`, resolved once data has been correctly set, fulfilled with an object with only updated data.

Invoking this function will update not only the original contact but also all other data setted in `writes` Array of Model Constructor. If writes path contains some query you can filter snap using [`snapFilter`](#paths-object) function to skip data update in certain case

```js
const ContactUpdater = Talker.$update('Contact');

ContactUpdater($harrisonFordID, { name: 'Henry', surname: 'Ford' })
  .then(($updated) => {
    /**
     * $updated = {
     *  name: 'Henry'
     * }
     */
  })
```

### $get(_modelName_)
Return a function that could be used to get data from Firebase Database.

The returned function is a `Promise` fulfilled with received data

```js
const ContactGetter = Talker.$get('Contact');

ContactGetter($harrisonFordID)
  .then(($contact) => {
    /**
     * $contact = {
     *  name: 'Henry',
     *  surname: 'Ford',
     *  displayName: 'Henry Ford'
     * }
     */
  })
```

### $delete(_modelName_)
Return a function that could be used to delete data from Firebase Database.

The returned function is a `Promise` resolved on data deleted.

Invoking this function will delete not only the original contact but also all other data setted in `writes` Array of Model Constructor. If writes path contains some query you can filter snap using [`snapFilter`](#paths-object) function to skip data update in certain case

```js
const ContactDeleter = Talker.$delete('Contact');

ContactDeleter($harrisonFordID)
  .then(() => {
    /**
     * Operation Complete
     */
  })
```

### $drop(_modelName_)
Drop entire node of a Model, removing all data from Firebase Database.

No bounded/referenced data will be deleted, only the original one.

```js
/**
 * Drop Contact to delete
 * all Contact data
 */

Talker.$drop('Contact');
```

### $destroy()
Destroy the [`Talker`](#talker) instance. After invoking this method no function could be used. This is useful on ExpressJS (or any other way to build WebServer with NodeJS) to destroy the `WeakMap` associated to the Talker instance and free used memory.

Example Using ExpressJS
```js
/**
 * On your Path Route
 */
App.use((req, res, next) => {
  /**
   * Build the Talker and append to res object
   */
  res.$talker = Modeler.Talker({ adminInstance: FirebaseAdmin });

  /**
   * Listen for Finish
   */
  res.on('finish', () => {
    /**
     * Unload the Talker
     */
    res.$talker.$destroy();

  })
})
```

## Built With

* [FirebaseAdminSDK](https://github.com/firebase/firebase-admin-node) - Official Firebase SDK

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags). 

## Authors

* **Marco Cavanna** - *Producer*
* **Matteo Ballarini** - *Documentation, review and tester*

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details