# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## `1.0.2` - 2018-11-02
### `Added`
- [`<580ce115>`](https://github.com/marcocavanna/FireDataModeler/#)  This CHANGELOG file to keep change updated
- [`<580ce115>`](https://github.com/marcocavanna/FireDataModeler/#) `$id` can be added in path to get and parse child data, a this moment, id placeholder inside path string can be used in `$get` functions only and will produce an error while `$add` or `$set` data<br><br>
  ```js
  Modeler.$model('UserDetail', {
    model: {
      name: '?String',
      surname: '?String',
      email: '?String'
    },
    paths: {
      hasID: true,
      read: 'users/$id/detail'
    }
  });
  ```

### `Fixed`
- [`<7afb36f>`](https://github.com/marcocavanna/FireDataModeler/commit/7afb36fe54f523f387bbab71d3f24279f2fb80a8) Fixed an error when loading an existance Firebase Admin object during Talker initialization

## `1.0.1` - 2018-11-01
### `Added`
- [`<4969ad4>`](https://github.com/marcocavanna/FireDataModeler/commit/d969ad49c040ba5a9e5db4445460395a25928fa8) `Talker` instance appendend to Function evaluated fields Arguments<br><br>
  ```js
  // Talker instance is always the last arguments
  Modeler.$function('UID', Talker => Talker.$path('uid').get() )
  ```
- [`<802f0c2>`](https://github.com/marcocavanna/FireDataModeler/commit/802f0c27fd883484d990946ab892a7af3cb4e25e) `Talker.$path(<placeholder>).get()` : Return replacer for a path placeholder<br><br>
  ```js
  Talker.$path('uid').replace(userUID);

  // Later on your code
  const $uid = Talker.$path('uid').get();
  ```

## [`1.0.0`](https://github.com/marcocavanna/FireDataModeler/commit/0db0fce2d16eb4cfe1bd274edf49272de5914e79) - 2018-10-31
### First Package Publish