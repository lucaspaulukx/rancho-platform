// Usage: node compile-templates.cjs <path-to-ember-2.9.1-template-compiler.js>
// Compiler: https://cdnjs.cloudflare.com/ajax/libs/ember.js/2.9.1/ember-template-compiler.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const compilerPath = path.resolve(process.argv[2]);
const expected = '4e5340a5346b3db819732623ffa86eb40d4d3a65628fc4ad76e1a092c330af46';
if (crypto.createHash('sha256').update(fs.readFileSync(compilerPath)).digest('hex') !== expected) {
  throw new Error('Expected the verified Ember 2.9.1 template compiler.');
}
const compiler = require(compilerPath);
const compile = name => compiler.precompile(fs.readFileSync(path.join(__dirname, name + '.hbs'), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'local-rbac-templates.js'),
  'var LOCAL_RBAC_TEMPLATES = {noAccess:' + compile('no-access') + ',localGroups:' + compile('local-groups') + '};');
