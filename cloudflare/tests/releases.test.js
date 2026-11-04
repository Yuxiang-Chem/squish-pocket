import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolatedTargets,requireTestedCandidate,sourceDigest} from '../scripts/release.mjs';

test('test deployment uses separate resources and the shared game source',()=>{
  assert.doesNotThrow(assertIsolatedTargets);
});
test('official promotion requires a verified matching test candidate and explicit version',()=>{
  const receipt={verified:true,worker:'squish-pocket-test',url:'https://squish-test.chemisgreat.online',version:'tested-version',sourceDigest:'tested-source'};
  assert.throws(()=>requireTestedCandidate(null,'tested-source','tested-version'),/test release first/);
  assert.throws(()=>requireTestedCandidate({...receipt,verified:false},'tested-source','tested-version'),/test release first/);
  assert.throws(()=>requireTestedCandidate(receipt,'tested-source',null),/tested version explicitly/);
  assert.throws(()=>requireTestedCandidate(receipt,'edited-source','tested-version'),/Source changed/);
  assert.throws(()=>requireTestedCandidate({...receipt,worker:'squish-pocket'},'tested-source','tested-version'),/test release first/);
  assert.doesNotThrow(()=>requireTestedCandidate(receipt,'tested-source','tested-version'));
});
test('release fingerprints are stable for the same game source',()=>{
  const digest=sourceDigest();assert.match(digest,/^[a-f0-9]{64}$/);assert.equal(sourceDigest(),digest);
});
