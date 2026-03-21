import assert from 'node:assert/strict';
import {
  RPC_VERSION,
  rpcRequestEnvelopeSchema,
  rpcResponseEnvelopeSchema,
} from '../src/shared/rpc/schema.js';

// ---------------------------------------------------------------------------
// rpcRequestEnvelopeSchema
// ---------------------------------------------------------------------------

function testRequestEnvelopeValidation(): void {
  // Valid request
  const valid = {
    v: RPC_VERSION,
    kind: 'rpc-request',
    id: 'test-123',
    method: 'GET_TREE',
    input: { treeId: 'abc' },
  };
  const result = rpcRequestEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true, 'valid request should parse');
  if (result.success) {
    assert.equal(result.data.method, 'GET_TREE');
    assert.deepEqual(result.data.input, { treeId: 'abc' });
  }

  // Input defaults to empty object
  const noInput = {
    v: RPC_VERSION,
    kind: 'rpc-request',
    id: 'test-456',
    method: 'UNDO',
  };
  const noInputResult = rpcRequestEnvelopeSchema.safeParse(noInput);
  assert.equal(noInputResult.success, true, 'request without input should default to {}');
  if (noInputResult.success) {
    assert.deepEqual(noInputResult.data.input, {});
  }

  console.log('  [PASS] valid request envelopes');
}

function testRequestEnvelopeRejection(): void {
  // Wrong version
  const wrongVersion = {
    v: 999,
    kind: 'rpc-request',
    id: 'test',
    method: 'GET_TREE',
  };
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse(wrongVersion).success,
    false,
    'wrong version should be rejected',
  );

  // Wrong kind
  const wrongKind = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test',
    method: 'GET_TREE',
  };
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse(wrongKind).success,
    false,
    'wrong kind should be rejected',
  );

  // Empty id
  const emptyId = {
    v: RPC_VERSION,
    kind: 'rpc-request',
    id: '',
    method: 'GET_TREE',
  };
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse(emptyId).success,
    false,
    'empty id should be rejected',
  );

  // Empty method
  const emptyMethod = {
    v: RPC_VERSION,
    kind: 'rpc-request',
    id: 'test',
    method: '',
  };
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse(emptyMethod).success,
    false,
    'empty method should be rejected',
  );

  // Not an object
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse('string').success,
    false,
    'string should be rejected',
  );
  assert.equal(
    rpcRequestEnvelopeSchema.safeParse(null).success,
    false,
    'null should be rejected',
  );

  console.log('  [PASS] invalid request envelopes rejected');
}

// ---------------------------------------------------------------------------
// rpcResponseEnvelopeSchema
// ---------------------------------------------------------------------------

function testSuccessResponseValidation(): void {
  const valid = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test-123',
    method: 'GET_TREE',
    success: true,
    data: { tree: { id: 'abc' } },
  };
  const result = rpcResponseEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true, 'valid success response should parse');
  if (result.success) {
    assert.equal(result.data.success, true);
    if (result.data.success) {
      assert.deepEqual(result.data.data, { tree: { id: 'abc' } });
    }
  }

  // Data can be null/undefined
  const nullData = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test-456',
    method: 'UNDO',
    success: true,
    data: null,
  };
  assert.equal(
    rpcResponseEnvelopeSchema.safeParse(nullData).success,
    true,
    'null data should be accepted',
  );

  console.log('  [PASS] valid success response envelopes');
}

function testErrorResponseValidation(): void {
  const valid = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test-123',
    method: 'GET_TREE',
    success: false,
    error: 'Tree not found',
  };
  const result = rpcResponseEnvelopeSchema.safeParse(valid);
  assert.equal(result.success, true, 'valid error response should parse');
  if (result.success) {
    assert.equal(result.data.success, false);
    if (!result.data.success) {
      assert.equal(result.data.error, 'Tree not found');
    }
  }

  // Empty error string rejected
  const emptyError = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test',
    method: 'GET_TREE',
    success: false,
    error: '',
  };
  assert.equal(
    rpcResponseEnvelopeSchema.safeParse(emptyError).success,
    false,
    'empty error string should be rejected',
  );

  console.log('  [PASS] error response envelopes');
}

function testResponseEnvelopeRejection(): void {
  // Missing success field
  const noSuccess = {
    v: RPC_VERSION,
    kind: 'rpc-response',
    id: 'test',
    method: 'GET_TREE',
  };
  assert.equal(
    rpcResponseEnvelopeSchema.safeParse(noSuccess).success,
    false,
    'missing success should be rejected',
  );

  // Wrong version
  assert.equal(
    rpcResponseEnvelopeSchema.safeParse({
      v: 1,
      kind: 'rpc-response',
      id: 'test',
      method: 'X',
      success: true,
      data: null,
    }).success,
    false,
    'wrong version should be rejected',
  );

  console.log('  [PASS] invalid response envelopes rejected');
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------

console.log('RPC Schema Tests:');
testRequestEnvelopeValidation();
testRequestEnvelopeRejection();
testSuccessResponseValidation();
testErrorResponseValidation();
testResponseEnvelopeRejection();
console.log('All RPC schema tests passed!');
