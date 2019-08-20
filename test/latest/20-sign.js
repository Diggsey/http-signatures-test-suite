const config = require('../../config.json');
const util = require('./util');
const {expect} = require('chai');
const {registry, keys} = require('./input/algorithms');
const path = require('path');

// base64 string should only consist of letters,
// numbers, and end with an = sign.
const base64Signature = /signature=[\"\'][a-z0-9=\/\+]+[\"\']/i;
const privateKeys = Object.keys(keys.private);
const rsaPrivateKey = path.join(__dirname, '../keys/rsa.private');
const rsaKeyType = 'rsa';

function commonOptions(options) {
  options.args['private-key'] = rsaPrivateKey;
  options.args['headers'] = 'digest';
  options.args['algorithm'] = 'hs2019';
  options.args['key-type'] = rsaKeyType;
  options.args['keyId'] = 'test';
  return options;
}

describe('Sign', function() {
  let generatorOptions = null;
  beforeEach(function() {
    generatorOptions = {
      generator: config.generator,
      command: 'sign',
      args: {},
      date: new Date().toGMTString(),
    };
  });

  it(`A client MUST generate a signature by base 64 encoding
      the output of the digital signature algorithm.`, async function() {
    // The `signature` is then generated by base 64
    // encoding the output of the digital signature algorithm.
    const options = commonOptions(generatorOptions);
    const result = await util.generate(
      'default-test', options);
    expect(result, 'Expected sign to return a Signature').to.exist;
    result.should.match(base64Signature);
  });
  it(`A client MUST use the headers and algorithm values as
      well as the contents of the HTTP message,
      to create the signature string.`, async function() {
    const options = commonOptions(generatorOptions);
    options.args['headers'] = 'date';
    const result = await util.generate(
      'basic-request', options);
    expect(result, 'Expected sign to return a Signature').to.exist;
    result.should.match(base64Signature);
  });

  describe('Algorithm Parameter', function() {

    it(`MUST produce an error if algorithm
        parameter differs from key metadata.`, async function() {
      /**
       * If `algorithm` is provided and differs from
       * the key metadata identified by the `keyId`,
       * for example `rsa-sha256` but an EdDSA key
       * is identified via `keyId`,
       * then an implementation MUST produce an error.
      */
      const options = commonOptions(generatorOptions);
      options.args['key-type'] = 'unknown';
      let error = null;
      try {
        await util.generate('basic-request', options);
      } catch(e) {
        error = e;
      }
      expect(error, 'Expected an error to be thrown.')
        .to.not.be.null;
    });

    it(`Signature scheme MUST be in the
        HTTP Signatures Algorithms Registry.`, async function() {
      const options = commonOptions(generatorOptions);
      options.args['headers'] = 'date';
      options.args['algorithm'] = 'unknown';
      let error = null;
      try {
        await util.generate('basic-request', options);
      } catch(e) {
        error = e;
      }
      expect(error,
        'Expected an error to be thrown.')
        .to.not.be.null;
    });

    describe('Signature scheme', function() {
      registry.forEach(({scheme, deprecated}) => {
        if(deprecated) {
          it(`MUST reject deprecated algorithm ${scheme}.`, async function() {
            let error = null;
            generatorOptions.args['private-key'] = path.join(
              __dirname, '../keys/test_ed');
            generatorOptions.args['headers'] = 'date';
            generatorOptions.args['algorithm'] = scheme;
            generatorOptions.args['key-type'] = 'ed25519';
            generatorOptions.args['keyId'] = 'test';
            try {
              await util.generate('basic-request', generatorOptions);
            } catch(e) {
              error = e;
            }
            expect(error,
              `Expected deprecated algorithm ${scheme}
               to be rejected`).to.not.be.null;
          });
        } else {
          it(`MUST sign for algorithm ${scheme}.`, async function() {
            generatorOptions.args['private-key'] = path.join(
              __dirname, '../keys/rsa.private');
            generatorOptions.args['headers'] = 'date';
            generatorOptions.args['algorithm'] = scheme;
            generatorOptions.args['key-type'] = 'rsa';
            generatorOptions.args['keyId'] = 'test';
            const result = await util.generate(
              'basic-request', generatorOptions);
            result.should.match(base64Signature);
          });
        }
      });
    });
  });


  it(`MUST NOT process a Signature with a
      created timestamp value that is in the future.`, async function() {
    /**
     * A signature with a `created` timestamp value
     * that is in the future MUST NOT be processed.
    */
    let error = null;
    const options = commonOptions(generatorOptions);
    options.args['headers'] = 'date';
    options.args['created'] = util.getUnixTime() + 1000;
    try {
      await util.generate('default-test', options);
    } catch(e) {
      error = e;
    }
    expect(error, 'Expected an Error').to.not.be.null;
  });

  it(`MUST NOT process a Signature with an expires
      timestamp value that is in the past.`, async function() {
    /**
      * A signatures with a `expires` timestamp
      * value that is in the past MUST NOT be processed.
    */
    let error = null;
    const options = commonOptions(generatorOptions);
    options.args['headers'] = 'date';
    options.args['expires'] = util.getUnixTime() - 1000;
    try {
      await util.generate('default-test', options);
    } catch(e) {
      error = e;
    }
    error.should.not.be.null;
  });
  describe('optional Private Keys', function() {
    privateKeys.forEach(key => {
      it(`should sign with a/an ${key} private key.`, async function() {
        const filePath = path.join(__dirname, '..', 'keys', keys.private[key]);
        generatorOptions.args['private-key'] = filePath;
        generatorOptions.args['headers'] = ['host', 'digest'];
        generatorOptions.args['algorithm'] = 'hs2019';
        generatorOptions.args['key-type'] = key;
        generatorOptions.args['keyId'] = 'test';
        const result = await util.generate(
          'default-test', generatorOptions);
        expect(result, 'Expected sign to return a Signature').to.exist;
        result.should.match(base64Signature);
      });
    });
  });
});
